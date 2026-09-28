import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * The Math Lab's history, saving and mistake log.
 *
 * Three rules shape this file:
 *
 *   1. It is entirely owner-scoped. A solution, a save and a mistake all belong
 *      to the account that made them, and every read is filtered by that owner
 *      before anything is returned.
 *   2. Nothing is invented. A history entry exists because a solve finished, a
 *      mistake row exists because the checker returned a verdict for that step,
 *      and the mistake summary is a grouping of those rows — never a stored
 *      "accuracy" number that could drift from the rows behind it.
 *   3. The engine itself stays unauthenticated. The solve action does not (and
 *      should not) know about accounts, so the client records the finished
 *      solution here, using the identity the rest of the app already uses.
 */

type SolutionStep = {
  title?: string;
  expression?: string;
  rule?: string;
};

type SolutionProblem = {
  problem?: string;
  title?: string;
  finalAnswer?: string;
  given?: string[];
  formulas?: string[];
  steps?: SolutionStep[];
};

/** A display-only flattening: LaTeX commands are dropped, not interpreted. */
function plain(source: string) {
  return source
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\^{2}/g, "²")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The whole solution as readable text, for filing into a notebook. */
function solutionText(headline: string, problems: SolutionProblem[]) {
  const lines: string[] = [headline, ""];
  problems.forEach((problem, index) => {
    if (problems.length > 1) lines.push(`Problem ${index + 1}`);
    if (problem.title) lines.push(problem.title);
    if (problem.problem) lines.push(plain(problem.problem), "");
    (problem.steps ?? []).forEach((step, stepIndex) => {
      const rule = step.rule ? ` [${step.rule}]` : "";
      lines.push(`${stepIndex + 1}.${rule} ${plain(step.title ?? "")} ${plain(step.expression ?? "")}`.trim());
    });
    if (problem.finalAnswer) lines.push("", `FINAL ANSWER: ${plain(problem.finalAnswer)}`);
    lines.push("");
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Record a finished solution.
 *
 * Called by the notebook after a solve succeeds and only when someone is signed
 * in; a signed-out visitor solves happily and simply keeps no history.
 */
export const record = mutation({
  args: {
    question: v.string(),
    headline: v.string(),
    track: v.string(),
    chapterName: v.string(),
    method: v.string(),
    problems: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const question = args.question.trim().slice(0, 2_000) || "A photographed question";
    const problems = Array.isArray(args.problems) ? args.problems : [];

    return await ctx.db.insert("mathSolutions", {
      ownerId: userId,
      question,
      headline: args.headline.trim().slice(0, 400),
      track: args.track.slice(0, 40),
      chapterName: args.chapterName.slice(0, 160),
      method: args.method.slice(0, 40),
      problems,
      model: args.model.slice(0, 120),
      createdAt: Date.now(),
    });
  },
});

/**
 * The student's own solutions, newest first.
 *
 * Only summary fields come back — the payload is fetched per entry when it is
 * opened, so a long history does not ship every solution to the browser.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("mathSolutions")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(60);

    return rows.map((row) => {
      const problems: SolutionProblem[] = Array.isArray(row.problems) ? row.problems : [];
      return {
        id: row._id,
        question: row.question,
        headline: row.headline,
        track: row.track,
        chapterName: row.chapterName,
        method: row.method,
        createdAt: row.createdAt,
        problemCount: problems.length,
        finalAnswers: problems
          .map((problem) => problem.finalAnswer ?? "")
          .filter(Boolean)
          .slice(0, 4),
        savedNotebookId: row.savedNotebookId ?? null,
      };
    });
  },
});

/** One entry in full, for reopening, copying or exporting it. */
export const get = query({
  args: { solutionId: v.id("mathSolutions") },
  handler: async (ctx, { solutionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.get(solutionId);
    if (!row || row.ownerId !== userId) return null;
    return {
      id: row._id,
      question: row.question,
      headline: row.headline,
      track: row.track,
      chapterName: row.chapterName,
      method: row.method,
      model: row.model,
      problems: row.problems as SolutionProblem[],
      createdAt: row.createdAt,
    };
  },
});

export const remove = mutation({
  args: { solutionId: v.id("mathSolutions") },
  handler: async (ctx, { solutionId }) => {
    const userId = await requireAuthUserId(ctx);
    const row = await ctx.db.get(solutionId);
    if (!row || row.ownerId !== userId) throw new Error("That solution is not in your history.");
    await ctx.db.delete(solutionId);
  },
});

/**
 * File a solved problem into one of the student's notebooks.
 *
 * The solution becomes an ordinary text source, so it shows up wherever the
 * rest of the notebook's material does and the generator can build from it.
 * Saving twice reuses the first source rather than duplicating it.
 */
export const saveToNotebook = mutation({
  args: {
    solutionId: v.id("mathSolutions"),
    notebookId: v.id("notebooks"),
  },
  handler: async (ctx, { solutionId, notebookId }) => {
    const userId = await requireAuthUserId(ctx);

    const solution = await ctx.db.get(solutionId);
    if (!solution || solution.ownerId !== userId) {
      throw new Error("That solution is not in your history.");
    }
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }

    if (solution.savedNotebookId === notebookId) return solution.savedNotebookId;

    const problems: SolutionProblem[] = Array.isArray(solution.problems) ? solution.problems : [];
    const body = solutionText(solution.headline, problems);
    const name = (problems[0]?.problem
      ? plain(problems[0].problem)
      : solution.question
    ).slice(0, 120) || "Solved problem";

    await ctx.db.insert("sources", {
      ownerId: userId,
      notebookId,
      kind: "text",
      name,
      detail: `Solved in the Math Lab · ${solution.track}`,
      text: body.slice(0, 200_000),
      status: "ready",
      createdAt: Date.now(),
    });

    await ctx.db.patch(solutionId, {
      savedNotebookId: notebookId,
      savedAt: Date.now(),
    });
    return notebookId;
  },
});

/**
 * Log which steps Check My Work found wrong.
 *
 * The checker returns a verdict per step; only the steps it marked wrong reach
 * this mutation, so the mistake log can only ever contain steps that were
 * genuinely marked. Re-checking the same work replaces nothing — each attempt
 * is its own row, which is what makes a summary over time meaningful.
 */
export const recordAttempt = mutation({
  args: {
    solutionId: v.optional(v.id("mathSolutions")),
    problem: v.string(),
    mistakes: v.array(
      v.object({
        stepIndex: v.number(),
        stepTitle: v.string(),
        rule: v.string(),
        note: v.string(),
      }),
    ),
  },
  handler: async (ctx, { solutionId, problem, mistakes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    if (!mistakes.length) return 0;

    // The link back to the solution is kept only when it really is this
    // account's row; otherwise the mistake is logged unlinked rather than
    // pointing at somebody else's history.
    let linkedId: typeof solutionId = undefined;
    if (solutionId) {
      const row = await ctx.db.get(solutionId);
      if (row && row.ownerId === userId) linkedId = solutionId;
    }

    const now = Date.now();
    for (const mistake of mistakes.slice(0, 40)) {
      await ctx.db.insert("mathMistakes", {
        ownerId: userId,
        solutionId: linkedId,
        problem: problem.slice(0, 1_000),
        stepIndex: Math.max(0, Math.round(mistake.stepIndex)),
        stepTitle: mistake.stepTitle.slice(0, 200) || "Step",
        rule: mistake.rule.slice(0, 80),
        note: mistake.note.slice(0, 600),
        createdAt: now,
      });
    }
    return Math.min(mistakes.length, 40);
  },
});

/**
 * The mistake summary, built from the logged rows and nothing else.
 *
 * Each entry reports how many times that particular move was marked wrong and
 * when it last happened, alongside the most recent explanation the checker
 * gave. If nothing has been logged the list is empty and the UI says so.
 */
/** One row of the mistake summary, grouped from the logged steps. */
export type MistakeEntry = {
  stepTitle: string;
  rule: string;
  count: number;
  lastAt: number;
  note: string;
  example: string;
};

export const mistakes = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ total: number; attempts: number; entries: MistakeEntry[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, attempts: 0, entries: [] };

    const rows = await ctx.db
      .query("mathMistakes")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(400);

    const grouped = new Map<string, MistakeEntry>();

    for (const row of rows) {
      const key = `${row.stepTitle}::${row.rule}`;
      const existing = grouped.get(key);
      // `rows` is newest first, so the first row seen for a key is the most
      // recent one; its note and problem are kept as the live example.
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          stepTitle: row.stepTitle,
          rule: row.rule,
          count: 1,
          lastAt: row.createdAt,
          note: row.note,
          example: row.problem,
        });
      }
    }

    const entries = [...grouped.values()]
      .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
      .slice(0, 24);

    return {
      total: rows.length,
      // Distinct problems/attempts the rows came from, not a guessed figure.
      attempts: new Set(rows.map((row) => row.problem)).size,
      entries,
    };
  },
});
