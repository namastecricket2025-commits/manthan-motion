"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { z } from "zod";
import { callModel, resolveCandidates } from "./providers";
import { parseJsonLoose } from "./ai";
import { boardBank, boardLabel, type BankQuestion } from "../lib/boardBank";
import { chapterBench } from "../lib/chapter-bench";

/**
 * The part of the STEM Lab that is not a simulation.
 *
 * The benches let a student change resistance or tilt an organ and watch the
 * result. They cannot answer the question that follows ("why did the current
 * fall when I added the second bulb?"), which is exactly the question a lab is
 * for. This action answers it in the student's own syllabus language and then
 * writes a small practice set on the same idea, so the bench ends in recall
 * rather than in a slider.
 *
 * One call, one structured reply. The metering is the same contract as the
 * rest of the app: `ensureWithinQuota` before the call, `usage.record` with the
 * tokens actually spent afterwards.
 */

const CHARS_PER_TOKEN = 4;

const SYSTEM = [
  "You are Manthan's STEM tutor for Indian school students in CBSE Classes 8 to 12.",
  "Explain at the level of the named class, using NCERT wording and SI units.",
  "Be concrete: name the law or process, then show the cause and effect the student can see on a lab bench.",
  "Never invent a formula or a constant. If the question is outside school science, say so and answer the nearest syllabus idea.",
  "Write plain text with Unicode symbols (Ω, °C, cm³, 10⁻³), never LaTeX, Markdown or asterisks.",
  "When the request asks for practice, write exactly the number of multiple-choice questions asked for (or three when no number is given), each with four options, one correct zero-based answerIndex and a one-sentence explanation.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

const questionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  answerIndex: z.coerce.number().optional().catch(0),
  explanation: z.string().optional().catch(undefined),
});

const replySchema = z.object({
  title: z.string().min(1),
  answer: z.string().min(1),
  keyPoints: z.array(z.string()).optional().catch(undefined),
  misconception: z.string().optional().catch(undefined),
  questions: z.array(questionSchema).optional().catch(undefined),
});

const drillSchema = z.object({
  title: z.string().min(1),
  questions: z.array(questionSchema).optional().catch(undefined),
});

function clean(value: string): string {
  return value.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const SUBJECT_LABEL = {
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
} as const;

/** Which bench a science chapter belongs to — one rule, shared with the lab picker. */

/**
 * Real board MCQs for a Class 10 drill, capped so the set still contains
 * questions written for the chosen chapter and count. If the chapter has no
 * past-paper MCQ, the drill keeps its fresh questions rather than borrowing a
 * question from another chapter and mislabelling it.
 */
function pickScienceBoard(
  subject: "physics" | "chemistry" | "biology",
  chapter: string,
  maximum: number,
): BankQuestion[] {
  const pool = boardBank("10", "science").filter((item) => {
    if (item.type !== "mcq" || !item.options || item.options.length < 2) {
      return false;
    }
    if (chapter) return item.chapter === chapter;
    const bench = chapterBench(item.chapter);
    return bench === subject || bench === "both";
  });
  const copy = [...pool];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, Math.max(0, maximum));
}

/** Keep only usable MCQs: a question, at least two options and an answer index
 *  that actually points at one of them. */
function normaliseQuestions(
  raw: Array<z.infer<typeof questionSchema>> | undefined,
  limit: number,
) {
  return (raw ?? [])
    .slice(0, limit)
    .map((item) => {
      const options = item.options.map(clean).filter(Boolean).slice(0, 4);
      if (options.length < 2) return null;
      return {
        question: clean(item.question),
        options,
        answerIndex: clamp(Math.round(item.answerIndex ?? 0), 0, options.length - 1),
        explanation: item.explanation ? clean(item.explanation) : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.question.length > 0);
}

export const ask = action({
  args: {
    subject: v.union(
      v.literal("physics"),
      v.literal("chemistry"),
      v.literal("biology"),
    ),
    className: v.optional(v.string()),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    const question = clean(args.question).slice(0, 500);
    if (question.length < 8) {
      throw new Error("Ask a fuller question — a sentence is enough.");
    }

    const userId = await ctx.runQuery(internal.identity.currentUserId, {});
    if (!userId) throw new Error("Sign in first.");

    const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, {
      userId,
    });
    if (usage.used >= usage.limit) {
      throw new Error(
        usage.window === "month"
          ? "Your monthly AI allowance is used up — it resets on the 1st. Plans has a higher cap."
          : "Your daily AI allowance is used up — it resets at midnight. Plans has a higher cap.",
      );
    }

    const numericClass = ["8", "9", "10", "11", "12"].includes(args.className ?? "")
      ? args.className
      : "10";

    const prompt = [
      `CLASS: ${numericClass} (CBSE).`,
      `SUBJECT: ${SUBJECT_LABEL[args.subject]}.`,
      `STUDENT'S QUESTION: ${question}`,
      "Answer in 120 to 170 words, in two or three short paragraphs.",
      "Give two to four keyPoints a teacher would tick.",
      "Name the one misconception students usually have about this, in one sentence.",
      'Return exactly this JSON shape: {"title":string,"answer":string,"keyPoints":[string],"misconception":string,"questions":[{"question":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string}]}',
      "No preamble, no text outside the JSON object.",
    ].join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, SYSTEM, prompt, undefined, 0.4);
    const spent =
      reply.tokens ??
      Math.round((prompt.length + reply.text.length) / CHARS_PER_TOKEN);
    await ctx.runMutation(internal.usage.record, {
      userId,
      tokens: spent,
      requests: 1,
    });

    const parsed = replySchema.parse(parseJsonLoose(reply.text));
    const questions = normaliseQuestions(parsed.questions, 3);

    return {
      title: clean(parsed.title),
      answer: clean(parsed.answer),
      keyPoints: (parsed.keyPoints ?? []).map(clean).filter(Boolean).slice(0, 5),
      misconception: parsed.misconception ? clean(parsed.misconception) : undefined,
      questions,
      model: reply.model,
    };
  },
});

/**
 * A bench-side drill: no explanation, just questions on the chapter the
 * student is standing in. The bench already shows the phenomenon; this gives
 * them the CBSE wording for it and marks the answers. Asking for a specific
 * count is deliberate — a drill after a lab visit should be short enough to
 * finish before the next class.
 */
export const drill = action({
  args: {
    subject: v.union(
      v.literal("physics"),
      v.literal("chemistry"),
      v.literal("biology"),
    ),
    className: v.optional(v.string()),
    chapter: v.optional(v.string()),
    count: v.optional(v.number()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("medium"), v.literal("board")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.identity.currentUserId, {});
    if (!userId) throw new Error("Sign in first.");

    const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, {
      userId,
    });
    if (usage.used >= usage.limit) {
      throw new Error(
        usage.window === "month"
          ? "Your monthly AI allowance is used up — it resets on the 1st. Plans has a higher cap."
          : "Your daily AI allowance is used up — it resets at midnight. Plans has a higher cap.",
      );
    }

    const numericClass = ["8", "9", "10", "11", "12"].includes(args.className ?? "")
      ? args.className
      : "10";
    const chapter = clean(args.chapter ?? "").slice(0, 160);
    const count = clamp(Math.round(args.count ?? 10), 5, 20);
    const difficulty = args.difficulty ?? "medium";
    /* A quarter of a Class 10 board-level drill is real paper material, and
       never the whole set: the remaining questions are written for the
       chapter the student actually chose. */
    const realBoard =
      numericClass === "10" && difficulty === "board"
        ? pickScienceBoard(
            args.subject,
            chapter,
            Math.min(4, Math.max(1, Math.floor(count / 4))),
          )
        : [];
    const writtenCount = Math.max(1, count - realBoard.length);
    const difficultyLine =
      difficulty === "easy"
        ? "Easy: one-step recall and direct definitions, the kind a student meets in the first exercise."
        : difficulty === "board"
          ? "Board level: CBSE board-examination style, with one or two application/analysis questions and NCERT phrasing."
          : "Medium: exercise-level understanding, one or two steps, no trick questions.";

    const prompt = [
      `CLASS: ${numericClass} (CBSE).`,
      `SUBJECT: ${SUBJECT_LABEL[args.subject]}.`,
      chapter
        ? `CHAPTER / TOPIC: ${chapter}.`
        : "CHAPTER / TOPIC: across the class syllabus for this subject.",
      difficultyLine,
      `Write exactly ${writtenCount} single-correct multiple-choice questions.`,
      "Every question has four plausible options, exactly one correct answer, and a one-sentence explanation a teacher would accept.",
      "Use NCERT wording and SI units; keep each question under 45 words and avoid questions that need a diagram.",
      'Return exactly this JSON shape: {"title":string,"questions":[{"question":string,"options":[string,string,string,string],"answerIndex":number,"explanation":string}]}',
      "No preamble, no text outside the JSON object.",
    ].join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, SYSTEM, prompt, undefined, 0.5);
    const spent =
      reply.tokens ??
      Math.round((prompt.length + reply.text.length) / CHARS_PER_TOKEN);
    await ctx.runMutation(internal.usage.record, {
      userId,
      tokens: spent,
      requests: 1,
    });

    const parsed = drillSchema.parse(parseJsonLoose(reply.text));
    const written = normaliseQuestions(parsed.questions, writtenCount);
    const boardQuestions = realBoard.map((item) => ({
      question: item.prompt,
      options: item.options ?? [],
      answerIndex: item.answerIndex ?? 0,
      explanation: item.explanation,
      source: boardLabel(item.origin),
      sourceDetail: item.origin,
    }));
    const questions = [...boardQuestions, ...written].slice(0, count);
    if (questions.length === 0) {
      throw new Error("The lab could not build a usable drill. Try a chapter name, or ask again.");
    }

    return {
      title: clean(parsed.title),
      questions,
      model: reply.model,
      boardQuestions: boardQuestions.length,
    };
  },
});
