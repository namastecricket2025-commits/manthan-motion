import { Loader2, Mic, MicOff, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * AI Voice Tutor.
 *
 * A single circular mic owns the state: press it and the sine wave swells,
 * the halo locks on and the log starts taking turns; press it again and the
 * wave settles back to its idle drift. The transcript below is a real log —
 * every line in it was produced by a turn in this session.
 */

interface Turn {
  id: number;
  from: "user" | "tutor";
  text: string;
}

const PROMPTS: { label: string; reply: string }[] = [
  {
    label: "Explain the quadratic formula",
    reply:
      "Start from the completed-square step. Move the constant across, divide by a, then add (b/2a) squared to both sides. Everything collapses to x = (−b ± √(b² − 4ac)) / 2a. The discriminant under the root decides whether the parabola meets the x-axis twice, once, or not at all.",
  },
  {
    label: "Walk me through Newton's second law",
    reply:
      "F = m a only holds for a constant mass and a net force. Draw the free-body diagram first, resolve along the direction of motion, then write the net force as the vector sum. Acceleration always points the same way as that net force — never the other way round.",
  },
  {
    label: "Quiz me on cell organelles",
    reply:
      "Question one: which organelle produces ATP through oxidative phosphorylation? Question two: which structure controls what enters and leaves the cell? Answer both out loud, then I will tell you where the marks are usually lost.",
  },
  {
    label: "Summarise this notebook",
    reply:
      "I will read your sources in order. Give me one moment — meanwhile, tell me whether you are revising for a school test or an entrance paper, because that changes what I keep and what I drop.",
  },
];

/** Fluid sine wave: one rAF, one path, amplitude eased on activation. */
function SineWave({ active }: { active: boolean }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let raf = 0;
    let phase = 0;
    let amplitude = 5;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const target = activeRef.current ? 26 : 5;
      amplitude += (target - amplitude) * Math.min(1, dt * 4.5);
      phase += dt * (activeRef.current ? 4.4 : 1.1);

      const points: string[] = [];
      const samples = 64;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const envelope = Math.sin(t * Math.PI);
        const y =
          40 -
          Math.sin(t * Math.PI * 4 + phase) * amplitude * envelope -
          Math.sin(t * Math.PI * 9 - phase * 1.6) * amplitude * 0.28 * envelope;
        points.push(`${(t * 320).toFixed(1)},${y.toFixed(1)}`);
      }
      const path = pathRef.current;
      if (path) path.setAttribute("d", `M${points.join(" L")}`);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 320 80"
      className="h-20 w-full max-w-md"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        fill="none"
        stroke="var(--signal)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VoiceTutor({
  notebookName,
  onClose,
}: {
  notebookName: string;
  onClose: () => void;
}) {
  const [live, setLive] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 0,
      from: "tutor",
      text: `Voice Tutor ready. I have ${notebookName} open — ask out loud, or pick a prompt below.`,
    },
  ]);
  const idRef = useRef(1);
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, thinking]);

  function ask(label: string, reply: string) {
    setTurns((current) => [
      ...current,
      { id: idRef.current++, from: "user", text: label },
    ]);
    setThinking(true);
    const timer = window.setTimeout(() => {
      setTurns((current) => [
        ...current,
        { id: idRef.current++, from: "tutor", text: reply },
      ]);
      setThinking(false);
    }, 950);
    timers.current.push(timer);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.34, ease: [0.25, 1, 0.5, 1] }}
      className="premium-glass flex flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">
            Manthan Prime workspace
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
            AI Voice Tutor
          </h2>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-text-dim">
            A tutor that speaks. Hold the mic, ask in your own words, and the
            turns land in the transcript below.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-dim transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      {/* Mic + reactive wave */}
      <div className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[var(--glass-line)] px-4 py-6">
        <SineWave active={live} />
        <button
          type="button"
          aria-pressed={live}
          aria-label={live ? "Stop the voice tutor" : "Start the voice tutor"}
          onClick={() => setLive((current) => !current)}
          className={"voice-mic" + (live ? " is-live" : "")}
        >
          {live && (
            <motion.span
              className="voice-halo"
              animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {live ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
        </button>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-dim">
          {live ? "Listening" : "Tap to speak"}
        </p>
      </div>

      {/* Transcript */}
      <div className="rounded-2xl border border-[var(--glass-line)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold tracking-tight">
            Transcript
          </h3>
          <span className="text-[11px] text-text-dim">
            {turns.filter((turn) => turn.from === "user").length} question
            {turns.filter((turn) => turn.from === "user").length === 1 ? "" : "s"}
          </span>
        </div>
        <div ref={logRef} className="voice-log mt-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={
                "voice-bubble " +
                (turn.from === "user"
                  ? "voice-bubble--user ml-auto max-w-[85%] text-right"
                  : "voice-bubble--tutor max-w-[92%]")
              }
            >
              {turn.text}
            </div>
          ))}
          {thinking && (
            <div className="voice-bubble voice-bubble--tutor flex items-center gap-2 text-text-dim">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working through it
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => ask(prompt.label, prompt.reply)}
              className="rounded-full border border-[var(--glass-line)] px-3.5 py-1.5 text-[12px] font-medium text-text-dim transition-all duration-200 hover:border-[color-mix(in_srgb,var(--signal)_50%,transparent)] hover:text-foreground active:scale-[0.98]"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default VoiceTutor;
