import { currentIdentity, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Reviews left by students.
 *
 * Two kinds of row live here and are treated as one stream on the site:
 *
 *   `source: "user"`         — submitted in-app by a signed-in account. Starts
 *                              `pending`; only the owner can approve it.
 *   `source: "early_tester"` — the six students who tried Manthan before launch
 *                              and agreed to be quoted. They have no accounts,
 *                              so `userId` is empty; they are seeded already
 *                              approved and consented.
 *
 * Public reads go through `approved`, which filters on BOTH `status` and
 * `consentToPublish` and computes the count and average live from the rows it
 * actually read. Nothing on the marketing pages hardcodes 4.7 or a review
 * count: if a row is removed, both numbers move with it.
 */

const MAX_TEXT = 600;
const MAX_NAME = 40;

/** Owner identity is the Supabase `sub` stored in the deployment's env. */
const OWNER_SUBJECT_KEY = "MANTHAN_OWNER_SUBJECT";

async function requireOwner(ctx: Parameters<typeof currentIdentity>[0]) {
  const owner = process.env[OWNER_SUBJECT_KEY];
  if (!owner) {
    throw new Error(
      `The Convex environment variable ${OWNER_SUBJECT_KEY} is not set. Set it ` +
        `to the site owner's Supabase user id (the "sub" claim) so review ` +
        `moderation can identify them.`,
    );
  }
  const identity = await currentIdentity(ctx);
  if (!identity || identity.subject !== owner) {
    throw new Error("Only the site owner can moderate reviews.");
  }
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
    if (!(args.rating >= 1 && args.rating <= 5)) {
      throw new Error("Rating must be between 1 and 5.");
    }

    const userId = await requireAuthUserId(ctx);

    await ctx.db.insert("testimonials", {
      userId,
      rating: Math.round(args.rating),
      text: (args.text ?? "").trim().slice(0, MAX_TEXT),
      displayName: args.displayName?.trim().slice(0, MAX_NAME) || undefined,
      classLabel: args.classLabel?.trim().slice(0, MAX_NAME) || undefined,
      consentToPublish: args.consentToPublish,
      status: "pending",
      source: "user",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public: approved + consented rows, with live stats
// ---------------------------------------------------------------------------

export type PublicReview = {
  id: string;
  rating: number;
  text: string;
  displayName?: string;
  classLabel?: string;
  source: string;
};

/**
 * The reviews the marketing pages may show, plus the numbers derived from
 * them.
 *
 * Order: the seeded early testers keep the order they were inserted in (that
 * is the order the school approved the quotes in), then in-app reviews newest
 * first. Both groups are only ever approved AND consented rows.
 */
export const approved = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const publishable = rows.filter(
      (row) => row.status === "approved" && row.consentToPublish === true,
    );

    const seeded = publishable
      .filter((row) => row.source === "early_tester")
      .sort((a, b) => a.createdAt - b.createdAt);
    const recent = publishable
      .filter((row) => row.source !== "early_tester")
      .sort((a, b) => b.createdAt - a.createdAt);

    const ordered = [...seeded, ...recent];

    const count = ordered.length;
    const total = ordered.reduce((sum, row) => sum + row.rating, 0);

    return {
      reviews: ordered.map((row): PublicReview => ({
        id: row._id,
        rating: row.rating,
        text: row.text,
        displayName: row.displayName,
        classLabel: row.classLabel,
        source: row.source,
      })),
      count,
      averageRating: count === 0 ? 0 : Math.round((total / count) * 10) / 10,
    };
  },
});

// ---------------------------------------------------------------------------
// Owner moderation
// ---------------------------------------------------------------------------

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);

    const rows = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
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

export const approve = mutation({
  args: { id: v.id("testimonials") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");
    await ctx.db.patch(args.id, { status: "approved" });
  },
});

export const reject = mutation({
  args: { id: v.id("testimonials") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");
    await ctx.db.patch(args.id, { status: "rejected" });
  },
});

/** Typo-only edits: the meaning of an approved quote never changes. */
export const editText = mutation({
  args: { id: v.id("testimonials"), text: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");
    const text = args.text.trim().slice(0, MAX_TEXT);
    if (!text) throw new Error("A review cannot be empty.");
    await ctx.db.patch(args.id, { text });
  },
});

// ---------------------------------------------------------------------------
// Seed: the six early testers
// ---------------------------------------------------------------------------

/**
 * The quotes exactly as the testers wrote them. Text is never reworded here —
 * this array is the record, and the site renders it verbatim.
 */
export const EARLY_TESTERS = [
  {
    displayName: "Aarav",
    classLabel: "Class 9",
    rating: 5,
    text: "I used Manthan to make summaries and quizzes for my science chapters. I liked how quickly it helped me revise important topics without reading everything again. It makes studying easier and more interesting.",
  },
  {
    displayName: "Siya",
    classLabel: "Class 8",
    rating: 5,
    text: "I tried the quiz and summary features on Manthan. My favourite part was being able to understand a chapter and test myself in one place. I think it can be really useful during exam preparation.",
  },
  {
    displayName: "Reyansh",
    classLabel: "Class 10",
    rating: 4,
    text: "I used Manthan to create study material and practise questions. I liked having different learning tools on the same website. It could become even better with more customisation options and explanations.",
  },
  {
    displayName: "Ananya",
    classLabel: "Class 8",
    rating: 5,
    text: "Manthan is a helpful platform for students who want to study smarter. I especially liked the idea of generating slides and summaries because they can make difficult topics easier to understand and remember.",
  },
  {
    displayName: "Vivaan",
    classLabel: "Class 9",
    rating: 5,
    text: "The STEM Lab and Math Lab features make Manthan an interesting concept beyond regular studying. I like that it aims to make learning more interactive instead of just reading textbooks.",
  },
  {
    displayName: "Kavya",
    classLabel: "Class 11",
    rating: 4,
    text: "I liked the idea of having quizzes, notes, and other study resources together. Manthan has the potential to save students time and help them prepare for exams in a more organised way.",
  },
] as const;

/**
 * Insert the six approved early-tester rows. Idempotent: if any early-tester
 * rows already exist the seed is a no-op, so running it twice cannot duplicate
 * a quote. Run with `bunx convex run testimonials:seedEarlyTesters`.
 */
export const seedEarlyTesters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("testimonials").collect();
    const existing = rows.filter((row) => row.source === "early_tester");
    if (existing.length > 0) {
      return { inserted: 0, skipped: existing.length };
    }

    // A fixed base keeps the quotes in the order they were collected.
    const base = Date.UTC(2026, 9, 1);
    for (const [index, tester] of EARLY_TESTERS.entries()) {
      await ctx.db.insert("testimonials", {
        rating: tester.rating,
        text: tester.text,
        displayName: tester.displayName,
        classLabel: tester.classLabel,
        consentToPublish: true,
        status: "approved",
        source: "early_tester",
        createdAt: base + index * 60_000,
      });
    }

    return { inserted: EARLY_TESTERS.length, skipped: 0 };
  },
});
