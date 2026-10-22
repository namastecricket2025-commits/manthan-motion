"use node";

import { action, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { z } from "zod";
import { callModel, resolveCandidates } from "./providers";
import {
  detectLanguage,
  languageDirective,
  languageLock,
  parseJsonLoose,
} from "./ai";

/**
 * Mock-paper generation and marking.
 *
 * Generation is one model call that returns the whole paper. Marking is a
 * second call for the written section only: objective answers are scored by the
 * `exams.submit` mutation, where the answer key never leaves the server.
 */

const MAX_CORPUS_CHARS = 16_000;
const CHARS_PER_TOKEN = 4;

type QuestionType = "mcq" | "short" | "long";

type PaperQuestion = {
  id: string;
  section: string;
  type: QuestionType;
  marks: number;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  modelAnswer?: string;
  markingPoints?: string[];
  source?: string;
};

async function assertAllowance(ctx: ActionCtx, userId: Id<"users">) {
  const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, { userId });
  if (usage.used >= usage.limit) {
    throw new Error(
      usage.window === "month"
        ? "Your monthly AI allowance is used up — it resets on the 1st. Plans has a higher cap."
        : "Your daily AI allowance is used up — it resets at midnight. Plans has a higher cap.",
    );
  }
}

async function meter(
  ctx: ActionCtx,
  userId: Id<"users">,
  prompt: string,
  reply: { text: string; tokens?: number },
) {
  const spent =
    reply.tokens ??
    Math.round((prompt.length + reply.text.length) / CHARS_PER_TOKEN);
  await ctx.runMutation(internal.usage.record, {
    userId,
    tokens: spent,
    requests: 1,
  });
}

function cleanLine(value: string): string {
  return value.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countsFor(durationMinutes: number, pattern: "objective" | "board") {
  if (pattern === "objective") {
    return {
      mcq: clamp(Math.round(durationMinutes / 1.5), 5, 30),
      short: 0,
      long: 0,
    };
  }
  // A full board paper is too much JSON for one response. This is a condensed
  // paper: enough questions to make the chosen clock feel real, while keeping
  // the reply inside a single reliable model response.
  return {
    mcq: clamp(Math.round(durationMinutes / 12), 4, 15),
    short: clamp(Math.round(durationMinutes / 35), 2, 6),
    long: clamp(Math.round(durationMinutes / 60), 1, 3),
  };
}

function corpusFor(
  sources: { name: string; text: string }[],
): string {
  if (sources.length === 0) return "";
  const share = Math.max(
    1200,
    Math.floor(MAX_CORPUS_CHARS / sources.length),
  );
  return sources
    .map(
      (source) =>
        `--- SOURCE: ${source.name} ---\n${source.text.slice(0, share)}`,
    )
    .join("\n\n");
}

const PAPER_SYSTEM = [
  "You are Manthan's mock-exam setter for Indian school students in Classes 8 to 12 (CBSE and ICSE).",
  "Build a paper ONLY from the supplied notebook sources. Never add a fact, figure, formula or example that the sources do not support.",
  "Questions must be answerable from those sources alone. A question that needs outside knowledge is a bad question here.",
  "For multiple-choice questions, write exactly four plausible options and set answerIndex to the 0-based correct option. Distractors should be believable mistakes, not jokes.",
  "For written questions, provide a complete modelAnswer and two to four markingPoints a teacher could tick.",
  "Group the paper into named sections. The paper should feel like a real school paper, not a list of trivia.",
  "Reply with a single JSON object and nothing else — no prose before or after it.",
].join(" ");

const paperQuestionSchema = z.object({
  type: z.string(),
  marks: z.number().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional().catch(undefined),
  answerIndex: z.number().optional().catch(undefined),
  explanation: z.string().optional().catch(undefined),
  modelAnswer: z.string().optional().catch(undefined),
  markingPoints: z.array(z.string()).optional().catch(undefined),
  source: z.string().optional().catch(undefined),
});

const paperSchema = z.object({
  title: z.string().optional().catch(undefined),
  instructions: z.string().optional().catch(undefined),
  sections: z
    .array(
      z.object({
        name: z.string().optional().catch(undefined),
        questions: z.array(paperQuestionSchema).min(1),
      }),
    )
    .min(1),
});

function normalisePaper(
  parsed: z.infer<typeof paperSchema>,
): { questions: PaperQuestion[]; totalMarks: number } {
  const questions: PaperQuestion[] = [];
  parsed.sections.forEach((section, sectionIndex) => {
    const sectionName =
      cleanLine(section.name ?? "") || `Section ${String.fromCharCode(65 + sectionIndex)}`;
    section.questions.forEach((raw) => {
      if (questions.length >= 40) return;
      const lowered = cleanLine(raw.type).toLowerCase();
      const type: QuestionType | null =
        lowered.includes("mcq") || lowered.includes("multiple")
          ? "mcq"
          : lowered.includes("short") || lowered.includes("brief")
            ? "short"
            : lowered.includes("long") || lowered.includes("essay")
              ? "long"
              : null;
      if (!type) return;

      const prompt = cleanLine(raw.prompt);
      if (!prompt) return;

      if (type === "mcq") {
        const options = (raw.options ?? [])
          .map((option) => cleanLine(option))
          .filter(Boolean)
          .slice(0, 4);
        if (options.length < 2) return;
        const answerIndex = clamp(
          Math.round(raw.answerIndex ?? 0),
          0,
          options.length - 1,
        );
        questions.push({
          id: `q${questions.length + 1}`,
          section: sectionName,
          type,
          marks: 1,
          prompt,
          options,
          answerIndex,
          explanation: raw.explanation
            ? cleanLine(raw.explanation)
            : undefined,
          source: raw.source ? cleanLine(raw.source) : undefined,
        });
        return;
      }

      const markingPoints = (raw.markingPoints ?? [])
        .map((point) => cleanLine(point))
        .filter(Boolean)
        .slice(0, 5);
      const modelAnswer = raw.modelAnswer
        ? cleanLine(raw.modelAnswer)
        : markingPoints.join("; ");
      if (!modelAnswer) return;

      questions.push({
        id: `q${questions.length + 1}`,
        section: sectionName,
        type,
        marks: type === "short" ? 3 : 5,
        prompt,
        modelAnswer,
        markingPoints,
        source: raw.source ? cleanLine(raw.source) : undefined,
      });
    });
  });

  return {
    questions,
    totalMarks: questions.reduce((total, question) => total + question.marks, 0),
  };
}

export const generate = action({
  args: {
    notebookId: v.id("notebooks"),
    durationMinutes: v.number(),
    pattern: v.union(v.literal("objective"), v.literal("board")),
  },
  handler: async (
    ctx,
    { notebookId, durationMinutes, pattern },
  ): Promise<{
    examId: Id<"mockExams">;
    title: string;
    totalMarks: number;
    questionCount: number;
    durationMinutes: number;
  }> => {
    const duration = Math.round(durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 300) {
      throw new Error("Choose a duration between 5 and 300 minutes.");
    }
    if (pattern === "board" && duration < 15) {
      throw new Error(
        "A board-style paper needs at least 15 minutes. Choose a longer time or the objective pattern.",
      );
    }

    const ownerId = await ctx.runQuery(internal.materials.assertOwner, {
      notebookId,
    });
    const context = await ctx.runQuery(internal.materials.sourceContext, {
      notebookId,
    });
    const usable = context.sources.filter(
      (source) => source.status !== "failed" && source.text.trim().length > 40,
    );
    if (usable.length === 0) {
      throw new Error(
        "Add a readable source first — a mock paper has to come from your notebook, not the internet.",
      );
    }
    await assertAllowance(ctx, ownerId);

    const counts = countsFor(duration, pattern);
    const language = detectLanguage(usable.map((source) => source.text.slice(0, 500)));
    const prompt = [
      `NOTEBOOK: ${context.notebookName}`,
      `TIME ALLOWED: ${duration} minutes.`,
      pattern === "objective"
        ? "PATTERN: objective only — every question is multiple choice."
        : "PATTERN: board-style paper with multiple-choice, short-answer and long-answer sections.",
      `Write exactly ${counts.mcq} multiple-choice question${counts.mcq === 1 ? "" : "s"} (1 mark each)${counts.short > 0 ? `, ${counts.short} short-answer question${counts.short === 1 ? "" : "s"} (3 marks each), and ${counts.long} long-answer question${counts.long === 1 ? "" : "s"} (5 marks each)` : ""}.`,
      pattern === "board"
        ? "Put the MCQs in Section A, short answers in Section B and long answers in Section C."
        : "Put all questions in one section.",
      "Use the sources below. Do not ask anything the sources do not teach.",
      `SOURCES:\n${corpusFor(usable)}`,
      ...languageDirective(language),
      "Return exactly this JSON shape:",
      '{"title":string,"instructions":string,"sections":[{"name":string,"questions":[{"type":"mcq"|"short"|"long","prompt":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string,"modelAnswer":string,"markingPoints":[string],"source":string}]}]}',
      "For MCQ, include options, answerIndex and explanation; omit modelAnswer and markingPoints. For short/long, include modelAnswer and markingPoints; omit options and answerIndex.",
      "Every `source` is the exact source name the question came from.",
      languageLock(language),
    ].join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, PAPER_SYSTEM, prompt, undefined, 0.3);
    await meter(ctx, ownerId, prompt, reply);

    let parsed: z.infer<typeof paperSchema>;
    try {
      parsed = paperSchema.parse(parseJsonLoose(reply.text));
    } catch {
      const retryPrompt = [
        prompt,
        "CORRECTION: the previous reply was not the required JSON object. Return one complete JSON object only.",
      ].join("\n\n");
      const retry = await callModel(candidates, PAPER_SYSTEM, retryPrompt, undefined, 0.2);
      await meter(ctx, ownerId, retryPrompt, retry);
      parsed = paperSchema.parse(parseJsonLoose(retry.text));
    }

    const paper = normalisePaper(parsed);
    if (paper.questions.length === 0) {
      throw new Error(
        "The paper came back without usable questions. Try again — your allowance was charged for the attempt.",
      );
    }

    const title =
      cleanLine(parsed.title ?? "") ||
      `${context.notebookName} · ${duration}-minute mock`;
    const examId = await ctx.runMutation(internal.exams.insertExam, {
      ownerId,
      notebookId,
      title,
      instructions: parsed.instructions
        ? cleanLine(parsed.instructions)
        : undefined,
      pattern,
      durationMinutes: duration,
      totalMarks: paper.totalMarks,
      questions: paper.questions,
      model: reply.model,
    });

    return {
      examId,
      title,
      totalMarks: paper.totalMarks,
      questionCount: paper.questions.length,
      durationMinutes: duration,
    };
  },
});

const gradeSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      feedback: z.string().optional().catch(undefined),
    }),
  ),
  summary: z.string().optional().catch(undefined),
});

const GRADE_SYSTEM = [
  "You are marking the written section of a school mock exam for Manthan.",
  "Award marks only for what the student's answer actually says. Do not give credit for a keyword with no explanation.",
  "Use the model answer and marking points as the standard, but accept a correct idea expressed in the student's own words.",
  "Each score is between 0 and that question's marks, inclusive. Feedback is one or two short sentences naming what earned marks and what was missing.",
  "Be encouraging but honest. Never invent a point the student did not make.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

export const grade = action({
  args: { examId: v.id("mockExams") },
  handler: async (
    ctx,
    { examId },
  ): Promise<{ ok: true; already?: boolean; total: number; max: number }> => {
    const exam = await ctx.runQuery(internal.exams.getForGrading, { examId });
    if (exam.status === "graded") {
      return {
        ok: true,
        already: true,
        total: exam.score ?? 0,
        max: exam.totalMarks,
      };
    }
    if (exam.status !== "submitted") {
      throw new Error("Submit the paper before asking for it to be marked.");
    }

    const questions = exam.questions as PaperQuestion[];
    const responses = exam.responses as Record<string, string | number>;
    const written = questions.filter((question) => question.type !== "mcq");

    const objectiveResults = questions
      .filter((question) => question.type === "mcq")
      .map((question) => {
        const given = responses[question.id];
        const correct =
          typeof given === "number" && given === question.answerIndex;
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          marks: question.marks,
          awarded: correct ? question.marks : 0,
          given:
            typeof given === "number"
              ? (question.options?.[given] ?? "")
              : "",
          correctAnswer: question.options?.[question.answerIndex ?? -1] ?? "",
          feedback: question.explanation,
          correct,
        };
      });

    let writtenScore = 0;
    let summary = "";
    let writtenResults: {
      id: string;
      prompt: string;
      type: QuestionType;
      marks: number;
      awarded: number;
      given: string;
      modelAnswer?: string;
      markingPoints?: string[];
      feedback?: string;
    }[] = [];

    if (written.length > 0) {
      await assertAllowance(ctx, exam.ownerId);
      const prompt = [
        `PAPER: ${exam.title}`,
        `MARKING SCHEME AND STUDENT ANSWERS:\n${JSON.stringify(
          written.map((question) => ({
            id: question.id,
            marks: question.marks,
            prompt: question.prompt,
            modelAnswer: question.modelAnswer,
            markingPoints: question.markingPoints,
            studentAnswer: String(responses[question.id] ?? ""),
          })),
        )}`,
        "Mark every item. Return exactly: {\"results\":[{\"id\":string,\"score\":number,\"feedback\":string}],\"summary\":string}.",
        "Score may be a decimal only when the question's marks allow it; otherwise use whole marks.",
      ].join("\n\n");

      const candidates = await resolveCandidates();
      const reply = await callModel(candidates, GRADE_SYSTEM, prompt, undefined, 0.2);
      await meter(ctx, exam.ownerId, prompt, reply);
      const parsed = gradeSchema.parse(parseJsonLoose(reply.text));
      const byId = new Map(parsed.results.map((result) => [result.id, result]));

      writtenResults = written.map((question) => {
        const result = byId.get(question.id);
        const awarded = clamp(
          Math.round((result?.score ?? 0) * 2) / 2,
          0,
          question.marks,
        );
        writtenScore += awarded;
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          marks: question.marks,
          awarded,
          given: String(responses[question.id] ?? ""),
          modelAnswer: question.modelAnswer,
          markingPoints: question.markingPoints,
          feedback: result?.feedback
            ? cleanLine(result.feedback)
            : "No specific feedback returned for this answer.",
        };
      });
      summary = cleanLine(parsed.summary ?? "");
    }

    const objectiveMax = questions
      .filter((question) => question.type === "mcq")
      .reduce((total, question) => total + question.marks, 0);
    const objectiveScore = objectiveResults.reduce(
      (total, result) => total + result.awarded,
      0,
    );
    const writtenMax = written.reduce(
      (total, question) => total + question.marks,
      0,
    );
    const total = objectiveScore + writtenScore;
    const max = objectiveMax + writtenMax;
    const report = {
      results: [...objectiveResults, ...writtenResults],
      objectiveScore,
      objectiveMax,
      writtenScore,
      writtenMax,
      total,
      max,
      percent: max > 0 ? Math.round((total / max) * 100) : 0,
      summary:
        summary ||
        (max > 0
          ? `You scored ${total} of ${max}. The per-question notes below show where the marks went.`
          : "This paper had no questions to mark."),
      gradedAt: Date.now(),
    };

    await ctx.runMutation(internal.exams.saveGrade, {
      examId,
      report,
      score: total,
    });
    return { ok: true, total, max };
  },
});
