import { Check, RotateCcw, X } from "lucide-react";
import { useCallback, useState } from "react";

/**
 * Click-the-part drills.
 *
 * The 3D models already know the name of every pickable structure. A drill is
 * just a target name, a score and the same pick — which is why it belongs
 * beside the model rather than in a separate quiz page. Nothing is generated:
 * the labels come from the anatomy registration itself, so the drill can only
 * ask for a part the model actually has.
 */

export type DrillFeedback = {
  ok: boolean;
  picked: string;
};

export type DrillState = {
  target: string;
  score: number;
  tries: number;
  feedback: DrillFeedback | null;
};

function pickTarget(parts: string[], exclude?: string) {
  const pool = parts.filter((part) => part !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? parts[0] ?? "";
}

export function useLabelDrill(parts: string[]) {
  const [drill, setDrill] = useState<DrillState | null>(null);

  const start = useCallback(() => {
    setDrill({ target: pickTarget(parts), score: 0, tries: 0, feedback: null });
  }, [parts]);

  const stop = useCallback(() => setDrill(null), []);

  const answer = useCallback((picked: string) => {
    setDrill((current) => {
      if (!current) return current;
      const ok = picked === current.target;
      return {
        ...current,
        score: current.score + (ok ? 1 : 0),
        tries: current.tries + 1,
        feedback: { ok, picked },
      };
    });
  }, []);

  const next = useCallback(() => {
    setDrill((current) =>
      current
        ? {
            ...current,
            target: pickTarget(parts, current.target),
            feedback: null,
          }
        : current,
    );
  }, [parts]);

  return { drill, start, stop, answer, next };
}

export function LabelDrillHud({
  drill,
  accent = "#67e8f9",
  onNext,
  onStop,
}: {
  drill: DrillState | null;
  accent?: string;
  onNext: () => void;
  onStop: () => void;
}) {
  if (!drill) return null;

  const feedback = drill.feedback;
  const message = feedback
    ? feedback.ok
      ? "Correct — that is the " + drill.target.toLowerCase() + "."
      : feedback.picked
        ? `That is the ${feedback.picked.toLowerCase()}. Find the ${drill.target.toLowerCase()}.`
        : `Tap a labelled structure to answer. Find the ${drill.target.toLowerCase()}.`
    : null;

  return (
    <div
      className="pointer-events-auto absolute inset-x-2 bottom-2 z-40 rounded-xl border bg-black/80 p-2.5 shadow-lg backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:p-3"
      style={{ borderColor: `${accent}55` }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            <span>Label drill</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {drill.score}/{drill.tries} correct
            </span>
          </p>
          <p className="mt-0.5 text-[13px] font-bold text-slate-100">
            Find the <span style={{ color: accent }}>{drill.target}</span>
          </p>
          {message ? (
            <p
              className={
                "mt-1 flex items-start gap-1.5 text-[11px] leading-snug " +
                (feedback?.ok ? "text-emerald-300" : "text-slate-400")
              }
            >
              {feedback ? (
                feedback.ok ? (
                  <Check className="mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                )
              ) : null}
              {message}
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Tap the structure on the model. Hover labels are paused during the
              drill.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onNext}
            className="lab-btn !px-2.5 !py-1.5 !text-[11px]"
            title="Ask for another structure"
          >
            <RotateCcw className="h-3 w-3" />
            Next
          </button>
          <button
            type="button"
            onClick={onStop}
            className="lab-btn !px-2.5 !py-1.5 !text-[11px]"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
