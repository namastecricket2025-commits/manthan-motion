import { api } from "@/convex/_generated/api";
import {
  detectStudyTopic,
  fallbackReply,
  pickAviaVoice,
  speakText,
  stopSpeaking,
} from "@/components/voice/avia";
import { Loader2, Mic, MicOff, Square, Volume2, X } from "lucide-react";
import { useAction } from "convex/react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * AI Voice Tutor — the notebook's spoken tutor.
 *
 * This panel is the same tutor as the floating orb, in the place the student is
 * already working. It listens through the browser's own Web Speech API, asks
 * Manthan's model chain (with Avia's personality and Study Switch) and reads
 * the answer back with `speechSynthesis` — so nothing here is scripted, no
 * reply is pre-written, and no API key is needed on the client.
 *
 * It used to be a mock: a mic that only toggled a boolean and four canned
 * answers behind a timeout. Asking anything real produced the same handful of
 * paragraphs, which is exactly what a voice tutor must never do.
 *
 * The notebook name travels with every question so answers stay anchored to the
 * chapter that is open.
 */

interface Turn {
  id: number;
  from: "user" | "tutor";
  text: string;
}

/** Openers for a cold panel. Sending one asks the real question. */
const STARTERS = [
  "Explain the hardest idea in this notebook",
  "Quiz me on this notebook",
  "Walk me through a worked example",
  "What should I revise first?",
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
  const askAvia = useAction(api.ai.aviaReply);

  const [live, setLive] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [studying, setStudying] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel] = useState("device voice");
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 0,
      from: "tutor",
      text: `Voice Tutor ready. ${notebookName} is open — ask out loud, or type below.`,
    },
  ]);

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const queuedRef = useRef(0);
  const logRef = useRef<HTMLDivElement | null>(null);
  const studyingRef = useRef(false);
  const thinkingRef = useRef(false);
  const mountedRef = useRef(true);

  turnsRef.current = turns;
  studyingRef.current = studying;
  thinkingRef.current = thinking;

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  /* ---------------- voice selection ---------------- */

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    const load = () => {
      const picked = pickAviaVoice(synth.getVoices());
      voiceRef.current = picked;
      setVoiceLabel(
        picked ? picked.name.replace(/^(Microsoft|Google)\s+/i, "") : "device voice",
      );
    };

    load();
    synth.addEventListener?.("voiceschanged", load);
    // Safari populates the list late and fires nothing when it does.
    const late = window.setTimeout(load, 800);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(late);
    };
  }, []);

  /* ---------------- speaking ---------------- */

  const say = useCallback((text: string, interrupt = true, onDone?: () => void) => {
    queuedRef.current += 1;
    setSpeaking(true);
    speakText(
      text,
      voiceRef.current,
      () => {
        queuedRef.current = Math.max(0, queuedRef.current - 1);
        if (queuedRef.current === 0 && mountedRef.current) setSpeaking(false);
        onDone?.();
      },
      interrupt,
    );
  }, []);

  const hush = useCallback(() => {
    stopSpeaking();
    queuedRef.current = 0;
    setSpeaking(false);
  }, []);

  /* ---------------- conversation ---------------- */

  const addTurn = useCallback((from: Turn["from"], text: string) => {
    setTurns((current) => [...current, { id: idRef.current++, from, text }]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || thinkingRef.current) return;

      addTurn("user", message);
      setNote(null);

      const academic = detectStudyTopic(message);
      const nextStudying = studyingRef.current || academic;
      if (nextStudying && !studyingRef.current) setStudying(true);

      setThinking(true);
      const history = turnsRef.current.slice(-8).map((turn) => ({
        role: (turn.from === "user" ? "student" : "avia") as "student" | "avia",
        text: turn.text,
      }));

      try {
        const result = await askAvia({ message, history, studying: nextStudying });
        if (!mountedRef.current) return;
        addTurn("tutor", result.reply);
        if (result.mode === "tutoring" || nextStudying) setStudying(true);
        say(result.reply, false);
      } catch {
        const reply = fallbackReply(nextStudying);
        if (!mountedRef.current) return;
        addTurn("tutor", reply);
        say(reply, false);
      } finally {
        if (mountedRef.current) setThinking(false);
      }
    },
    [addTurn, askAvia, say],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  /* ---------------- listening ---------------- */

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLive(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setNote(
        "This browser can't listen in — Chrome, Edge and Safari can. Type your question below instead.",
      );
      return;
    }
    if (recognitionRef.current) {
      stopListening();
      return;
    }

    stopSpeaking();
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setLive(true);
      setNote(null);
    };
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex] ?? event.results[0];
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) void sendRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setLive(false);
      recognitionRef.current = null;
      setNote(
        event.error === "not-allowed"
          ? "Microphone permission is needed to hear you. Allow it in the address bar, or type below."
          : "I didn't catch that. Give the mic another tap and speak clearly.",
      );
    };
    recognition.onend = () => {
      setLive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [stopListening]);

  /* ---------------- lifecycle ---------------- */

  useEffect(() => {
    // Set on mount as well as cleared on unmount: StrictMode mounts, cleans up
    // and mounts again in development, so a cleanup-only flag would latch to
    // false and silently swallow every reply.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, thinking, note]);

  const questions = turns.filter((turn) => turn.from === "user").length;

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
            A tutor that speaks. Tap the mic, ask in your own words, and the
            answer is read back turn by turn. {voiceLabel} · pitch 1.0 · rate 1.05
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
        <SineWave active={live || speaking} />
        <button
          type="button"
          aria-pressed={live}
          aria-label={live ? "Stop the voice tutor" : "Start the voice tutor"}
          onClick={startListening}
          className={"voice-mic" + (live ? " is-live" : "")}
        >
          {live && (
            <motion.span
              className="voice-halo"
              animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {live ? (
            <Square className="h-6 w-6" />
          ) : supported ? (
            <Mic className="h-7 w-7" />
          ) : (
            <MicOff className="h-7 w-7" />
          )}
        </button>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-dim">
          {live
            ? "Listening"
            : thinking
              ? "Thinking"
              : speaking
                ? "Speaking"
                : "Tap to speak"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {speaking && (
            <button
              type="button"
              onClick={hush}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-line)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-foreground"
            >
              <Volume2 className="h-3 w-3" />
              Quiet
            </button>
          )}
          {studying && (
            <span className="rounded-full border border-[color-mix(in_srgb,var(--signal)_40%,transparent)] px-3 py-1 text-[11px] font-medium text-[var(--signal)]">
              Locked in
            </span>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="rounded-2xl border border-[var(--glass-line)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold tracking-tight">
            Transcript
          </h3>
          <span className="text-[11px] text-text-dim">
            {questions} question{questions === 1 ? "" : "s"}
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

        {note && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-text-dim">
            {note}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendRef.current(`${prompt} (${notebookName})`)}
              className="rounded-full border border-[var(--glass-line)] px-3.5 py-1.5 text-[12px] font-medium text-text-dim transition-all duration-200 hover:border-[color-mix(in_srgb,var(--signal)_50%,transparent)] hover:text-foreground active:scale-[0.98]"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft;
            setDraft("");
            void sendRef.current(value);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Or type a question…"
            aria-label="Type a question for the voice tutor"
            className="min-w-0 flex-1 rounded-full border border-[var(--glass-line)] bg-transparent px-4 py-2.5 text-[16px] outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)] sm:text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || thinking}
            className="rounded-full border border-[var(--glass-line)] px-4 py-2.5 text-[13px] font-semibold transition-colors hover:border-[var(--signal)] disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </div>
    </motion.section>
  );
}

export default VoiceTutor;
