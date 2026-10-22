import { getAuthUserId, requireAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Syllabus progress.
 *
 * One row per chapter a student has marked as revised, scoped to their account.
 * The curriculum index is the identity of a chapter inside a grade, and the
 * chapter name is kept alongside it so an old progress row can still be shown
 * honestly if the curriculum is reordered in a later edition.
 */

export const list = query({
  args: { track: v.string(), grade: v.string() },
  handler: async (ctx, { track, grade }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("syllabusProgress")
      .withIndex("by_owner_grade", (q) =>
        q.eq("ownerId", userId).eq("track", track.slice(0, 24)).eq("grade", grade.slice(0, 8)),
      )
      .collect();

    return rows
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .map((row) => ({
        chapterIndex: row.chapterIndex,
        chapterName: row.chapterName,
        doneAt: row.doneAt,
      }));
  },
});

/** Mark one chapter revised, or clear the mark. Idempotent. */
export const setChapter = mutation({
  args: {
    track: v.string(),
    grade: v.string(),
    chapterIndex: v.number(),
    chapterName: v.string(),
    done: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const track = args.track.slice(0, 24);
    const grade = args.grade.slice(0, 8);
    const chapterIndex = Math.max(0, Math.floor(args.chapterIndex));

    const existing = await ctx.db
      .query("syllabusProgress")
      .withIndex("by_owner_grade", (q) =>
        q.eq("ownerId", userId).eq("track", track).eq("grade", grade),
      )
      .collect()
      .then((rows) => rows.find((row) => row.chapterIndex === chapterIndex));

    if (!args.done) {
      if (existing) await ctx.db.delete(existing._id);
      return { done: false };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        chapterName: args.chapterName.slice(0, 160),
        doneAt: Date.now(),
      });
    } else {
      await ctx.db.insert("syllabusProgress", {
        ownerId: userId,
        track,
        grade,
        chapterIndex,
        chapterName: args.chapterName.slice(0, 160),
        doneAt: Date.now(),
      });
    }

    return { done: true };
  },
});
