import { getAuthUserId, requireAuthUserId } from "./identity";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { bumpProgress } from "./labProgress";

/**
 * Worksheets, a personal lab notebook, and a shared margin.
 *
 * The share code is a capability, not a membership system: the owner can hand
 * a six-character code to a lab partner, who can read the page and append an
 * entry. Only the owner can rewrite the worksheet or revoke the code. Every
 * entry carries its author, so a group notebook still says who contributed
 * what instead of presenting one anonymous voice.
 */

const contentValidator = v.object({
  aim: v.string(),
  apparatus: v.string(),
  procedure: v.string(),
  observations: v.string(),
  conclusion: v.string(),
  answers: v.array(
    v.object({
      question: v.string(),
      answer: v.string(),
    }),
  ),
});

type Content = {
  aim: string;
  apparatus: string;
  procedure: string;
  observations: string;
  conclusion: string;
  answers: Array<{ question: string; answer: string }>;
};

const MAX_ANSWERS = 12;
const MAX_ENTRIES = 60;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function clean(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanMultiline(value: string, max: number) {
  return value.replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function cleanContent(input: Content): Content {
  return {
    aim: cleanMultiline(input.aim, 1200),
    apparatus: cleanMultiline(input.apparatus, 1200),
    procedure: cleanMultiline(input.procedure, 2400),
    observations: cleanMultiline(input.observations, 5000),
    conclusion: cleanMultiline(input.conclusion, 2400),
    answers: input.answers.slice(0, MAX_ANSWERS).map((answer) => ({
      question: clean(answer.question, 500),
      answer: cleanMultiline(answer.answer, 1600),
    })),
  };
}

function answered(content: Content) {
  return content.answers.filter((answer) => answer.answer.trim().length > 0).length;
}

async function authorName(ctx: MutationCtx, userId: Id<"users">) {
  const row = await ctx.db.get(userId);
  if (row?.name?.trim()) return row.name.trim().slice(0, 60);
  if (row?.email?.includes("@")) return row.email.split("@")[0].slice(0, 60);
  return "Student";
}

function randomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("labNotebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        id: row._id,
        kind: row.kind,
        title: row.title,
        subject: row.subject,
        experimentKey: row.experimentKey ?? null,
        content: row.content,
        entries: row.entries,
        shareCode: row.shareCode ?? null,
        completedAt: row.completedAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (cleaned.length !== 6) return null;
    const row = await ctx.db
      .query("labNotebooks")
      .withIndex("by_share_code", (q) => q.eq("shareCode", cleaned))
      .unique();
    if (!row) return null;
    const owner = await ctx.db.get(row.ownerId);
    return {
      id: row._id,
      ownerName: owner?.name?.trim() || "A lab partner",
      kind: row.kind,
      title: row.title,
      subject: row.subject,
      experimentKey: row.experimentKey ?? null,
      content: row.content,
      entries: row.entries,
      shareCode: row.shareCode ?? null,
      completedAt: row.completedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
});

export const saveWorksheet = mutation({
  args: {
    notebookId: v.optional(v.id("labNotebooks")),
    experimentKey: v.string(),
    subject: v.string(),
    title: v.string(),
    content: contentValidator,
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    const content = cleanContent(args.content);
    const key = clean(args.experimentKey, 80) || "experiment";
    const title = clean(args.title, 90) || "Experiment worksheet";

    let existing = null;
    if (args.notebookId) {
      existing = await ctx.db.get(args.notebookId);
      if (!existing || existing.ownerId !== userId) {
        throw new Error("That worksheet does not belong to this account.");
      }
    } else {
      const rows = await ctx.db
        .query("labNotebooks")
        .withIndex("by_owner_kind", (q) =>
          q.eq("ownerId", userId).eq("kind", "worksheet"),
        )
        .collect();
      existing =
        rows.find(
          (row) =>
            row.experimentKey === key ||
            row.title.toLowerCase() === title.toLowerCase(),
        ) ?? null;
    }

    let notebookId = existing?._id;
    if (!notebookId) {
      notebookId = await ctx.db.insert("labNotebooks", {
        ownerId: userId,
        kind: "worksheet",
        title,
        subject: clean(args.subject, 24) || "STEM",
        experimentKey: key,
        content,
        entries: [],
        completedAt: args.completed ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(notebookId, {
        title,
        subject: clean(args.subject, 24) || "STEM",
        experimentKey: key,
        content,
        completedAt: args.completed ? existing?.completedAt ?? now : undefined,
        updatedAt: now,
      });
    }

    /* Answer totals are read from the notebook itself, not incremented here:
       every autosave would otherwise count the same answer again. */
    await bumpProgress(ctx, userId, {
      key,
      subject: clean(args.subject, 24) || "STEM",
      title,
      completed: args.completed,
    });
    return { id: notebookId };
  },
});

export const ensureNotes = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const rows = await ctx.db
      .query("labNotebooks")
      .withIndex("by_owner_kind", (q) => q.eq("ownerId", userId).eq("kind", "notes"))
      .collect();
    const existing = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (existing) return { id: existing._id, created: false };
    const now = Date.now();
    const id = await ctx.db.insert("labNotebooks", {
      ownerId: userId,
      kind: "notes",
      title: "My lab notebook",
      subject: "STEM",
      content: {
        aim: "",
        apparatus: "",
        procedure: "",
        observations: "",
        conclusion: "",
        answers: [],
      },
      entries: [],
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const ensureJournal = mutation({
  args: {
    experimentKey: v.string(),
    subject: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const key = clean(args.experimentKey, 80) || "journal";
    const rows = await ctx.db
      .query("labNotebooks")
      .withIndex("by_owner_kind", (q) =>
        q.eq("ownerId", userId).eq("kind", "journal"),
      )
      .collect();
    const existing = rows.find((row) => row.experimentKey === key);
    if (existing) return { id: existing._id, created: false };
    const now = Date.now();
    const id = await ctx.db.insert("labNotebooks", {
      ownerId: userId,
      kind: "journal",
      title: `Observation journal · ${clean(args.title, 80) || "Lab"}`,
      subject: clean(args.subject, 24) || "STEM",
      experimentKey: key,
      content: {
        aim: "",
        apparatus: "",
        procedure: "",
        observations: "",
        conclusion: "",
        answers: [],
      },
      entries: [],
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const addEntry = mutation({
  args: {
    notebookId: v.optional(v.id("labNotebooks")),
    code: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const text = cleanMultiline(args.text, 2000);
    if (!text) throw new Error("Write something before adding it to the notebook.");
    const code = args.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) ?? "";

    let notebook = null;
    if (args.notebookId) notebook = await ctx.db.get(args.notebookId);
    if (!notebook && code.length === 6) {
      notebook = await ctx.db
        .query("labNotebooks")
        .withIndex("by_share_code", (q) => q.eq("shareCode", code))
        .unique();
    }
    if (!notebook) throw new Error("That notebook could not be opened.");
    const isOwner = notebook.ownerId === userId;
    if (!isOwner && (!code || notebook.shareCode !== code)) {
      throw new Error("This notebook is not shared with you.");
    }

    const now = Date.now();
    const entry = {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      authorId: userId,
      authorName: await authorName(ctx, userId),
      text,
      at: now,
    };
    const entries = [...notebook.entries, entry].slice(-MAX_ENTRIES);
    await ctx.db.patch(notebook._id, { entries, updatedAt: now });

    await bumpProgress(ctx, userId, {
      key: notebook.experimentKey
        ? `${notebook.experimentKey}-notebook`
        : `notebook-${notebook.kind}`,
      subject: notebook.subject,
      title: `${notebook.title} · notebook`,
      notebookEntries: 1,
    });
    return { id: entry.id, authorName: entry.authorName };
  },
});

export const share = mutation({
  args: { notebookId: v.id("labNotebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await requireAuthUserId(ctx);
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Only the owner can share this notebook.");
    }
    if (notebook.shareCode) return { code: notebook.shareCode };

    let code = randomCode();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const clash = await ctx.db
        .query("labNotebooks")
        .withIndex("by_share_code", (q) => q.eq("shareCode", code))
        .unique();
      if (!clash) break;
      code = randomCode();
    }
    await ctx.db.patch(notebookId, { shareCode: code, updatedAt: Date.now() });
    return { code };
  },
});

export const revokeShare = mutation({
  args: { notebookId: v.id("labNotebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await requireAuthUserId(ctx);
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("Only the owner can stop sharing this notebook.");
    }
    /* Convex has no nullable column to write here. An empty string is not a
       valid six-character capability, so it reads as revoked without deleting
       the row. */
    await ctx.db.patch(notebookId, { shareCode: "", updatedAt: Date.now() });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { notebookId: v.id("labNotebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await requireAuthUserId(ctx);
    const notebook = await ctx.db.get(notebookId);
    if (!notebook || notebook.ownerId !== userId) {
      throw new Error("That notebook does not belong to this account.");
    }
    await ctx.db.delete(notebookId);
    return { ok: true };
  },
});
