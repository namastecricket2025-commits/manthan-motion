import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState, type CSSProperties } from "react";
import { CornerDownLeft, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { Explanation, Expression } from "@/components/mathlab/parts";
import type { EngineStep } from "@/components/mathlab/solution";

/**
 * One problem's working.
 *
 * Two of the features a student actually asks for live here:
 *
 *   • **Why?** — every step carries a button that asks the tutor about that
 *     single move, and nothing else. The reply lands inside the step, where the
 *     question was asked, and the student can push further with their own
 *     follow-up if the short version is not enough.
 *   • **Try first** — with hint mode on, only the first move is shown. The
 *     student attempts that move, then reveals the next one, and so on, so the
 *     working arrives at the pace of their own thinking.
 *
 * Everything else about how a step is drawn is shared with the rest of the
 * notebook through `parts.tsx`.
 */

type Why = { loading: boolean; text: string; error: string | null };

export function StepList({
  problemIndex,
  problem,
  steps,
  reduceMotion,
  speakingKey,
  hintMode,
  track,
  chapterName,
  stepTransition,
}: {
  problemIndex: number;
  problem: string;
  steps: EngineStep[];
  reduceMotion: boolean;
  speakingKey: string | null;
  hintMode: boolean;
  track: string;
  chapterName: string;
  stepTransition: (index: number) => {
    type: "tween";
    duration: number;
    ease: [number, number, number, number];
    delay: number;
  };
}) {
  const explainStep = useAction(api.mathTutor.explainStep);
  const [why, setWhy] = useState<Record<number, Why>>({});
  const [openWhy, setOpenWhy] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(hintMode ? 1 : steps.length);

  const ask = useCallback(
    async (stepIndex: number, question?: string) => {
      const step = steps[stepIndex];
      if (!step) return;
      setOpenWhy(stepIndex);
      setWhy((current) => ({
        ...current,
        [stepIndex]: { loading: true, text: current[stepIndex]?.text ?? "", error: null },
      }));
      try {
        const reply = await explainStep({
          problem,
          stepTitle: step.title,
          stepExpression: step.expression,
          stepExplanation: step.explanation,
          rule: step.rule,
          question,
          track,
          chapterName,
        });
        setWhy((current) => ({
          ...current,
          [stepIndex]: { loading: false, text: reply.simple, error: null },
        }));
      } catch (err) {
        setWhy((current) => ({
          ...current,
          [stepIndex]: {
            loading: false,
            text: current[stepIndex]?.text ?? "",
            error:
              err instanceof Error && err.message
                ? err.message
                : "The tutor could not be reached just now. Try again in a moment.",
          },
        }));
      }
    },
    [chapterName, explainStep, problem, steps, track],
  );

  const visible = hintMode ? Math.min(revealed, steps.length) : steps.length;
  const more = hintMode && revealed < steps.length;

  return (
    <>
      {hintMode ? (
        <div className="mathlab-hintbar">
          <span className="mathlab-hintbar__status">
            <Sparkles className="h-3.5 w-3.5" />
            {visible} of {steps.length} steps showing — try each move yourself first
          </span>
          {more ? (
            <motion.button
              type="button"
              className="mathlab-tab-action"
              onClick={() => setRevealed((current) => current + 1)}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
            >
              Show next step
            </motion.button>
          ) : (
            <span className="mathlab-hintbar__done">That is the whole method.</span>
          )}
        </div>
      ) : null}

      <ol className="mathlab-walk">
        {steps.slice(0, visible).map((step, stepIndex) => {
          const key = `p${problemIndex}s${stepIndex}`;
          const entry = why[stepIndex];
          const open = openWhy === stepIndex;
          return (
            <motion.li
              key={`${key}-${step.expression || step.explanation}`}
              className="mathlab-walk__step"
              data-speaking={speakingKey === key}
              /* Drives the staggered rail flash in the stylesheet: each step
                 lights up in the order the method has to be read. */
              style={{ "--step-i": stepIndex } as CSSProperties}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={stepTransition(stepIndex)}
            >
              <span className="mathlab-walk__index" aria-hidden>
                {String(stepIndex + 1).padStart(2, "0")}
              </span>
              <div className="mathlab-walk__body">
                <p className="mathlab-walk__title">{step.title}</p>
                <Explanation text={step.explanation} />
                <Expression source={step.expression} />

                <div className="mathlab-why">
                  <button
                    type="button"
                    className={"mathlab-why__toggle" + (open ? " is-open" : "")}
                    aria-expanded={open}
                    onClick={() => {
                      if (open) {
                        setOpenWhy(null);
                        return;
                      }
                      setOpenWhy(stepIndex);
                      if (!entry?.text) void ask(stepIndex);
                    }}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {open ? "Hide the why" : "Why?"}
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        className="mathlab-why__panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
                      >
                        {entry?.loading ? (
                          <p className="mathlab-why__loading">
                            <Loader2 className="spin-micro h-3.5 w-3.5" />
                            Thinking about this step…
                          </p>
                        ) : entry?.text ? (
                          <p className="mathlab-why__text">
                            <Explanation text={entry.text} />
                          </p>
                        ) : null}
                        {entry?.error ? <p className="mathlab-error">{entry.error}</p> : null}
                        <div className="mathlab-why__ask">
                          <input
                            value={openWhy === stepIndex ? draft : ""}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              const text = draft.trim();
                              if (!text) return;
                              setDraft("");
                              void ask(stepIndex, text);
                            }}
                            placeholder="Ask something about this step…"
                            aria-label={`Ask about step ${stepIndex + 1}`}
                          />
                          <button
                            type="button"
                            disabled={!draft.trim() || Boolean(entry?.loading)}
                            onClick={() => {
                              const text = draft.trim();
                              if (!text) return;
                              setDraft("");
                              void ask(stepIndex, text);
                            }}
                            aria-label="Send the question"
                          >
                            <CornerDownLeft className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
              <span className="mathlab-walk__rule">{step.rule}</span>
            </motion.li>
          );
        })}
      </ol>
    </>
  );
}

export default StepList;
