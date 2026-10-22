import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Share links for one generated material.
 *
 * Sharing is a deliberate, per-sheet act: a link exists only because its owner
 * clicked Share on that material. The token is the capability, so it is long
 * and random; every read re-checks that the material still belongs to the
 * account that shared it, and revoking flips a flag that every copy of the
 * link respects immediately. Nothing else on the notebook is exposed — sources,
 * chat history and other materials are not reachable from the token.
 */

function makeToken() {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return uuid.replace(/-/g, "").slice(0, 32);
}

export const forMaterial = query({
  args: { materialId: v.id("materials") },
  handler: async (ctx, { materialId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const share = await ctx.db
      .query("sharedMaterials")
      .withIndex("by_material", (q) => q.eq("materialId", materialId))
      .collect()
      .then((rows) => rows.find((row) => row.ownerId === userId));
    if (!share || share.revokedAt) return null;
    return { token: share.token, createdAt: share.createdAt };
  },
});

export const create = mutation({
  args: { materialId: v.id("materials") },
  handler: async (ctx, { materialId }) => {
    const userId = await requireAuthUserId(ctx);
    const material = await ctx.db.get(materialId);
    if (!material || material.ownerId !== userId) {
      throw new Error("Study material not found.");
    }
    const notebook = await ctx.db.get(material.notebookId);

    const existing = await ctx.db
      .query("sharedMaterials")
      .withIndex("by_material", (q) => q.eq("materialId", materialId))
      .collect()
      .then((rows) => rows.find((row) => row.ownerId === userId));

    if (existing) {
      if (existing.revokedAt) {
        await ctx.db.patch(existing._id, { revokedAt: undefined });
      }
      return { token: existing.token };
    }

    const token = makeToken();
    await ctx.db.insert("sharedMaterials", {
      token,
      ownerId: userId,
      materialId,
      notebookName: notebook?.name ?? "Study material",
      createdAt: Date.now(),
    });
    return { token };
  },
});

export const revoke = mutation({
  args: { materialId: v.id("materials") },
  handler: async (ctx, { materialId }) => {
    const userId = await requireAuthUserId(ctx);
    const rows = await ctx.db
      .query("sharedMaterials")
      .withIndex("by_material", (q) => q.eq("materialId", materialId))
      .collect();
    for (const row of rows) {
      if (row.ownerId === userId && !row.revokedAt) {
        await ctx.db.patch(row._id, { revokedAt: Date.now() });
      }
    }
    return { revoked: true };
  },
});

/**
 * The public read. No identity is required — the token is the authorisation —
 * and the response carries only the rendered sheet, never sources or ids.
 */
export const getPublic = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token || token.length < 16) return null;
    const share = await ctx.db
      .query("sharedMaterials")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!share || share.revokedAt) return null;

    const material = await ctx.db.get(share.materialId);
    if (!material || material.ownerId !== share.ownerId) return null;

    return {
      title: material.title,
      kind: material.kind,
      payload: material.payload,
      createdAt: material.createdAt,
      sourceCount: material.sourceIds.length,
      notebookName: share.notebookName,
    };
  },
});
