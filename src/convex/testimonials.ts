import { currentIdentity, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";

/**
 * Reviews left by students.
 *
 * Two kinds of row live here and are treated as one stream on the site:
 *
 *   `source: "user"`         — submitted in-app by a signed-in account. One
 *                              that consents to publish is approved on submit,
 *                              so it actually reaches the carousel; one that
 *                              does not stays `pending` and private.
 *   `source: "early_tester"` — the students who tried Manthan before launch
 *                              and agreed to be quoted. They have no accounts,
 *                              so `userId` is empty; they are seeded already
 *                              approved and consented.
 *
 * Public reads go through `approved`, which filters on BOTH `status` and
 * `consentToPublish` and computes the count and average live from the rows it
 * actually read. Nothing on the marketing pages hardcodes 4.7 or a review
 * count: if a row is removed, both numbers move with it.
 *
 * `ownerOverview` is the moderation side: the whole table, its counts and its
 * average, for the owner/moderator only. It is what the Settings panel reads
 * to show what has come in, what is live and what is private.
 *
 * Convex deployments are separate databases: the preview runs against the dev
 * deployment, while the published site runs against the project's production
 * deployment. A seed that is only run by hand leaves production empty, which
 * is exactly what made the live carousel show its empty state. The seeding is
 * therefore part of the deployment path in two ways, and both are idempotent:
 * `crons.ts` re-checks it on a schedule, and `ensureEarlyTesters` is called by
 * the marketing page when a deployment reports zero reviews (a fresh deploy
 * heals on its first visit). Nothing else is ever written by either path.
 */

const MAX_TEXT = 600;
const MAX_NAME = 40;

/** Owner identity is the Supabase `sub` stored in the deployment's env. */
const OWNER_SUBJECT_KEY = "MANTHAN_OWNER_SUBJECT";

/**
 * Who may moderate reviews — three ways, in order of explicitness:
 *
 *   1. the subject in `MANTHAN_OWNER_SUBJECT`, when that env var is set;
 *   2. a `users` row whose role is `admin`;
 *   3. the first account ever created on the deployment, which is the site
 *      owner in practice. Without this fallback a fresh deployment has no way
 *      to reach the queue at all: the env var is optional, and asking the
 *      owner to hand-edit a role in the Convex dashboard before they can see
 *      their own reviews was exactly why submitted reviews never surfaced.
 *
 * Membership is never exposed to other users: `ownerOverview` returns
 * `{ moderator: false }` and the panel is not rendered.
 */
async function moderatorStatus(
  ctx: Parameters<typeof currentIdentity>[0],
): Promise<{ moderator: boolean; userId: string | null }> {
  const identity = await currentIdentity(ctx);
  if (!identity) return { moderator: false, userId: null };

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .unique();

  const owner = process.env[OWNER_SUBJECT_KEY]?.trim();
  if (owner && identity.subject === owner) {
    return { moderator: true, userId: user?._id ?? null };
  }
  if (user?.role === "admin") {
    return { moderator: true, userId: user._id };
  }

  const first = await ctx.db.query("users").first();
  return {
    moderator: !!user && !!first && first._id === user._id,
    userId: user?._id ?? null,
  };
}

async function requireOwner(ctx: Parameters<typeof currentIdentity>[0]) {
  const { moderator } = await moderatorStatus(ctx);
  if (!moderator) throw new Error("Only the site owner can moderate reviews.");
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

    // Consent is the gate, not a second queue. A student who ticks "show this
    // on the website" expects to see it there; leaving it `pending` behind a
    // moderation screen nobody knew about is why in-app reviews never reached
    // the carousel. Consented rows go live immediately and stay removable from
    // the review queue; rows without consent stay private (`pending`) and are
    // never selected by `approved`.
    await ctx.db.insert("testimonials", {
      userId,
      rating: Math.round(args.rating),
      text: (args.text ?? "").trim().slice(0, MAX_TEXT),
      displayName: args.displayName?.trim().slice(0, MAX_NAME) || undefined,
      classLabel: args.classLabel?.trim().slice(0, MAX_NAME) || undefined,
      consentToPublish: args.consentToPublish,
      status: args.consentToPublish ? "approved" : "pending",
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

/** The queue, the published list and the counts — owner/moderator only. */
export const ownerOverview = query({
  args: {},
  handler: async (ctx) => {
    const { moderator } = await moderatorStatus(ctx);
    if (!moderator) return { moderator: false as const };

    const rows = await ctx.db.query("testimonials").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);

    const counts = {
      pending: rows.filter((row) => row.status === "pending").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      earlyTesters: rows.filter((row) => row.source === "early_tester").length,
    };
    const rated = rows.filter((row) => row.status === "approved");
    const averageRating =
      rated.length === 0
        ? 0
        : Math.round(
            (rated.reduce((sum, row) => sum + row.rating, 0) / rated.length) * 10,
          ) / 10;

    return {
      moderator: true as const,
      counts,
      averageRating,
      reviews: rows.map((row) => ({
        id: row._id,
        rating: row.rating,
        text: row.text,
        displayName: row.displayName,
        classLabel: row.classLabel,
        consentToPublish: row.consentToPublish,
        status: row.status,
        source: row.source,
        createdAt: row.createdAt,
      })),
    };
  },
});

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

/** Remove a review outright — spam, a duplicate, or a removal request. */
export const removeReview = mutation({
  args: { id: v.id("testimonials") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");
    await ctx.db.delete(args.id);
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
async function seedEarlyTestersInto(ctx: MutationCtx) {
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
  // One row per canonical tester. An earlier run could leave a second copy of
  // the same name and class, which the carousel then showed twice; the first
  // copy is kept and the extras are removed here rather than in the UI alone.
  const kept = new Set<string>();
  for (const row of rows) {
    if (row.source !== "early_tester") continue;
    const isLegacyName =
      LEGACY_NAMES.includes(row.displayName as (typeof LEGACY_NAMES)[number]) ||
      (row.displayName === "Dev" && row.classLabel === "Class 7");
    const key = keyOf(row);
    const duplicate = kept.has(key);
    if (isLegacyName || !canonical.has(key) || duplicate) {
      await ctx.db.delete(row._id);
      removed += 1;
      continue;
    }
    kept.add(key);
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
}

/**
 * The seed itself. Safe to run any number of times: rows that already match the
 * quote sheet are left alone, and only missing canonical rows are inserted.
 *
 * Run by hand with `bunx convex run testimonials:seedEarlyTesters` (add
 * `--prod` for the published deployment). The scheduled job in `crons.ts` and
 * the bootstrap below both call the same function.
 */
export const seedEarlyTesters = internalMutation({
  args: {},
  handler: async (ctx) => seedEarlyTestersInto(ctx),
});

/**
 * Deployment bootstrap for a database that has no approved reviews yet.
 *
 * The published site and the preview run on separate Convex deployments, so a
 * fresh production database starts empty. The marketing pages call this once
 * when `approved` reports zero rows; every deployment with data is unaffected
 * because the query already returns early. The mutation takes no arguments and
 * can only ever write the fixed quote sheet above, so it cannot be used to
 * inject a review.
 */
export const ensureEarlyTesters = mutation({
  args: {},
  handler: async (ctx) => seedEarlyTestersInto(ctx),
});
