import { getAuthUserId, requireAuthUserId } from "./identity";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

/**
 * Mock exams.
 *
 * A paper is generated once by `examStudio.generate`, then lives here as a
 * row. The timer is server-owned: `begin` writes `endsAt`, so refreshing the
 * page cannot buy extra time, and the answer key is redacted from the browser
 * until the paper is submitted.
 */

export type ExamQuestion = {
  id: string;
  section: string;
  type: "mcq" | "short" | "long";
  marks: number;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  modelAnswer?: string;
  markingPoints?: string[];
  source?: string;
};

export type ExamReport = {
  results: {
    id: string;
    prompt: string;
    type: ExamQuestion["type"];
    marks: number;
    awarded: number;
    given: string;
    correctAnswer?: string;
    modelAnswer?: string;
    markingPoints?: string[];
    feedback?: string;
    correct?: boolean;
  }[];
  objectiveScore: number;
  objectiveMax: number;
  writtenScore: number;
  writtenMax: number;
  total: number;
  max: number;
  percent: number;
  summary: string;
  gradedAt: number;
};

type ResponseMap = Record<string, string | number>;

function asQuestions(value: unknown): ExamQuestion[] {
  return Array.isArray(value) ? (value as ExamQuestion[]) : [];
}

function asResponses(value: unknown): ResponseMap {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ResponseMap)
    : {};
}

function displayAnswer(
  question: ExamQuestion,
  response: string | number | undefined,
) {
  if (response === undefined || response === null || response === "") return "";
  if (question.type === "mcq" && typeof response === "number") {
    return question.options?.[response] ?? "";
  }
  return String(response);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const exams = await ctx.db
      .query("mockExams")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(20);
    const notebooks = await ctx.db
      .query("notebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const names = new Map(notebooks.map((notebook) => [notebook._id, notebook.name]));

    return exams.map((exam) => ({
      id: exam._id,
      title: exam.title,
      instructions: exam.instructions ?? "",
      notebookId: exam.notebookId ?? null,
      notebookName: exam.notebookId
        ? (names.get(exam.notebookId) ?? "Notebook")
        : exam.syllabus
          ? `Class ${exam.syllabus.className} · ${exam.syllabus.subject}`
          : "Mock paper",
      syllabus: exam.syllabus ?? null,
      pattern: exam.pattern,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      questionCount: asQuestions(exam.questions).length,
      status: exam.status,
      score: exam.score ?? null,
      objectiveScore: exam.objectiveScore ?? null,
      createdAt: exam.createdAt,
      submittedAt: exam.submittedAt ?? null,
    }));
  },
});

export const get = query({
  args: { examId: v.id("mockExams") },
  handler: async (ctx, { examId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const exam = await ctx.db.get(examId);
    if (!exam || exam.ownerId !== userId) return null;

    const questions = asQuestions(exam.questions);
    const hideAnswers = exam.status === "ready" || exam.status === "in_progress";
    const notebook = exam.notebookId
      ? await ctx.db.get(exam.notebookId)
      : null;
    const syllabus = exam.syllabus ?? null;

    return {
      id: exam._id,
      notebookId: exam.notebookId ?? null,
      notebookName:
        notebook?.name ??
        (syllabus ? `Class ${syllabus.className} · ${syllabus.subject}` : "Mock paper"),
      syllabus,
      title: exam.title,
      instructions: exam.instructions ?? "",
      pattern: exam.pattern,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      status: exam.status,
      startedAt: exam.startedAt ?? null,
      endsAt: exam.endsAt ?? null,
      submittedAt: exam.submittedAt ?? null,
      objectiveScore: exam.objectiveScore ?? null,
      score: exam.score ?? null,
      report: (exam.report ?? null) as ExamReport | null,
      responses: asResponses(exam.responses),
      model: exam.model,
      now: Date.now(),
      questions: questions.map((question) => {
        if (!hideAnswers) return question;
        return {
          id: question.id,
          section: question.section,
          type: question.type,
          marks: question.marks,
          prompt: question.prompt,
          options: question.options,
          source: question.source,
        };
      }),
    };
  },
});

export const begin = mutation({
  args: { examId: v.id("mockExams") },
  handler: async (ctx, { examId }) => {
    const userId = await requireAuthUserId(ctx);
    const exam = await ctx.db.get(examId);
    if (!exam || exam.ownerId !== userId) throw new Error("Exam not found.");
    if (exam.status !== "ready") {
      return {
        startedAt: exam.startedAt ?? Date.now(),
        endsAt: exam.endsAt ?? Date.now() + exam.durationMinutes * 60_000,
      };
    }

    const now = Date.now();
    const endsAt = now + Math.max(1, exam.durationMinutes) * 60_000;
    await ctx.db.patch(examId, {
      status: "in_progress",
      startedAt: now,
      endsAt,
      responses: {},
      updatedAt: now,
    });
    return { startedAt: now, endsAt };
  },
});

/** Autosave one response map. Called from the exam screen as answers change. */
export const saveResponses = mutation({
  args: { examId: v.id("mockExams"), responses: v.any() },
  handler: async (ctx, { examId, responses }) => {
    const userId = await requireAuthUserId(ctx);
    const exam = await ctx.db.get(examId);
    if (!exam || exam.ownerId !== userId) throw new Error("Exam not found.");
    if (exam.status !== "in_progress") return { saved: false };

    await ctx.db.patch(examId, {
      responses: responses as ResponseMap,
      updatedAt: Date.now(),
    });
    return { saved: true };
  },
});

/**
 * Close the paper and mark the objective section. Written answers stay
 * `submitted` until `examStudio.grade` returns; an all-MCQ paper is `graded`
 * here immediately.
 */
export const submit = mutation({
  args: { examId: v.id("mockExams"), responses: v.optional(v.any()) },
  handler: async (ctx, { examId, responses }) => {
    const userId = await requireAuthUserId(ctx);
    const exam = await ctx.db.get(examId);
    if (!exam || exam.ownerId !== userId) throw new Error("Exam not found.");
    if (exam.status === "graded") return { status: "graded" as const };
    if (exam.status !== "in_progress" && exam.status !== "submitted") {
      throw new Error("Start the paper before submitting it.");
    }

    const map = asResponses(responses ?? exam.responses);
    const questions = asQuestions(exam.questions);
    let objectiveScore = 0;
    let objectiveMax = 0;
    let writtenMax = 0;

    const results: ExamReport["results"] = [];
    for (const question of questions) {
      if (question.type === "mcq") {
        objectiveMax += question.marks;
        const given = map[question.id];
        const correct = typeof given === "number" && given === question.answerIndex;
        if (correct) objectiveScore += question.marks;
        results.push({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          marks: question.marks,
          awarded: correct ? question.marks : 0,
          given: displayAnswer(question, given),
          correctAnswer: question.options?.[question.answerIndex ?? -1] ?? "",
          feedback: question.explanation,
          correct,
        });
      } else {
        writtenMax += question.marks;
        results.push({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          marks: question.marks,
          awarded: 0,
          given: displayAnswer(question, map[question.id]),
          modelAnswer: question.modelAnswer,
          markingPoints: question.markingPoints,
        });
      }
    }

    const now = Date.now();
    if (writtenMax === 0) {
      const report: ExamReport = {
        results,
        objectiveScore,
        objectiveMax,
        writtenScore: 0,
        writtenMax: 0,
        total: objectiveScore,
        max: objectiveMax || exam.totalMarks,
        percent:
          objectiveMax > 0 ? Math.round((objectiveScore / objectiveMax) * 100) : 0,
        summary:
          objectiveMax > 0
            ? `You scored ${objectiveScore} of ${objectiveMax}. Review every miss below — those are the marks to recover next time.`
            : "This paper had no questions to mark.",
        gradedAt: now,
      };
      await ctx.db.patch(examId, {
        status: "graded",
        responses: map,
        objectiveScore,
        score: objectiveScore,
        report,
        submittedAt: now,
        updatedAt: now,
      });
      return { status: "graded" as const };
    }

    await ctx.db.patch(examId, {
      status: "submitted",
      responses: map,
      objectiveScore,
      submittedAt: now,
      updatedAt: now,
    });
    return { status: "submitted" as const };
  },
});

/** Full row for the grading action. Owner-checked. */
export const getForGrading = internalQuery({
  args: { examId: v.id("mockExams") },
  handler: async (ctx, { examId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const exam = await ctx.db.get(examId);
    if (!exam || exam.ownerId !== userId) throw new Error("Exam not found.");
    return {
      ...exam,
      questions: asQuestions(exam.questions),
      responses: asResponses(exam.responses),
    };
  },
});

export const insertExam = internalMutation({
  args: {
    ownerId: v.id("users"),
    notebookId: v.optional(v.id("notebooks")),
    syllabus: v.optional(
      v.object({
        className: v.string(),
        subject: v.string(),
        chapters: v.array(v.string()),
        paperKind: v.string(),
      }),
    ),
    title: v.string(),
    instructions: v.optional(v.string()),
    pattern: v.union(v.literal("objective"), v.literal("board")),
    durationMinutes: v.number(),
    totalMarks: v.number(),
    questions: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mockExams", {
      ownerId: args.ownerId,
      notebookId: args.notebookId,
      syllabus: args.syllabus,
      title: args.title,
      instructions: args.instructions,
      pattern: args.pattern,
      durationMinutes: args.durationMinutes,
      totalMarks: args.totalMarks,
      questions: args.questions,
      status: "ready",
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveGrade = internalMutation({
  args: {
    examId: v.id("mockExams"),
    report: v.any(),
    score: v.number(),
  },
  handler: async (ctx, { examId, report, score }) => {
    await ctx.db.patch(examId, {
      status: "graded",
      report,
      score,
      updatedAt: Date.now(),
    });
  },
});
