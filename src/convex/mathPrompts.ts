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
