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
 *   `source: "early_tester"` — the students who tried Manthan before launch
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
// Seed: the early testers
// ---------------------------------------------------------------------------

/**
 * The quotes exactly as the testers wrote them, emojis and all. Text is never
 * reworded, capitalised or corrected here — this array is the record, and the
 * site renders it verbatim. The column is a Convex string, so it stores and
 * returns UTF-8 unchanged.
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
  {
    displayName: "Anshul",
    classLabel: "Class 10",
    rating: 5,
    text: "I tried the quiz feature and its actually pretty good 😭 makes revision a little less boring and helps me see what i still need to learn",
  },
  {
    displayName: "Nidhi",
    classLabel: "Class 9",
    rating: 5,
    text: "the website is really cool ngl, especially the summaries coz sometimes the textbook is just too much to read before a test 💀",
  },
  {
    displayName: "Rishabh",
    classLabel: "Class 8",
    rating: 4,
    text: "Manthan is actually a nice idea. I would probably use it more for science and maths. The STEM lab looks interesting, would be cool to explore more stuff on it.",
  },
  {
    displayName: "Anavi",
    classLabel: "Class 8",
    rating: 5,
    text: "wait this can make slides too?? 😭 thats actually helpful for school projects. having different study tools on one website is a pretty good idea",
  },
  {
    displayName: "Dev",
    classLabel: "Class 10",
    rating: 5,
    text: "I like how everything is in one place instead of searching different websites for everything. could be really useful during exams when you have like 10 chapters left lol",
  },
] as const;

/**
 * Names from an earlier review batch that was never part of the school quote
 * sheet. `Dev` is special-cased by class because Class 10 Dev is canonical.
 */
const LEGACY_NAMES = [
  "Aditya",
  "Mehak",
  "Rohan",
  "Ishita",
  "Arjun",
  "Anushka",
  "Pari",
  "Myra",
  "Kabir",
] as const;

/**
 * Bring the early-tester rows in line with the quote sheet, idempotently.
 *
 * - removes the old test batch (and any other `early_tester` row that is not
 *   one of the canonical eleven),
 * - inserts the ones that are missing,
 * - rewrites the canonical fields on rows that already exist, so the exact
 *   spelling, rating, consent and approval state are guaranteed.
 *
 * In-app reviews (`source: "user"`) are never touched. Run with
 * `bunx convex run testimonials:seedEarlyTesters`.
 */
export const seedEarlyTesters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("testimonials").collect();
    const keyOf = (row: { displayName?: string; classLabel?: string }) =>
      `${row.displayName ?? ""}\u0000${row.classLabel ?? ""}`;
    const canonical = new Map(
      EARLY_TESTERS.map((tester, index) => [
        `${tester.displayName}\u0000${tester.classLabel}`,
        index,
      ]),
    );

    let removed = 0;
    for (const row of rows) {
      if (row.source !== "early_tester") continue;
      const isLegacyName =
        LEGACY_NAMES.includes(row.displayName as (typeof LEGACY_NAMES)[number]) ||
        (row.displayName === "Dev" && row.classLabel === "Class 7");
      if (isLegacyName || !canonical.has(keyOf(row))) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }

    // A fixed base keeps the quote sheet's order stable; the UI mixes the
    // order for display without writing anything back to the database.
    const base = Date.UTC(2026, 9, 1);
    let inserted = 0;
    let updated = 0;

    for (const [index, tester] of EARLY_TESTERS.entries()) {
      const existing = rows.find(
        (row) =>
          row.source === "early_tester" &&
          row.displayName === tester.displayName &&
          row.classLabel === tester.classLabel,
      );

      if (existing) {
        const fields = {
          rating: tester.rating,
          text: tester.text,
          displayName: tester.displayName,
          classLabel: tester.classLabel,
          consentToPublish: true,
          status: "approved" as const,
          source: "early_tester" as const,
          createdAt: base + index * 60_000,
        };
        const changed =
          existing.rating !== fields.rating ||
          existing.text !== fields.text ||
          existing.consentToPublish !== fields.consentToPublish ||
          existing.status !== fields.status ||
          existing.createdAt !== fields.createdAt;
        if (changed) {
          await ctx.db.patch(existing._id, fields);
          updated += 1;
        }
        continue;
      }

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
      inserted += 1;
    }

    return { inserted, updated, removed, total: EARLY_TESTERS.length };
  },
});
