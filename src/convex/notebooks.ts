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

/**
 * Every notebook the user owns, each with its real source and material
 * counts.
 *
 * `lastActivityAt` is the newest of the notebook's own creation, its newest
 * source and its newest generated material — the honest answer to "which one
 * was I working in last", which is what the dashboard's resume block needs.
 * It is derived from rows the user actually created, never from a stored
 * "last visited" flag this app does not keep.
 */
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
        const materials = await ctx.db
          .query("materials")
          .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
          .collect();
        const newestSource = sources.reduce(
          (newest, source) => Math.max(newest, source.createdAt),
          0,
        );
        const newestMaterial = materials.reduce(
          (newest, material) => Math.max(newest, material.createdAt),
          0,
        );
        return {
          id: notebook._id,
          name: notebook.name,
          createdAt: notebook.createdAt,
          sourceCount: sources.length,
          fileCount: sources.filter((s) => s.kind === "file").length,
          linkCount: sources.filter((s) => s.kind === "link").length,
          materialCount: materials.length,
          lastActivityAt: Math.max(
            notebook.createdAt,
            newestSource,
            newestMaterial,
          ),
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
      sourcesPrevWeek: 0,
      materialsThisWeek: 0,
      materialsPrevWeek: 0,
      activeNotebook: null as null | { id: string; name: string; materialCount: number },
      perNotebook: [] as { id: string; name: string; count: number }[],
      byDay: [] as { day: string; label: string; count: number }[],
      heatmap: [] as {
        day: string;
        label: string;
        weekday: number;
        materials: number;
        sources: number;
        count: number;
      }[],
      recent: [] as {
        id: string;
        notebookId: string;
        kind:
          | "source"
          | "summary"
          | "flashcards"
          | "quiz"
          | "mindmap"
          | "slides";
        label: string;
        notebook: string;
        at: number;
      }[],
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

    // Twelve weeks of daily activity — one cell per day, counted from the
    // same `createdAt` stamps the seven-day chart already reads, so the
    // heatmap and the bars can never disagree. Rows outside the window are
    // ignored rather than clamped, so a cell never borrows another day's
    // count. Keys are built from local calendar parts, which keeps the cells
    // aligned to the user's own days across a DST shift.
    const pad = (value: number) => String(value).padStart(2, "0");
    const dayKey = (date: Date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const dayStarts = Array.from({ length: 84 }, (_, i) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (83 - i));
      return date;
    });
    const heatIndex = new Map(
      dayStarts.map((date, index) => [dayKey(date), index]),
    );
    const heatmap = dayStarts.map((date) => ({
      day: dayKey(date),
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      weekday: date.getDay(),
      materials: 0,
      sources: 0,
      count: 0,
    }));
    for (const material of materials) {
      const index = heatIndex.get(dayKey(new Date(material.createdAt)));
      if (index === undefined) continue;
      heatmap[index].materials += 1;
      heatmap[index].count += 1;
    }
    for (const source of sources) {
      const index = heatIndex.get(dayKey(new Date(source.createdAt)));
      if (index === undefined) continue;
      heatmap[index].sources += 1;
      heatmap[index].count += 1;
    }

    // The last five things that actually happened: a source landing or an
    // artefact being generated, newest first, each carrying the notebook it
    // belongs to. Derived from the same rows, so there is nothing invented.
    const notebookNames = new Map(
      notebooks.map((notebook) => [notebook._id as string, notebook.name]),
    );
    const recent = [
      ...sources.map((source) => ({
        id: source._id as string,
        notebookId: source.notebookId as string,
        kind: "source" as const,
        label: source.name,
        notebook: notebookNames.get(source.notebookId) ?? "Notebook",
        at: source.createdAt,
      })),
      ...materials.map((material) => ({
        id: material._id as string,
        notebookId: material.notebookId as string,
        kind: material.kind,
        label: material.title,
        notebook: notebookNames.get(material.notebookId) ?? "Notebook",
        at: material.createdAt,
      })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 5);

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
      sourcesPrevWeek: sources.filter(
        (s) => s.createdAt >= weekStart - 7 * 24 * 60 * 60 * 1000 && s.createdAt < weekStart,
      ).length,
      materialsThisWeek: materials.filter((m) => m.createdAt >= weekStart).length,
      materialsPrevWeek: materials.filter(
        (m) => m.createdAt >= weekStart - 7 * 24 * 60 * 60 * 1000 && m.createdAt < weekStart,
      ).length,
      heatmap,
      recent,
      perNotebook: notebooks
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((notebook) => ({
          id: notebook._id as string,
          name: notebook.name,
          count: sources.filter((s) => s.notebookId === notebook._id).length,
        })),
      // The notebook with the newest work in it — same derivation the resume
      // block makes client-side, so the tiles can name it without pulling the
      // whole notebook list.
      activeNotebook: notebooks
        .map((notebook) => {
          const inNotebook = sources.filter(
            (s) => s.notebookId === notebook._id,
          );
          const madeInNotebook = materials.filter(
            (m) => m.notebookId === notebook._id,
          );
          return {
            id: notebook._id as string,
            name: notebook.name,
            materialCount: madeInNotebook.length,
            latest: Math.max(
              notebook.createdAt,
              ...inNotebook.map((s) => s.createdAt),
              ...madeInNotebook.map((m) => m.createdAt),
            ),
          };
        })
        .sort((a, b) => b.latest - a.latest)
        .map(({ id, name, materialCount }) => ({ id, name, materialCount }))[0] ?? null,
      byDay,
    };
  },
});
