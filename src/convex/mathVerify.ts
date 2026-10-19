import { evaluate } from "mathjs";
import {
  describeExact,
  describeExactLatex,
  evaluateExpression,
  exactClose,
  latexToPlain,
  numbersFromLatex,
  numbersFromPlain,
  solveExactly,
  type Rational,
} from "./exactMath";

/**
 * Independent answer checking for the Math Lab.
 *
 * The model writes the explanation; this module decides whether the final
 * answer is actually right. It recomputes the problem with the exact rational
 * engine first — fractions, linear and quadratic equations — and only reaches
 * for a second, numeric engine when the exact one cannot read the question at
 * all. When neither can speak to a problem the verdict is `unverifiable`, never
 * a quiet pass: a maths app that says "verified" about an answer it did not
 * check has broken the one promise it is making.
 *
 * The two engines are also used against each other. Where both can read the
 * same expression they must agree, or the answer is reported as unverified
 * rather than trusted.
 */

export type VerificationStatus = "match" | "mismatch" | "unverifiable";

export interface Verification {
  status: VerificationStatus;
  /** The value the independent engine computed, ready to typeset. */
  verifiedLatex?: string;
  /** The same value the way a student writes it. */
  verifiedText?: string;
  /** One plain sentence: what was checked, and what it found. */
  note: string;
}

const UNREADABLE =
  "This one could not be recomputed independently — the tutor's answer is shown exactly as written.";

/** A sortable real value, for pairing roots that may be listed in any order. */
function realValue(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/** Do two small sets of exact numbers describe the same answer? */
function sameNumbers(model: Rational[], expected: Rational[]): boolean {
  if (model.length !== expected.length) return false;
  const taken = expected.map(() => false);
  for (const mine of model) {
    const index = expected.findIndex(
      (theirs, i) => !taken[i] && exactClose(mine, theirs),
    );
    if (index < 0) return false;
    taken[index] = true;
  }
  return true;
}

/** A number for display: whole numbers stay whole, the rest keep six places. */
function formatNumeric(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1e6) / 1e6);
}

/**
 * Evaluate with mathjs, but only when the expression is pure arithmetic.
 *
 * A function name or a unit would be read differently by a numeric library
 * than by the student who wrote it — `sin 30` is 30° in a classroom and 30
 * radians to a library — so anything carrying a letter is refused here rather
 * than mis-scored.
 */
function numericValue(expression: string): number | null {
  if (/[a-z]/i.test(expression)) return null;
  try {
    const result = evaluate(expression);
    return typeof result === "number" && Number.isFinite(result)
      ? result
      : null;
  } catch {
    return null;
  }
}

/**
 * Recompute one problem's final answer.
 *
 * `problem` and `answer` are the LaTeX the engine produced; both are read back
 * through the exact engines above. A mismatch carries the value the checker
 * trusts so the caller can correct the answer it shows.
 */
/**
 * The mathematics inside a problem statement.
 *
 * Problem statements are prose now — "Evaluate 22 × 6 using the distributive
 * property" — so handing the whole sentence to the exact engine would make
 * every answer unverifiable. Inline maths is marked with dollars; when it is
 * present, that is the question to recompute.
 */
function mathFromProblem(problem: string): string {
  const inline = [...problem.matchAll(/\$([^$]+)\$/g)]
    .map((match) => match[1] ?? "")
    .join(" ")
    .trim();
  return inline || problem;
}

export function verifyAnswer(problem: string, answer: string): Verification {
  const plain = latexToPlain(mathFromProblem(problem));
  if (!plain) {
    return { status: "unverifiable", note: UNREADABLE };
  }

  const stated = numbersFromLatex(answer);
  if (stated.length === 0) {
    // A word answer ("no real roots", "every value of x") has no number to
    // compare, and pretending otherwise would only produce noise.
    return { status: "unverifiable", note: UNREADABLE };
  }

  /* ---- 1. An equation: solve it exactly and compare the roots. ---- */
  if (plain.includes("=")) {
    const exact = solveExactly(plain);
    if (exact.kind !== "unsupported") {
      const expected = numbersFromPlain(exact.answerText);
      if (expected.length === 0) {
        return { status: "unverifiable", note: UNREADABLE };
      }
      const matched = sameNumbers(stated, expected);
      return {
        status: matched ? "match" : "mismatch",
        verifiedLatex: exact.answerLatex,
        verifiedText: exact.answerText,
        note: matched
          ? `Recomputed in exact arithmetic: ${exact.answerText}. ${exact.verification}`
          : `Recomputed in exact arithmetic, the answer is ${exact.answerText}.`,
      };
    }
  }

  /* ---- 2. Plain arithmetic: evaluate it exactly. ---- */
  const exactValue = evaluateExpression(plain);
  if (exactValue) {
    const numeric = numericValue(plain);
    if (numeric !== null && Math.abs(realValue(exactValue) - numeric) > 1e-6) {
      return {
        status: "unverifiable",
        note: "Two independent engines disagreed about the arithmetic here, so the answer is shown unchecked.",
      };
    }
    const matched = stated.some((value) => exactClose(value, exactValue));
    const valueText = describeExact(exactValue);
    return {
      status: matched ? "match" : "mismatch",
      verifiedLatex: describeExactLatex(exactValue),
      verifiedText: valueText,
      note: matched
        ? `Recomputed exactly: this works out to ${valueText}, and nothing was rounded to get there.`
        : `Recomputed exactly, this works out to ${valueText}.`,
    };
  }

  /* ---- 3. A numeric check with mathjs, when the exact reader is silent. ---- */
  const numeric = numericValue(plain);
  if (numeric !== null) {
    const matched = stated.some(
      (value) => Math.abs(realValue(value) - numeric) < 1e-6,
    );
    const valueText = formatNumeric(numeric);
    return {
      status: matched ? "match" : "mismatch",
      verifiedLatex: valueText,
      verifiedText: valueText,
      note: matched
        ? `Recomputed independently: this works out to ${valueText}.`
        : `Recomputed independently, this works out to ${valueText}.`,
    };
  }

  return { status: "unverifiable", note: UNREADABLE };
}
