"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";
import { callModel, resolveCandidates } from "./providers";
import { verifyAnswer, type Verification } from "./mathVerify";
import {
  MAX_CORPUS,
  MATH_SYSTEM,
  UploadUnreadable,
  detectLanguage,
  languageDirective,
  languageLock,
  parseJsonLoose,
  readUpload,
  tidy,
} from "./ai";
import {
  MAX_MATH_IMAGE,
  SOLVE_METHODS,
  cleanLatex,
  cleanProse,
  mathProblemSchema,
  type SolvedProblem,
} from "./mathPrompts";

/**
 * The Math Lab's equation engine.
 *
 * Two things make this different from a plain "ask the model" call, and both
 * exist because the old version got them wrong:
 *
 *   1. The model returns *structure*, never a blob. Every step arrives as four
 *      separate fields — `explanation` is prose, `expression` is LaTeX — so the
 *      notebook never has to guess where the English stops and the maths starts.
 *      The old single string had to be split by guesswork on the way to the
 *      screen, which is how "to an equivalent fraction" came out of the maths
 *      renderer as unreadable italic mush.
 *
 *   2. The arithmetic is checked here, not by the model. Every final answer is
 *      re-worked by an independent engine — exact rational arithmetic first,
 *      a numeric engine only when the exact reader is silent — and a
 *      disagreement goes back to the model exactly once, carrying the value the
 *      checker trusts. A maths app that confidently prints a wrong answer has
 *      failed at the only thing it is for.
 *
 * Unauthenticated on purpose, like the Canvas Solver: the lab itself is
 * plan-gated in the UI, and nothing here touches the daily allowance.
 */

/** What the model is asked for. The checker's fields are added afterwards. */
const modelSolutionSchema = z.object({
  headline: z.string().min(1),
  problems: z.array(mathProblemSchema).min(1),
});

/** Shown when an answer could not be re-worked by an independent engine. */
const UNCHECKED =
  "This one could not be recomputed independently, so it is shown exactly as the tutor wrote it.";

type Parsed = z.infer<typeof modelSolutionSchema>;

/**
 * Turn one parsed problem plus the checker's verdict into what is rendered.
 *
 * Shared with the practice generator in `mathTutor.ts`, which produces the
 * same object from a freshly written problem, so a practice question and a
 * solved one can never drift apart in shape or in how the checker's verdict is
 * folded in.
 */
export function finalizeProblem(
  entry: z.infer<typeof mathProblemSchema>,
  check?: Verification,
): SolvedProblem {
  const verdict: Verification = check ?? {
    status: "unverifiable",
    note: UNCHECKED,
  };
  // `corrected` only when there is a value to put in its place.
  const corrected =
    verdict.status === "mismatch" && Boolean(verdict.verifiedLatex);
  const checkNote = cleanProse(verdict.note);

  return {
    problem: cleanLatex(entry.problem),
    title: cleanProse(entry.title),
    given: entry.given.map(cleanProse),
    formulas: entry.formulas.map(cleanLatex),
    steps: entry.steps.map((step) => ({
      title: cleanProse(step.title),
      explanation: cleanProse(step.explanation),
      expression: cleanLatex(step.expression),
      rule: cleanProse(step.rule),
    })),
    // When the checker disagreed, its value is the one the student sees.
    finalAnswer: corrected
      ? cleanLatex(verdict.verifiedLatex ?? "")
      : cleanLatex(entry.finalAnswer),
    verification:
      verdict.status === "unverifiable"
        ? cleanProse(entry.verification) || checkNote
        : checkNote,
    verified: verdict.status === "match" || corrected,
    corrected,
    checkNote,
  };
}

/** The sentence sent back to the model when the checker disagreed. */
function correctionLines(parsed: Parsed, checks: Verification[]): string {
  return parsed.problems
    .map((entry, index) => {
      const check = checks[index];
      if (!check || check.status !== "mismatch" || !check.verifiedText) {
        return "";
      }
      return (
        '- "' +
        entry.problem +
        '" was answered as ' +
        entry.finalAnswer +
        ", but an independent engine recomputes it as " +
        check.verifiedText +
        "."
      );
    })
    .filter(Boolean)
    .join("\n");
}

/** How many answers the independent engine disagreed with. */
function mismatches(checks: Verification[]): number {
  return checks.filter((check) => check.status === "mismatch").length;
}

export const mathSolve = action({
  args: {
    /** The typed question, when the student pasted or typed one. */
    question: v.optional(v.string()),
    /** A photographed question sheet, base64, no data-url prefix. */
    imageBase64: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    /** Or an uploaded file, read through the same pipeline as notebooks. */
    storageId: v.optional(v.id("_storage")),
    name: v.optional(v.string()),
    mime: v.optional(v.string()),
    /** Syllabus context for the selected curriculum track and skill. */
    gradeLabel: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    chapterFormulas: v.optional(v.array(v.string())),
    /** Which voice explains the working. The algebra does not change. */
    method: v.optional(
      v.union(v.literal("standard"), v.literal("visual"), v.literal("analogy")),
    ),
    /** Follow-up conversation, oldest first. */
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
    {
      question,
      imageBase64,
      mimeType,
      storageId,
      name,
      mime,
      gradeLabel,
      chapterName,
      chapterFormulas,
      method,
      history,
    },
  ): Promise<{ headline: string; problems: SolvedProblem[]; model: string }> => {
    const trimmedQuestion = question?.trim() ?? "";
    if (!trimmedQuestion && !imageBase64 && !storageId) {
      throw new Error(
        "Give the engine something to solve — a typed equation, a photo or a file.",
      );
    }
    if (imageBase64 && imageBase64.length > MAX_MATH_IMAGE) {
      throw new Error(
        "That image is too large to read. Crop it to the question and try again.",
      );
    }

    // An uploaded file is read once and dropped — the text is all we keep.
    let fileText = "";
    const fileName = name ?? "";
    if (storageId) {
      const blob = await ctx.storage.get(storageId);
      if (!blob) throw new Error("The upload did not reach storage. Try again.");
      const buffer = Buffer.from(await blob.arrayBuffer());
      await ctx.storage.delete(storageId);
      try {
        fileText = (await readUpload(buffer, fileName, mime)).text;
      } catch (err) {
        if (err instanceof UploadUnreadable) throw err;
        throw new Error(
          "The engine reads PDF, Word, photos and text files. This one could not be read — paste the equation instead.",
        );
      }
      fileText = tidy(fileText).slice(0, MAX_CORPUS);
      if (fileText.length < 20) {
        throw new Error(
          "No readable problem was found in that file — paste the equation instead.",
        );
      }
    }

    // The question's own language decides the reply's language.
    const language = detectLanguage([fileText, trimmedQuestion].filter(Boolean));
    const transcript = (history ?? [])
      .slice(-6)
      .map((turn) => `${turn.role === "student" ? "Student" : "Engine"}: ${turn.text}`)
      .join("\n");

    const prompt = [
      imageBase64
        ? "Solve the mathematics problem shown in the attached photograph."
        : "Solve the mathematics problem below.",
      fileText
        ? `ATTACHED EXTRACT${fileName ? ` (${fileName})` : ""}:\n${fileText}`
        : "",
      trimmedQuestion ? `PROBLEM: ${trimmedQuestion}` : "",
      gradeLabel
        ? `Syllabus context: ${gradeLabel}${chapterName ? `, chapter ${chapterName}` : ""}.`
        : "",
      chapterFormulas && chapterFormulas.length > 0
        ? `Formulas this chapter is examined on (use the one that fits, or say why none does):\n- ${chapterFormulas.join("\n- ")}`
        : "",
      transcript
        ? `This is a follow-up turn. CONVERSATION SO FAR:\n${transcript}`
        : "",
      SOLVE_METHODS[method ?? "standard"],
      ...languageDirective(language),
      "Reply with the JSON object only.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const image =
      imageBase64 && mimeType ? { mimeType, data: imageBase64 } : undefined;

    const candidates = await resolveCandidates();
    const first = await callModel(candidates, MATH_SYSTEM, prompt, image, 0.2);

    let parsed: Parsed = modelSolutionSchema.parse(parseJsonLoose(first.text));
    let modelShown = first.model;
    let checks = parsed.problems.map((entry) =>
      verifyAnswer(entry.problem, entry.finalAnswer),
    );

    if (mismatches(checks) > 0) {
      const corrections = correctionLines(parsed, checks);
      try {
        const retry = await callModel(
          candidates,
          MATH_SYSTEM,
          [
            prompt,
            "CORRECTION: an independent maths engine re-worked this problem and disagreed with the final answers listed below. Re-derive each one from scratch and reply with the WHOLE JSON object again, with every step consistent with the corrected value. Keep fractions exact — never round one into a decimal to make it fit.",
            corrections,
            "Reply with the JSON object only.",
          ].join("\n\n"),
          image,
          0.1,
        );
        const retried: Parsed = modelSolutionSchema.parse(
          parseJsonLoose(retry.text),
        );
        const rechecks = retried.problems.map((entry) =>
          verifyAnswer(entry.problem, entry.finalAnswer),
        );
        // The retry is kept only when it is actually better, so a second bad
        // pass can never replace a first good one.
        if (mismatches(rechecks) < mismatches(checks)) {
          parsed = retried;
          checks = rechecks;
          modelShown = retry.model;
        }
      } catch {
        // A retry that will not parse leaves the first pass standing.
      }
    }

    const problems: SolvedProblem[] = parsed.problems.map((entry, index) =>
      finalizeProblem(entry, checks[index]),
    );

    return {
      headline: cleanProse(parsed.headline),
      problems,
      model: modelShown,
    };
  },
});

/** Storage ids are passed straight through, so keep the import meaningful. */
export type MathStorageId = Id<"_storage">;
