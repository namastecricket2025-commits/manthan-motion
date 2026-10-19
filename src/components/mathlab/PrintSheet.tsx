import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MathTex } from "@/components/mathlab/latex";
import { ProblemStatement } from "@/components/mathlab/parts";
import type { EngineProblem } from "@/components/mathlab/solution";

/**
 * The printable copy of a solution.
 *
 * "Export as PDF" is the browser's own print-to-PDF, which is a real export and
 * needs no service, no key and no upload: this sheet is portalled onto the
 * document body, everything else is hidden by the print stylesheet, and the
 * print dialog is opened. What comes out is the same working the student is
 * looking at, typeset rather than screenshotted.
 */
export function PrintSheet({
  solution,
  meta,
  onDone,
}: {
  solution: { headline: string; problems: EngineProblem[] } | null;
  meta: string;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!solution) return;
    // The print stylesheet only hides the app while this marker is present, so
    // an ordinary Ctrl+P with no exported sheet prints the page as it looks
    // rather than a blank sheet.
    document.documentElement.classList.add("mathlab-printing");
    // One frame for the portal to lay out, then hand over to the browser.
    const handle = window.setTimeout(() => {
      window.print();
      document.documentElement.classList.remove("mathlab-printing");
      onDone();
    }, 150);
    return () => {
      window.clearTimeout(handle);
      document.documentElement.classList.remove("mathlab-printing");
    };
  }, [solution, onDone]);

  if (!solution) return null;

  return createPortal(
    <div className="mathlab-print-root">
      <header className="mathlab-print__head">
        <h1>{solution.headline}</h1>
        <p>{meta}</p>
      </header>
      {solution.problems.map((problem, index) => (
        <section key={`${index}-${problem.problem}`} className="mathlab-print__problem">
          <h2>
            {solution.problems.length > 1 ? `Problem ${index + 1} — ` : ""}
            {problem.title}
          </h2>
          <div className="mathlab-print__question">
            <ProblemStatement text={problem.problem} />
          </div>
          <ol className="mathlab-print__steps">
            {problem.steps.map((step, stepIndex) => (
              <li key={`${stepIndex}-${step.expression || step.title}`}>
                <p className="mathlab-print__steptitle">
                  {stepIndex + 1}. {step.title}
                  {step.rule ? ` (${step.rule})` : ""}
                </p>
                {step.explanation ? <p className="mathlab-print__prose">{step.explanation}</p> : null}
                {step.expression ? (
                  <div className="mathlab-print__math">
                    <MathTex source={step.expression} fallback={step.expression} display />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mathlab-print__answer">
            <strong>Final answer: </strong>
            <MathTex source={problem.finalAnswer} fallback={problem.finalAnswer} />
          </p>
          {problem.verification ? (
            <p className="mathlab-print__check">Check: {problem.verification}</p>
          ) : null}
        </section>
      ))}
    </div>,
    document.body,
  );
}

export default PrintSheet;
