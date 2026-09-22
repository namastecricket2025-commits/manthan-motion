import { currentIdentity, getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

/**
 * Daily usage accounting for the study-material engine.
 *
 * The free tier of the backing model provider is finite, so the platform
 * metered: `ai.generate` spends from this ledger before and after each model
 * call, and the dashboard reads the same ledger to draw the quota meter. The
 * limit is intentionally a product decision, not the provider's — the engine
 * stays under it, and the UI presents it as "your daily allowance", not as a
 * provider error.
 */

/** Daily token allowance per account on the free (current) plan. */
export const DAILY_TOKEN_LIMIT = 60_000;

/** UTC date bucket "YYYY-MM-DD" — one row per user per day. */
export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Milliseconds until the current UTC day rolls over. */
export function msUntilReset(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - now;
}

export const record = internalMutation({
  args: {
    userId: v.id("users"),
    tokens: v.number(),
    requests: v.number(),
  },
  handler: async (ctx, { userId, tokens, requests }) => {
    const day = utcDay();
    const row = await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();

    if (row) {
      await ctx.db.patch(row._id, {
        used: row.used + tokens,
        requests: row.requests + requests,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("usage", {
        userId,
        day,
        used: tokens,
        requests,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Read today's ledger row without creating one. */
export const getToday = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const day = utcDay();
    return await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
  },
});

/** What the dashboard's usage card renders. */
export const myUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await currentIdentity(ctx);
    if (!identity) return null;

    // An account that has not generated anything yet has no ledger row — and
    // that is a started meter, not a missing one: zero of the daily allowance
    // has been spent.
    const userId = await getAuthUserId(ctx);
    const row = userId
      ? await ctx.db
          .query("usage")
          .withIndex("by_user_day", (q) =>
            q.eq("userId", userId).eq("day", utcDay()),
          )
          .unique()
      : null;

    return {
      used: row?.used ?? 0,
      requests: row?.requests ?? 0,
      limit: DAILY_TOKEN_LIMIT,
      resetsAt: Date.now() + msUntilReset(),
    };
  },
});

/** Endpoint used by ai.generate before it spends anything. */
export const ensureWithinQuota = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", utcDay()))
      .unique();
    return {
      used: row?.used ?? 0,
      requests: row?.requests ?? 0,
      limit: DAILY_TOKEN_LIMIT,
    };
  },
});

/**
 * Forward-only spend marker so a client can't hold a stale meter: the
 * generation action calls this with the tokens a request actually consumed.
 * (Record is the real writer; this is exported for symmetry/future tools.)
 */
export const addSpend = mutation({
  args: { tokens: v.number(), requests: v.number() },
  handler: async (ctx, { tokens, requests }) => {
    const userId = await requireAuthUserId(ctx);
    await ctx.runMutation(internal.usage.record, {
      userId,
      tokens,
      requests,
    });
  },
});
