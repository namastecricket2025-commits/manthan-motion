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
import { cleanProse } from "./mathPrompts";
import { sourceExcerpt } from "./sourceExcerpt";

/**
 * The notebook's studio: a conversation grounded in the student's own sources,
 * and the script for an audio overview of those sources.
 *
 * Both read the same corpus — the extracted text of the notebook's readable
 * sources — and neither pretends to know something the sources do not say. The
 * corpus is capped per request rather than per source, so one enormous PDF
 * cannot crowd every other source out of the answer, and each source is
 * labelled so a claim can be traced back to it.
 */

const MAX_CORPUS_CHARS = 14_000;
const MAX_CHAT_HISTORY = 6;
const CHARS_PER_TOKEN = 4;

/**
 * Studio calls spend from the same ledger as generation.
 *
 * Chat and audio write tokens against the plan the student is on rather than
 * running unmetered beside it: the dashboard meter, the plan card and the
 * server all have to agree, or the allowance is decorative.
 */
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

interface SourceSlice {
  name: string;
  text: string;
}

/** A fair share of the budget per source, unused share flowing to the rest. */
function corpusFor(sources: SourceSlice[]) {
  if (!sources.length) return "";
  const share = Math.max(1200, Math.floor(MAX_CORPUS_CHARS / sources.length));
  return sources
    .map((source) => {
      const body = source.text.slice(0, share);
      return `--- SOURCE: ${source.name} ---\n${body}`;
    })
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Ask this notebook                                                   */
/* ------------------------------------------------------------------ */

const CHAT_SYSTEM = [
  "You are the study companion inside Manthan, answering a student from the sources in THEIR notebook.",
  "The notebook's sources are supplied below, each labelled SOURCE: <name>. Treat those sources as the ground truth for this notebook.",
  "Answer the question directly in the first sentence. Then support it only with what the sources say.",
  "Cite the source name in the sentence that uses it, like (Source: Chapter 6 — Life Processes). Never cite a source you were not given.",
  "If the sources do not cover the question, say so plainly in one sentence, then — and only then — add the smallest piece of general background that helps, clearly marked 'Not from your sources:'. Never invent a page number, formula or quotation.",
  "If the student asks you to compare, list, or make a plan, use short numbered or dashed lines. No tables, no Markdown headings, no asterisks for bold.",
  "Be warm but concise. No filler openers ('Great question!'), no emoji, no closing offer to help further.",
].join(" ");

const MODE_RULES = {
  quick: "MODE: quick answer. Two to four sentences total. Answer the question and stop.",
  deep: [
    "MODE: deep research.",
    "Give a structured answer of three to six short sections, each beginning with a plain line like 'What the sources say', 'How it works', or 'What to remember'.",
    "End with one line beginning 'Revise:' naming the exact idea the student should open next. Stay grounded in the sources; this is depth, not speculation.",
  ].join(" "),
  explain: [
    "MODE: explain simply.",
    "Explain it the way a patient senior would to a junior: one everyday comparison first, then the correct terms.",
    "Five or six short sentences. Do not lose the accuracy of the source while simplifying.",
  ].join(" "),
} as const;

const chatReplySchema = z.object({
  answer: z.string().min(1),
});

/**
 * Prose cleanup that keeps paragraphs.
 *
 * `cleanProse` collapses every newline, which is right for a one-line tag and
 * wrong for a deep answer whose sections are the structure. This removes the
 * Markdown debris without flattening the answer.
 */
function cleanAnswer(value: string) {
  return value
    .replace(/[*_`#]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One spoken segment: no Markdown, no line breaks inside a sentence. */
function cleanSpoken(value: string) {
  return value.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
}

export const notebookChat = action({
  args: {
    notebookId: v.id("notebooks"),
    question: v.string(),
    mode: v.union(v.literal("quick"), v.literal("deep"), v.literal("explain")),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("student"), v.literal("lab")),
          text: v.string(),
        }),
      ),
    ),
  },
  handler: async (
    ctx,
    { notebookId, question, mode, history },
  ): Promise<{
    answer: string;
    sources: string[];
    citations: { sourceId: Id<"sources">; name: string; excerpt: string }[];
    model: string;
  }> => {
    const trimmed = question.trim();
    if (!trimmed) throw new Error("Ask something about this notebook first.");

    const { name, ownerId, sources } = await ctx.runQuery(
      internal.notebookContext.studioContext,
      { notebookId },
    );
    if (!sources.length) {
      throw new Error(
        "This notebook has no readable sources yet. Add a file, link or notes, then ask again.",
      );
    }
    await assertAllowance(ctx, ownerId);

    const corpus = corpusFor(sources);
    const transcript = (history ?? [])
      .slice(-MAX_CHAT_HISTORY)
      .map((turn) => `${turn.role === "student" ? "Student" : "Manthan"}: ${turn.text}`)
      .join("\n");
    const language = detectLanguage([trimmed, ...sources.map((s) => s.text.slice(0, 400))]);

    const prompt = [
      `NOTEBOOK: ${name}`,
      `SOURCES IN THIS NOTEBOOK:\n${corpus}`,
      transcript ? `CONVERSATION SO FAR:\n${transcript}` : "",
      `THE STUDENT ASKS: ${trimmed}`,
      MODE_RULES[mode],
      ...languageDirective(language),
      "Reply with a single JSON object and nothing else: {\"answer\":string}.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, CHAT_SYSTEM, prompt, undefined, mode === "deep" ? 0.35 : 0.25);
    await meter(ctx, ownerId, prompt, reply);

    let answer = "";
    try {
      answer = cleanAnswer(chatReplySchema.parse(parseJsonLoose(reply.text)).answer);
    } catch {
      // A model that ignored the JSON wrapper still wrote a useful answer;
      // strip fences rather than throwing the words away.
      answer = cleanAnswer(reply.text.replace(/```(?:json)?/g, "").replace(/```/g, ""));
    }

    // Cite only the sources the answer actually names, so the line under the
    // reply is a receipt rather than the whole library restated. The excerpt
    // is copied from that source, not written by the model: clicking a citation
    // must show what the source really says.
    const citations = sources
      .filter((source) =>
        answer.toLowerCase().includes(source.name.toLowerCase()),
      )
      .map((source) => ({
        sourceId: source.id,
        name: source.name,
        excerpt: sourceExcerpt(source.text, answer),
      }));

    return {
      answer,
      sources: citations.map((citation) => citation.name),
      citations,
      model: reply.model,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Teach-it-back viva                                                  */
/* ------------------------------------------------------------------ */

const VIVA_START_SYSTEM = [
  "You are the oral examiner inside Manthan, a study app for Indian school students in Classes 8 to 12.",
  "Ask one question that makes the student explain an idea in their own words, not recall a single word or date.",
  "The question must be answerable from the supplied sources alone, and must be specific enough that a vague answer is visibly incomplete.",
  "Question wording should sound like a friendly viva, not a written exam: 'Walk me through…', 'Why does…', 'What would happen if…'.",
  "Also list the three to five key points a strong answer should contain. These are for grading, never read out to the student.",
  "Work only from the sources. Never ask about a fact the sources do not support.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

const vivaStartSchema = z.object({
  question: z.string().min(1),
  focus: z.string().min(1),
  expected: z.array(z.string().min(1)).min(2).max(6),
});

/**
 * The examiner when the viva is set from the syllabus instead of a notebook.
 *
 * Most students have no sources of their own on day one, so a viva that could
 * only ask about an uploaded PDF was unusable for them. This variant is handed
 * a class, a subject and the chapter(s) the student picked, and asks the same
 * three-question viva from the NCERT treatment of that chapter — no notebook
 * needed, nothing invented outside the school syllabus.
 */
const SYLLABUS_START_SYSTEM = [
  "You are the oral examiner inside Manthan, a study app for Indian school students in Classes 8 to 10.",
  "The student has named a class, a subject and the chapters to be examined; there is no uploaded text.",
  "Ask one question that makes the student explain an idea in their own words, not recall a single word or date.",
  "Stay strictly inside the NCERT / CBSE syllabus for that class and subject. Never ask about a fact outside that chapter.",
  "Question wording should sound like a friendly viva: 'Walk me through…', 'Why does…', 'What would happen if…'.",
  "Also list the three to five key points a strong answer should contain. These are for grading, never read out to the student.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

const SYLLABUS_REPLY_SYSTEM = [
  "You are the oral examiner inside Manthan, grading a student's spoken explanation of a CBSE / NCERT chapter.",
  "Be fair and specific. A correct idea in the student's own words earns credit even when the wording differs from the textbook; a keyword without an explanation does not.",
  "Score out of 5: 5 is complete and precise, 3 is mostly right with one real gap, 1 is a fragment, 0 is absent or wrong.",
  "Feedback is two or three short sentences: name what was right, then the single most important thing missing. Never shame the student.",
  "If there are more turns, ask ONE short follow-up that probes the gap you just found, inside the same chapter. If this was the last turn, set nextQuestion to null and write a short overall summary.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

const VIVA_REPLY_SYSTEM = [
  "You are the oral examiner inside Manthan, grading a student's spoken explanation against the notebook's sources.",
  "Be fair and specific. A correct idea in the student's own words earns credit even when the wording differs from the source; a keyword without an explanation does not.",
  "Score out of 5: 5 is complete and precise, 3 is mostly right with one real gap, 1 is a fragment, 0 is absent or wrong.",
  "Feedback is two or three short sentences: name what was right, then the single most important thing missing. Never shame the student.",
  "If there are more turns, ask ONE short follow-up that probes the gap you just found, grounded in the sources. If this was the last turn, set nextQuestion to null and write a short overall summary.",
  "Reply with a single JSON object and nothing else.",
].join(" ");

const vivaReplySchema = z.object({
  score: z.number(),
  feedback: z.string().min(1),
  missed: z.array(z.string()).optional(),
  nextQuestion: z.string().nullable().optional(),
  nextFocus: z.string().nullable().optional(),
  nextExpected: z.array(z.string()).optional(),
  overall: z.string().nullable().optional(),
});

/**
 * Start a short oral examination.
 *
 * Two scopes, one examiner: either the readable sources of one notebook, or a
 * class / subject / chapter pick from the school syllabus (`scope`), which
 * needs no uploaded material at all.
 */
export const vivaStart = action({
  args: {
    notebookId: v.optional(v.id("notebooks")),
    scope: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { notebookId, scope, topic },
  ): Promise<{
    question: string;
    focus: string;
    expected: string[];
    sources: string[];
    model: string;
  }> => {
    const syllabus = scope?.trim() ?? "";
    let ownerId: Id<"users">;
    let system = VIVA_START_SYSTEM;
    let heading: string;
    let body: string;
    let language: ReturnType<typeof detectLanguage>;
    let labels: string[];

    if (syllabus) {
      const userId = await ctx.runQuery(internal.identity.currentUserId, {});
      if (!userId) throw new Error("You need to be signed in to sit a viva.");
      ownerId = userId;
      system = SYLLABUS_START_SYSTEM;
      heading = `SYLLABUS: ${syllabus}`;
      body =
        "This viva is set from the CBSE / NCERT syllabus line above, not from an uploaded source. Ask from the standard textbook treatment of that chapter.";
      language = detectLanguage([syllabus]);
      labels = syllabus
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);
    } else {
      if (!notebookId) {
        throw new Error("Choose a notebook, or pick a class, subject and chapter.");
      }
      const context = await ctx.runQuery(internal.notebookContext.studioContext, {
        notebookId,
      });
      if (!context.sources.length) {
        throw new Error(
          "Add a readable source first — the viva can only ask about what is in this notebook.",
        );
      }
      ownerId = context.ownerId;
      heading = `NOTEBOOK: ${context.name}`;
      body = `SOURCES:\n${corpusFor(context.sources)}`;
      language = detectLanguage(
        context.sources.map((source) => source.text.slice(0, 500)),
      );
      labels = context.sources.map((source) => source.name).slice(0, 4);
    }

    await assertAllowance(ctx, ownerId);

    const prompt = [
      heading,
      topic?.trim() ? `TOPIC THE STUDENT CHOSE: ${topic.trim()}` : "",
      body,
      "Ask the first question of a three-question viva. It should take about thirty seconds to answer aloud.",
      "Return exactly: {\"question\":string,\"focus\":string,\"expected\":[string]}.",
      ...languageDirective(language),
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, system, prompt, undefined, 0.45);
    await meter(ctx, ownerId, prompt, reply);
    const parsed = vivaStartSchema.parse(parseJsonLoose(reply.text));

    return {
      question: cleanSpoken(parsed.question),
      focus: cleanSpoken(parsed.focus),
      expected: parsed.expected.map(cleanSpoken).slice(0, 6),
      sources: labels,
      model: reply.model,
    };
  },
});

/** Grade one spoken answer and, unless this was the last turn, ask the next. */
export const vivaRespond = action({
  args: {
    notebookId: v.optional(v.id("notebooks")),
    scope: v.optional(v.string()),
    topic: v.optional(v.string()),
    question: v.string(),
    expected: v.array(v.string()),
    answer: v.string(),
    turn: v.number(),
    history: v.optional(
      v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
          score: v.number(),
          feedback: v.string(),
        }),
      ),
    ),
  },
  handler: async (
    ctx,
    { notebookId, scope, topic, question, expected, answer, turn, history },
  ): Promise<{
    score: number;
    feedback: string;
    missed: string[];
    nextQuestion: string | null;
    nextFocus: string | null;
    nextExpected: string[];
    overall: string | null;
    model: string;
  }> => {
    const spoken = answer.replace(/\s+/g, " ").trim();
    if (spoken.length < 12) {
      throw new Error("Say a little more — even one full sentence gives the examiner something to work with.");
    }

    const syllabus = scope?.trim() ?? "";
    let ownerId: Id<"users">;
    let system = VIVA_REPLY_SYSTEM;
    let heading: string;
    let body: string;
    let language: ReturnType<typeof detectLanguage>;

    if (syllabus) {
      const userId = await ctx.runQuery(internal.identity.currentUserId, {});
      if (!userId) throw new Error("You need to be signed in to sit a viva.");
      ownerId = userId;
      system = SYLLABUS_REPLY_SYSTEM;
      heading = `SYLLABUS: ${syllabus}`;
      body =
        "Grade against the standard CBSE / NCERT treatment of that chapter; the expected points below are the marking scheme.";
      language = detectLanguage([syllabus]);
    } else {
      if (!notebookId) {
        throw new Error("Choose a notebook, or pick a class, subject and chapter.");
      }
      const context = await ctx.runQuery(internal.notebookContext.studioContext, {
        notebookId,
      });
      if (!context.sources.length) {
        throw new Error("This notebook has no readable sources to grade against.");
      }
      ownerId = context.ownerId;
      heading = `NOTEBOOK: ${context.name}`;
      body = `SOURCES:\n${corpusFor(context.sources)}`;
      language = detectLanguage(
        context.sources.map((source) => source.text.slice(0, 500)),
      );
    }

    await assertAllowance(ctx, ownerId);

    const transcript = (history ?? [])
      .map(
        (entry, index) =>
          `Q${index + 1}: ${entry.question}\nStudent: ${entry.answer}\nExaminer: ${entry.feedback} (${entry.score}/5)`,
      )
      .join("\n\n");
    const last = turn >= 3;
    const prompt = [
      heading,
      topic?.trim() ? `TOPIC: ${topic.trim()}` : "",
      body,
      transcript ? `EARLIER IN THIS VIVA:\n${transcript}` : "",
      `THE QUESTION: ${question}`,
      `WHAT A STRONG ANSWER SHOULD CONTAIN:\n- ${expected.join("\n- ")}`,
      `THE STUDENT SAID: ${spoken}`,
      last
        ? "This is the final turn. Grade it, then write a two-sentence overall summary for the whole viva in `overall`, and set nextQuestion to null."
        : "Grade it, then ask one follow-up that probes the biggest gap. Provide its focus and expected points too.",
      "Return exactly: {\"score\":number,\"feedback\":string,\"missed\":[string],\"nextQuestion\":string|null,\"nextFocus\":string|null,\"nextExpected\":[string],\"overall\":string|null}.",
      ...languageDirective(language),
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, system, prompt, undefined, 0.35);
    await meter(ctx, ownerId, prompt, reply);
    const parsed = vivaReplySchema.parse(parseJsonLoose(reply.text));
    const score = Math.max(0, Math.min(5, Math.round(parsed.score)));
    const nextQuestion = last ? null : cleanSpoken(parsed.nextQuestion ?? "") || null;

    return {
      score,
      feedback: cleanAnswer(parsed.feedback),
      missed: (parsed.missed ?? []).map(cleanSpoken).slice(0, 6),
      nextQuestion,
      nextFocus: nextQuestion
        ? cleanSpoken(parsed.nextFocus ?? "") || null
        : null,
      nextExpected: nextQuestion
        ? (parsed.nextExpected ?? expected).map(cleanSpoken).slice(0, 6)
        : [],
      overall: last ? cleanAnswer(parsed.overall ?? parsed.feedback) : null,
      model: reply.model,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Audio overview                                                      */
/* ------------------------------------------------------------------ */

const AUDIO_SYSTEM = [
  "You write short study audio scripts for Manthan, an Indian study app.",
  "You are given a notebook's sources. Write a spoken overview that teaches the material in the order it should be understood.",
  "The script is spoken by browser text-to-speech: write only words to be said. No stage directions, no [pause], no speaker labels inside the text, no timestamps, no Markdown.",
  "Indian English, natural and warm; use the student's subject vocabulary and keep the sentences short enough to speak.",
  "Ground every claim in the sources. You may connect ideas and give examples, but never invent a fact, figure or name that the sources do not support.",
  "For a two-host script, alternate A and B as two classmates revising together: A introduces and asks, B explains, both build on each other. Do not let one host lecture for more than two segments in a row.",
  "Open with one line that names what is being revised. Close with one line naming the two things to remember.",
  "No ads, no greetings to an audience, no 'subscribe'.",
].join(" ");

const audioSchema = z.object({
  title: z.string().min(1),
  segments: z
    .array(
      z.object({
        speaker: z.enum(["A", "B"]).catch("A"),
        text: z.string().min(1),
      }),
    )
    .min(3),
});

export const audioOverview = action({
  args: {
    notebookId: v.id("notebooks"),
    style: v.union(v.literal("duo"), v.literal("solo")),
  },
  handler: async (
    ctx,
    { notebookId, style },
  ): Promise<{
    title: string;
    style: "duo" | "solo";
    segments: { speaker: "A" | "B"; text: string }[];
    sources: string[];
    model: string;
  }> => {
    const { name, ownerId, sources } = await ctx.runQuery(
      internal.notebookContext.studioContext,
      { notebookId },
    );
    if (!sources.length) {
      throw new Error(
        "Add a readable source first — the audio overview is written from your sources, not from the internet.",
      );
    }
    await assertAllowance(ctx, ownerId);

    const language = detectLanguage(sources.map((source) => source.text.slice(0, 500)));
    const prompt = [
      `NOTEBOOK: ${name}`,
      `SOURCES:\n${corpusFor(sources)}`,
      style === "duo"
        ? "Write a two-host audio overview (A and B), nine to fourteen segments, about four to six minutes when spoken."
        : "Write a solo audio overview (all segments speaker A), six to nine segments, about three to four minutes when spoken.",
      "Each segment is one or two sentences, 12 to 38 words. Alternate speakers in the duo version.",
      ...languageDirective(language),
      "Reply with a single JSON object and nothing else: {\"title\":string,\"segments\":[{\"speaker\":\"A\"|\"B\",\"text\":string}]}.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const first = await callModel(candidates, AUDIO_SYSTEM, prompt, undefined, 0.5);
    await meter(ctx, ownerId, prompt, first);
    let parsed: z.infer<typeof audioSchema>;
    let model = first.model;
    try {
      parsed = audioSchema.parse(parseJsonLoose(first.text));
    } catch {
      const retryPrompt = [
        prompt,
        "CORRECTION: the last reply was not a valid JSON object. Reply with the JSON object only.",
      ].join("\n\n");
      const retry = await callModel(
        candidates,
        AUDIO_SYSTEM,
        retryPrompt,
        undefined,
        0.25,
      );
      await meter(ctx, ownerId, retryPrompt, retry);
      parsed = audioSchema.parse(parseJsonLoose(retry.text));
      model = retry.model;
    }

    const segments = parsed.segments
      .map((segment) => ({
        speaker: style === "solo" ? ("A" as const) : segment.speaker,
        text: cleanSpoken(segment.text),
      }))
      .filter((segment) => segment.text.length > 0)
      .slice(0, 18);

    if (!segments.length) throw new Error("The script came back empty. Try again.");

    return {
      title: cleanProse(parsed.title),
      style,
      segments,
      sources: sources.map((source) => source.name),
      model,
    };
  },
});
