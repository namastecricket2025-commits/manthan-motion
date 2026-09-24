"use node";

import { action } from "./_generated/server";
import { callModel, resolveCandidates } from "./providers";
import { v } from "convex/values";
import { z } from "zod";

const STEM_SYSTEM = [
  "You are the step-by-step AI engine inside Manthan's STEM Lab, a premium school science workspace.",
  "Solve the Physics, Chemistry or Biology problem with a precise, exam-ready explanation.",
  "Name the governing law, formula or biological process at the start of every step so the student can see the method.",
  "Keep every unit, sign, coefficient and chemical state exact. Never invent values that are not in the question or image.",
  "No emoji, no markdown, no bullet symbols. Plain sentences and plain science notation in every string.",
  'Reply with one JSON object only: {"title":string,"domain":string,"inputs":string[],"formulas":string[],"steps":string[],"answer":string}.',
].join(" ");

const stemSchema = z.object({
  title: z.string().min(1),
  domain: z.string().min(1).catch("General science"),
  inputs: z.array(z.string().min(1)).min(1),
  formulas: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(1),
  answer: z.string().min(1),
});

function parseJson(text: string): unknown {
  const fenced = text.match(/\{[\s\S]*\}/);
  return JSON.parse(fenced?.[0] ?? text);
}

export const stemSolve = action({
  args: {
    question: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    subject: v.optional(v.string()),
    chapter: v.optional(v.string()),
  },
  handler: async (_ctx, { question, imageBase64, mimeType, subject, chapter }) => {
    const typedQuestion = question?.trim() ?? "";
    if (!typedQuestion && !imageBase64) throw new Error("Give the STEM engine a question or a scanned diagram.");
    if (imageBase64 && imageBase64.length > 5_500_000) throw new Error("That image is too large. Crop it to the question and try again.");

    const prompt = [
      imageBase64
        ? "Read the attached image and solve the science problem shown in it."
        : "Solve the science problem below.",
      typedQuestion ? `PROBLEM: ${typedQuestion}` : "",
      subject ? `Subject: ${subject}.` : "",
      chapter ? `Chapter: ${chapter}.` : "",
      "Reply with the JSON object only.",
    ].filter(Boolean).join("\n\n");
    const candidates = await resolveCandidates();
    const { text, model } = await callModel(
      candidates,
      STEM_SYSTEM,
      prompt,
      imageBase64 && mimeType ? { mimeType, data: imageBase64 } : undefined,
      0.2,
    );
    const parsed = stemSchema.parse(parseJson(text));
    const clean = (value: string) => value.replace(/[*_`#]/g, "").trim();
    return {
      title: clean(parsed.title),
      domain: clean(parsed.domain),
      inputs: parsed.inputs.map(clean),
      formulas: parsed.formulas.map(clean),
      steps: parsed.steps.map(clean),
      answer: clean(parsed.answer),
      model,
    };
  },
});
