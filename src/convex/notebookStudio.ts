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
  ): Promise<{ answer: string; sources: string[]; model: string }> => {
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
    // reply is a receipt rather than the whole library restated.
    const cited = sources
      .filter((source) => answer.toLowerCase().includes(source.name.toLowerCase()))
      .map((source) => source.name);

    return {
      answer,
      sources: cited,
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
