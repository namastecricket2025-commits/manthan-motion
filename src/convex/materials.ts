import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Study material — what a notebook's sources were churned into.
 *
 * This file holds only reads and writes; the model calls that produce the rows
 * live in `ai.ts` (a `"use node"` file) because PDF parsing and long-running
 * provider requests need Node.
 */

export const MATERIAL_KINDS = [
  "summary",
  "flashcards",
  "quiz",
  "mindmap",
  "slides",
] as const;

export const kindValidator = v.union(
  v.literal("summary"),
  v.literal("flashcards"),
  v.literal("quiz"),
  v.literal("mindmap"),
  v.literal("slides"),
);

/** Every generated material in one notebook, newest first. */
export const listForNotebook = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) return [];

    return await ctx.db
      .query("materials")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect()
      .then((rows) => rows.sort((a, b) => b.createdAt - a.createdAt));
  },
});

/** The prompt context for a notebook: its sources plus extracted text. */
export const sourceContext = internalQuery({
  args: { notebookId: v.id("notebooks") },
  handler: async (
    ctx,
    { notebookId },
  ): Promise<{
    notebookId: Id<"notebooks">;
    notebookName: string;
    sources: {
      id: Id<"sources">;
      name: string;
      kind: "file" | "link" | "text";
      status: "ready" | "failed";
      text: string;
    }[];
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    return {
      notebookId,
      notebookName: notebook.name,
      sources: sources
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((s) => ({
          id: s._id,
          name: s.name,
          kind: s.kind,
          status: s.status,
          text: s.text ?? "",
        })),
    };
  },
});

export const save = internalMutation({
  args: {
    notebookId: v.id("notebooks"),
    kind: kindValidator,
    title: v.string(),
    payload: v.any(),
    sourceIds: v.array(v.id("sources")),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }

    // One material per kind per notebook: regenerating replaces the old one, so
    // the notebook never accumulates stale versions of the same artefact.
    const existing = await ctx.db
      .query("materials")
      .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
      .collect();
    for (const row of existing) {
      if (row.kind === args.kind) await ctx.db.delete(row._id);
    }

    return await ctx.db.insert("materials", {
      ownerId: userId,
      notebookId: args.notebookId,
      kind: args.kind,
      title: args.title,
      payload: args.payload,
      sourceIds: args.sourceIds,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { materialId: v.id("materials") },
  handler: async (ctx, { materialId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to delete material.");
    const material = await ctx.db.get(materialId);
    if (!material || material.ownerId !== userId) {
      throw new Error("Material not found.");
    }
    await ctx.db.delete(materialId);
  },
});

/** Ownership check used by the actions before they spend a model call. */
export const assertNotebook = internalQuery({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    return notebook.name as string;
  },
});

export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export type NotebookId = Id<"notebooks">;
