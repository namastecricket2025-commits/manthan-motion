import { getAuthUserId, requireAuthUserId } from "./identity";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * The daily review queue.
 *
 * A review card is not a new piece of generated content: it is a pointer to a
 * flashcard, quiz question or Maths practice mistake the student already owns.
 * `ensure` materialises those rows once, and `grade` moves a card along a small
 * FSRS-style schedule. The queue therefore cannot contain anything the student
 * has not already studied.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_NEW_PER_BUILD = 300;

const ratingValidator = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy"),
);

type Rating = "again" | "hard" | "good" | "easy";

type WantedCard = {
  key: string;
  notebookId?: Id<"notebooks">;
  materialId?: Id<"materials">;
  mistakeId?: Id<"studyMistakes">;
  kind: "flashcard" | "quiz" | "practice";
  prompt: string;
  answer: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  source?: string;
};

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cardKey(...parts: (string | number)[]) {
  return parts.join(":");
}

function fromMaterials(
  materials: {
    _id: Id<"materials">;
    notebookId: Id<"notebooks">;
    payload: unknown;
  }[],
) {
  const cards: WantedCard[] = [];

  for (const material of materials) {
    const payload = material.payload as
      | {
          cards?: { front?: unknown; back?: unknown; source?: unknown }[];
          questions?: {
            question?: unknown;
            options?: unknown;
            answer?: unknown;
            explanation?: unknown;
            source?: unknown;
          }[];
        }
      | null;

    if (!payload) continue;

    if (Array.isArray(payload.cards)) {
      payload.cards.forEach((card, index) => {
        const front = text(card?.front, 2_000);
        const back = text(card?.back, 2_000);
        if (!front || !back) return;
        cards.push({
          key: cardKey("flash", material._id, index),
          notebookId: material.notebookId,
          materialId: material._id,
          kind: "flashcard",
          prompt: front,
          answer: back,
          source: text(card?.source, 240) || undefined,
        });
      });
    }

    if (Array.isArray(payload.questions)) {
      payload.questions.forEach((question, index) => {
        const prompt = text(question?.question, 2_000);
        const options = Array.isArray(question?.options)
          ? question.options
              .map((option) => text(option, 400))
              .filter(Boolean)
              .slice(0, 8)
          : [];
        const answerIndex =
          typeof question?.answer === "number" &&
          Number.isInteger(question.answer) &&
          question.answer >= 0 &&
          question.answer < options.length
            ? question.answer
            : -1;
        if (!prompt || options.length < 2 || answerIndex < 0) return;
        cards.push({
          key: cardKey("quiz", material._id, index),
          notebookId: material.notebookId,
          materialId: material._id,
          kind: "quiz",
          prompt,
          answer: options[answerIndex] ?? "",
          options,
          answerIndex,
          explanation: text(question?.explanation, 2_000) || undefined,
          source: text(question?.source, 240) || undefined,
        });
      });
    }
  }

  return cards;
}

function fromPractice(
  mistakes: {
    _id: Id<"studyMistakes">;
    source: "quiz" | "practice";
    prompt: string;
    correctAnswer?: string;
    explanation?: string;
    resolvedAt?: number;
    materialId?: Id<"materials">;
  }[],
) {
  return mistakes
    .filter((row) => row.source === "practice" && !row.resolvedAt)
    .map<WantedCard>((row) => ({
      key: cardKey("practice", row._id),
      materialId: row.materialId,
      mistakeId: row._id,
      kind: "practice",
      prompt: row.prompt,
      answer: row.correctAnswer?.trim() ?? "",
      explanation: row.explanation?.trim() || undefined,
      source: "Math Lab practice",
    }))
    .filter((card) => card.answer.length > 0);
}

function nextSchedule(
  current: { intervalDays: number; ease: number; reps: number; lapses: number },
  rating: Rating,
  now: number,
) {
  let { intervalDays, ease, reps, lapses } = current;
  ease = Math.min(3.2, Math.max(1.3, ease));

  if (rating === "again") {
    lapses += 1;
    reps = 0;
    intervalDays = 0;
    ease = Math.max(1.3, ease - 0.2);
    return { intervalDays, ease, reps, lapses, dueAt: now + 10 * MINUTE };
  }

  reps += 1;
  if (rating === "hard") {
    intervalDays = Math.max(1, intervalDays * 1.2);
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === "good") {
    intervalDays = reps <= 1 ? 1 : Math.max(1, intervalDays * ease);
  } else {
    intervalDays = Math.max(2, (intervalDays || 1) * ease * 1.3);
    ease = Math.min(3.2, ease + 0.15);
  }

  intervalDays = Math.min(365, Math.round(intervalDays * 10) / 10);
  return {
    intervalDays,
    ease,
    reps,
    lapses,
    dueAt: now + Math.max(1, intervalDays) * DAY,
  };
}

/** Counts for the dashboard and the review page header. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { due: 0, total: 0 };

    const cards = await ctx.db
      .query("reviewCards")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const now = Date.now();
    return {
      due: cards.filter((card) => card.dueAt <= now).length,
      total: cards.length,
    };
  },
});

/**
 * Materialise any cards that do not exist yet, and drop cards whose source has
 * gone (a deleted deck, a deleted notebook, a resolved practice mistake).
 * Running it repeatedly is harmless.
 */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const materials = await ctx.db
      .query("materials")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const mistakes = await ctx.db
      .query("studyMistakes")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(200);

    const wanted = [...fromMaterials(materials), ...fromPractice(mistakes)];
    const wantedKeys = new Set(wanted.map((card) => card.key));

    const existing = await ctx.db
      .query("reviewCards")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const existingKeys = new Set(existing.map((card) => card.key));

    let created = 0;
    for (const card of wanted) {
      if (existingKeys.has(card.key) || created >= MAX_NEW_PER_BUILD) continue;
      await ctx.db.insert("reviewCards", {
        ownerId: userId,
        key: card.key,
        notebookId: card.notebookId,
        materialId: card.materialId,
        mistakeId: card.mistakeId,
        kind: card.kind,
        prompt: card.prompt,
        answer: card.answer,
        options: card.options,
        answerIndex: card.answerIndex,
        explanation: card.explanation,
        source: card.source,
        dueAt: now,
        intervalDays: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }

    for (const card of existing) {
      if (!wantedKeys.has(card.key)) await ctx.db.delete(card._id);
    }

    return { created };
  },
});

/** Cards that are due right now, oldest first. */
export const queue = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const take = Math.min(60, Math.max(1, Math.floor(limit ?? 40)));
    const now = Date.now();

    const rows = await ctx.db
      .query("reviewCards")
      .withIndex("by_owner_due", (q) =>
        q.eq("ownerId", userId).lte("dueAt", now),
      )
      .order("asc")
      .take(take);

    return rows.map((card) => ({
      id: card._id,
      materialId: card.materialId ?? null,
      notebookId: card.notebookId ?? null,
      kind: card.kind,
      prompt: card.prompt,
      answer: card.answer,
      options: card.options ?? [],
      answerIndex: card.answerIndex ?? null,
      explanation: card.explanation ?? null,
      source: card.source ?? null,
      dueAt: card.dueAt,
      intervalDays: card.intervalDays,
      reps: card.reps,
      lapses: card.lapses,
    }));
  },
});

/** Move a card forward on the schedule. */
export const grade = mutation({
  args: { cardId: v.id("reviewCards"), rating: ratingValidator },
  handler: async (ctx, { cardId, rating }) => {
    const userId = await requireAuthUserId(ctx);
    const card = await ctx.db.get(cardId);
    if (!card || card.ownerId !== userId) throw new Error("Review card not found.");

    const now = Date.now();
    const next = nextSchedule(
      {
        intervalDays: card.intervalDays,
        ease: card.ease,
        reps: card.reps,
        lapses: card.lapses,
      },
      rating,
      now,
    );

    await ctx.db.patch(cardId, {
      ...next,
      updatedAt: now,
    });
    return next;
  },
});
