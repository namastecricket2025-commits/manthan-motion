import { useMemo } from "react";
import katex from "katex";
import { mathFieldError } from "@/convex/latexGuard";
import "katex/dist/katex.min.css";

/**
 * KaTeX rendering for the equation engine.
 *
 * This file is the render and nothing else. It used to split a single engine
 * string into maths and prose on the way to the screen, by guessing from the
 * characters involved — and a guess that went wrong fed a whole English
 * sentence to KaTeX, which dropped its spaces and set the words in italics.
 * The engine now separates the two fields itself, so there is nothing to guess:
 * `expression` arrives as LaTeX and goes straight to display mode, `finalAnswer`
 * as LaTeX for the answer card, and prose is never passed here at all.
 *
 * Every render is still guarded: if KaTeX cannot parse what it is handed, the
 * original characters are shown instead, so a missing glyph is never worse than
 * the text the student already had.
 */
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
    /* English never reaches KaTeX: a run of letters or an unknown command is
       shown as the characters the student typed, with its spaces intact. */
    const bad = mathFieldError(source);
    if (bad) {
      console.warn("[MathLab] refused to typeset a non-math field:", bad, JSON.stringify(source));
      return null;
    }
    try {
      return katex.renderToString(source, {
        displayMode: display,
        throwOnError: true,
        strict: false,
        output: "htmlAndMathml",
        trust: false,
      });
    } catch {
      console.warn("[MathLab] KaTeX rejected:", JSON.stringify(source));
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
