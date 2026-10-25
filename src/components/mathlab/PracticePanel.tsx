import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Eye,
  Flag,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Expression, Explanation, ProblemStatement } from "@/components/mathlab/parts";
import { MathTex } from "@/components/mathlab/latex";
import type { EngineProblem, EngineStep } from "@/components/mathlab/solution";

/**
 * Practice.
 *
 * A set, not a single question: the student chooses how many, how hard, and
 * whether the set should read like a board paper. Each question arrives with its
 * own answer field, its own worked solution and — for a board set — the paper
 * tag in the corner, so a question can be recognised as exam material without
 * being told so in the middle of the sentence.
 *
 * The answer is checked by the same independent arithmetic engine as a live
 * solve, so "correct" is a recomputation, not a model's opinion.
 */

type Level = "easy" | "medium" | "hard" | "board";

const LEVELS: Array<{ id: Level; label: string; hint: string }> = [
  { id: "easy", label: "Easy", hint: "One idea, friendly numbers" },
  { id: "medium", label: "Medium", hint: "Two or three moves" },
  { id: "hard", label: "Hard", hint: "HOTS — plan before you compute" },
  { id: "board", label: "Board paper", hint: "CBSE style, with marks" },
];

/** Only Class 10 has a board paper in this lab's classes — a Class 8 or 9
 *  set with a "CBSE 2025" tag would be inventing an exam that does not exist. */
const BOARD_GRADE = "10";

const COUNTS = [1, 3, 5];

const BOARDS = [
  "CBSE 2026",
  "CBSE 2025",
  "CBSE 2024",
  "CBSE 2023",
  "CBSE 2022",
  "CBSE (mixed)",
];

/** A CBSE Class 10 maths paper runs three hours; this set is a section of it,
 *  so the clock is 90 minutes — enough to finish without being a mock exam. */
const BOARD_SECONDS = 90 * 60;

function clock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface Verdict {
  correct: boolean;
  note: string;
}

export function PracticePanel({
  problem,
  steps,
  finalAnswer,
  track,
  gradeId,
  chapterName,
  chapterFormulas,
  autoStart = false,
}: {
  problem: string;
  steps: EngineStep[];
  finalAnswer: string;
  track: string;
  gradeId: string;
  chapterName: string;
  chapterFormulas: string[];
  /** Generate immediately when opened from "Another similar problem". */
  autoStart?: boolean;
}) {
  const boardAllowed = gradeId === BOARD_GRADE;
  const levels = boardAllowed ? LEVELS : LEVELS.filter((entry) => entry.id !== "board");
  const setAction = useAction(api.mathTutor.practiceSet);
  const gradeAction = useAction(api.mathTutor.gradeAnswer);
  const recordMistake = useMutation(api.studyMistakes.record);

  const [level, setLevel] = useState<Level>("medium");
  const [count, setCount] = useState(3);
  const [boardYear, setBoardYear] = useState(BOARDS[0]);
  const [realWorld, setRealWorld] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EngineProblem[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, Verdict>>({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [openWorking, setOpenWorking] = useState<Record<number, boolean>>({});
  const [remaining, setRemaining] = useState(BOARD_SECONDS);
  const [finished, setFinished] = useState(false);

  const generate = useCallback(
    async (overrideCount?: number) => {
      setBusy(true);
      setError(null);
      try {
        const reply = await setAction({
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
          className: gradeId,
          count: overrideCount ?? count,
          level: boardAllowed || level !== "board" ? level : "medium",
          boardYear: boardAllowed && level === "board" ? boardYear : undefined,
          realWorld,
        });
        setQuestions(reply.problems);
        setAnswers({});
        setFeedback({});
        setOpenWorking({});
        setRemaining(BOARD_SECONDS);
        setFinished(false);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "The tutor could not write a new set just now. Try again in a moment.",
        );
      } finally {
        setBusy(false);
      }
    },
    [boardAllowed, boardYear, chapterFormulas, chapterName, count, finalAnswer, gradeId, level, problem, realWorld, setAction, steps, track],
  );

  /* A board set is timed from the moment it lands. The interval is cleared
     when the paper is finished, the level changes, or the component leaves. */
  useEffect(() => {
    if (!questions.length || level !== "board" || finished) return;
    const end = Date.now() + BOARD_SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setFinished(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [finished, level, questions]);

  /* Carry-over from Solve: one genuinely similar question, once. */
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoStart || autoRan.current) return;
    autoRan.current = true;
    void generate(1);
  }, [autoStart, generate]);

  const checkAnswer = useCallback(
    async (index: number) => {
      const question = questions[index];
      const given = answers[index] ?? "";
      if (!question || checking[index]) return;
      setChecking((current) => ({ ...current, [index]: true }));
      setFeedback((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      try {
        const verdict = await gradeAction({
          problem: question.problem,
          expectedAnswer: question.finalAnswer,
          given,
        });
        setFeedback((current) => ({
          ...current,
          [index]: { correct: verdict.correct, note: verdict.note },
        }));
        if (!verdict.correct) {
          void recordMistake({
            source: "practice",
            prompt: question.problem,
            correctAnswer: question.finalAnswer,
            givenAnswer: given,
            chapter: chapterName,
          }).catch(() => {
            /* A failed bank write must not block checking the next answer. */
          });
        }
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "That answer could not be marked just now. Try again in a moment.",
        );
      } finally {
        setChecking((current) => ({ ...current, [index]: false }));
      }
    },
    [answers, chapterName, checking, gradeAction, questions, recordMistake],
  );

  const answered = questions.filter((_, index) => feedback[index]?.correct).length;

  return (
    <div className="mathlab-practice">
      <div className="mathlab-practice__setup">
        <div className="mathlab-practice__row">
          <span className="mathlab-practice__label">Difficulty</span>
          <div className="mathlab-practice__levels" role="radiogroup" aria-label="Difficulty">
            {levels.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={level === entry.id}
                data-active={level === entry.id}
                title={entry.hint}
                onClick={() => setLevel(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mathlab-practice__row">
          <span className="mathlab-practice__label">Questions</span>
          <div className="mathlab-practice__counts" role="radiogroup" aria-label="How many questions">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                data-active={count === n}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mathlab-practice__row">
          <span className="mathlab-practice__label">Framing</span>
          <label className="mathlab-practice__check">
            <input
              type="checkbox"
              checked={realWorld}
              onChange={(event) => setRealWorld(event.target.checked)}
            />
            Real-world framing
          </label>
          {boardAllowed ? (
            <select
              className="mathlab-practice__select"
              value={boardYear}
              onChange={(event) => {
                setBoardYear(event.target.value);
                setLevel("board");
              }}
              aria-label="Board paper year"
            >
              {BOARDS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="mathlab-practice__go">
          <button
            type="button"
            className="mathlab-solve mathlab-solve--small"
            onClick={() => void generate()}
            disabled={busy}
          >
            {busy ? <Loader2 className="spin-micro h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {questions.length ? "New set" : "Generate set"}
          </button>
          <span className="mathlab-practice__meta">
            {level === "board"
              ? `${boardYear} · real board questions tagged with their year`
              : LEVELS.find((entry) => entry.id === level)?.hint}
          </span>
        </div>
      </div>

      {error ? <p className="mathlab-error">{error}</p> : null}

      {questions.length ? (
        <div className="mathlab-practice__sheet">
          <header className="mathlab-practice__sheethead">
            <span>
              {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
              {LEVELS.find((entry) => entry.id === level)?.label}
            </span>
            <span className="flex items-center gap-3">
              {level === "board" ? (
                <span
                  className="inline-flex items-center gap-1.5 tabular-nums"
                  title={finished ? "Time is up" : "Time left for this paper"}
                  style={
                    finished
                      ? { color: "var(--signal)" }
                      : remaining < 300
                        ? { color: "#d97706" }
                        : undefined
                  }
                >
                  <Clock className="h-3.5 w-3.5" />
                  {finished ? "Time up" : clock(remaining)}
                </span>
              ) : null}
              <span className="mathlab-practice__score">
                {answered}/{questions.length} correct
              </span>
            </span>
          </header>

          {finished ? (
            <p
              className="mb-3 rounded-lg border border-[var(--signal)]/40 bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] px-3 py-2 text-[12px] text-foreground"
              role="status"
            >
              <strong>Paper finished.</strong> {answered} of {questions.length} correct
              {level === "board" ? " — review the solutions, then generate a fresh set." : "."}
            </p>
          ) : null}

          <AnimatePresence initial={false}>
            {questions.map((question, index) => {
              const verdict = feedback[index];
              const isChecking = Boolean(checking[index]);
              return (
                <motion.article
                  key={`${index}-${question.problem}`}
                  className="mathlab-qcard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
                >
                  <div className="mathlab-qcard__head">
                    <span className="mathlab-qcard__no">Q{index + 1}</span>
                    {question.source ? (
                      <span className="mathlab-qcard__tag" title="Where this question comes from">
                        {question.source}
                      </span>
                    ) : null}
                  </div>

                  <div className="mathlab-qcard__question">
                    <ProblemStatement text={question.problem} />
                  </div>

                  <div className="mathlab-qcard__answer">
                    <input
                      value={answers[index] ?? ""}
                      onChange={(event) => {
                        setAnswers((current) => ({ ...current, [index]: event.target.value }));
                        setFeedback((current) => {
                          if (!current[index]) return current;
                          const next = { ...current };
                          delete next[index];
                          return next;
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void checkAnswer(index);
                      }}
                      placeholder="Your answer"
                      aria-label={`Your answer to question ${index + 1}`}
                      className="mathlab-practice__field"
                    />
                    <button
                      type="button"
                      className="mathlab-solve mathlab-solve--small"
                      onClick={() => void checkAnswer(index)}
                      disabled={isChecking || !(answers[index] ?? "").trim()}
                    >
                      {isChecking ? <Loader2 className="spin-micro h-4 w-4" /> : null}
                      Check
                    </button>
                    <button
                      type="button"
                      className="mathlab-tab-action"
                      onClick={() =>
                        setOpenWorking((current) => ({ ...current, [index]: !current[index] }))
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {openWorking[index] ? "Hide solution" : "Solution"}
                    </button>

                  </div>

                  {verdict ? (
                    <p
                      className={
                        "mathlab-practice__feedback" + (verdict.correct ? " is-right" : " is-wrong")
                      }
                      aria-live="polite"
                    >
                      {verdict.correct ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>
                        <Explanation text={verdict.note} />
                      </span>
                    </p>
                  ) : null}

                  <AnimatePresence initial={false}>
                    {openWorking[index] ? (
                      <motion.div
                        className="mathlab-practice__working"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: "easeOut" }}
                      >
                        <ol className="mathlab-walk">
                          {question.steps.map((step, stepIndex) => (
                            <li
                              key={`${stepIndex}-${step.expression || step.title}`}
                              className="mathlab-walk__step"
                            >
                              <span className="mathlab-walk__index" aria-hidden>
                                {String(stepIndex + 1).padStart(2, "0")}
                              </span>
                              <div className="mathlab-walk__body">
                                <p className="mathlab-walk__title">{step.title}</p>
                                <Explanation text={step.explanation} />
                                <Expression source={step.expression} />
                              </div>
                            </li>
                          ))}
                        </ol>
                        <div className="mathlab-practice__final">
                          <span>Final answer</span>
                          <MathTex
                            source={question.finalAnswer}
                            fallback={question.finalAnswer}
                            display
                          />
                          {question.verification || question.checkNote ? (
                            <p className="mathlab-practice__check">
                              <ShieldCheck className="h-3 w-3 shrink-0" />
                              <span>{question.verification || question.checkNote}</span>
                            </p>
                          ) : null}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </AnimatePresence>

          <div className="mathlab-practice__sheetfoot">
            <button
              type="button"
              className="mathlab-tab-action"
              onClick={() => void generate()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin-micro h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate another set
            </button>
            {level === "board" && !finished ? (
              <button
                type="button"
                className="mathlab-tab-action"
                onClick={() => setFinished(true)}
                title="Stop the clock and mark this paper finished"
              >
                <Flag className="h-3.5 w-3.5" />
                Finish paper
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PracticePanel;
