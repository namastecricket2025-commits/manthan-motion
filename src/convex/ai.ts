"use node";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
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

const NO_KEY_MESSAGE =
  "No AI key is configured yet. Add GEMINI_API_KEY (free key from aistudio.google.com/apikey) " +
  "or OPENAI_API_KEY in the project's Keys tab, then generate again.";

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
/* Model providers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ordered candidates — the first that answers is the one used.
 *
 * Google retires models for new accounts without removing them from
 * `/v1beta/models` (a listing entry is not proof a model will run), and the
 * flagship tier answers 503 while it is busy, so a single hard-coded model is
 * not a working configuration. `AI_MODEL` pins exactly one and switches the
 * fallback off.
 */
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];

/** Overloaded / rate limited: worth one retry, then move to the next model. */
const TRANSIENT =
  /high demand|overloaded|try again|rate limit|resource.?exhausted/i;

/**
 * Account-level failures: every other candidate fails identically.
 */
const FATAL =
  /api key not valid|api_key_invalid|permission denied|permission_denied|billing|not enabled|has been disabled/i;

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

/** The provider itself refused on quota grounds (429 / RESOURCE_EXHAUSTED). */
function isProviderQuotaError(status: number, message: string) {
  return (
    status === 429 ||
    /resource.?exhausted|quota|rate.?limit/i.test(message)
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The model that answered last time, tried first next time.
 *
 * `generate` runs one request per artefact, so without this memo every extra
 * summary/flashcard/quiz set would re-discover that the flagship tier is busy
 * from scratch — several seconds and two wasted requests each. Only successes
 * are remembered, and the full chain still runs if the memo stops working.
 */
let lastGoodModel: string | undefined;

const BUSY_COOLDOWN_MS = 90_000;

/**
 * Models that came back overloaded get pushed to the back of the order for the
 * next call, so one busy tier does not cost every artefact two requests.
 *
 * This is only a hint: a cooled-down model is still tried when nothing else
 * answers, and the map lives in the process, so it self-heals.
 */
const busyUntil = new Map<string, number>();

function orderCandidates(models: string[], prefer?: string) {
  const now = Date.now();
  const fresh = models.filter((model) => (busyUntil.get(model) ?? 0) <= now);
  const cooling = models.filter((model) => (busyUntil.get(model) ?? 0) > now);

  if (prefer && fresh.includes(prefer)) {
    return [prefer, ...fresh.filter((model) => model !== prefer), ...cooling];
  }
  return [...fresh, ...cooling];
}

type ProviderConfig = {
  provider: "gemini" | "openai";
  apiKey: string;
  models: string[];
};

function resolveProvider(): ProviderConfig {
  const explicit = (process.env.AI_PROVIDER ?? "").toLowerCase();
  const geminiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (explicit === "openai" || (!geminiKey && openaiKey)) {
    if (!openaiKey) throw new Error(NO_KEY_MESSAGE);
    return {
      provider: "openai",
      apiKey: openaiKey,
      models: [process.env.AI_MODEL?.trim() || "gpt-4o-mini"],
    };
  }
  if (geminiKey) {
    const pinned = process.env.AI_MODEL?.trim();
    return {
      provider: "gemini",
      apiKey: geminiKey,
      models: pinned ? [pinned] : GEMINI_MODELS,
    };
  }
  throw new Error(NO_KEY_MESSAGE);
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

/** One request. Returns the failure as a value so the fallback can read it. */
async function geminiAttempt(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
): Promise<
  { ok: true; text: string; tokens?: number } | { ok: false; status: number; message: string }
> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    const payload = (await response.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          payload?.error?.message ??
          `The model request failed (${response.status}).`,
      };
    }
    return {
      ok: true,
      text:
        payload?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? "",
      tokens:
        payload?.usageMetadata?.totalTokenCount ??
        undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : "network error",
    };
  }
}

/**
 * Walk the candidate list until a model returns text.
 *
 * Two distinct failures are handled differently on purpose: a *retired* model
 * (404, "no longer available to new users") is skipped silently because the next
 * candidate is fine, while a *rejected key* aborts immediately because every
 * remaining candidate would fail the same way.
 */
async function callGemini(
  config: ProviderConfig,
  system: string,
  prompt: string,
  prefer?: string,
): Promise<{ text: string; model: string; tokens?: number }> {
  const failures: string[] = [];
  const candidates = orderCandidates(config.models, prefer);

  for (const model of candidates) {
    let overloaded = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await geminiAttempt(config.apiKey, model, system, prompt);

      if (result.ok) {
        if (result.text.trim()) {
          lastGoodModel = model;
          busyUntil.delete(model);
          return { text: result.text, model, tokens: result.tokens };
        }
        failures.push(`${model}: the model replied with nothing`);
        break;
      }

      failures.push(`${model}: ${result.message}`);

      if (
        result.status === 401 ||
        result.status === 403 ||
        FATAL.test(result.message)
      ) {
        throw new Error(result.message);
      }

      // Overload is worth one more go; a retired model is not.
      if (!TRANSIENT.test(result.message) && result.status < 500) break;
      overloaded = true;
      if (attempt === 0) await sleep(600);
    }

    if (overloaded) busyUntil.set(model, Date.now() + BUSY_COOLDOWN_MS);
  }

  throw new Error(
    `No Gemini model answered. ${failures.slice(-3).join(" · ")}`,
  );
}

async function callModel(
  config: ProviderConfig,
  system: string,
  prompt: string,
  prefer?: string,
): Promise<{ text: string; model: string; tokens?: number }> {
  if (config.provider === "gemini") {
    return await callGemini(config, system, prompt, prefer ?? lastGoodModel);
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.models[0],
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? `The model request failed (${response.status}).`,
    );
  }
  return {
    text: payload?.choices?.[0]?.message?.content ?? "",
    model: config.models[0],
    tokens: payload?.usage?.total_tokens,
  };
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
    { kind: Kind; ok: boolean; error?: string; quotaExceeded?: boolean }[]
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

    const config = resolveProvider();
    const results: {
      kind: Kind;
      ok: boolean;
      error?: string;
      quotaExceeded?: boolean;
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
        const { text: raw, model, tokens } = await callModel(
          config,
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
          model: `${config.provider}:${model}`,
        });

        results.push({ kind, ok: true });
      } catch (error) {
        // The provider's own quota refusal also stops the run — retrying the
        // remaining artefacts would just burn more of a day that is already out.
        if (error instanceof Error && isProviderQuotaError(429, error.message)) {
          await ctx.runMutation(internal.usage.record, {
            userId,
            tokens: 0,
            requests: 0,
          });
          results.push({
            kind,
            ok: false,
            quotaExceeded: true,
            error: "The AI provider's free quota for today is used up. Your allowance resets soon — see the usage card on the dashboard.",
          });
          break;
        }
        results.push({
          kind,
          ok: false,
          error:
            error instanceof Error ? error.message : "Generation failed.",
        });
      }
    }

    return results;
  },
});
