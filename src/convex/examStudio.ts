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
import {
  findClass,
  findSubject,
  paperPlan,
  scopeLine,
  type ExamPattern,
  type PaperKind,
} from "../lib/curriculum";
import { boardBank, boardLabel, type BankQuestion } from "../lib/boardBank";

/**
 * Mock-paper generation and marking.
 *
 * A paper is written one section at a time. That is deliberate: a 60-minute
 * objective test or a three-hour board simulation would need thirty to sixty
 * questions, and a single model reply that long is where JSON gets truncated
 * and questions get dropped. Each batch is a small, independently valid reply,
 * and the batches are merged at the end.
 *
 * Two sources feed a paper:
 *
 *  - `notebook` — the student's own sources, as before.
 *  - `syllabus` — a CBSE class, subject and chapter list, so an account with
 *    no sources can still sit a paper. For Class 10 "board simulation" papers,
 *    real questions from the 2020–2026 board papers fill up to half the paper
 *    and the model writes the rest around them.
 */

const MAX_CORPUS_CHARS = 16_000;
const CHARS_PER_TOKEN = 4;

/** Questions per model call, by type — small enough that JSON never overruns. */
const BATCH_SIZE = { mcq: 18, short: 8, long: 6 } as const;

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
  /** Simple student-facing provenance, e.g. "BOARD 2024". */
  source?: string;
  /** Full paper reference for the tooltip, e.g. "CBSE 2024 · 31/4/1 · Q6". */
  sourceDetail?: string;
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

function normalisePrompt(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, " ").trim();
}

function corpusFor(sources: { name: string; text: string }[]): string {
  if (sources.length === 0) return "";
  const share = Math.max(1200, Math.floor(MAX_CORPUS_CHARS / sources.length));
  return sources
    .map(
      (source) =>
        `--- SOURCE: ${source.name} ---\n${source.text.slice(0, share)}`,
    )
    .join("\n\n");
}

const NOTEBOOK_SYSTEM = [
  "You are Manthan's mock-exam setter for Indian school students in Classes 8 to 12 (CBSE and ICSE).",
  "Build a paper ONLY from the supplied notebook sources. Never add a fact, figure, formula or example that the sources do not support.",
  "Questions must be answerable from those sources alone. A question that needs outside knowledge is a bad question here.",
  "For multiple-choice questions, write exactly four plausible options and set answerIndex to the 0-based correct option. Distractors should be believable mistakes, not jokes.",
  "For written questions, provide a complete modelAnswer and two to four markingPoints a teacher could tick.",
  "Write mathematical expressions in plain text with Unicode symbols (x², √3, ½, 30°, ∠ABC), never LaTeX, $ signs or Markdown.",
  "Reply with a single JSON object and nothing else — no prose before or after it.",
].join(" ");

const SYLLABUS_SYSTEM = [
  "You are a senior CBSE paper setter in India, writing a mock examination from the NCERT syllabus.",
  "Write questions at the standard of the named class and subject, the way a real school or board paper is written: precise, syllabus-bound, with no trivia and no question that needs a diagram you cannot supply.",
  "Use the NCERT terminology for that chapter. Do not lift a question from a textbook exercise word for word; write fresh questions in the board's style.",
  "For multiple-choice questions write exactly four plausible options and set answerIndex to the 0-based correct option. Distractors must be the mistakes students actually make.",
  "For written questions, give a complete modelAnswer and two to five markingPoints that a CBSE examiner would tick.",
  "Write mathematical expressions in plain text with Unicode symbols (x², √3, ½, 30°, ∠ABC), never LaTeX, $ signs or Markdown.",
  "Reply with a single JSON object and nothing else — no prose before or after it.",
].join(" ");

const questionSchema = z.object({
  type: z.string().optional().catch(undefined),
  marks: z.number().optional().catch(undefined),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional().catch(undefined),
  answerIndex: z.number().optional().catch(undefined),
  explanation: z.string().optional().catch(undefined),
  modelAnswer: z.string().optional().catch(undefined),
  markingPoints: z.array(z.string()).optional().catch(undefined),
  source: z.string().optional().catch(undefined),
});

const listSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

/** Turn one raw model question into the stored shape, forcing the asked type. */
function normalise(
  raw: z.infer<typeof questionSchema>,
  type: QuestionType,
  section: string,
  marks: number,
): PaperQuestion | null {
  const prompt = cleanLine(raw.prompt ?? "");
  if (!prompt) return null;

  if (type === "mcq") {
    const options = (raw.options ?? [])
      .map((option) => cleanLine(option))
      .filter(Boolean)
      .slice(0, 4);
    if (options.length < 2) return null;
    return {
      id: "",
      section,
      type,
      marks,
      prompt,
      options,
      answerIndex: clamp(Math.round(raw.answerIndex ?? 0), 0, options.length - 1),
      explanation: raw.explanation ? cleanLine(raw.explanation) : undefined,
      source: raw.source ? cleanLine(raw.source) : undefined,
    };
  }

  const markingPoints = (raw.markingPoints ?? [])
    .map((point) => cleanLine(point))
    .filter(Boolean)
    .slice(0, 6);
  const modelAnswer = raw.modelAnswer
    ? cleanLine(raw.modelAnswer)
    : markingPoints.join("; ");
  if (!modelAnswer && markingPoints.length === 0) return null;

  return {
    id: "",
    section,
    type,
    marks,
    prompt,
    modelAnswer: modelAnswer || markingPoints.join("; "),
    markingPoints,
    source: raw.source ? cleanLine(raw.source) : undefined,
  };
}

interface BatchRequest {
  type: QuestionType;
  count: number;
  section: string;
  marks: number;
}

/** One model call, one type of question, with a schema-shaped reply. */
async function writeBatch(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  system: string,
  brief: string[],
  request: BatchRequest,
  avoid: string[],
): Promise<{ questions: PaperQuestion[]; model: string }> {
  const style =
    request.type === "mcq"
      ? [
          `Write exactly ${request.count} multiple-choice question${request.count === 1 ? "" : "s"}, ${request.marks} mark each.`,
          "Each question has four options and exactly one correct option.",
          'Return JSON: {"questions":[{"prompt":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string}]}',
        ]
      : [
          `Write exactly ${request.count} ${request.type === "short" ? "short-answer" : "long-answer"} question${request.count === 1 ? "" : "s"}, ${request.marks} marks each.`,
          request.type === "short"
            ? "A short answer is answerable in three or four sentences."
            : "A long answer is answerable in a structured paragraph of six to ten sentences.",
          'Return JSON: {"questions":[{"prompt":string,"modelAnswer":string,"markingPoints":[string]}]}',
        ];

  const prompt = [
    ...brief,
    style[0],
    style[1],
    avoid.length > 0
      ? `Do not repeat or rephrase any of these questions already on the paper:\n- ${avoid.slice(-24).join("\n- ")}`
      : "",
    style[2],
    "No preamble, no explanation outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const candidates = await resolveCandidates();

  const attempt = async (extra: string | null) => {
    const full = extra ? `${prompt}\n\n${extra}` : prompt;
    const reply = await callModel(candidates, system, full, undefined, 0.55);
    await meter(ctx, ownerId, full, reply);
    const parsed = listSchema.parse(parseJsonLoose(reply.text));
    return {
      model: reply.model,
      questions: parsed.questions
        .map((raw) =>
          normalise(raw, request.type, request.section, request.marks),
        )
        .filter((question): question is PaperQuestion => question !== null),
    };
  };

  try {
    return await attempt(null);
  } catch {
    return await attempt(
      "CORRECTION: the previous reply was not the required JSON object. Return one complete JSON object only, with the `questions` array.",
    );
  }
}

/**
 * How many of each type a paper needs, and how many marks each carries.
 * Objective papers are all one-mark MCQs; board papers follow CBSE's
 * 1 / 3 / 5-mark weighting.
 */
function planSections(
  plan: ReturnType<typeof paperPlan>,
  pattern: ExamPattern,
): BatchRequest[] {
  if (pattern === "objective") {
    return [
      { type: "mcq", count: plan.mcq, section: "Section A · Multiple choice", marks: 1 },
    ];
  }
  return [
    { type: "mcq", count: plan.mcq, section: "Section A · Multiple choice", marks: 1 },
    { type: "short", count: plan.short, section: "Section B · Short answer", marks: 3 },
    { type: "long", count: plan.long, section: "Section C · Long answer", marks: 5 },
  ];
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

/**
 * Real past-paper questions for the chosen chapters, split by type and capped
 * to what each section still needs.
 */
function pickBank(
  classId: string,
  subjectId: string,
  chapters: string[],
  plan: ReturnType<typeof paperPlan>,
): BankQuestion[] {
  const picked = new Set(chapters);
  const pool = boardBank(classId, subjectId).filter(
    (item) => chapters.length === 0 || picked.has(item.chapter),
  );
  if (pool.length === 0) return [];

  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  };

  const pools = {
    mcq: shuffle(pool.filter((item) => item.type === "mcq")),
    short: shuffle(pool.filter((item) => item.type === "short")),
    long: shuffle(pool.filter((item) => item.type === "long")),
  };
  const slots = { mcq: plan.mcq, short: plan.short, long: plan.long };

  /*
   * A board paper should contain real past-paper questions, not be made almost
   * entirely of them. The bank is a sample of published papers, while the setter
   * can write to the exact chapters and time limit the student chose, so the
   * paper keeps half its seats for fresh questions. The cap is on the whole
   * paper; questions are taken one type at a time, which also keeps all three
   * sections represented instead of spending the whole allowance on MCQs.
   */
  const total = plan.mcq + plan.short + plan.long;
  const cap = Math.min(
    total,
    Math.max(1, Math.round(total * 0.5)),
  );

  const pickedQuestions: BankQuestion[] = [];
  const types: Array<keyof typeof pools> = ["mcq", "short", "long"];
  let added = true;
  while (pickedQuestions.length < cap && added) {
    added = false;
    for (const type of types) {
      if (pickedQuestions.length >= cap) break;
      const next = pools[type][0];
      if (!next || slots[type] <= 0) continue;
      pools[type].shift();
      slots[type] -= 1;
      pickedQuestions.push(next);
      added = true;
    }
  }
  return pickedQuestions;
}

function bankToQuestion(item: BankQuestion, section: string): PaperQuestion {
  return {
    id: "",
    section,
    type: item.type,
    marks: item.marks,
    prompt: item.prompt,
    options: item.options,
    answerIndex: item.answerIndex,
    explanation: item.explanation,
    modelAnswer: item.modelAnswer,
    markingPoints: item.markingPoints,
    source: boardLabel(item.origin),
    sourceDetail: item.origin,
  };
}

export const generate = action({
  args: {
    /** Notebook paper — the original mode. */
    notebookId: v.optional(v.id("notebooks")),
    /** School-syllabus paper. */
    className: v.optional(v.string()),
    subject: v.optional(v.string()),
    chapters: v.optional(v.array(v.string())),
    paperKind: v.optional(v.union(v.literal("practice"), v.literal("board"))),
    durationMinutes: v.number(),
    pattern: v.union(v.literal("objective"), v.literal("board")),
  },
  handler: async (
    ctx,
    { notebookId, className, subject, chapters, paperKind, durationMinutes, pattern },
  ): Promise<{
    examId: Id<"mockExams">;
    title: string;
    totalMarks: number;
    questionCount: number;
    durationMinutes: number;
    boardQuestions: number;
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

    const plan = paperPlan(duration, pattern);
    const syllabusClass = findClass(className);
    const syllabusSubject = findSubject(className, subject);
    const kind: PaperKind = paperKind ?? "practice";

    if (!notebookId && !syllabusClass) {
      throw new Error("Choose a class, or pick a notebook to make the paper from.");
    }
    if (!notebookId && !syllabusSubject) {
      throw new Error("Choose a subject for the paper.");
    }

    /* ---------------- owner, scope and allowance ---------------- */
    let ownerId: Id<"users">;
    let brief: string[];
    let system = SYLLABUS_SYSTEM;
    let chaptersUsed: string[] = [];
    let language: "hi" | "en" = "en";

    if (notebookId) {
      ownerId = await ctx.runQuery(internal.materials.assertOwner, { notebookId });
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
      language = detectLanguage(usable.map((source) => source.text.slice(0, 500)));
      system = NOTEBOOK_SYSTEM;
      brief = [
        `NOTEBOOK: ${context.notebookName}`,
        `TIME ALLOWED: ${duration} minutes.`,
        pattern === "objective"
          ? "PATTERN: objective only — every question is multiple choice."
          : "PATTERN: board-style paper with multiple-choice, short-answer and long-answer sections.",
        "Use the sources below. Do not ask anything the sources do not teach.",
        `SOURCES:\n${corpusFor(usable)}`,
        ...languageDirective(language),
        languageLock(language),
      ];
    } else {
      const userId = await ctx.runQuery(internal.identity.currentUserId, {});
      if (!userId) throw new Error("Sign in first.");
      ownerId = userId;

      chaptersUsed = (chapters ?? [])
        .map((chapter) => chapter.trim())
        .filter((chapter) => syllabusSubject!.chapters.includes(chapter));

      language = syllabusSubject!.id === "hindi" ? "hi" : "en";
      brief = [
        `CLASS: ${syllabusClass!.label} (CBSE).`,
        `SUBJECT: ${syllabusSubject!.name}.`,
        `SYLLABUS SCOPE: ${scopeLine(chaptersUsed)}.`,
        `TIME ALLOWED: ${duration} minutes.`,
        pattern === "objective"
          ? "PATTERN: objective test — every question is multiple choice."
          : `PATTERN: ${kind === "board" && syllabusClass!.hasBoard ? "full board pattern" : "school annual exam pattern"} with multiple-choice, short-answer and long-answer sections.`,
        chaptersUsed.length > 0
          ? "Every question must come from the syllabus scope above. Do not wander into chapters the student did not choose."
          : "Cover the whole subject evenly across its chapters.",
        kind === "board"
          ? "This is a full exam simulation: include application and case-based questions, not only recall, and keep the difficulty of a real annual paper."
          : "This is a chapter practice test: mix recall with understanding, and keep every question fair to the chapters chosen.",
        "Questions must be answerable in writing, without a diagram, graph or photograph.",
        ...(language === "hi"
          ? [
              "LANGUAGE (critical): write every question, option, model answer and marking point in Hindi, in Devanagari script, the way the NCERT Hindi textbook does. Keep standard technical terms as the textbook writes them and never mix English sentences in.",
            ]
          : []),
        languageLock(language),
      ];
    }

    await assertAllowance(ctx, ownerId);

    /* ---------------- real board questions first ---------------- */
    const bank =
      !notebookId && kind === "board" && syllabusClass?.hasBoard
        ? pickBank(syllabusClass.id, syllabusSubject!.id, chaptersUsed, plan)
        : [];

    const sections = planSections(plan, pattern);
    const questions: PaperQuestion[] = [];
    const seen = new Set<string>();
    let model = "mixed";

    for (const item of bank) {
      const question = bankToQuestion(item, sectionForType(item.type, pattern));
      if (seen.has(normalisePrompt(question.prompt))) continue;
      seen.add(normalisePrompt(question.prompt));
      questions.push(question);
    }

    /* ---------------- the rest, one section at a time ---------------- */
    for (const section of sections) {
      const bankCount = questions.filter(
        (question) => question.type === section.type,
      ).length;
      const remaining = Math.max(0, section.count - bankCount);
      if (remaining === 0) continue;

      const batches = chunk(
        Array.from({ length: remaining }, () => section.type),
        BATCH_SIZE[section.type],
      );

      for (const batch of batches) {
        const avoid = questions.map((question) => question.prompt);
        try {
          const written = await writeBatch(
            ctx,
            ownerId,
            system,
            brief,
            { ...section, count: batch.length },
            avoid,
          );
          model = written.model;
          for (const question of written.questions) {
            const key = normalisePrompt(question.prompt);
            if (seen.has(key)) continue;
            seen.add(key);
            questions.push(question);
            if (questions.length >= plan.mcq + plan.short + plan.long) break;
          }
        } catch {
          /* One failed batch should not throw away the rest of the paper. */
        }
      }
    }

    if (questions.length === 0) {
      throw new Error(
        notebookId
          ? "The paper came back without usable questions. Try again — your allowance was charged for the attempt."
          : "The paper could not be written this time. Try again, or pick fewer chapters.",
      );
    }

    /* ---------------- order, marks and storage ---------------- */
    const ordered = ["mcq", "short", "long"].flatMap((type) =>
      questions.filter((question) => question.type === type),
    );
    ordered.forEach((question, index) => {
      question.id = `q${index + 1}`;
    });
    const totalMarks = ordered.reduce(
      (total, question) => total + question.marks,
      0,
    );

    const title = notebookId
      ? `${duration}-minute mock`
      : `${syllabusSubject!.name} · ${
          chaptersUsed.length === 0
            ? "Full syllabus"
            : chaptersUsed.length <= 2
              ? chaptersUsed.join(" & ")
              : `${chaptersUsed.length} chapters`
        } · ${duration} min`;

    const examId = await ctx.runMutation(internal.exams.insertExam, {
      ownerId,
      notebookId,
      syllabus:
        !notebookId && syllabusClass && syllabusSubject
          ? {
              className: syllabusClass.id,
              subject: syllabusSubject.name,
              chapters: chaptersUsed,
              paperKind: kind,
            }
          : undefined,
      title,
      instructions: [
        "All questions are compulsory.",
        "Marks for each question are shown against it.",
        "Write written answers in your own words — marks are for the idea, not the wording.",
      ].join(" "),
      pattern,
      durationMinutes: duration,
      totalMarks,
      questions: ordered,
      model,
    });

    return {
      examId,
      title,
      totalMarks,
      questionCount: ordered.length,
      durationMinutes: duration,
      boardQuestions: ordered.filter((question) =>
        question.source?.startsWith("BOARD"),
      ).length,
    };
  },
});

function sectionForType(type: QuestionType, pattern: ExamPattern): string {
  if (pattern === "objective") return "Section A · Multiple choice";
  if (type === "mcq") return "Section A · Multiple choice";
  if (type === "short") return "Section B · Short answer";
  return "Section C · Long answer";
}

/* ------------------------------------------------------------------ */
/* Marking                                                             */
/* ------------------------------------------------------------------ */

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
        'Mark every item. Return exactly: {"results":[{"id":string,"score":number,"feedback":string}],"summary":string}.',
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
