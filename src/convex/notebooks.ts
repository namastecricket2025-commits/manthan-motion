import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Notebooks — the user's own workspaces.
 *
 * A notebook is what the user names, fills with sources, and churns into study
 * material. Every read here is scoped to the signed-in owner, and there is no
 * seeded or sample content anywhere: a fresh account genuinely has zero
 * notebooks, so the dashboard can honestly show "nothing yet".
 */

/** Trim + sanity-check a notebook name. */
function cleanName(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("A notebook needs a name.");
  return name.slice(0, 60);
}

/** Every notebook the user owns, each with its real source counts. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const notebooks = await ctx.db
      .query("notebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    const withCounts = await Promise.all(
      notebooks.map(async (notebook) => {
        const sources = await ctx.db
          .query("sources")
          .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
          .collect();
        return {
          id: notebook._id,
          name: notebook.name,
          createdAt: notebook.createdAt,
          sourceCount: sources.length,
          fileCount: sources.filter((s) => s.kind === "file").length,
          linkCount: sources.filter((s) => s.kind === "link").length,
        };
      }),
    );

    return withCounts.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireAuthUserId(ctx);

    return await ctx.db.insert("notebooks", {
      ownerId: userId,
      name: cleanName(name),
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { notebookId: v.id("notebooks"), name: v.string() },
  handler: async (ctx, { notebookId, name }) => {
    const userId = await requireAuthUserId(ctx);

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }
    await ctx.db.patch(notebookId, { name: cleanName(name) });
  },
});

/** Deleting a notebook takes its sources with it. */
export const remove = mutation({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await requireAuthUserId(ctx);

    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Notebook not found.");
    }

    // Deleting a notebook takes its sources (and their uploaded files) and
    // everything generated from them with it, so nothing is orphaned.
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    for (const source of sources) {
      if (source.storageId) await ctx.storage.delete(source.storageId);
      await ctx.db.delete(source._id);
    }

    const materials = await ctx.db
      .query("materials")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    for (const material of materials) await ctx.db.delete(material._id);

    await ctx.db.delete(notebookId);
  },
});

/**
 * The dashboard summary — every number derived from rows the user actually
 * created. A new account gets zeroes and an empty `byDay`, which is what lets
 * the UI show a true "nothing yet" state instead of invented activity.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const empty = {
      notebookCount: 0,
      sourceCount: 0,
      fileCount: 0,
      linkCount: 0,
      notesCount: 0,
      readableCount: 0,
      failedCount: 0,
      materialsByKind: {} as Record<string, number>,
      addedThisWeek: 0,
      perNotebook: [] as { id: string; name: string; count: number }[],
      byDay: [] as { day: string; label: string; count: number }[],
      materialsByDay: [] as {
        day: string;
        label: string;
        summary: number;
        flashcards: number;
        quiz: number;
        mindmap: number;
        slides: number;
      }[],
    };

    const userId = await getAuthUserId(ctx);
    if (!userId) return empty;

    const notebooks = await ctx.db
      .query("notebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Last seven days, ending today, counted from real `createdAt` stamps.
    const now = new Date();
    const byDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - i));
      const start = date.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return {
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        label: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        count: sources.filter((s) => s.createdAt >= start && s.createdAt < end)
          .length,
      };
    });

    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Generated artefacts across every notebook — what the donut's second
    // ring reports so the chart shows outcomes, not only inputs.
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const materialsByKind: Record<string, number> = {};
    for (const material of materials) {
      materialsByKind[material.kind] =
        (materialsByKind[material.kind] ?? 0) + 1;
    }

    // Materials generated per day over the last seven days, split by kind —
    // the stacked bars under the donut: "these many summaries, these many
    // quizzes" on each day, from real createdAt stamps.
    const materialsByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - i));
      const start = date.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const todays = materials.filter(
        (m) => m.createdAt >= start && m.createdAt < end,
      );
      return {
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        label: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        summary: todays.filter((m) => m.kind === "summary").length,
        flashcards: todays.filter((m) => m.kind === "flashcards").length,
        quiz: todays.filter((m) => m.kind === "quiz").length,
        mindmap: todays.filter((m) => m.kind === "mindmap").length,
        slides: todays.filter((m) => m.kind === "slides").length,
      };
    });

    return {
      notebookCount: notebooks.length,
      sourceCount: sources.length,
      fileCount: sources.filter((s) => s.kind === "file").length,
      linkCount: sources.filter((s) => s.kind === "link").length,
      notesCount: sources.filter((s) => s.kind === "text").length,
      readableCount: sources.filter(
        (s) => s.status !== "failed" && (s.text?.length ?? 0) > 0,
      ).length,
      failedCount: sources.filter((s) => s.status === "failed").length,
      materialsByKind,
      materialsByDay,
      addedThisWeek: sources.filter((s) => s.createdAt >= weekStart).length,
      perNotebook: notebooks
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((notebook) => ({
          id: notebook._id as string,
          name: notebook.name,
          count: sources.filter((s) => s.notebookId === notebook._id).length,
        })),
      byDay,
    };
  },
});
