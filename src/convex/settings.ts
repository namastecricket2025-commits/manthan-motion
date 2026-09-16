import { getAuthSessionId, getAuthUserId, invalidateSessions } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ */
/* Profile + active sessions (drives the account section of settings)  */
/* ------------------------------------------------------------------ */

/** The signed-in user's profile plus every live login session. */
export const myAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const sessionId = await getAuthSessionId(ctx);
    const user = await ctx.db.get(userId);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    return {
      name: user?.name ?? "",
      email: user?.email ?? "",
      providers: accounts.map((a) => a.provider),
      sessions: sessions
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((s) => ({
          id: s._id,
          createdAt: s._creationTime,
          expiresAt: s.expirationTime,
          current: s._id === sessionId,
        })),
    };
  },
});

/** Update display name and/or contact email of the signed-in user. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You need to be signed in.");

    const patch: { name?: string; email?: string } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2) throw new Error("Display name must be at least 2 characters.");
      if (name.length > 60) throw new Error("Display name must be 60 characters or fewer.");
      patch.name = name;
    }

    if (args.email !== undefined) {
      const email = args.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
      patch.email = email;
    }

    if (Object.keys(patch).length === 0) return { ok: true as const, changed: false };
    await ctx.db.patch(userId, patch);
    return { ok: true as const, changed: true };
  },
});

/* ------------------------------------------------------------------ */
/* Device / session control                                            */
/* ------------------------------------------------------------------ */

/** Revoke every login session except the one making the request. */
export const signOutOtherSessions = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You need to be signed in.");
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: sessionId === null ? [] : [sessionId],
    });
    return { ok: true as const };
  },
});

/* ------------------------------------------------------------------ */
/* Account deletion — permanent                                        */
/* ------------------------------------------------------------------ */

/** Permanently erase the account, its sessions and all linked credentials. */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You need to be signed in.");

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }

    await ctx.db.delete(userId);
    return { ok: true as const };
  },
});
