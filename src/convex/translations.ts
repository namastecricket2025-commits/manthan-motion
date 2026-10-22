import { getAuthUserId } from "./identity";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Cached translations of study material.
 *
 * The original `materials.payload` is immutable here: a translation is a
 * sibling row, so switching back to the source language is instant and a
 * regeneration of the material does not inherit a stale Hindi copy.
 */

export const get = query({
  args: { materialId: v.id("materials"), lang: v.string() },
  handler: async (ctx, { materialId, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const material = await ctx.db.get(materialId);
    if (!material || material.ownerId !== userId) return null;

    const row = await ctx.db
      .query("materialTranslations")
      .withIndex("by_material_lang", (q) =>
        q.eq("materialId", materialId).eq("lang", lang.slice(0, 8)),
      )
      .unique();
    return row ? { payload: row.payload, model: row.model, createdAt: row.createdAt } : null;
  },
});

/** Internal read used by the action after it has verified ownership. */
export const getInternal = internalQuery({
  args: { materialId: v.id("materials"), lang: v.string() },
  handler: async (ctx, { materialId, lang }) => {
    return await ctx.db
      .query("materialTranslations")
      .withIndex("by_material_lang", (q) =>
        q.eq("materialId", materialId).eq("lang", lang),
      )
      .unique();
  },
});

export const save = internalMutation({
  args: {
    materialId: v.id("materials"),
    lang: v.string(),
    payload: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materialTranslations")
      .withIndex("by_material_lang", (q) =>
        q.eq("materialId", args.materialId).eq("lang", args.lang),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: args.payload,
        model: args.model,
        createdAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("materialTranslations", {
      materialId: args.materialId,
      lang: args.lang,
      payload: args.payload,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});
