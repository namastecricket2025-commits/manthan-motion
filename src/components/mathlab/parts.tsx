import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { MathTex } from "@/components/mathlab/latex";

/**
 * The pieces the structured solution is drawn from.
 *
 * These used to live inside the notebook component, which was fine while the
 * notebook was the only thing rendering a solution. It is not any more — the
 * step list, the check-my-work panel and the saved history all render the same
 * shapes — so the render primitives live on their own and every caller shares
 * one definition of how a step looks.
 *
 * The rule they all obey: `explanation` is prose, `expression` is LaTeX, and
 * neither is ever guessed at. The bug this whole structure replaced was a
 * splitter that fed English sentences to KaTeX; there is nothing here that
 * inspects a string to decide which half it is.
 */

/** Inline maths inside prose, marked by the engine with `$...$`. */
export function InlineMath({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/\$([^$]+)\$/g), [text]);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <MathTex key={index} source={part} fallback={part} />
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** One sentence of prose, with its marked maths typeset. */
export function Explanation({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mathlab-walk__prose">
      <InlineMath text={text} />
    </p>
  );
}

/**
 * One expression, in display mode.
 *
 * A step carrying several equivalent lines arrives separated by `\\` or a
 * newline; each line is typeset on its own so nothing is squashed into one
 * unreadable row. A line KaTeX cannot parse falls back to its own characters.
 */
export function Expression({ source }: { source: string }) {
  const lines = useMemo(
    () =>
      source
        .split(/\\\\|\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [source],
  );
  if (!lines.length) return null;
  return (
    <div className="mathlab-walk__math">
      {lines.map((line, index) => (
        <MathTex key={`${index}-${line}`} source={line} fallback={line} display />
      ))}
    </div>
  );
}

/** A rule name, or a short formula, kept as its own typeset run. */
export function InlineFormula({ source }: { source: string }) {
  return <MathTex source={source} fallback={source} />;
}

/** A `Given data` / `Governing formulas` list, wrapped rather than scrolled. */
export function DetailList({ entries, latex = false }: { entries: string[]; latex?: boolean }) {
  if (!entries.length) return null;
  return (
    <ul className="mathlab-note-list">
      {entries.map((entry) => (
        <li key={entry} className="mathlab-note-list__row">
          {latex ? <InlineFormula source={entry} /> : <InlineMath text={entry} />}
        </li>
      ))}
    </ul>
  );
}

/** An animated collapsible, used for the folds the notebook keeps closed. */
export function Fold({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mathlab-fold" data-open={open}>
      <button
        type="button"
        className="mathlab-fold__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className="mathlab-fold__chev" aria-hidden />
        <span>{label}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="mathlab-fold__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
