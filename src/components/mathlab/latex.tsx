import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { isMathLine, toLatex, type WorkedStep } from "@/components/mathlab/mathformat";

/**
 * KaTeX rendering for the equation engine.
 *
 * The conversion from the engine's plain-text answers into LaTeX source lives
 * in `mathformat.ts`; this file is only the render. Every render is guarded:
 * if KaTeX cannot parse what it is handed, the original characters are shown
 * instead, so a missing glyph is never worse than the sentence the student
 * already had.
 */

export type { WorkedStep, RuleTone } from "@/components/mathlab/mathformat";
export { toLatex, toWorkedStep, toWorkedSteps } from "@/components/mathlab/mathformat";

/** Render LaTeX source, falling back to the original characters on any error. */
export function MathTex({
  source,
  fallback,
  display = false,
}: {
  source: string;
  fallback: string;
  display?: boolean;
}) {
  const html = useMemo(() => {
    if (!source) return null;
    try {
      return katex.renderToString(source, {
        displayMode: display,
        throwOnError: true,
        strict: false,
        output: "htmlAndMathml",
        trust: false,
      });
    } catch {
      return null;
    }
  }, [source, display]);

  if (html === null) {
    return <span className="mathlab-tex mathlab-tex--plain">{fallback}</span>;
  }
  return (
    <span
      className={"mathlab-tex" + (display ? " mathlab-tex--display" : "")}
      // KaTeX output is generated locally from strings this module produced.
      // `trust: false` above means no \href, \includegraphics or \htmlData can
      // reach the DOM, so there is no scriptable surface here.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Typeset a whole line, deciding for itself whether it is maths or prose. */
export function MathLine({ text }: { text: string }) {
  if (!isMathLine(text)) return <span>{text}</span>;
  return <MathTex source={toLatex(text)} fallback={text} />;
}
