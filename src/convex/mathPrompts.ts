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
/**
 * How much working a student asked to see.
 *
 * Simple is the default: short sentences, one idea per step, and only as many
 * steps as the arithmetic needs. Detailed keeps the full textbook proof for
 * the students who want it, including the rule names and the formal lines.
 */
export const DETAIL_STYLES = {
  simple: [
    "Write for the student's own level as a tutor would speak: short sentences (20 words at most per step), one idea per step, plain verbs.",
    "Use symbols rather than words: ×, +, −, ÷, =.",
    "Match the number of steps to the difficulty. Simple arithmetic gets 2 to 4 steps; never pad a short problem with extra moves or analogies.",
    "For each step put the whole instruction in explanation as one sentence, with any mathematics inline in dollars. Leave expression empty when explanation already contains the calculation.",
    "Do not use a jargon title. Say 'Split 22 into 20 + 2', not 'Decompose the number'.",
  ].join(" "),
  detailed: [
    "Show the full formal working: a title for every move, the rule that licenses it, and the expression on its own line.",
    "Explanation may use two or three sentences where the move needs it, but keep it plain and free of jargon.",
  ].join(" "),
} as const;

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
  /** Where the question comes from, e.g. "CBSE 2024 · 3 marks". Empty for a
   *  question written from scratch. */
  source: z.string().catch(""),
});

/**
 * Reading a photographed question, character by character.
 *
 * Reciprocal pairs are the single most common transcription error: a printed
 * `cos` read as `csc` turns a provable identity into a false one, and every step
 * after it is then built on the wrong problem. The prompt names the pairs and
 * asks the model to re-read the page before solving, rather than trusting a
 * first glance.
 */
export const PHOTO_READING_RULES = [
  "Transcribe the question EXACTLY as printed before solving it. Do not 'fix' the notation to a form that looks more familiar.",
  "Read every function name letter by letter and keep reciprocals apart: cos is not csc, sin is not sec, tan is not cot. A reciprocal pair changes the whole problem.",
  "Also distinguish + from −, x from ×, a superscript 2 from a coefficient, and the fraction bar's extent (what is actually in the numerator).",
  "If a symbol is genuinely illegible, choose the reading that makes the printed statement mathematically true, and keep that same reading in `problem` and in every step.",
  "`problem` must be the transcription of the printed question, not a rewritten version of it.",
].join(" ");

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
  /** Board paper / year tag shown on the question card, when known. */
  source?: string;
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
 * Read the student's notation the way a teacher would.
 *
 * `22x6`, `22X6`, `22*6` and `22·6` all mean 22 × 6; `÷` means division. The
 * substitution is deliberately narrow — an `x` followed by a space is a
 * variable, not a multiplication sign — so `3x + 5` is left alone.
 */
export function normalizeMathInput(value: string) {
  return value
    .replace(/(\d)\s*[xX*·]\s*(?=\d)/g, "$1 \\times ")
    .replace(/(\d)\s*[xX*·]\s*(?=[a-zA-Z])/g, "$1 \\times ")
    .replace(/÷/g, " \\div ")
    .replace(/\s+\/\s+/g, " \\div ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  let out = value
    /* JSON turns a single-backslash \times into a tab + "imes", \frac into a
       form-feed + "rac", and so on. The parser now repairs the JSON first, but
       a stored history row can still carry the damaged form; rebuild the
       command from the control character so old solutions render too. This
       runs before `trim`, or a leading form-feed would be stripped instead of
       restored. */
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replaceAll(String.fromCharCode(8), "\\b")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .trim();
  if (out.length > 4 && out.startsWith("$$") && out.endsWith("$$")) {
    out = out.slice(2, -2);
  } else if (out.length > 2 && out.startsWith("$") && out.endsWith("$")) {
    out = out.slice(1, -1);
  }
  if (out.startsWith("\\[") && out.endsWith("\\]")) {
    out = out.slice(2, -2);
  }
  if (!out.includes("\\text")) {
    /* The lookarounds catch `times` even when the model glued it to a number
       ("22times6"), while leaving the `times` inside a real `\\times` alone. */
    out = out
      .replace(/(?<![a-zA-Z\\])equals?(?![a-zA-Z])/gi, " = ")
      .replace(/(?<![a-zA-Z\\])plus(?![a-zA-Z])/gi, " + ")
      .replace(/(?<![a-zA-Z\\])minus(?![a-zA-Z])/gi, " - ")
      .replace(/(?<![a-zA-Z\\])times(?![a-zA-Z])/gi, " \\times ")
      .replace(/(?<![a-zA-Z\\])multiplied\s+by(?![a-zA-Z])/gi, " \\times ")
      .replace(/(?<![a-zA-Z\\])divided\s+by(?![a-zA-Z])/gi, " \\div ")
      .replace(/(?<![a-zA-Z\\])squared(?![a-zA-Z])/gi, "^{2}");
  }
  return out.replace(/\s+/g, " ").trim();
}
