"use node";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { LATEX_COMMANDS } from "./latexGuard";
import { callModel, ProviderUnavailable, resolveCandidates } from "./providers";
import { v } from "convex/values";
import { inflateRawSync } from "node:zlib";
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
export const MAX_CORPUS = 120_000; // total characters handed to the model

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

/* ---------------- ZIP (a .docx is one) ---------------- */

/**
 * Pull one file out of a ZIP archive.
 *
 * A .docx is a ZIP of XML parts, and the only part worth reading is
 * `word/document.xml`. Rather than take a dependency for it, the central
 * directory is walked — it is the one place filenames are guaranteed to be
 * complete (local headers may be streamed with size 0) — and the entry is
 * inflated with Node's own zlib. Returns null for anything it cannot read, so
 * the caller can fall back to a clear "paste the text instead" message.
 */
function readZipEntry(buffer: Buffer, wanted: RegExp): Buffer | null {
  try {
    // End Of Central Directory: signature 0x06054b50, at most 64 KiB from the
    // end (ZIP comment limit).
    let eocd = -1;
    const floor = Math.max(0, buffer.length - 65_557);
    for (let i = buffer.length - 22; i >= floor; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;

    const count = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);

    for (let entry = 0; entry < count; entry++) {
      if (offset + 46 > buffer.length) return null;
      if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;

      const method = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const nameLen = buffer.readUInt16LE(offset + 28);
      const extraLen = buffer.readUInt16LE(offset + 30);
      const commentLen = buffer.readUInt16LE(offset + 32);
      const localOffset = buffer.readUInt32LE(offset + 42);
      const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);

      if (wanted.test(name)) {
        const localNameLen = buffer.readUInt16LE(localOffset + 26);
        const localExtraLen = buffer.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localNameLen + localExtraLen;
        const raw = buffer.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        return null;
      }

      offset += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  } catch {
    return null;
  }
}

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

/**
 * A failure the student can act on. Its message is shown in the source row
 * verbatim, which is why every throw site below is phrased as advice rather
 * than as a diagnosis.
 */
export class UploadUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadUnreadable";
  }
}

/** Word document → plain text, keeping paragraph and line breaks. */
function extractDocxText(buffer: Buffer): string {
  const document = readZipEntry(buffer, /^word\/document\.xml$/i);
  if (!document) {
    throw new UploadUnreadable(
      "That Word file could not be opened. Save it as a PDF, or paste its text.",
    );
  }

  return decodeXmlEntities(
    document
      .toString("utf8")
      // Paragraph and line breaks are the only structure worth keeping.
      .replace(/<w:tab\b[^>]*\/?>/gi, " ")
      .replace(/<w:br\b[^>]*\/?>/gi, "\n")
      .replace(/<\/w:p>/gi, "\n")
      .replace(/<w:tr\b[^>]*>/gi, "\n")
      .replace(/<\/w:tc>/gi, " | ")
      // Everything else is formatting, styles or revision bookkeeping.
      .replace(/<[^>]+>/g, " "),
  );
}

/* ---------------- Photographs and scans ---------------- */

/** Formats the model can read directly; anything here skips the text layer. */
const IMAGE_RE = /\.(png|jpe?g|webp|heic|heif|bmp|gif)$/i;

/** ~4 MB of image. A phone photo of a page sits well under this. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const TRANSCRIBE_SYSTEM = [
  "You transcribe study material from a photograph: a textbook page, a notebook, a whiteboard or a printed question sheet.",
  "Write the text exactly as it appears, in the SAME language and the SAME script — Hindi stays in Devanagari, English stays in Latin. Never translate and never transliterate.",
  "Keep numbers, units, symbols, chemical formulae and equations exactly as written. Put each paragraph or question on its own line.",
  "Read mathematical function names letter by letter and keep reciprocal pairs apart: cos is never csc, sin is never sec, tan is never cot. Distinguish + from −, x from ×, and a superscript from a coefficient, and keep each fraction bar over exactly the terms printed beneath and above it.",
  "A reciprocal misread turns a true identity into a false one, so when a symbol is ambiguous prefer the reading that makes the printed statement consistent with itself.",
  "If the image also contains a diagram or figure, add one short sentence describing it, in the same language, after the text.",
  "Never summarise, never explain, never add anything that is not in the image. If the image is unreadable, return the single word UNREADABLE as the text.",
  'Reply with a single JSON object and nothing else: {"language":"hindi"|"english","text":string}.',
].join(" ");

const transcriptSchema = z.object({
  language: z.string().catch("english"),
  text: z.string().min(1),
});

function imageMimeFor(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.bmp$/i.test(name)) return "image/bmp";
  return "image/jpeg";
}

/**
 * A photograph or scan → its text, read by the model.
 *
 * This is the one place a notebook source needs vision, so the prompt is blunt
 * about the two failures that matter: translating the page into English, and
 * inventing content that is not there. A provider without vision answers 400
 * and the chain moves on; if none can see, the caller reports it instead of
 * quietly storing an empty source.
 */
async function transcribeImage(
  buffer: Buffer,
  mime: string,
  name: string,
): Promise<{ text: string; language?: "hi" | "en" }> {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new UploadUnreadable(
      "That photo is larger than 4 MB. Crop it to the page and add it again.",
    );
  }

  const candidates = await resolveCandidates();
  const { text } = await callModel(
    candidates,
    TRANSCRIBE_SYSTEM,
    `Transcribe every word of this image. It is a file named "${name}". Reply with the JSON object only.`,
    { mimeType: mime, data: buffer.toString("base64") },
  );

  let transcript = text;
  let language: "hi" | "en" | undefined;
  try {
    const parsed = transcriptSchema.parse(parseJsonLoose(text));
    transcript = parsed.text;
    if (/hindi|devanagari|हिंदी|हिन्दी/i.test(parsed.language)) language = "hi";
    else if (/english/i.test(parsed.language)) language = "en";
  } catch {
    // A model that ignored the JSON contract still gave us the words.
  }

  return { text: transcript, language };
}

/* ---------------- One entry point for every upload ---------------- */

interface ReadUpload {
  text: string;
  /** Set only when the reader itself knew the language (image transcription). */
  language?: "hi" | "en";
}

/**
 * Any supported upload → text.
 *
 * Called by adding a source and by re-running a failed one, so the two paths
 * can never drift apart in what they accept. Throws with a student-readable
 * message for anything it cannot read.
 */
export async function readUpload(
  buffer: Buffer,
  name: string,
  mime: string | undefined,
): Promise<ReadUpload> {
  const lower = name.toLowerCase();

  const isText =
    (mime?.startsWith("text/") ?? false) ||
    /\.(txt|md|markdown|csv|json|rtf|html?|ts|tsx|js|py)$/i.test(lower);
  if (isText) {
    const raw = buffer.toString("utf8");
    return { text: /\.html?$/i.test(lower) ? stripHtml(raw) : raw };
  }

  if (mime === "application/pdf" || /\.pdf$/i.test(lower)) {
    return { text: await extractPdfText(new Uint8Array(buffer)) };
  }

  if (
    /\.docx$/i.test(lower) ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return { text: extractDocxText(buffer) };
  }

  if (mime?.startsWith("image/") || IMAGE_RE.test(lower)) {
    return await transcribeImage(buffer, mime ?? imageMimeFor(lower), name);
  }

  throw new UploadUnreadable(
    "Manthan reads PDF, Word (.docx), photos and scans (JPG, PNG, WEBP), and plain text, Markdown or CSV files. Paste this file's text instead.",
  );
}

export function tidy(text: string) {
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

/**
 * The list matters because of an ambiguity JSON cannot see: `\times` starts
 * with the valid JSON escape `\t`, so a model that writes single-backslash
 * LaTeX inside a JSON string produces a tab followed by "imes" when the JSON
 * is decoded. The student then sees "times6" set as italic letters. Before
 * parsing, every backslash that introduces one of these commands is doubled,
 * which is what the model should have written in the first place.
 */

/**
 * Double the backslashes that introduce LaTeX commands, inside JSON strings
 * only. Ordinary escapes (`"`, `\\`, `\n`) are left exactly as they are.
 */
function escapeLatexInJson(raw: string, aggressive: boolean): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]!;
    if (!inString) {
      out += char;
      if (char === '"') inString = true;
      continue;
    }
    if (char === '"' && !escaped) {
      inString = false;
      out += char;
      continue;
    }
    if (char === "\\" && !escaped) {
      const run = /^([A-Za-z]+)/.exec(raw.slice(index + 1))?.[1] ?? "";
      const looksLatex = LATEX_COMMANDS.has(run);
      // Aggressive mode only runs after a normal parse has already failed,
      // so treating an unknown two-letter run as LaTeX is safe: the alternative
      // is rejecting a valid solution over a command the list does not name.
      if (looksLatex || (aggressive && run.length >= 2)) {
        out += "\\\\";
        continue;
      }
      out += char;
      escaped = true;
      continue;
    }
    out += char;
    escaped = false;
  }
  return out;
}

export function parseJsonLoose(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  /* The repaired form is tried FIRST. A JSON string containing `\times` parses
     successfully as a tab + "imes", so trying the raw text first would silently
     win and hand the corrupted value to the renderer. */
  const candidates = [
    escapeLatexInJson(cleaned, false),
    cleaned,
    escapeLatexInJson(cleaned, true),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next repair */
    }
  }

  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    for (const candidate of [escapeLatexInJson(slice, false), slice, escapeLatexInJson(slice, true)]) {
      try {
        return JSON.parse(candidate);
      } catch {
        /* try the next repair */
      }
    }
  }
  throw new Error("The model replied with something that was not valid JSON.");
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
  "The user message carries a LANGUAGE directive — always follow it: every student-facing string is written in that language only, with no mixing.",
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

/* ------------------------------------------------------------------ */
/* Output language: Hindi or English, following the sources            */
/* ------------------------------------------------------------------ */

/** Devanagari (Hindi) code points — their presence marks Hindi source text. */
const HINDI_RE = /[\u0900-\u097F]/g;

/**
 * Manthan generates in exactly two languages: the sources' own. Sampling the
 * corpus for Devanagari script decides which — English text contains none, so
 * even a small fraction of Hindi script is decisive. A mixed notebook takes
 * whichever dominates, defaulting to English.
 */
export function detectLanguage(corpusParts: string[]): "hi" | "en" {
  let devanagari = 0;
  let total = 0;

  for (const part of corpusParts) {
    // Sample generously: a chapter's Hindi often lives in its body while the
    // opening page is a list of English technical terms.
    const sample = part.slice(0, 40_000);
    if (sample.length === 0) continue;
    const found = sample.match(HINDI_RE)?.length ?? 0;
    // Any single source whose text is clearly Devanagari is decisive on its
    // own — a notebook holding one Hindi chapter and one English handout is a
    // Hindi request, not a tie.
    if (found / sample.length > 0.03) return "hi";
    total += sample.length;
    devanagari += found;
  }

  if (total === 0) return "en";
  // A low floor matters more than a high one: English contains no Devanagari
  // at all, so even a thin trace of it is a signal, and the cost of wrongly
  // choosing Hindi for an English notebook is a regenerable deck while the
  // reverse is a summary the student cannot read.
  return devanagari / total > 0.004 ? "hi" : "en";
}

/**
 * The last thing the model reads before it answers.
 *
 * Models drift toward the language of their own instructions, which here are
 * English. Re-stating the rule after the sources — the point where drift
 * actually happens — is what keeps a Hindi chapter from coming back with an
 * English title and English section headings.
 */
export function languageLock(lang: "hi" | "en"): string {
  return lang === "hi"
    ? "FINAL CHECK before answering: every student-facing string must be Hindi written in Devanagari script — the title, the overview, every section heading, every point, every question and option, every card face, every mind-map label, every slide bullet. No English words, no Hindi typed in Latin letters. Rewrite anything that breaks this rule."
    : "FINAL CHECK before answering: every student-facing string must be in English, with no other language mixed in.";
}

/**
 * The one non-negotiable instruction per run: the model writes every
 * student-facing string in the detected language. Without it, models drift —
 * a Hindi source would come back with an English title and English section
 * headings, or worse, Hindi transliterated into Latin script.
 */
export function languageDirective(lang: "hi" | "en"): string[] {
  if (lang === "hi") {
    return [
      "LANGUAGE (critical): The sources are in Hindi, so EVERY word a student reads must be written in Hindi in the Devanagari script — title, overview, section headings, points, keyTerms, card fronts and backs, questions, options, explanations, mind-map labels, slide titles, bullets and speaker notes.",
      "Write Hindi in Devanagari script only — never transliterate Hindi into English (Latin) letters. Keep standard technical terms the way the source writes them, and copy `source` file names exactly as given.",
      "Do not mix languages: no English sentences or English headings anywhere in the output.",
    ];
  }
  return [
    "LANGUAGE (critical): The sources are in English, so write EVERY student-facing string in English — title, overview, headings, points, keyTerms, questions, options, explanations, mind-map labels, slide titles, bullets and notes.",
    "Do not mix other languages into the output.",
  ];
}

function buildPrompt(
  kind: Kind,
  notebookName: string,
  corpus: string,
  lang: "hi" | "en",
) {
  const spec = KIND_SPECS[kind];
  return [
    `Notebook: ${notebookName}`,
    `Task: ${spec.task}`,
    ...languageDirective(lang),
    `Return exactly this shape: ${spec.shape}`,
    spec.extras,
    "",
    "SOURCES (name — text):",
    corpus,
    "",
    languageLock(lang),
  ].join("\n");
}

function fallbackTitle(kind: Kind, payload: unknown, notebook: string, lang: "hi" | "en") {
  if (kind === "summary" || kind === "slides") {
    const title = (payload as { title?: string }).title;
    if (title) return title;
  }
  if (kind === "mindmap") {
    const root = (payload as { root?: string }).root;
    if (root) return root;
  }
  // Only reached when the model omitted a title; keep the same language as
  // the material itself so a Hindi deck never gets an English label.
  if (kind === "flashcards") {
    const cards = (payload as { cards?: unknown[] }).cards || []; // ?      ? [];
    return lang === "hi"
      ? `${cards.length} फ़्लैशकार्ड · ${notebook}`
      : `${cards.length} flashcards · ${notebook}`;
  }
  return lang === "hi" ? `${notebook} प्रश्नोत्तरी` : `${notebook} quiz`;
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

    let text = "";
    let error: string | undefined;

    try {
      text = (await readUpload(buffer, name, mime)).text;
    } catch (err) {
      if (err instanceof UploadUnreadable) {
        error = err.message;
      } else if (err instanceof ProviderUnavailable) {
        // A photo needs a model that can actually see; when none can, say so
        // rather than storing an empty source.
        error =
          "No AI model could read that photo just now. Try again in a minute, or paste the text instead.";
      } else {
        error =
          "That file could not be read — it may be password protected or corrupted. Paste its text instead.";
      }
    }

    const clean = tidy(text);
    if (!error && clean.length < 40) {
      error =
        "No readable text was found in that file — if it is a photo of handwriting, take a sharper, straighter picture and add it again.";
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
      try {
        // Same reader the original upload used, so a retry can never accept a
        // different set of formats than the first pass did.
        text = (await readUpload(buffer, source.name, undefined)).text;
      } catch (err) {
        error =
          err instanceof UploadUnreadable
            ? err.message
            : err instanceof ProviderUnavailable
              ? "No AI model could read that photo just now. Try again in a minute."
              : "That file still cannot be read.";
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
    // The reset instant travels with the meter — a monthly plan rolls over on
    // the 1st, the free plan at UTC midnight, and the ledger is authoritative.
    const resetsAt = usage.resetsAt;
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

    // Every artefact in this run comes out in the sources' own language —
    // Hindi sources produce Hindi material, English ones English.
    const language = detectLanguage(parts);

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
          error:
            usage.window === "month"
              ? `Monthly allowance reached — resets on ${new Date(resetsAt).toLocaleDateString([], { month: "short", day: "numeric" })}.`
              : `Daily allowance reached — resets at ${new Date(resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        });
        continue;
      }

      try {
        const { text: raw, model, provider, tokens } = await callModel(
          candidates,
          SYSTEM,
          buildPrompt(kind, context.notebookName, corpus, language),
        );

        // Meter what the call actually cost, falling back to the estimate.
        const spent =
          tokens ??
          Math.round(
            (buildPrompt(kind, context.notebookName, corpus, language).length +
              raw.length) /
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
          title: fallbackTitle(kind, parsed, context.notebookName, language),
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

/* ------------------------------------------------------------------ */
/* Cram Mode — a textbook in, exam-ready notes out                     */
/* ------------------------------------------------------------------ */

/**
 * Cram Mode's contract.
 *
 * It reads a whole textbook chapter — not a notebook of small sources — and
 * compresses it into revision notes, then ranks that chapter against the
 * syllabus benchmarks of its subject. `covered` is the honest half of the
 * output: it says whether the supplied text actually teaches a benchmark, so a
 * student can see the gaps instead of trusting a confidence score.
 */
const CRAM_SYSTEM = [
  "You are Cram Mode inside Manthan, a study app for Indian school students in Classes 8 to 12 (CBSE and ICSE).",      "You are given the text of a textbook chapter, a school PDF or a student's notes. Compress it into exam-ready revision notes, and rank how far it covers the syllabus benchmarks of its subject.",
      "The benchmarks are the board syllabus for the subject the text is about — not whatever the document happens to discuss. A chapter about cell division is benchmarked against Biology topics (cell cycle, mitosis, meiosis, tissues), never against file formats, software, printing or document layout. Only if the text genuinely is a chapter on that subject may those be its topics.",
  "Work ONLY from the supplied text. Never add facts, formulas, dates, examples or citations that are not in it, and keep the student's own terminology.",
  "The user message carries a LANGUAGE directive — always follow it: every student-facing string is written in that language only, with no mixing.",
  "No emoji, no markdown, no asterisks, no bullet symbols. Plain sentences in every string.",
  'Reply with a single JSON object and nothing else: {"subject":string,"notes":[{"topic":string,"points":[string]}],"benchmarks":[{"topic":string,"weight":number,"note":string,"covered":boolean}]}.',
  "subject is the school subject the text belongs to. Give 4 to 8 notes, each a distinct topic with 3 to 5 short points (one idea per point). benchmarks are 5 to 8 syllabus topics for that subject, ordered most important first: weight is 0 to 1 for how heavily the board papers weigh it, note is one line describing what it covers, and covered is true only when the supplied text genuinely teaches it.",
].join(" ");

const cramSchema = z.object({
  subject: z.string().min(1),
  notes: z
    .array(
      z.object({
        topic: z.string().min(1),
        points: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  benchmarks: z
    .array(
      z.object({
        topic: z.string().min(1),
        // Models occasionally write the weight as a string ("0.8"); that is
        // still the number the student sees, so coerce instead of failing the
        // whole reading over a pair of quotes.
        weight: z.coerce.number(),
        note: z.string().min(1),
        covered: z.boolean().catch(false),
      }),
    )
    .min(1),
});

/** The model answered, but not with the shape this action can render. */
class CramShapeError extends Error {
  constructor(detail: string) {
    super(`Cram Mode's reply was incomplete. ${detail}`);
    this.name = "CramShapeError";
  }
}

/** Parse one reply, returning null instead of throwing on bad JSON/shape. */
function readCramReply(raw: string) {
  try {
    return cramSchema.parse(parseJsonLoose(raw));
  } catch {
    return null;
  }
}

/**
 * Read a textbook upload and compress it against its syllabus.
 *
 * The file arrives through Convex storage (the browser PUTs the bytes, exactly
 * like a notebook source), is decoded here, and is deleted again the moment its
 * text is in memory — a textbook is read once and has no business sitting in
 * storage afterwards.
 *
 * Signed-in only: the workspace that hosts Cram Mode is behind auth, and unlike
 * the free voice companion this one spends a real model call on a large corpus.
 */
export const cramAnalyze = action({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    mime: v.optional(v.string()),
    /** Optional line the student typed beside the upload. */
    note: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { storageId, name, mime, note },
  ): Promise<
    | {
        ok: true;
        subject: string;
        notes: { topic: string; points: string[] }[];
        benchmarks: { topic: string; weight: number; note: string; covered: boolean }[];
        characters: number;
        model: string;
      }
    | { ok: false; error: string }
  > => {
    /*
     * Nothing in this action throws at the client.
     *
     * A Convex action's thrown errors are replaced with "Server Error" before
     * they reach the browser, so every message written here — "mostly
     * pictures", "password protected", "no model answered" — was arriving as
     * the same unexplained line. The panel could not tell a scanned PDF from
     * an expired key. Expected failures are returned as `{ ok: false }` with a
     * sentence the student can act on; the real upstream reason is logged.
     */
    try {
      return await analyzeCram(ctx, { storageId, name, mime, note });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[cramAnalyze] ${detail}`);

      if (error instanceof UploadUnreadable) {
        return { ok: false, error: error.message };
      }
      if (error instanceof ProviderUnavailable) {
        return {
          ok: false,
          error: error.dayExhausted
            ? "Every study model has hit its limit for today. Try again tomorrow, or paste the chapter text into a notebook instead."
            : error.rateLimited
              ? "The study models are busy right now. Nothing was saved — try again in a minute."
              : "No study model could read that file just now. Try again in a minute, or paste the chapter text.",
        };
      }
      if (error instanceof CramShapeError) {
        return {
          ok: false,
          error:
            "The notes came back incomplete, so nothing was saved. Try the upload again — a shorter chapter or a PDF with a real text layer reads best.",
        };
      }
      return {
        ok: false,
        error:
          "Cram Mode could not finish that file. Try again, or add the chapter as a notebook source and churn it there.",
      };
    }
  },
});

/**
 * The reading itself, separated so the action can own the error contract.
 *
 * Corpus is capped at 60k characters here, not the 120k used by generation:
 * the reply is short, and a full textbook made every provider on the chain
 * reject the request for length before any of them could answer.
 */
async function analyzeCram(
  ctx: ActionCtx,
  { storageId, name, mime, note }: {
    storageId: Id<"_storage">;
    name: string;
    mime?: string;
    note?: string;
  },
): Promise<{
  ok: true;
  subject: string;
  notes: { topic: string; points: string[] }[];
  benchmarks: { topic: string; weight: number; note: string; covered: boolean }[];
  characters: number;
  model: string;
}> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new UploadUnreadable("Sign in to run Cram Mode.");

    const blob = await ctx.storage.get(storageId);
    if (!blob) {
      throw new UploadUnreadable("The upload did not reach storage. Try again.");
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    // Read once, keep nothing: the bytes are in memory now.
    await ctx.storage.delete(storageId);

    let text = "";
    try {
      text = (await readUpload(buffer, name, mime)).text;
    } catch (err) {
      // Both of these already carry a message meant for the student (or, for a
      // provider outage, the flags the action maps to one), so let them through
      // untouched instead of flattening them into one generic sentence.
      if (err instanceof UploadUnreadable) throw err;
      if (err instanceof ProviderUnavailable) throw err;
      throw new UploadUnreadable(
        "Cram Mode reads PDF, Word, photos and text files. This one could not be read — if it is password protected, paste its text instead.",
      );
    }

    // 60k, not the generation budget: Cram's reply is a few hundred words, and
    // a whole textbook pushed past what every provider on the chain accepts,
    // so the request failed before any model could read it. A chapter fits;
    // a 400-page book is pasted in chapters.
    const corpus = tidy(text).slice(0, 60_000);
    if (corpus.length < 40) {
      throw new UploadUnreadable(
        "No readable text was found in that file — if it is a scan or images, paste the text instead.",
      );
    }
    // A large PDF that yields a few hundred characters is almost always a
    // scan: the pages are pictures of text, not text. Compressing the stray
    // caption that did extract would produce notes about the captions, so say
    // so plainly and point at the path that works (photos, which are read by
    // the image reader).
    if (corpus.length < 600 && buffer.length > 120_000) {
      throw new UploadUnreadable(
        "This file is mostly pictures, so almost no text could be read. Photograph the pages and add those instead, or paste the chapter text.",
      );
    }

    return await cramFromText(corpus, name, note);
}

/**
 * The model half of Cram Mode: text in, notes and benchmarks out.
 *
 * Split from the action so the same pipeline can be exercised on a stored
 * chapter without an upload — the action still owns auth, storage and the
 * error contract, and this owns the prompt, the one retry and the parse.
 */
export async function cramFromText(
  corpus: string,
  name: string,
  note?: string,
): Promise<{
  ok: true;
  subject: string;
  notes: { topic: string; points: string[] }[];
  benchmarks: { topic: string; weight: number; note: string; covered: boolean }[];
  characters: number;
  model: string;
}> {
    // The chapter's own language decides the output language.
    const language = detectLanguage([corpus]);
    const prompt = [
      `Textbook: ${name}`,
      ...languageDirective(language),
      note?.trim() ? `Student's note with the upload: ${note.trim()}` : "",
      'Return exactly this shape: {"subject":string,"notes":[{"topic":string,"points":[string]}],"benchmarks":[{"topic":string,"weight":number,"note":string,"covered":boolean}]}',
      "",
      "TEXT:",
      corpus,
      "",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n");

    const candidates = await resolveCandidates();
    let { text: raw, model } = await callModel(candidates, CRAM_SYSTEM, prompt);
    let parsed = readCramReply(raw);

    // A truncated or malformed reply is worth exactly one more ask. It is the
    // common failure on a long chapter: the model starts the JSON, then runs
    // out of room. Asking again with the same text but an explicit reminder is
    // cheaper than making the student re-upload the file, and if it happens
    // twice the action returns a sentence instead of a Zod stack.
    if (!parsed) {
      console.error(
        `[cramAnalyze] unreadable reply (${raw.length} chars): ${raw.slice(0, 240)}`,
      );
      const retry = await callModel(
        candidates,
        CRAM_SYSTEM,
        `${prompt}\n\nYour previous reply could not be parsed. Reply with one complete JSON object only, with every required field. No prose before or after it.`,
      );
      raw = retry.text;
      model = retry.model;
      parsed = readCramReply(raw);
    }
    if (!parsed) throw new CramShapeError(`${raw.slice(0, 200)}`);

    const clean = (value: string) => value.replace(/[*_`#]/g, "").trim();

    return {
      ok: true,
      subject: clean(parsed.subject),
      notes: parsed.notes.map((entry) => ({
        topic: clean(entry.topic),
        points: entry.points.map(clean),
      })),
      benchmarks: parsed.benchmarks.map((entry) => ({
        topic: clean(entry.topic),
        weight: Math.min(1, Math.max(0, entry.weight)),
        note: clean(entry.note),
        covered: entry.covered,
      })),
      characters: corpus.length,
      model,
    };
}

/* ------------------------------------------------------------------ */
/* Avia — the spoken study companion                                    */
/* ------------------------------------------------------------------ */

/**
 * Avia's personality.
 *
 * She talks like a person: plain, direct, and short. An earlier version of this
 * prompt made her relentlessly upbeat — stacked welcomes, hype, and a scripted
 * "activating 100% brain power" switch line — which read as filler rather than
 * help. These rules optimise for the opposite: answer first, no preamble, no
 * catchphrases, and no more length than the question earns.
 *
 * The reply comes back as JSON because the model layer demands a bare JSON
 * object (see providers.ts); `mode` is the model's own read of whether the turn
 * was schoolwork. The transcript renders markdown while the voice path strips
 * it, so the structure that helps visually never reaches the synthesiser.
 */
const AVIA_SYSTEM = [
  "You are Avia, the voice assistant inside Manthan — Study material, distilled, a study app for school students in Classes 8 to 12. You help with homework, concepts and exam questions, and you can also just talk.",
  "HOW YOU TALK: like a normal, friendly, knowledgeable person. Plain, direct, and to the point — answer the question in the first sentence, then add only what is actually useful. No hype, no motivational speeches, no catchphrases, no roleplay, and never announce what you are about to do. Never say things like 'let's lock in', 'activating brain power', 'jokes over', 'vibes', or 'I'm not handing you the answer'. A short correct answer beats a long enthusiastic one, so do not pad a reply to sound impressive.",
  "LENGTH: match the question. A simple question gets one or two sentences. A 'why' or 'how does it work' question gets the key idea plus one example. Only go long when the student asks for a full explanation, a walkthrough, or notes — and even then drop anything that is not carrying information.",
  "MATHS: show the working as one move per line so it can be followed step by step, with a short plain-words reason after each line, and the final answer stated plainly at the end. Keep words out of the maths itself.",
  "NEVER REPEAT YOURSELF: read the conversation so far and do not reuse an opening or a sentence you have already used in this session.",
  "IDENTITY & ORIGIN: Manthan was founded and built by Luv Moond, its Founder & Innovator. If asked who made you, who your founder, creator or owner is, or who is behind Manthan, answer plainly that Luv Moond is the founder and the person who made you, then carry on. Never say you were made by Google, OpenAI, Gemini or any model vendor, and never name the underlying AI model as your creator — the model is your engine, not your maker. Do not invent other facts about Luv.",
  "GREETING: only when the conversation is empty (the very first message of a session), reply with one short friendly line that invites the question — for example 'Hey, what are we working on?'. One line, no stacked welcomes, no speech about the student's potential.",
  "STRUCTURE: use short markdown only when it helps — a '###' heading or a '- ' list when the content is genuinely a list. Never wrap a simple answer in headers and bullets for the sake of it; for a conceptual answer, plain sentences are usually best.",
  "If the student is just chatting, answer normally and briefly, the way a person would.",
  'Reply with a single JSON object and nothing else: {"reply":string,"mode":"banter"|"tutoring"}.',
].join(" ");

const aviaSchema = z.object({
  reply: z.string().min(1),
  mode: z.enum(["banter", "tutoring"]).catch("banter"),
});

/**
 * One turn of conversation with Avia.
 *
 * Deliberately unauthenticated and unmetered: the voice widget is a free,
 * zero-key feature that reads and speaks through the browser's own Web Speech
 * APIs, so a signed-out visitor on the landing page can use it too. It never
 * touches the student's daily generation allowance.
 */
export const aviaReply = action({
  args: {
    /** What the student just said. */
    message: v.string(),
    /** A short tail of the conversation, oldest first, for continuity. */
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("student"), v.literal("avia")),
          text: v.string(),
        }),
      ),
    ),
    /**
     * The client's own keyword detector. A quiet hint only — nothing is
     * announced on the device — used to label a study question as tutoring
     * rather than casual chat.
     */
    studying: v.optional(v.boolean()),
  },
  handler: async (
    _ctx,
    { message, history, studying },
  ): Promise<{ reply: string; mode: "banter" | "tutoring" }> => {
    const transcript = (history || [])
      .slice(-8)
      .map(function (turn) { return (turn.role === "student" ? "Student" : "Avia") + ": " + turn.text; })
      .join("\n");
    /* superseded transcript chain:      ? [])
      .slice(-8)
      .map((turn) => `${turn.role === "student" ? "Student" : "Avia"}: ${turn.text}`)
      .join("\n");

    */

    const prompt = [
      "MODE NOTE: decide your own mode. If the student's latest message is a study question, set mode to 'tutoring'; if it is casual chat, 'banter'.",
      transcript ? `CONVERSATION SO FAR:\n${transcript}` : "",
      `STUDENT NOW: ${message}`,
      transcript
        ? "Reply with the JSON object only. Apply the STRICT OUTPUT FORMATTING rules to the reply field."
        : "This is the first message of the session: reply with your DYNAMIC GREETING PROTOCOL message (three lines) plus the JSON object only.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    // 0.85, not the study-material 0.3: a companion sampled that low answers
    // every question in the same shape, which is what made her sound scripted.
    const { text } = await callModel(candidates, AVIA_SYSTEM, prompt, undefined, 0.85);
    const parsed = aviaSchema.parse(parseJsonLoose(text));

    // The transcript renders markdown, so the reply keeps its structure
    // (headers, bold step labels, line breaks). Only the voice path strips it.
    return {
      reply: parsed.reply.trim(),
      mode: studying ? "tutoring" : parsed.mode,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Math Lab — the AI equation engine                                    */
/* ------------------------------------------------------------------ */

/**
 * The Math Lab tutor.
 *
 * It solves what the student actually pasted — a typed equation, a photograph
 * of a question sheet, or an uploaded problem file — and returns a structured
 * notebook the lab renders as one continuous stream. Follow-up turns ("is this
 * true?", "why step 2?") arrive as the same action with the conversation so
 * far, so the engine answers about its own working instead of starting over.
 *
 * Unauthenticated on purpose: the lab itself is plan-gated in the UI, and this
 * mirrors the Canvas Solver's contract. Nothing here touches the student's
 * daily generation allowance.
 */
export const MATH_SYSTEM = [
  "You are the equation engine inside Manthan's Math Lab, a connected school mathematics workspace.",
  "Solve the mathematics problem you are given the way a careful teacher would: state the question, name the rule that carries each move, then work the solution step by step. Adapt the notation to the selected curriculum track (CBSE, ICSE, IB or IGCSE).",
  "If the input holds more than one question — '2/3 + 1/6, and 3/4 ÷ 9/10' is TWO — return one entry in problems for EACH question, in the order asked. Never merge two questions into one entry, and never interleave their steps.",
  "Each step is ONE move and carries four fields.",
  "expression is LaTeX ONLY: numbers, symbols and commands, never an English word. Write 2 + 3 = 5, \\frac{2}{3}, \\sqrt{5}, x^{2}, \\times, \\div, \\pm, \\le. Never write 'plus', 'times', 'divided by', 'equals', 'therefore' or 'the answer is' inside an expression. The only way a word may appear in an expression is inside \\text{...}, and only for a unit.",
  "explanation is plain English, one or two short sentences saying what is done and why. Any maths inside it must be wrapped in dollars, like 'rewrite $\\frac{1}{3}$ as an equivalent fraction with a denominator of 6'. Everything outside the dollars is rendered as ordinary text, so it has to read as ordinary text.",
  "rule is the short rule name a teacher writes in the margin, two to four words: 'LCM of denominators', 'Transpose rule', 'Quadratic formula'.",
  "title is a two-to-five word label for the move: 'Match the denominators'.",
  "Every expression must be exactly equivalent to the line above it, and the arithmetic is shown inside the expression — never only in prose.",
  "Keep a calculation on ONE line. Never insert a line-break command between terms; the page wraps an expression only when it is wider than the screen.",
  "verification must genuinely check the result: substitute the answer back into the original relation, restate by sum/product or dimensional check, and say plainly whether both sides match.",
  "If the question is a follow-up about a previous solution, answer THAT question in a single problem entry — verify the working if asked whether it is true, correct any error you actually find (naming the step and why it is wrong), or explain the named step more slowly. Do not re-solve the whole problem from scratch unless the student restates it.",
  "Read the student's notation the way a teacher would: x, X, * and · between numbers mean ×, and / or ÷ mean division. 22x6 is 22 × 6, not a variable.",
  "If the photograph or extract is unreadable, blurry or clearly not mathematics, say so plainly in headline and keep the problem entry short and honest. Never invent values or equations that are not visible.",
  "Read a photographed question letter by letter before solving it, and keep reciprocal pairs strictly apart: cos is not csc, sin is not sec, tan is not cot, and a superscript 2 is not a coefficient. Check the extent of every fraction bar — which terms are actually above it. A reciprocal misread turns a true identity into a false one, and every later step then belongs to the wrong problem.",
  "Whatever you transcribe into `problem` is the problem you must solve. If a symbol is ambiguous, choose the reading that makes the printed statement true and keep that same reading in every step.",
  "No emoji, no markdown, no asterisks, no bullet symbols.",
  'Reply with a single JSON object and nothing else: {"headline":string,"problems":[{"problem":string,"title":string,"given":string[],"formulas":string[],"steps":[{"title":string,"explanation":string,"expression":string,"rule":string}],"finalAnswer":string,"verification":string}]}.',
  "headline is one short line naming the result. problem is the question as plain text, with only the mathematics inside dollars — 'Evaluate 23 × 4 using the distributive property.' — never a LaTeX-only field. given lists the quantities and constraints read off the problem, in plain English with any maths in dollars. formulas lists the governing relations as LaTeX. finalAnswer is LaTeX ONLY — '\\frac{5}{6}' or 'x = \\frac{2}{3}' — with no sentence wrapped around it.",
].join(" ");


/* The Math Lab's action lives in ./mathLab.ts, its prompt constants in
   ./mathPrompts.ts and its independent checker in ./mathVerify.ts. */




/* ------------------------------------------------------------------ */
/* AI Canvas Solver                                                    */
/* ------------------------------------------------------------------ */

/**
 * The Canvas Solver reads a photograph — a question sheet, a diagram, a
 * handwritten derivation — and decomposes it. This is the one place in the app
 * that sends an image, so the instruction is blunt about the failure that
 * matters: a model that cannot see the picture must never invent its contents.
 */
const CANVAS_SYSTEM = [
  "You are the AI Canvas Solver inside Manthan, a study app for school students in Classes 8 to 12 (CBSE and ICSE).",
  "You are shown a photograph of a student's question sheet, textbook page or hand-drawn diagram. Read what is actually in the image: every given quantity with its unit, every marked label, every equation as written.",
  "If the image is unreadable, blurry, cropped or clearly not academic work, say so plainly in the answer field and keep inputs, formulas and steps short and honest. Never invent values, labels or formulas that are not visible.",
  "Solve the way a careful teacher would: symbolically first, then substitute the numbers, then state the answer with its unit and a one-line sanity check.",
  "Prefer the notation and method taught in Indian school syllabi for the detected domain (kinematics, ray optics, waves, electricity, algebra, trigonometry, calculus, chemistry stoichiometry, organic reactions, biology processes).",
  "No emoji, no markdown, no asterisks, no bullet symbols. Plain sentences in every string.",
  'Reply with a single JSON object and nothing else: {"title":string,"domain":string,"inputs":string[],"formulas":string[],"steps":string[],"answer":string}.',
  "title is one short line naming what the sheet asks. domain is the subject area. inputs is one entry per quantity or label read off the image. formulas lists the governing relations symbolically. steps is the ordered solution path, one idea per entry, each a full sentence. answer is the final result with its unit, or the honest statement that the image could not be read.",
].join(" ");

const canvasSchema = z.object({
  title: z.string().min(1),
  domain: z.string().min(1).catch("General relations"),
  inputs: z.array(z.string().min(1)).min(1),
  formulas: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(1),
  answer: z.string().min(1),
});

/** Rough ceiling on the base64 payload — about 4 MB of image. */
const MAX_CANVAS_IMAGE = 5_500_000;

/**
 * Read and solve a photographed question.
 *
 * Unauthenticated on purpose: the solver is part of the free tier's pitch, and
 * the client already holds the premium gate for the workspace it lives in.
 * The image itself is never stored — it is decoded, sent to the model and
 * dropped, so nothing leaves the request.
 */
export const solveCanvas = action({
  args: {
    /** Image bytes, base64, no data-url prefix. */
    imageBase64: v.string(),
    mimeType: v.string(),
    /** Optional note the student typed beside the upload. */
    note: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    { imageBase64, mimeType, note },
  ): Promise<{
    title: string;
    domain: string;
    inputs: string[];
    formulas: string[];
    steps: string[];
    answer: string;
    model: string;
  }> => {
    if (imageBase64.length > MAX_CANVAS_IMAGE) {
      throw new Error(
        "That image is too large to read. Crop it to the question and try again.",
      );
    }

    const prompt = [
      "Read the attached photograph of a question sheet and solve it.",
      note?.trim() ? `Student's note with the upload: ${note.trim()}` : "",
      "Reply with the JSON object only.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const { text, model } = await callModel(candidates, CANVAS_SYSTEM, prompt, {
      mimeType,
      data: imageBase64,
    });
    const parsed = canvasSchema.parse(parseJsonLoose(text));
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
