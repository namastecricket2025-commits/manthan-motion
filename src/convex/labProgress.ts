import { getAuthUserId, requireAuthUserId } from "./identity";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Lab progress, written by real events rather than inferred from a page view.
 *
 * An observation is counted when `useRecorder` has actually saved a row; an
 * answer is counted when a worksheet saves non-empty text; a notebook entry is
 * counted when it is appended. Time is sent in bounded slices by the notebook,
 * so a forgotten tab cannot claim a night of study.
 */

const MAX_TIME_SLICE = 900; // 15 minutes per write
const MAX_COUNT_SLICE = 120;
const MAX_TOTAL_TIME = 24 * 60 * 60;

function cleanKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function clampDelta(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_COUNT_SLICE, Math.floor(value));
}

export type ProgressBump = {
  key: string;
  subject: string;
  title: string;
  seconds?: number;
  observations?: number;
  answers?: number;
  notebookEntries?: number;
  completed?: boolean;
  attempt?: boolean;
};

/**
 * Shared write helper. `labNotebooks` and `useRecorder` both land here so a
 * worksheet save, a reading and a shared note all update one row.
 */
export async function bumpProgress(
  ctx: MutationCtx,
  userId: Awaited<ReturnType<typeof requireAuthUserId>>,
  input: ProgressBump,
) {
  const key = cleanKey(input.key);
  if (!key) throw new Error("This experiment has no stable key.");
  const now = Date.now();
  const seconds =
    typeof input.seconds === "number" && Number.isFinite(input.seconds)
      ? Math.min(MAX_TIME_SLICE, Math.max(0, Math.floor(input.seconds)))
      : 0;

  const existing = await ctx.db
    .query("labProgress")
    .withIndex("by_owner_experiment", (q) =>
      q.eq("ownerId", userId).eq("experimentKey", key),
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("labProgress", {
      ownerId: userId,
      experimentKey: key,
      subject: cleanText(input.subject, 24) || "STEM",
      title: cleanText(input.title, 90) || "Experiment",
      status: input.completed ? "completed" : "in_progress",
      timeSeconds: seconds,
      observations: clampDelta(input.observations),
      answers: clampDelta(input.answers),
      notebookEntries: clampDelta(input.notebookEntries),
      attempts: input.attempt ? 1 : 0,
      startedAt: now,
      lastActiveAt: now,
      completedAt: input.completed ? now : undefined,
    });
    return { ok: true, created: true };
  }

  /* `completed: false` is an explicit reopen, not an absent value. Autosaving
     a worksheet must be able to take an experiment back out of Completed when
     the student chooses to reopen it. */
  const status =
    input.completed === true
      ? "completed"
      : input.completed === false
        ? "in_progress"
        : existing.status;
  await ctx.db.patch(existing._id, {
    subject: cleanText(input.subject, 24) || existing.subject,
    title: cleanText(input.title, 90) || existing.title,
    status,
    timeSeconds: Math.min(MAX_TOTAL_TIME, existing.timeSeconds + seconds),
    observations: existing.observations + clampDelta(input.observations),
    answers: existing.answers + clampDelta(input.answers),
    notebookEntries:
      existing.notebookEntries + clampDelta(input.notebookEntries),
    attempts: existing.attempts + (input.attempt ? 1 : 0),
    lastActiveAt: now,
    completedAt:
      input.completed === true
        ? existing.completedAt ?? now
        : input.completed === false
          ? undefined
          : existing.completedAt,
  });
  return { ok: true, created: false };
}

export const touch = mutation({
  args: {
    key: v.string(),
    subject: v.string(),
    title: v.string(),
    seconds: v.optional(v.number()),
    observations: v.optional(v.number()),
    answers: v.optional(v.number()),
    notebookEntries: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    attempt: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await bumpProgress(ctx, userId, args);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("labProgress")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return rows
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((row) => ({
        id: row._id,
        key: row.experimentKey,
        subject: row.subject,
        title: row.title,
        status: row.status,
        timeSeconds: row.timeSeconds,
        observations: row.observations,
        answers: row.answers,
        notebookEntries: row.notebookEntries,
        attempts: row.attempts,
        startedAt: row.startedAt,
        lastActiveAt: row.lastActiveAt,
        completedAt: row.completedAt ?? null,
      }));
  },
});
