import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * The practical notebook.
 *
 * A record is one experiment: a title, a subject, and a table of observations.
 * Benches append a row when the student presses "Record", and the same table
 * can be edited by hand in the notebook. Nothing is generated — every number
 * here was measured on a bench or typed by the student.
 *
 * Records are capped so a runaway recording loop cannot fill the table, and
 * every value is checked for finiteness: a NaN in a graph is a blank screen,
 * which is worse than a refused write.
 */

const MAX_OBSERVATIONS = 80;
const MAX_FIELDS = 8;

function cleanTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 90);
}

function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("labRecords")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        id: row._id,
        subject: row.subject,
        title: row.title,
        observations: row.observations,
        measured: row.measured ?? null,
        accepted: row.accepted ?? null,
        resultUnit: row.resultUnit ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },
});

/**
 * Append one observed row, creating the experiment the first time.
 *
 * A bench passes a stable title ("Vernier calipers"), so every measurement
 * from that bench lands in one table instead of a new record per press.
 */
export const addObservation = mutation({
  args: {
    subject: v.string(),
    title: v.string(),
    values: v.array(
      v.object({
        label: v.string(),
        value: v.number(),
        unit: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { subject, title, values }) => {
    const userId = await requireAuthUserId(ctx);
    const label = cleanTitle(title);
    if (!label) throw new Error("Give the experiment a name first.");

    const cleaned = values
      .filter((entry) => Number.isFinite(entry.value))
      .slice(0, MAX_FIELDS)
      .map((entry) => ({
        label: cleanLabel(entry.label) || "Reading",
        value: entry.value,
        unit: entry.unit ? entry.unit.trim().slice(0, 12) : undefined,
      }));
    if (!cleaned.length) throw new Error("There is no reading to record yet.");

    const now = Date.now();
    const existing = await ctx.db
      .query("labRecords")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const record = existing.find(
      (row) => row.title.toLowerCase() === label.toLowerCase() && row.subject === subject,
    );

    if (!record) {
      const id = await ctx.db.insert("labRecords", {
        ownerId: userId,
        subject: subject.slice(0, 24),
        title: label,
        observations: [{ values: cleaned, at: now }],
        createdAt: now,
        updatedAt: now,
      });
      return { id, created: true, count: 1 };
    }

    // The newest observation is kept even at the cap; the oldest is dropped so
    // the table keeps moving instead of silently refusing new readings.
    const observations = [...record.observations, { values: cleaned, at: now }].slice(
      -MAX_OBSERVATIONS,
    );
    await ctx.db.patch(record._id, { observations, updatedAt: now });
    return { id: record._id, created: false, count: observations.length };
  },
});

export const removeObservation = mutation({
  args: { recordId: v.id("labRecords"), index: v.number() },
  handler: async (ctx, { recordId, index }) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(recordId);
    if (!record || record.ownerId !== userId) throw new Error("Record not found.");
    if (!Number.isInteger(index) || index < 0 || index >= record.observations.length) {
      return { removed: false };
    }
    const observations = record.observations.filter((_, at) => at !== index);
    await ctx.db.patch(recordId, { observations, updatedAt: Date.now() });
    return { removed: true };
  },
});

export const removeRecord = mutation({
  args: { recordId: v.id("labRecords") },
  handler: async (ctx, { recordId }) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(recordId);
    if (!record || record.ownerId !== userId) throw new Error("Record not found.");
    await ctx.db.delete(recordId);
    return { removed: true };
  },
});

/** The student's calculated result, the book value, and the unit. */
export const setResult = mutation({
  args: {
    recordId: v.id("labRecords"),
    measured: v.optional(v.number()),
    accepted: v.optional(v.number()),
    resultUnit: v.optional(v.string()),
  },
  handler: async (ctx, { recordId, measured, accepted, resultUnit }) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(recordId);
    if (!record || record.ownerId !== userId) throw new Error("Record not found.");

    const sanitize = (value: number | undefined) =>
      typeof value === "number" && Number.isFinite(value) ? value : undefined;

    await ctx.db.patch(recordId, {
      measured: sanitize(measured),
      accepted: sanitize(accepted),
      resultUnit: resultUnit ? resultUnit.trim().slice(0, 12) : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Rename an experiment, keeping its table. */
export const rename = mutation({
  args: { recordId: v.id("labRecords"), title: v.string() },
  handler: async (ctx, { recordId, title }) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(recordId);
    if (!record || record.ownerId !== userId) throw new Error("Record not found.");
    const next = cleanTitle(title);
    if (!next) throw new Error("The title cannot be empty.");
    await ctx.db.patch(recordId, { title: next, updatedAt: Date.now() });
    return { ok: true };
  },
});
