"use node";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { callModel, ProviderUnavailable, resolveCandidates } from "./providers";
import { msUntilReset } from "./usage";
import { v } from "convex/values";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";

/**
 * The generation pipeline.
 *
 * Everything in this file runs in Node (Convex `"use node"`), because it needs
 * to decrypt PDFs, scrape pages and wait on a model.
 *
 *   1. `ingestFile` / `ingestLink` — turn an upload or a URL into plain text and
 *      store it on the source row. If the text cannot be read, the source is
 *      saved as `failed` with a reason instead of being silently dropped.
 *   2. `generate` — build one prompt per requested artefact from the sources'
 *      extracted text, ask the model for strict JSON, validate it with zod and
 *      save the result. Nothing is ever invented locally: if there is no
 *      readable source text, generation refuses to run.
 *
 * Keys are read from the deployment environment (`process.env`), so they stay
 * server-side and never reach the browser.
 */

const MAX_SOURCE_TEXT = 200_000; // per source
const MAX_CORPUS = 120_000; // total characters handed to the model

/** Rough token estimate — models chunk English prose near 4 chars/token. */
const CHARS_PER_TOKEN = 4;

const kindValidator = v.union(
  v.literal("summary"),
  v.literal("flashcards"),
  v.literal("quiz"),
  v.literal("mindmap"),
  v.literal("slides"),
);

type Kind = "summary" | "flashcards" | "quiz" | "mindmap" | "slides";

/* ------------------------------------------------------------------ */
/* Text extraction                                                     */
/* ------------------------------------------------------------------ */

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** PDF → text, via pdf.js (bundled with unpdf). */
async function extractPdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
}

function tidy(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

/* ------------------------------------------------------------------ */
/* Manthan's own daily allowance                                       */
/* ------------------------------------------------------------------ */

/**
 * The free tier ran out for today — an expected, recoverable state, not a
 * crash. It gets its own error class so the UI can show the usage card and a
 * reset time instead of a raw provider dump.
 */
export class QuotaError extends Error {
  resetsAt: number;
  constructor(resetsAt: number) {
    super("Daily generation allowance reached.");
    this.name = "QuotaError";
    this.resetsAt = resetsAt;
  }
}

function parseJsonLoose(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The model replied with something that was not valid JSON.");
  }
}

/* ------------------------------------------------------------------ */
/* Output contracts                                                    */
/* ------------------------------------------------------------------ */

const summarySchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        points: z.array(z.string().min(1)).min(1),
        source: z.string().optional(),
      }),
    )
    .min(1),
  keyTerms: z
    .array(z.object({ term: z.string(), meaning: z.string() }))
    .optional(),
});

const flashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
        source: z.string().optional(),
      }),
    )
    .min(1),
});

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        answer: z.number(),
        explanation: z.string().optional(),
        source: z.string().optional(),
      }),
    )
    .min(1),
});

const mindmapSchema = z.object({
  root: z.string().min(1),
  branches: z
    .array(
      z.object({
        title: z.string().min(1),
        children: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
});

const slidesSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

const SYSTEM = [
  "You are Manthan's study-material engine. You turn a student's own sources into revision material.",
  "Work ONLY from the supplied sources. Never add facts, figures, dates, examples or citations that are not in them.",
  "If the sources are thin on something, cover less rather than guessing, and keep the student's terminology.",
  "Reply with a single JSON object and nothing else — no prose, no markdown fences.",
].join(" ");

const KIND_SPECS: Record<Kind, { task: string; shape: string; extras: string }> =
  {
    summary: {
      task: "Write a revision summary of the sources.",
      shape:
        '{"title":string,"overview":string,"sections":[{"heading":string,"points":[string],"source":string}],"keyTerms":[{"term":string,"meaning":string}]}',
      extras:
        "3-6 sections with 3-5 short points each (one idea per point). overview is 2-4 sentences. 4-10 keyTerms. `source` is the exact name of the source the section came from.",
    },
    flashcards: {
      task: "Write active-recall flashcards.",
      shape: '{"cards":[{"front":string,"back":string,"source":string}]}',
      extras:
        "10-18 cards. The front is one focused question or prompt; the back is the shortest complete answer. `source` is the source file or link name.",
    },
    quiz: {
      task: "Write a practice quiz with multiple-choice questions.",
      shape:
        '{"questions":[{"question":string,"options":[string,string,string,string],"answer":number,"explanation":string,"source":string}]}',
      extras:
        "6-12 questions. Exactly 4 plausible options each. `answer` is the 0-based index of the correct option. `explanation` says why, in one or two sentences, and may quote the source.",
    },
    mindmap: {
      task: "Build a mind map of the material as a hierarchy.",
      shape: '{"root":string,"branches":[{"title":string,"children":[string]}]}',
      extras:
        "`root` is the notebook topic. 4-8 branches, each with 2-5 short child labels (2-7 words). Labels, not sentences.",
    },
    slides: {
      task: "Build a slide deck outline that a student could present from.",
      shape:
        '{"title":string,"subtitle":string,"slides":[{"title":string,"bullets":[string],"notes":string}]}',
      extras:
        "6-12 slides. 3-5 bullets per slide, each under 14 words. `notes` is a one-sentence speaker prompt.",
    },
  };

function buildPrompt(kind: Kind, notebookName: string, corpus: string) {
  const spec = KIND_SPECS[kind];
  return [
    `Notebook: ${notebookName}`,
    `Task: ${spec.task}`,
    `Return exactly this shape: ${spec.shape}`,
    spec.extras,
    "",
    "SOURCES (name — text):",
    corpus,
  ].join("\n");
}

function fallbackTitle(kind: Kind, payload: unknown, notebook: string) {
  if (kind === "summary" || kind === "slides") {
    const title = (payload as { title?: string }).title;
    if (title) return title;
  }
  if (kind === "mindmap") {
    const root = (payload as { root?: string }).root;
    if (root) return root;
  }
  if (kind === "flashcards") {
    const cards = (payload as { cards?: unknown[] }).cards ?? [];
    return `${cards.length} flashcards · ${notebook}`;
  }
  return `${notebook} quiz`;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Uploaded file → extracted text on a new source row. */
export const ingestFile = action({
  args: {
    notebookId: v.id("notebooks"),
    storageId: v.id("_storage"),
    name: v.string(),
    mime: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { notebookId, storageId, name, mime, size },
  ): Promise<Id<"sources">> => {
    await ctx.runQuery(internal.materials.assertNotebook, { notebookId });

    const detail =
      typeof size === "number"
        ? `${(size / 1024 / 1024).toFixed(1)} MB${mime ? ` · ${mime.split("/")[1]?.toUpperCase() ?? ""}` : ""}`
        : undefined;

    const blob = await ctx.storage.get(storageId);
    if (!blob) throw new Error("The upload did not reach storage. Try again.");

    const buffer = Buffer.from(await blob.arrayBuffer());
    const lower = name.toLowerCase();
    const isText =
      (mime?.startsWith("text/") ?? false) ||
      /\.(txt|md|markdown|csv|json|ts|tsx|js|py|rtf|html?)$/i.test(lower);
    const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");

    let text = "";
    let error: string | undefined;

    try {
      if (isText) {
        text = buffer.toString("utf8");
        if (lower.endsWith(".html") || lower.endsWith(".htm")) {
          text = stripHtml(text);
        }
      } else if (isPdf) {
        text = await extractPdfText(new Uint8Array(buffer));
      } else {
        error =
          "Manthan reads PDF, text, Markdown and CSV files right now. Paste this file's text instead.";
      }
    } catch {
      error =
        "That file could not be read — it may be scanned images or password protected. Paste its text instead.";
    }

    const clean = tidy(text);
    if (!error && clean.length < 40) {
      error =
        "No readable text was found in that file — if it is a scan, paste the text instead.";
    }

    return await ctx.runMutation(internal.sources.insertSource, {
      notebookId,
      kind: "file",
      name,
      detail,
      storageId,
      text: error ? undefined : clean.slice(0, MAX_SOURCE_TEXT),
      status: error ? "failed" : "ready",
      error,
    });
  },
});

/** Pasted URL → fetched, tag-stripped text on a new source row. */
export const ingestLink = action({
  args: { notebookId: v.id("notebooks"), url: v.string() },
  handler: async (
    ctx,
    { notebookId, url },
  ): Promise<Id<"sources">> => {
    await ctx.runQuery(internal.materials.assertNotebook, { notebookId });

    let target: URL;
    try {
      target = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    } catch {
      throw new Error("That does not look like a valid link.");
    }
    if (!/^https?:$/.test(target.protocol)) {
      throw new Error("Only http(s) links can be read.");
    }

    const detail = target.hostname.replace(/^www\./, "").slice(0, 80);
    let text = "";
    let error: string | undefined;

    try {
      const response = await fetch(target.toString(), {
        headers: { "user-agent": "ManthanBot/1.0 (+study material)" },
      });
      if (!response.ok) {
        error = `That page returned ${response.status}. Paste the text instead.`;
      } else {
        const type = response.headers.get("content-type") ?? "";
        const body = (await response.text()).slice(0, 1_500_000);
        text = type.includes("html") || /<html/i.test(body)
          ? stripHtml(body)
          : body;
      }
    } catch {
      error =
        "That page could not be fetched — it may block bots or need a login. Paste the text instead.";
    }

    const clean = tidy(text);
    if (!error && clean.length < 200) {
      error =
        "That page had almost no readable text — it may need a login. Paste the text instead.";
    }

    return await ctx.runMutation(internal.sources.insertSource, {
      notebookId,
      kind: "link",
      name: url,
      detail,
      text: error ? undefined : clean.slice(0, MAX_SOURCE_TEXT),
      status: error ? "failed" : "ready",
      error,
    });
  },
});

/** Re-run extraction for a source that failed (or after a bad fetch). */
export const reExtract = action({
  args: { sourceId: v.id("sources") },
  handler: async (
    ctx,
    { sourceId },
  ): Promise<{ ok: boolean; error?: string }> => {
    const source = await ctx.runQuery(internal.sources.getSource, {
      sourceId,
    });
    if (!source) throw new Error("Source not found.");

    let text = "";
    let error: string | undefined;

    if (source.kind === "file" && source.storageId) {
      const blob = await ctx.storage.get(source.storageId);
      if (!blob) throw new Error("The stored file is gone — add it again.");
      const buffer = Buffer.from(await blob.arrayBuffer());
      const lower = source.name.toLowerCase();
      try {
        if (lower.endsWith(".pdf")) {
          text = await extractPdfText(new Uint8Array(buffer));
        } else if (
          /\.(txt|md|markdown|csv|json|ts|tsx|js|py|rtf|html?)$/i.test(lower)
        ) {
          text = buffer.toString("utf8");
        } else {
          error = "Manthan cannot read that file type yet.";
        }
      } catch {
        error = "That file still cannot be read.";
      }
    } else if (source.kind === "link") {
      try {
        const response = await fetch(source.name, {
          headers: { "user-agent": "ManthanBot/1.0 (+study material)" },
        });
        const body = (await response.text()).slice(0, 1_500_000);
        text = /<html/i.test(body) ? stripHtml(body) : body;
      } catch {
        error = "That page still cannot be fetched.";
      }
    } else {
      error = "Notes you typed are already text.";
    }

    const clean = tidy(text);
    if (!error && clean.length < 40) error = "Still no readable text found.";

    await ctx.runMutation(internal.sources.setExtraction, {
      sourceId,
      text: error ? undefined : clean.slice(0, MAX_SOURCE_TEXT),
      status: error ? "failed" : "ready",
      error,
    });

    return { ok: !error, error };
  },
});

/**
 * Churn a notebook's sources into the requested artefacts.
 *
 * Spend is metered: the day's ledger is checked before anything runs, tokens
 * actually consumed are written back after each call, and a day that is out of
 * allowance fails fast with a QuotaError (surfaced to the UI as `quotaExceeded`)
 * instead of half-running and dying on the provider's own 429.
 */
export const generate = action({
  args: { notebookId: v.id("notebooks"), kinds: v.array(kindValidator) },
  handler: async (
    ctx,
    { notebookId, kinds },
  ): Promise<
    {
      kind: Kind;
      ok: boolean;
      error?: string;
      quotaExceeded?: boolean;
      rateLimited?: boolean;
      providerExhausted?: boolean;
    }[]
  > => {
    if (kinds.length === 0) throw new Error("Pick at least one thing to generate.");

    const userId = await ctx.runQuery(internal.materials.assertOwner, {
      notebookId,
    });

    const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, {
      userId,
    });
    const resetsAt = Date.now() + msUntilReset();
    if (usage.used >= usage.limit) {
      throw new QuotaError(resetsAt);
    }

    const context = await ctx.runQuery(internal.materials.sourceContext, {
      notebookId,
    });
    const usable = context.sources.filter(
      (source) => source.status !== "failed" && source.text.trim().length > 0,
    );
    if (usable.length === 0) {
      throw new Error(
        "Nothing to churn yet — add a source whose text Manthan can read.",
      );
    }

    // Trim the corpus to the model budget, newest sources last so the earliest
    // (usually the core material) survives truncation.
    let budget = MAX_CORPUS;
    const parts: string[] = [];
    for (const source of usable) {
      const slice = source.text.slice(0, Math.max(0, budget));
      if (!slice) break;
      budget -= slice.length;
      parts.push(`--- ${source.name} ---\n${slice}`);
      if (budget <= 0) break;
    }
    const corpus = parts.join("\n\n");

    const candidates = await resolveCandidates();
    const results: {
      kind: Kind;
      ok: boolean;
      error?: string;
      quotaExceeded?: boolean;
      rateLimited?: boolean;
      providerExhausted?: boolean;
    }[] = [];

    let remaining = usage.limit - usage.used;

    for (const kind of kinds) {
      if (remaining <= 0) {
        results.push({
          kind,
          ok: false,
          quotaExceeded: true,
          error: `Daily allowance reached — resets at ${new Date(resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        });
        continue;
      }

      try {
        const { text: raw, model, provider, tokens } = await callModel(
          candidates,
          SYSTEM,
          buildPrompt(kind, context.notebookName, corpus),
        );

        // Meter what the call actually cost, falling back to the estimate.
        const spent =
          tokens ??
          Math.round(
            (buildPrompt(kind, context.notebookName, corpus).length + raw.length) /
              CHARS_PER_TOKEN,
          );
        await ctx.runMutation(internal.usage.record, {
          userId,
          tokens: spent,
          requests: 1,
        });
        remaining -= spent;

        const json = parseJsonLoose(raw);

        const parsed =
          kind === "summary"
            ? summarySchema.parse(json)
            : kind === "flashcards"
              ? flashcardsSchema.parse(json)
              : kind === "quiz"
                ? quizSchema.parse(json)
                : kind === "mindmap"
                  ? mindmapSchema.parse(json)
                  : slidesSchema.parse(json);

        // Keep quiz answers inside their option list; a stray index would make
        // the runner claim a wrong answer is right.
        if (kind === "quiz") {
          const quiz = parsed as z.infer<typeof quizSchema>;
          for (const question of quiz.questions) {
            if (
              !Number.isInteger(question.answer) ||
              question.answer < 0 ||
              question.answer >= question.options.length
            ) {
              question.answer = 0;
            }
          }
        }

        await ctx.runMutation(internal.materials.save, {
          notebookId,
          kind,
          title: fallbackTitle(kind, parsed, context.notebookName),
          payload: parsed,
          sourceIds: usable.map((source) => source.id),
          model: `${provider}:${model}`,
        });

        results.push({ kind, ok: true });
      } catch (error) {
        // The model chain is exhausted. Which flavour matters to the student:
        // a per-day exhaustion is the *providers'* free capacity, not
        // Manthan's allowance, and saying otherwise sent people to the Plans
        // page over a limit they had not reached.
        if (error instanceof ProviderUnavailable) {
          if (error.dayExhausted && !error.rateLimited) {
            results.push({
              kind,
              ok: false,
              providerExhausted: true,
              error:
                "Every AI model behind Manthan has used its free capacity for today. Your own allowance is untouched — add another key in the Keys tab, or see Plans for a higher cap.",
            });
          } else {
            const wait = error.retryAfterMs
              ? ` About ${Math.ceil(error.retryAfterMs / 1000)}s to go.`
              : "";
            results.push({
              kind,
              ok: false,
              rateLimited: true,
              error: `The AI models are busy right now, so nothing was generated.${wait} Try again in a minute — your allowance is untouched.`,
            });
          }
          break;
        }

        results.push({
          kind,
          ok: false,
          error: error instanceof Error ? error.message : "Generation failed.",
        });
      }
    }

    return results;
  },
});
