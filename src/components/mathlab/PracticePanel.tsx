import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, Loader2, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Expression, Explanation, ProblemStatement } from "@/components/mathlab/parts";
import { MathTex } from "@/components/mathlab/latex";
import type { EngineProblem, EngineStep } from "@/components/mathlab/solution";

/**
 * Practice.
 *
 * Asks the tutor for one more problem of the same kind and difficulty and drops
 * it right under the one the student just finished — then keeps the answer
 * hidden behind a check field, because a problem you can see the answer to is
 * not practice.
 *
 * The practice problem is verified by the same independent arithmetic engine as
 * a real solve, so "correct" here means the answer was recomputed and agreed
 * with, not merely that a model said so.
 */

export function PracticePanel({
  problem,
  steps,
  finalAnswer,
  track,
  chapterName,
  chapterFormulas,
  autoStart = false,
}: {
  problem: string;
  steps: EngineStep[];
  finalAnswer: string;
  track: string;
  chapterName: string;
  chapterFormulas: string[];
  /** Generate immediately when opened from "Another similar problem". */
  autoStart?: boolean;
}) {
  const practiceAction = useAction(api.mathTutor.practiceProblem);
  const gradeAction = useAction(api.mathTutor.gradeAnswer);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practice, setPractice] = useState<EngineProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; note: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [showWorking, setShowWorking] = useState(false);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reply = await practiceAction({
        problem,
        steps: steps.map((step) => ({
          title: step.title,
          expression: step.expression,
          rule: step.rule,
        })),
        finalAnswer,
        track,
        chapterName,
        chapterFormulas,
      });
      setPractice(reply.problem);
      setAnswer("");
      setFeedback(null);
      setShowWorking(false);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The tutor could not write a new problem just now. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }, [chapterFormulas, chapterName, finalAnswer, practiceAction, problem, steps, track]);

  /* Carry-over from Solve: generate the similar problem once, automatically. */
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoStart || autoRan.current) return;
    autoRan.current = true;
    void generate();
  }, [autoStart, generate]);

  const checkAnswer = useCallback(async () => {
    if (!practice || checking) return;
    setChecking(true);
    setFeedback(null);
    try {
      const verdict = await gradeAction({
        problem: practice.problem,
        expectedAnswer: practice.finalAnswer,
        given: answer,
      });
      setFeedback({ correct: verdict.correct, note: verdict.note });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "That answer could not be marked just now. Try again in a moment.",
      );
    } finally {
      setChecking(false);
    }
  }, [answer, checking, gradeAction, practice]);

  return (
    <div className="mathlab-practice">
      <div className="mathlab-practice__bar">
        <button
          type="button"
          className="mathlab-tab-action"
          onClick={() => void generate()}
          disabled={busy}
        >
          {busy ? <Loader2 className="spin-micro h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {practice ? "Another similar problem" : "Practice similar problem"}
        </button>
        {practice ? (
          <button
            type="button"
            className="mathlab-tab-action"
            onClick={() => setShowWorking((value) => !value)}
          >
            <Eye className="h-3.5 w-3.5" />
            {showWorking ? "Hide the worked solution" : "Show the worked solution"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mathlab-error">{error}</p> : null}

      <AnimatePresence initial={false}>
        {practice ? (
          <motion.div
            className="mathlab-practice__card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          >
            <p className="mathlab-practice__label">Your problem</p>
            <div className="mathlab-practice__question">
              <ProblemStatement text={practice.problem} />
            </div>

            <div className="mathlab-practice__answer">
              <input
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setFeedback(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void checkAnswer();
                  }
                }}
                placeholder="Your answer"
                aria-label="Your answer to the practice problem"
                className="mathlab-practice__field"
              />
              <button
                type="button"
                className="mathlab-solve mathlab-solve--small"
                onClick={() => void checkAnswer()}
                disabled={checking || !answer.trim()}
              >
                {checking ? <Loader2 className="spin-micro h-4 w-4" /> : null}
                Check answer
              </button>
            </div>

            {feedback ? (
              <p
                className={"mathlab-practice__feedback" + (feedback.correct ? " is-right" : " is-wrong")}
                aria-live="polite"
              >
                {feedback.correct ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  <Explanation text={feedback.note} />
                </span>
              </p>
            ) : null}

            <AnimatePresence initial={false}>
              {showWorking ? (
                <motion.div
                  className="mathlab-practice__working"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
                >
                  <ol className="mathlab-walk">
                    {practice.steps.map((step, index) => (
                      <li key={`${index}-${step.expression || step.title}`} className="mathlab-walk__step">
                        <span className="mathlab-walk__index" aria-hidden>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="mathlab-walk__body">
                          <p className="mathlab-walk__title">{step.title}</p>
                          <Explanation text={step.explanation} />
                          <Expression source={step.expression} />
                        </div>
                        <span className="mathlab-walk__rule">{step.rule}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mathlab-practice__final">
                    <span>Final answer</span>
                    <MathTex source={practice.finalAnswer} fallback={practice.finalAnswer} display />
                    <p className="mathlab-practice__check">
                      <ShieldCheck className="h-3 w-3 shrink-0" />
                      <span>{practice.verification || practice.checkNote}</span>
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default PracticePanel;
