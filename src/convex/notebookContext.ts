import { internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * The readable sources of one notebook, owner-checked.
 *
 * This lives in a plain (non-Node) module because Convex only allows actions in
 * a `"use node"` file; the studio actions call it through `internal`.
 */

export interface SourceSlice {
  name: string;
  text: string;
}

export const studioContext = internalQuery({
  args: { notebookId: v.id("notebooks") },
  handler: async (
    ctx,
    { notebookId },
  ): Promise<{
    name: string;
    ownerId: Id<"users">;
    sources: SourceSlice[];
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to talk about this notebook.");

    const notebook = await ctx.db.get(notebookId);
    if (!notebook) throw new Error("That notebook no longer exists.");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .first();
    if (!user || notebook.ownerId !== user._id) {
      throw new Error("That notebook belongs to another account.");
    }

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();

    const readable = sources
      .filter((source) => source.status === "ready" && (source.text?.length ?? 0) > 40)
      .map((source) => ({ name: source.name, text: source.text ?? "" }));

    return { name: notebook.name, ownerId: user._id, sources: readable };
  },
});
