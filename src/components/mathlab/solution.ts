/**
 * What the equation engine returns, and how it flattens into plain text.
 *
 * The shapes live here rather than inside the notebook component because four
 * screens now consume them: the solve pane, the step list, the check-my-work
 * panel and the saved history. One definition means a stored solution and a
 * live one are the same thing, and the clipboard, the speech reader and the
 * printed sheet all read from the same flattening rules.
 */

export interface EngineTurn {
  role: "student" | "lab";
  text: string;
}

export type SolveMethod = "standard" | "visual" | "analogy";

/** One move of a solution, exactly as the engine and the checker return it. */
export interface EngineStep {
  title: string;
  explanation: string;
  expression: string;
  rule: string;
}

/** One question, with its own working and its own answer card. */
export interface EngineProblem {
  problem: string;
  title: string;
  given: string[];
  formulas: string[];
  steps: EngineStep[];
  finalAnswer: string;
  verification: string;
  /** Board-paper tag for a practice question, e.g. "CBSE 2024 · 3 marks". */
  source?: string;
  /** True when an independent engine confirmed or corrected this answer. */
  verified: boolean;
  /** True when the checker's own value replaced the engine's. */
  corrected: boolean;
  /** What the independent engine found, in one sentence. */
  checkNote: string;
}

export interface EngineSolution {
  headline: string;
  problems: EngineProblem[];
  model: string;
}

/**
 * The stagger a step arrives on.
 *
 * A keyframe array would trip motion-dom's spring assertion (it insists on two
 * frames at most), so the delay rides a plain tween — and it is dropped
 * entirely when the student has asked for reduced motion.
 */
export function stepTransitionFor(index: number, reduceMotion: boolean | null) {
  return {
    type: "tween" as const,
    duration: 0.34,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    delay: reduceMotion ? 0 : Math.min(index, 8) * 0.05,
  };
}

/** LaTeX that reads sensibly when a speech synthesiser says it. */
export function spokenMath(source: string) {
  return source
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 over $2")
    .replace(/\\sqrt\{([^{}]+)\}/g, "the square root of $1")
    .replace(/\\times/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\le/g, " is less than or equal to ")
    .replace(/\\ge/g, " is greater than or equal to ")
    .replace(/\^{2}/g, " squared ")
    .replace(/\^\{?(\d+)\}?/g, " to the power $1 ")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prose with its inline maths flattened, for the clipboard and the printer. */
export function plainProse(text: string) {
  return text.replace(/\$([^$]+)\$/g, (_match, inner: string) => spokenMath(inner));
}

/** One line of a solution as clean, readable text. */
export function plainLine(source: string) {
  return spokenMath(source);
}

/** The whole solution as plain, readable text. */
export function solutionToText(solution: { headline: string; problems: EngineProblem[] }) {
  const lines: string[] = [solution.headline, ""];
  solution.problems.forEach((problem, problemIndex) => {
    if (solution.problems.length > 1) lines.push(`Problem ${problemIndex + 1}`);
    lines.push(problem.title, plainLine(problem.problem), "");
    problem.steps.forEach((step, stepIndex) => {
      lines.push(`${stepIndex + 1}. [${step.rule}] ${plainProse(step.explanation)}`);
      if (step.expression) lines.push(`   ${plainLine(step.expression)}`);
    });
    lines.push("", `FINAL ANSWER: ${plainLine(problem.finalAnswer)}`);
    if (problem.verification) lines.push(`Check: ${plainProse(problem.verification)}`);
    lines.push("");
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The same solution as LaTeX source, for pasting into notes or a paper. */
export function solutionToLatex(solution: { headline: string; problems: EngineProblem[] }) {
  const chunks: string[] = [`% ${solution.headline}`];
  solution.problems.forEach((problem, problemIndex) => {
    if (solution.problems.length > 1) chunks.push(`% Problem ${problemIndex + 1}`);
    chunks.push("\\begin{aligned}", problem.problem, "\\end{aligned}");
    problem.steps.forEach((step) => {
      if (step.rule) chunks.push(`% ${step.rule}`);
      if (step.expression) chunks.push("\\begin{aligned}", step.expression, "\\end{aligned}");
    });
    chunks.push("% Final answer", `\\boxed{${problem.finalAnswer}}`, "");
  });
  return chunks.join("\n");
}
