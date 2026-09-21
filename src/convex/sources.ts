import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Sources — the files and links a user adds to one of their notebooks.
 *
 * This table starts empty for every account and only ever holds things the
 * user really dropped in, so the queue on the dashboard reflects their work
 * and nothing else.
 */

/** Everything queued in one notebook, oldest first. */
export const listForNotebook = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) return [];

    return await ctx.db
      .query("sources")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect()
      .then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt));
  },
});

export const add = mutation({
  args: {
    notebookId: v.id("notebooks"),
    kind: v.union(v.literal("file"), v.literal("link")),
    name: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { notebookId, kind, name, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to add a source.");

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
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to remove a source.");

    const source = await ctx.db.get(sourceId);
    if (!source || source.ownerId !== userId) {
      throw new Error("Source not found.");
    }
    await ctx.db.delete(sourceId);
  },
});
