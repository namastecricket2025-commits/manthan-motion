import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Check, Loader2, PenLine, RotateCcw, TriangleAlert } from "lucide-react";
import { InlineMath } from "@/components/mathlab/parts";

/**
 * Step marking.
 *
 * The student writes a solution the way they would on paper, one line per
 * step, and an examiner marks each line against a scheme with the marks
 * printed beside it. The total is recomputed from the parts on the server, so
 * the score on the page always agrees with the rows underneath it.
 */

type MarkedStep = {
  title: string;
  marks: number;
  awarded: number;
  note: string;
};

type MarkResult = {
  steps: MarkedStep[];
  total: number;
  awarded: number;
  summary: string;
  correctedWorking: string;
};

export function MarkSteps({
  gradeId,
  track,
  chapterName,
  defaultQuestion,
}: {
  gradeId: string;
  track: string;
  chapterName: string;
  defaultQuestion: string;
}) {
  const mark = useAction(api.mathTutor.markSteps);

  const [question, setQuestion] = useState(defaultQuestion);
  const [working, setWorking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarkResult | null>(null);

  const submit = async () => {
    if (busy) return;
    if (working.trim().length < 3) {
      setError("Write your working first — one step per line is easiest to mark.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const reply = await mark({
        problem: question.trim(),
        working,
        gradeLabel: gradeId,
        track,
        chapterName,
      });
      setResult(reply);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The marker could not reach a model just now. Try again in a minute.",
      );
    } finally {
      setBusy(false);
    }
  };

  const percentage = result && result.total > 0 ? (result.awarded / result.total) * 100 : 0;

  return (
    <div className="marks">
      <header className="marks__head">
        <div>
          <p className="mathlab-card__kicker">Step marking</p>
          <h3 className="marks__title">Write it out, get it marked like a paper</h3>
          <p className="marks__sub">
            An examiner builds the marking scheme for the question, then awards
            each line you wrote against it — including where the method is right
            and the arithmetic is not.
          </p>
        </div>
        <span className="marks__context">
          Class {gradeId} · {chapterName}
        </span>
      </header>

      <div className="marks__grid">
        <label className="marks__field">
          <span>Question</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="The question you are answering"
            aria-label="Question being marked"
          />
        </label>

        <label className="marks__field marks__field--working">
          <span>Your working</span>
          <textarea
            value={working}
            onChange={(event) => setWorking(event.target.value)}
            placeholder={"Write one step per line, as you would on paper.\nFor example:\na = 1, b = −5, c = 6\nD = b² − 4ac = 25 − 24 = 1"}
            rows={7}
            aria-label="Your written working"
          />
        </label>
      </div>

      {error ? (
        <p className="mathlab-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="marks__actions">
        <button
          type="button"
          className="mathlab-solve marks__submit"
          onClick={() => void submit()}
          disabled={busy || working.trim().length < 3}
        >
          {busy ? <Loader2 className="spin-micro h-4 w-4" /> : <PenLine className="h-4 w-4" />}
          {busy ? "Marking…" : "Mark my working"}
        </button>
        <span className="marks__hint">
          Equations can be typed plainly — x², √, fractions like 2/3 all read fine.
        </span>
      </div>

      {result ? (
        <section className="marks__result" aria-live="polite">
          <header className="marks__scorehead">
            <div className="marks__score">
              <span className="marks__scorenum">{result.awarded}</span>
              <span className="marks__scoreof">/ {result.total}</span>
            </div>
            <div className="marks__scoremeta">
              <p className="marks__summary">{result.summary}</p>
              <div
                className="marks__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={result.total}
                aria-valuenow={result.awarded}
                aria-label="Marks awarded"
              >
                <span style={{ width: `${percentage}%` }} />
              </div>
            </div>
          </header>

          <ol className="marks__steps">
            {result.steps.map((step, index) => (
              <li
                key={`${index}-${step.title}`}
                className={
                  "marks__step" +
                  (step.awarded === step.marks
                    ? " is-full"
                    : step.awarded > 0
                      ? " is-part"
                      : " is-none")
                }
              >
                <span className="marks__stepnum" aria-hidden>
                  {index + 1}
                </span>
                <div className="marks__stepbody">
                  <div className="marks__steptop">
                    <span className="marks__steptitle">{step.title}</span>
                    <span className="marks__stepmarks">
                      {step.awarded}
                      <span aria-hidden> / </span>
                      {step.marks}
                    </span>
                  </div>
                  {step.note ? (
                    <p className="marks__stepnote">
                      <InlineMath text={step.note} />
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {result.correctedWorking ? (
            <details className="marks__corrected">
              <summary>The full correct solution</summary>
              <pre>{result.correctedWorking}</pre>
            </details>
          ) : null}

          <div className="marks__resultactions">
            <button
              type="button"
              className="mathlab-chip"
              onClick={() => {
                setWorking("");
                setResult(null);
                setError(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try the same question again
            </button>
            <button
              type="button"
              className="hunt__quiet"
              onClick={() => {
                setResult(null);
                setWorking("");
                setQuestion("");
                setError(null);
              }}
            >
              <Check className="h-3.5 w-3.5" />
              New question
            </button>
          </div>
        </section>
      ) : (
        !busy && (
          <p className="marks__empty">
            <TriangleAlert className="h-3.5 w-3.5" />
            Marks are awarded for the lines you actually write, so a blank step
            earns nothing — that is the point.
          </p>
        )
      )}
    </div>
  );
}

export default MarkSteps;
