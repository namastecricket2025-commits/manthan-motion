import { internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Who is asking for a web search.
 *
 * The search runs in a Node action (it calls Google), so it cannot touch the
 * database itself. It resolves the account through this query first, which is
 * what lets the action meter spend against the right plan instead of running
 * as an unattributed proxy.
 *
 * This lives in a plain (non-Node) module because Convex only allows actions
 * in a `"use node"` file.
 */
export const whoAmI = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ signedIn: boolean; userId: Id<"users"> | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { signedIn: false, userId: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject),
      )
      .first();

    // Signed in but never stored anything yet: the row is created by the
    // first write path, so search is allowed unmetered until it exists.
    return { signedIn: true, userId: user?._id ?? null };
  },
});
