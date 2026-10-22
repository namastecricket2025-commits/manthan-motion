import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * The Mistake Bank.
 *
 * Only answers the student actually got wrong are stored. A quiz row keeps its
 * options and correct index, so the question can be retried exactly as it was
 * asked; a practice row keeps the two answers, so the page can show the gap
 * without a model call. Re-answering the same question the same way does not
 * create a second row — the bank is a list of lessons, not a hit counter.
 */

const sourceValidator = v.union(v.literal("quiz"), v.literal("practice"));

function clean(value: string | undefined, limit: number) {
  return value?.trim().slice(0, limit);
}

export const record = mutation({
  args: {
    source: sourceValidator,
    prompt: v.string(),
    options: v.optional(v.array(v.string())),
    answerIndex: v.optional(v.number()),
    correctAnswer: v.optional(v.string()),
    givenAnswer: v.optional(v.string()),
    explanation: v.optional(v.string()),
    materialId: v.optional(v.id("materials")),
    chapter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const prompt = clean(args.prompt, 2_000) ?? "";
    if (!prompt) return null;

    const recent = await ctx.db
      .query("studyMistakes")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(80);

    const duplicate = recent.find(
      (row) =>
        row.source === args.source &&
        row.prompt === prompt &&
        (row.givenAnswer ?? "") === (clean(args.givenAnswer, 400) ?? "") &&
        !row.resolvedAt,
    );
    if (duplicate) return duplicate._id;

    return await ctx.db.insert("studyMistakes", {
      ownerId: userId,
      source: args.source,
      prompt,
      options: args.options?.map((option) => option.slice(0, 400)).slice(0, 8),
      answerIndex:
        typeof args.answerIndex === "number" && Number.isInteger(args.answerIndex)
          ? args.answerIndex
          : undefined,
      correctAnswer: clean(args.correctAnswer, 2_000),
      givenAnswer: clean(args.givenAnswer, 400),
      explanation: clean(args.explanation, 2_000),
      materialId: args.materialId,
      chapter: clean(args.chapter, 160),
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { includeResolved: v.optional(v.boolean()) },
  handler: async (ctx, { includeResolved }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("studyMistakes")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(120);

    return rows
      .filter((row) => includeResolved || !row.resolvedAt)
      .map((row) => ({
        id: row._id,
        source: row.source,
        prompt: row.prompt,
        options: row.options ?? [],
        answerIndex: row.answerIndex ?? null,
        correctAnswer: row.correctAnswer ?? null,
        givenAnswer: row.givenAnswer ?? null,
        explanation: row.explanation ?? null,
        materialId: row.materialId ?? null,
        chapter: row.chapter ?? null,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt ?? null,
      }));
  },
});

export const resolve = mutation({
  args: { mistakeId: v.id("studyMistakes"), resolved: v.boolean() },
  handler: async (ctx, { mistakeId, resolved }) => {
    const userId = await requireAuthUserId(ctx);
    const row = await ctx.db.get(mistakeId);
    if (!row || row.ownerId !== userId) throw new Error("Mistake not found.");
    await ctx.db.patch(mistakeId, {
      resolvedAt: resolved ? Date.now() : undefined,
    });
    if (resolved) {
      const cards = await ctx.db
        .query("reviewCards")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect();
      for (const card of cards) {
        if (card.mistakeId === mistakeId) await ctx.db.delete(card._id);
      }
    }
    return { resolved };
  },
});

export const remove = mutation({
  args: { mistakeId: v.id("studyMistakes") },
  handler: async (ctx, { mistakeId }) => {
    const userId = await requireAuthUserId(ctx);
    const row = await ctx.db.get(mistakeId);
    if (!row || row.ownerId !== userId) throw new Error("Mistake not found.");
    const cards = await ctx.db
      .query("reviewCards")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const card of cards) {
      if (card.mistakeId === mistakeId) await ctx.db.delete(card._id);
    }
    await ctx.db.delete(mistakeId);
  },
});
