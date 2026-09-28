import { z } from "zod";

/**
 * The Math Lab's own prompt constants.
 *
 * The engine and its output contracts live here rather than beside the
 * generation pipeline, because the Math Lab is the only thing that uses them:
 * it solves one problem at a time, returns structure rather than prose, and
 * verifies the arithmetic itself (see `mathLab.ts` and `mathVerify.ts`).
 */

/**
 * The three ways a student can be walked through the same problem.
 *
 * Same algebra, same answer — only the explanation changes, because a student
 * who has seen a proof three times still gets something from a number line.
 */
export const SOLVE_METHODS = {
  standard: [
    "Explain the working as a standard algebraic proof: state the identity or formula being used, substitute into it, and simplify symbolically until the answer is reached.",
    "Prefer algebra over diagrams. Every line must be a manipulation of the line above it.",
  ].join(" "),
  visual: [
    "Explain the working visually. Use fraction blocks, a bar model, a number line, a coordinate plane or a labelled diagram in words, and say exactly what each block, tick or segment represents.",
    "Where a picture would help, describe it concretely enough that the student can draw it: how many equal parts, which part is shaded, where the marker sits.",
    "Keep every number exact. Never replace a fraction with a rounded decimal.",
  ].join(" "),
  analogy: [
    "Explain the working as a real-world analogy first, then tighten it into the formal steps.",
    "Open with a situation a student has actually stood in — sharing, queues, budgets, distances, containers — and map each part of the problem onto it before doing any algebra.",
    "After the analogy has done its work, show the formal calculation in full so the method transfers to the exam.",
  ].join(" "),
} as const;

/**
 * The structured solution the notebook renders.
 *
 * One idea per step, with the prose and the mathematics in separate fields, is
 * the whole point: the previous single-string step had to be split by guesswork
 * on the way to the screen, and a sentence that guessed wrong came out as
 * italic mush inside the maths renderer. `expression` is now guaranteed to be
 * maths and `explanation` guaranteed to be prose, so nothing has to be guessed.
 */
export const mathStepSchema = z.object({
  title: z.string().min(1).catch("Step"),
  explanation: z.string().catch(""),
  expression: z.string().catch(""),
  rule: z.string().min(1).catch("Working"),
});

export const mathProblemSchema = z.object({
  problem: z.string().min(1),
  title: z.string().min(1).catch("Problem"),
  given: z.array(z.string().min(1)).catch([]),
  formulas: z.array(z.string().min(1)).catch([]),
  steps: z.array(mathStepSchema).catch([]),
  finalAnswer: z.string().min(1),
  verification: z.string().catch(""),
});

/** Rough ceiling on the base64 payload — about 4 MB of image. */
export const MAX_MATH_IMAGE = 5_500_000;

/**
 * One solved problem, exactly as the notebook renders it.
 *
 * Declared here rather than beside the solve action because three callers now
 * produce one: the solver, the practice generator, and the history replay. All
 * of them must agree on the shape or the renderer will render half of it.
 */
export interface SolvedProblem {
  problem: string;
  title: string;
  given: string[];
  formulas: string[];
  steps: {
    title: string;
    explanation: string;
    expression: string;
    rule: string;
  }[];
  finalAnswer: string;
  verification: string;
  /** True when an independent engine confirmed or corrected the answer. */
  verified: boolean;
  /** True when the checker's value replaced the model's own. */
  corrected: boolean;
  /** What the independent engine found, in one sentence. */
  checkNote: string;
}

/** Markdown debris out of prose, whitespace tidied. */
export function cleanProse(value: string) {
  return value.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Any maths delimiters the model wrapped around a line, stripped off again.
 *
 * Words never belong in an expression. The prompt forbids them; this catches
 * the ones that slip through anyway, because "2 plus 3" typesets as italic
 * mush rather than as arithmetic. `\text{...}` runs are left alone — a unit
 * legitimately lives there.
 */
export function cleanLatex(value: string) {
  let out = value.trim();
  if (out.length > 4 && out.startsWith("$$") && out.endsWith("$$")) {
    out = out.slice(2, -2);
  } else if (out.length > 2 && out.startsWith("$") && out.endsWith("$")) {
    out = out.slice(1, -1);
  }
  if (out.startsWith("\\[") && out.endsWith("\\]")) {
    out = out.slice(2, -2);
  }
  if (!out.includes("\\text")) {
    out = out
      .replace(/\bequals?\b/gi, "=")
      .replace(/\bplus\b/gi, "+")
      .replace(/\bminus\b/gi, "-")
      .replace(/\btimes\b/gi, "\\times")
      .replace(/\bmultiplied by\b/gi, "\\times")
      .replace(/\bdivided by\b/gi, "\\div")
      .replace(/\bsquared\b/gi, "^{2}");
  }
  return out.replace(/\s+/g, " ").trim();
}
