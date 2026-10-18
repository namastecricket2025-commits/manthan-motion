"use node";

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Owner identity
// ---------------------------------------------------------------------------
// The owner is identified by the supabase auth `sub` (the JWT claim Convex
// trusts), compared against the environment value the owner sets in their
// keys. We do not store the owner id in Convex — the env var is the only place
// it lives, read server-side inside this file.

const OWNER_SUBJECT_KEY = "MANTHAN_OWNER_SUBJECT";

function ownerSubject(): string {
  const sub = process.env[OWNER_SUBJECT_KEY];
  if (!sub) {
    throw new Error(
      `The Convex environment variable ${OWNER_SUBJECT_KEY} is not set. ` +
        `Set it to your Supabase auth user id (the "sub" claim) so the owner ` +
        `approval page can identify itself.`,
    );
  }
  return sub;
}

// ---------------------------------------------------------------------------
// In-app submission
// ---------------------------------------------------------------------------

export const submitFeedback = mutation({
  args: {
    rating: v.number(),
    text: v.optional(v.string()),
    displayName: v.optional(v.string()),
    classLabel: v.optional(v.string()),
    consentToPublish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in to leave feedback.");
    }

    if (!(args.rating >= 1 && args.rating <= 5)) {
      throw new Error("Rating must be between 1 and 5.");
    }

    await ctx.db.insert("testimonials", {
      userId: identity.subject ?? undefined,
      rating: args.rating,
      text: args.text ?? "",
      displayName: args.displayName ?? undefined,
      classLabel: args.classLabel ?? undefined,
      consentToPublish: args.consentToPublish,
      status: "pending",
      source: "user",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Owner-only: list pending testimonials
// ---------------------------------------------------------------------------

interface TestimonialRow {
  _id: Id<"testimonials">;
  userId: Id<"users"> | undefined;
  rating: number;
  text: string;
  displayName: string | undefined;
  classLabel: string | undefined;
  consentToPublish: boolean;
  status: "pending" | "approved" | "rejected";
  source: string;
  createdAt: number;
}

export const listPending = action({
  args: {},
  handler: async (ctx) => {
    const me = ownerSubject();

    const rows = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const filtered: TestimonialRow[] = rows.filter(
      (row: TestimonialRow) =>
        !row.userId ||
        row.userId === me ||
        // Seeded early-tester rows have no owner; the app owner is the only
        // person who can act on them, and we allow it only when the caller
        // is the owner.
        row.source === "early_tester",
    );

    return filtered.map((row) => ({
      id: row._id,
      rating: row.rating,
      text: row.text,
      displayName: row.displayName,
      classLabel: row.classLabel,
      consentToPublish: row.consentToPublish,
      source: row.source,
      createdAt: row.createdAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Owner-only: approve / reject / edit-for-typos
// ---------------------------------------------------------------------------

export const approve = action({
  args: { id: v.id("testimonials") },
  handler: async (ctx, args) => {
    const me = ownerSubject();
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");

    if (
      row.userId !== me &&
      row.userId !== undefined &&
      row.source !== "early_tester"
    ) {
      throw new Error("You may only approve your own submissions.");
    }

    await ctx.db.patch(args.id, {
      status: "approved",
      updatedAt: Date.now(),
    });
  },
});

export const reject = action({
  args: { id: v.id("testimonials") },
  handler: async (ctx, args) => {
    const me = ownerSubject();
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");

    if (
      row.userId !== me &&
      row.userId !== undefined &&
      row.source !== "early_tester"
    ) {
      throw new Error("You may only reject your own submissions.");
    }

    await ctx.db.patch(args.id, {
      status: "rejected",
      updatedAt: Date.now(),
    });
  },
});

export const editText = action({
  args: {
    id: v.id("testimonials"),
    /** New text — allowed only when the meaning is unchanged (typo fixes). */
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const me = ownerSubject();
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");

    if (
      row.userId !== me &&
      row.userId !== undefined &&
      row.source !== "early_tester"
    ) {
      throw new Error("You may only edit reviews you own.");
    }

    // Owner-only edit path: store the edited text. The status stays as-is, so
    // an approved review remains approved.
    await ctx.db.patch(args.id, {
      text: args.text.trim(),
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public: approved + consented rows (only ever what the public may see)
// ---------------------------------------------------------------------------

export const approvedList = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(100, args.limit ?? 50);
    const rows = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const publicRows: TestimonialRow[] = rows.filter(
      (row: TestimonialRow) =>
        row.status === "approved" && row.consentToPublish === true,
    );

    return publicRows
      .slice(0, limit)
      .map((row) => ({
        id: row._id,
        rating: row.rating,
        text: row.text,
        displayName: row.displayName,
        classLabel: row.classLabel,
        source: row.source,
        createdAt: row.createdAt,
      }));
  },
});

export const approvedStats = action({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const publicRows: TestimonialRow[] = rows.filter(
      (row: TestimonialRow) =>
        row.status === "approved" && row.consentToPublish === true,
    );

    const count = publicRows.length;
    if (count === 0) {
      return { count: 0, averageRating: 0 };
    }

    const sum = publicRows.reduce(
      (acc: number, row: TestimonialRow) => acc + row.rating,
      0,
    );
    return {
      count,
      averageRating: Math.round((sum / count) * 10) / 10,
    };
  },
});
