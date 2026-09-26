import { currentIdentity, getAuthUserId, requireAuthUserId } from "./identity";
import { PLAN_ALLOWANCES, type PlanId } from "../lib/plans";
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

/** Which bucket the current plan's allowance refills in. */
export type AllowanceWindow = "day" | "month";

/** Milliseconds until the current UTC month rolls over. */
export function msUntilMonthReset(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return next - now;
}

/** Milliseconds until the plan's allowance window rolls over. */
export function msUntilWindowReset(window: AllowanceWindow, now = Date.now()) {
  return window === "month" ? msUntilMonthReset(now) : msUntilReset(now);
}

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
    // Spend lands in the same bucket the plan meters — a monthly allowance
    // accumulates across the month's rows, a daily one resets at midnight.
    const user = await ctx.db.get(userId);
    const plan = (user?.plan ?? "free") as AllowancePlan;
    const day = windowKey(allowanceFor(plan).window);
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

type AllowancePlan = PlanId;

/** A plan's allowance size and the bucket it refills in. */
function allowanceFor(plan: AllowancePlan) {
  return {
    limit: PLAN_ALLOWANCES[plan],
    window: (plan === "free" ? "day" : "month") as AllowanceWindow,
  };
}

/** The UTC day (free plan) or UTC month (subscribed) a window key names. */
function windowKey(window: AllowanceWindow, now = Date.now()) {
  if (window === "month") {
    return new Date(now).toISOString().slice(0, 7); // "YYYY-MM"
  }
  return utcDay(now);
}

/**
 * What the dashboard's usage card renders.
 *
 * The allowance is plan-aware: the free plan meters a day, every paid plan
 * meters the month its subscription is sold in. The window being metered
 * travels with the numbers so the UI never has to guess which cap applies.
 */
export const myUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await currentIdentity(ctx);
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const plan = (user?.plan ?? "free") as AllowancePlan;
    const { limit, window } = allowanceFor(plan);

    // An account that has not generated anything yet has no ledger row — and
    // that is a started meter, not a missing one: zero of the allowance has
    // been spent.
    const row = await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("day", windowKey(window)),
      )
      .unique();

    return {
      used: row?.used ?? 0,
      requests: row?.requests ?? 0,
      limit,
      window,
      plan,
      resetsAt: Date.now() + msUntilWindowReset(window),
    };
  },
});

/**
 * Endpoint used by ai.generate before it spends anything.
 *
 * The plan is read from the user row here — never taken from the caller — so
 * the window and cap being enforced are always the account's own.
 */
export const ensureWithinQuota = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const plan = (user?.plan ?? "free") as AllowancePlan;
    const { limit, window } = allowanceFor(plan);
    const row = await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("day", windowKey(window)),
      )
      .unique();
    return {
      used: row?.used ?? 0,
      requests: row?.requests ?? 0,
      limit,
      window,
      resetsAt: Date.now() + msUntilWindowReset(window),
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
