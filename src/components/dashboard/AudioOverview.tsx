import { useAction } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Audio overview.
 *
 * The script is generated from the notebook's sources on the server; this
 * component speaks it with the browser's own speech engine, so there is no key,
 * no upload and no cost. A and B get different voices (or, when the browser has
 * only one, different pitch and rate), which is enough for the "two classmates
 * revising" format; the transcript stays in front of the student so nothing is
 * only audible.
 */

type Style = "duo" | "solo";

interface Segment {
  speaker: "A" | "B";
  text: string;
}

interface Overview {
  title: string;
  style: Style;
  segments: Segment[];
  sources: string[];
}

function hasDevanagari(text: string) {
  return /[\u0900-\u097F]/.test(text);
}

export function AudioOverview({
  notebookId,
  readyCount,
}: {
  notebookId: Id<"notebooks">;
  readyCount: number;
}) {
  const generate = useAction(api.notebookStudio.audioOverview);
  const [style, setStyle] = useState<Style>("duo");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);

  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const overviewRef = useRef<Overview | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Refs mirror the latest script and voice list for the speech callbacks,
  // which run outside React's render cycle.
  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);

  useEffect(() => {
    voiceRef.current = voices;
  }, [voices]);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      playingRef.current = false;
      synth.cancel();
    };
  }, [supported]);

  const voiceFor = useCallback((speaker: "A" | "B") => {
    const all = voiceRef.current;
    if (!all.length) return undefined;
    const hindi = all.filter((voice) => /^hi/i.test(voice.lang));
    const indian = all.filter((voice) => /^(en|hi)-IN/i.test(voice.lang));
    const pool = hindi.length >= 2 ? hindi : indian.length >= 2 ? indian : all;
    return pool[speaker === "A" ? 0 : Math.min(1, pool.length - 1)];
  }, []);

  const speakFrom = useCallback(
    (start: number) => {
      if (!supported) return;
      const script = overviewRef.current;
      if (!script) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      playingRef.current = true;
      indexRef.current = start;
      setIndex(start);
      setStatus("playing");

      const step = () => {
        if (!playingRef.current) return;
        const segment = overviewRef.current?.segments[indexRef.current];
        if (!segment) {
          playingRef.current = false;
          setStatus("idle");
          setIndex(0);
          return;
        }
        setIndex(indexRef.current);
        const utterance = new SpeechSynthesisUtterance(segment.text);
        const voice = voiceFor(segment.speaker);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-IN";
        }
        // Two distinct voices when the device has them; when it does not, the
        // pitch lift/drop is what keeps the two speakers apart.
        utterance.pitch = segment.speaker === "B" ? 0.84 : 1.03;
        utterance.rate = segment.speaker === "B" ? 1.05 : 0.98;
        utterance.onend = () => {
          if (!playingRef.current) return;
          indexRef.current += 1;
          step();
        };
        utterance.onerror = () => {
          playingRef.current = false;
          setStatus("idle");
        };
        synth.speak(utterance);
      };
      step();
    },
    [supported, voiceFor],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    playingRef.current = false;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setIndex(0);
  }, [supported]);

  const toggle = () => {
    if (!supported) return;
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
      return;
    }
    if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    speakFrom(indexRef.current);
  };

  const run = async () => {
    if (busy) return;
    if (readyCount === 0) {
      setError("Add a readable source first — the overview is written from your sources.");
      return;
    }
    stop();
    setBusy(true);
    setError(null);
    try {
      const reply = await generate({ notebookId, style });
      setOverview(reply);
      indexRef.current = 0;
      setIndex(0);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The audio overview could not be written just now.",
      );
    } finally {
      setBusy(false);
    }
  };

  const progress = overview ? ((index + (status === "idle" ? 0 : 1)) / overview.segments.length) * 100 : 0;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--card-border)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="dashboard-kicker">
            <Headphones className="h-3.5 w-3.5" />
            Audio overview
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-dim">
            Two classmates revise this notebook out loud, or one narrator walks
            it through. Spoken by this device — no audio is uploaded.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {([
          { id: "duo", label: "Two hosts", icon: Users },
          { id: "solo", label: "One narrator", icon: Headphones },
        ] as const).map((option) => {
          const Icon = option.icon;
          const active = style === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setStyle(option.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                (active
                  ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] text-foreground"
                  : "border-[var(--card-border)] text-text-dim hover:text-foreground")
              }
            >
              <Icon className="h-3 w-3" />
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--signal-strong)] px-3 py-1.5 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {overview ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error ? <p className="mt-2 text-[11px] leading-relaxed text-[var(--signal)]">{error}</p> : null}

      {overview ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[12.5px] font-semibold">{overview.title}</p>
            <span className="shrink-0 text-[10px] tabular-nums text-text-dim">
              {Math.min(index + 1, overview.segments.length)} / {overview.segments.length}
            </span>
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-[var(--card-border)]">
            <span
              className="block h-full rounded-full bg-[var(--signal)] transition-[width] duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggle}
              aria-label={status === "playing" ? "Pause the audio overview" : "Play the audio overview"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-foreground transition-colors hover:border-[var(--signal)]"
            >
              {status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => speakFrom(0)}
              aria-label="Restart the audio overview"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-text-dim transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label="Stop the audio overview"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-text-dim transition-colors hover:text-foreground"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            {!supported ? (
              <span className="text-[10.5px] leading-relaxed text-text-dim">
                This browser has no speech engine — the transcript below is the
                full script.
              </span>
            ) : (
              <span className="text-[10.5px] text-text-dim">
                {hasDevanagari(overview.segments.map((s) => s.text).join(" ")) ? "Hindi voices" : "Indian English voices"}
                {voices.length === 0 ? " · loading voices…" : ""}
              </span>
            )}
          </div>

          <ol className="thin-scroll thin-scroll flex max-h-[230px] flex-col gap-1 overflow-y-auto pr-1">
            {overview.segments.map((segment, i) => {
              const active = i === index;
              return (
                <li key={`${i}-${segment.speaker}-${segment.text.slice(0, 24)}`}>
                  <button
                    type="button"
                    onClick={() => {
                      playingRef.current = false;
                      window.speechSynthesis?.cancel();
                      indexRef.current = i;
                      setIndex(i);
                      setStatus("idle");
                    }}
                    onDoubleClick={() => speakFrom(i)}
                    className={
                      "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-relaxed transition-colors " +
                      (active
                        ? "bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-foreground"
                        : "text-text-dim hover:text-foreground")
                    }
                    title="Double-click to play from this line"
                  >
                    <span
                      className={
                        "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] " +
                        (segment.speaker === "A"
                          ? "bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-foreground"
                          : "bg-[var(--card-border)] text-text-dim")
                      }
                    >
                      {overview.style === "solo" ? "N" : segment.speaker}
                    </span>
                    <span>{segment.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-[10px] leading-relaxed text-text-dim">
            {overview.style === "duo" ? "Maya and Rohan" : "Narrator"} · from{" "}
            {overview.sources.length} source{overview.sources.length === 1 ? "" : "s"} ·
            double-click a line to hear it from there.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default AudioOverview;
