import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * The landing page's demo lane for web search.
 *
 * `webSearch.search` and `webSearch.followUp` both require an account, because
 * both spend from a plan allowance. The home page's preview cannot: it is the
 * first thing a visitor uses, before there is anything to meter against. This
 * module holds the two things that make an anonymous lane safe to offer:
 *
 *   1. a cache — one row per distinct question, answered once and then served
 *      free to everyone who asks it again. The suggested questions on the
 *      landing page cost one lookup in total, not one per visitor;
 *   2. a daily ceiling — a per-day counter the demo claims a slot from before
 *      it spends anything. When the day is used up the panel says so and
 *      points at the sign-in, so the demo degrades into a sentence rather
 *      than into a bill.
 *
 * The cache is deliberately kept for good rather than expiring: these are
 * evergreen school questions, and a stale answer is still an answer this
 * audience wants. Rows only accumulate at the rate of the daily ceiling, so
 * the table cannot grow faster than the spend it bounds.
 *
 * Like `searchContext.ts`, this lives in a plain (non-Node) module, because
 * Convex only allows actions in a `"use node"` file and the actions here need
 * to read and write the database.
 */

/**
 * Live lookups the public demo may run in one UTC day, searches and follow-ups
 * together. This is the dial: raise it for a launch, drop it if the demo is
 * being farmed as a free search API. It is deliberately small enough that the
 * worst case is a known, boring number of requests.
 */
export const DEMO_DAILY_LIMIT = 40;

/** The UTC bucket `usage` already uses, so the two ceilings read alike. */
export function dayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Trim, collapse whitespace and lowercase: "Why Sky  Blue?" hits "why sky blue?". */
export function normaliseQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 240);
}

export const read = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    return await ctx.db
      .query("searchDemo")
      .withIndex("by_query", (q) => q.eq("query", query))
      .first();
  },
});

export const write = internalMutation({
  args: {
    query: v.string(),
    provider: v.optional(v.string()),
    answer: v.optional(
      v.object({
        text: v.string(),
        title: v.optional(v.string()),
        url: v.optional(v.string()),
      }),
    ),
    results: v.array(
      v.object({ title: v.string(), url: v.string(), snippet: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("searchDemo")
      .withIndex("by_query", (q) => q.eq("query", args.query))
      .first();
    const row = {
      query: args.query,
      provider: args.provider,
      answer: args.answer,
      results: args.results,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { stored: "updated" as const };
    }
    await ctx.db.insert("searchDemo", row);
    return { stored: "created" as const };
  },
});

/**
 * Take one slot from today's ceiling.
 *
 * The read and the write are in one mutation on purpose: two visitors arriving
 * together cannot both see "39 spent" and both go through. Returns whether the
 * slot was granted, so the caller can refuse before it spends anything.
 */
export const claim = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const row = await ctx.db
      .query("searchDemoDay")
      .withIndex("by_day", (q) => q.eq("day", day))
      .first();
    const spent = row?.spent ?? 0;
    if (spent >= DEMO_DAILY_LIMIT) return { allowed: false, spent };
    if (row) {
      await ctx.db.patch(row._id, { spent: spent + 1, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("searchDemoDay", { day, spent: 1, updatedAt: Date.now() });
    }
    return { allowed: true, spent: spent + 1 };
  },
});
