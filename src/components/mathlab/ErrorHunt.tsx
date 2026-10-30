import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { huntItemsFor } from "@/components/mathlab/errorHunt-items";
import { GRADES } from "@/components/mathlab/mathlab";

/**
 * Find the error.
 *
 * A worked solution is put in front of the student with exactly one corrupted
 * line. Every other line is sound, so there is no shortcut: the only way to
 * answer is to check each move against the one above it. The bank is local and
 * checked line by line, so the drill works offline and cannot hallucinate.
 */
export function ErrorHunt({
  gradeId,
  chapterName,
}: {
  gradeId: string;
  chapterName: string;
}) {
  const pool = useMemo(() => huntItemsFor(gradeId), [gradeId]);
  const grade = GRADES.find((entry) => entry.id === String(gradeId));
  const [cursor, setCursor] = useState(0);
  const [found, setFound] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [solved, setSolved] = useState(0);

  const item = pool[cursor % pool.length];

  const resetRun = () => {
    setCursor(0);
    setFound(false);
    setWrongPicks([]);
    setSolved(0);
  };

  const next = () => {
    setCursor((value) => (value + 1) % pool.length);
    setFound(false);
    setWrongPicks([]);
  };

  const pick = (index: number) => {
    if (found) return;
    if (index === item.wrongIndex) {
      setFound(true);
      setSolved((value) => value + 1);
      return;
    }
    setWrongPicks((current) => (current.includes(index) ? current : [...current, index]));
  };

  return (
    <div className="hunt">
      <header className="hunt__head">
        <div className="min-w-0">
          <p className="mathlab-card__kicker">Find the error</p>
          <h3 className="hunt__title">One line is wrong. Mark it.</h3>
          <p className="hunt__sub">
            Every other line is correct, so the only way through is to check each
            move against the line above it — the way a paper is checked before it
            is handed in.
          </p>
        </div>
        <div className="hunt__meta">
          <span className="hunt__tag">
            Class {grade?.id ?? gradeId} · {item.topic}
          </span>
          <span className="hunt__score">
            Found <strong>{solved}</strong>
            <span aria-hidden> / </span>
            <span className="hunt__score-total">{pool.length}</span>
          </span>
        </div>
      </header>

      <div className="hunt__prompt">
        <span className="hunt__promptlabel">Question</span>
        <p>{item.prompt}</p>
        <span className="hunt__context">{chapterName}</span>
      </div>

      <ol className="hunt__steps" aria-label="Solution lines">
        {item.steps.map((step, index) => {
          const isWrong = index === item.wrongIndex;
          const wasPickedWrong = wrongPicks.includes(index);
          const revealed = found && isWrong;
          return (
            <li key={`${item.id}-${index}`}>
              <button
                type="button"
                className={
                  "hunt__step" +
                  (revealed ? " is-revealed" : "") +
                  (wasPickedWrong ? " is-missed" : "")
                }
                aria-pressed={revealed}
                aria-label={`Line ${index + 1}: ${step}`}
                onClick={() => pick(index)}
                disabled={found}
              >
                <span className="hunt__num" aria-hidden>
                  {index + 1}
                </span>
                <span className="hunt__text">{step}</span>
                {revealed ? (
                  <span className="hunt__flag">
                    <Check className="h-3.5 w-3.5" />
                    This one
                  </span>
                ) : wasPickedWrong ? (
                  <span className="hunt__flag hunt__flag--miss">
                    <X className="h-3.5 w-3.5" />
                    Sound
                  </span>
                ) : (
                  <span className="hunt__pick" aria-hidden>
                    Tap
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="hunt__foot">
        {found ? (
          <div className="hunt__verdict" role="status" aria-live="polite">
            <p className="hunt__verdicthead">
              <Check className="h-4 w-4" />
              Line {item.wrongIndex + 1} is the fault
            </p>
            <p className="hunt__reason">{item.reason}</p>
            <div className="hunt__actions">
              <button type="button" className="mathlab-chip" onClick={next}>
                Next solution
              </button>
              <button type="button" className="hunt__quiet" onClick={resetRun}>
                <RotateCcw className="h-3.5 w-3.5" />
                Start again
              </button>
            </div>
          </div>
        ) : (
          <p className="hunt__hint" role="status" aria-live="polite">
            {wrongPicks.length === 0
              ? "Tap the line you believe is wrong."
              : "That line follows from the one above it. Look again."}
          </p>
        )}
      </div>
    </div>
  );
}

export default ErrorHunt;
