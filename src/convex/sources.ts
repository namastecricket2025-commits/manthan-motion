import { getAuthUserId, requireAuthUserId } from "./identity";
import { sourceExcerpt } from "./sourceExcerpt";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/**
 * Sources — the files, links and typed notes a user puts into a notebook.
 *
 * `text` holds the plain text that generation actually reads (extracted from
 * the uploaded file, scraped from the link, or typed by the user). `status`
 * records whether that extraction worked, so a file Manthan could not read is
 * reported honestly rather than silently ignored.
 *
 * The list queries project *out* the extracted text: a 200-page PDF's text has
 * no business travelling to the browser, only to the model.
 */

const statusValidator = v.union(v.literal("ready"), v.literal("failed"));

/** Everything queued in one notebook, oldest first (without the body text). */
export const listForNotebook = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) return [];

    const rows = await ctx.db
      .query("sources")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();

    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => ({
        _id: s._id,
        kind: s.kind,
        name: s.name,
        detail: s.detail,
        status: s.status ?? "ready",
        error: s.error,
        characters: s.text?.length ?? 0,
        createdAt: s.createdAt,
      }));
  },
});

/** A one-shot upload URL for the browser to PUT the file bytes to. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Public URL for a stored file (used by the download link in the UI). */
export const fileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => await ctx.storage.getUrl(storageId),
});

/**
 * Add a source row directly, with no extraction step.
 *
 * Used for the simple case where there is nothing to parse — a link the user
 * just wants on the list, or text they already have. Files and links that
 * should be *read* go through the actions in `ai.ts` so their text lands on the
 * row and can be cited later.
 */
export const add = mutation({
  args: {
    notebookId: v.id("notebooks"),
    kind: v.union(v.literal("file"), v.literal("link"), v.literal("text")),
    name: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { notebookId, kind, name, detail }) => {
    const userId = await requireAuthUserId(ctx);

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    const clean = name.trim();
    if (!clean) throw new Error("A source needs a name.");

    return await ctx.db.insert("sources", {
      ownerId: userId,
      notebookId,
      kind,
      name: clean.slice(0, 240),
      detail: detail?.trim().slice(0, 120),
      status: "ready",
      createdAt: Date.now(),
    });
  },
});

/** Typed or pasted notes need no extraction — they are already text. */
export const addText = mutation({
  args: { notebookId: v.id("notebooks"), name: v.string(), text: v.string() },
  handler: async (ctx, { notebookId, name, text }) => {
    const userId = await requireAuthUserId(ctx);

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    const body = text.trim();
    if (body.length < 20) {
      throw new Error("Paste at least a sentence or two of notes.");
    }

    return await ctx.db.insert("sources", {
      ownerId: userId,
      notebookId,
      kind: "text",
      name: name.trim() || "Pasted notes",
      detail: `${body.length.toLocaleString()} characters`,
      text: body.slice(0, 200_000),
      status: "ready",
      createdAt: Date.now(),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Source peek                                                         */
/* ------------------------------------------------------------------ */

/**
 * The exact extract behind a material's source chip.
 *
 * Only sources the material was actually built from are considered, and the
 * body text never leaves this query in full: the UI receives one small window
 * around the most relevant passage, plus the source name it can trust.
 */
export const peek = query({
  args: {
    materialId: v.id("materials"),
    sourceName: v.optional(v.string()),
    focus: v.optional(v.string()),
  },
  handler: async (ctx, { materialId, sourceName, focus }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const material = await ctx.db.get(materialId);
    if (!material || material.ownerId !== userId) return null;

    const sources = (
      await Promise.all(material.sourceIds.map((id) => ctx.db.get(id)))
    ).flatMap((source) => (source ? [source] : []));

    if (sources.length === 0) return null;

    const wanted = sourceName?.trim().toLowerCase();
    const source =
      (wanted
        ? sources.find((entry) => entry.name.toLowerCase() === wanted)
        : undefined) ??
      sources.find((entry) => entry.status === "ready" && entry.text) ??
      sources[0];

    if (!source) return null;

    if (!source.text || source.status === "failed") {
      return {
        name: source.name,
        kind: source.kind,
        excerpt: "",
        characters: 0,
        unavailable: true as const,
      };
    }

    return {
      name: source.name,
      kind: source.kind,
      excerpt: sourceExcerpt(source.text, focus),
      characters: source.text.length,
      unavailable: false as const,
    };
  },
});

export const remove = mutation({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const userId = await requireAuthUserId(ctx);

    const source = await ctx.db.get(sourceId);
    if (!source || source.ownerId !== userId) {
      throw new Error("Source not found.");
    }
    if (source.storageId) await ctx.storage.delete(source.storageId);
    await ctx.db.delete(sourceId);
  },
});

/* ------------------------------------------------------------------ */
/* Internals used by the Node actions in ai.ts                         */
/* ------------------------------------------------------------------ */

export const insertSource = internalMutation({
  args: {
    notebookId: v.id("notebooks"),
    kind: v.union(v.literal("file"), v.literal("link")),
    name: v.string(),
    detail: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    text: v.optional(v.string()),
    status: statusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    return await ctx.db.insert("sources", {
      ownerId: userId,
      notebookId: args.notebookId,
      kind: args.kind,
      name: args.name,
      detail: args.detail,
      storageId: args.storageId,
      text: args.text,
      status: args.status,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

/** The bytes + mime type for an uploaded file, for the extractor. */
export const storedFile = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const meta = await ctx.db.system.get(storageId);
    return meta
      ? { contentType: meta.contentType ?? null, size: meta.size }
      : null;
  },
});

/** A single source (with its text) for re-extraction. */
export const getSource = internalQuery({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const source = await ctx.db.get(sourceId);
    if (!source || source.ownerId !== userId) return null;
    return source;
  },
});

/** Write back the extraction result for a source that already exists. */
export const setExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    text: v.optional(v.string()),
    status: statusValidator,
    error: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { sourceId, text, status, error, detail }) => {
    const userId = await requireAuthUserId(ctx);
    const source = await ctx.db.get(sourceId);
    if (!source || source.ownerId !== userId) {
      throw new Error("Source not found.");
    }
    await ctx.db.patch(sourceId, { text, status, error, detail });
  },
});
