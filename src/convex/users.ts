import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  currentIdentity,
  getAuthUserId,
  requireAuthUserId,
} from "./identity";

/**
 * The signed-in account, as the UI sees it.
 *
 * Identity comes from the verified Supabase access token. A `users` row is only
 * needed once the account actually stores something, so a brand-new student
 * still has a name and email to render — those come straight from the token
 * until the row is created on their first write.
 */
export type SessionUser = {
  _id: Id<"users">;
  name?: string;
  email?: string;
  image?: string;
  isAnonymous: boolean;
};

export const currentUser = query({
  args: {},
  handler: async (ctx): Promise<SessionUser | null> => {
    const user = await getCurrentUser(ctx);
    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle
 * the null user case.
 */
/**
 * The few facts that personalise the workspace: which class, which board and
 * which subjects. Separate from `currentUser` because the notebook and plan
 * surfaces do not need them, and because this query also says whether the
 * first-run questions have been answered.
 */
export type StudyProfile = {
  name: string;
  grade: string | null;
  board: string | null;
  subjects: string[];
  onboardedAt: number | null;
};

export const profile = query({
  args: {},
  handler: async (ctx): Promise<StudyProfile | null> => {
    const identity = await currentIdentity(ctx);
    if (!identity) return null;
    const userId = await getAuthUserId(ctx);
    const row = userId ? await ctx.db.get(userId) : null;
    return {
      name: row?.name ?? identity.name ?? "",
      grade: row?.grade ?? null,
      board: row?.board ?? null,
      subjects: row?.subjects ?? [],
      onboardedAt: row?.onboardedAt ?? null,
    };
  },
});

const ALLOWED_GRADES = ["8", "9", "10", "11", "12"] as const;
const ALLOWED_BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "State board"] as const;

/**
 * Save the first-run answers (and the same fields later from Settings).
 *
 * This is a write path, so it creates the `users` row if this is the account's
 * first write — which is exactly what happens for a brand-new sign-up.
 * `onboardedAt` is stamped even when every field is skipped, so the prompt does
 * not reappear on the next page load.
 */
export const completeOnboarding = mutation({
  args: {
    grade: v.optional(v.string()),
    board: v.optional(v.string()),
    subjects: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<StudyProfile> => {
    const userId = await requireAuthUserId(ctx);
    const grade = ALLOWED_GRADES.find((entry) => entry === args.grade);
    const board = ALLOWED_BOARDS.find((entry) => entry === args.board);
    const subjects = Array.from(
      new Set(
        (args.subjects ?? [])
          .map((subject) => subject.trim().slice(0, 40))
          .filter(Boolean),
      ),
    ).slice(0, 8);

    await ctx.db.patch(userId, {
      ...(grade ? { grade } : {}),
      ...(board ? { board } : {}),
      subjects,
      onboardedAt: Date.now(),
    });

    const row = await ctx.db.get(userId);
    return {
      name: row?.name ?? "",
      grade: row?.grade ?? null,
      board: row?.board ?? null,
      subjects: row?.subjects ?? [],
      onboardedAt: row?.onboardedAt ?? null,
    };
  },
});

export const getCurrentUser = async (
  ctx: QueryCtx,
): Promise<SessionUser | null> => {
  const identity = await currentIdentity(ctx);
  if (!identity) return null;

  const userId = await getAuthUserId(ctx);
  const row = userId ? await ctx.db.get(userId) : null;

  return {
    // Until the row exists this is only an opaque handle for React keys — the
    // Supabase subject is already the canonical identifier.
    _id: (row?._id ?? `supabase:${identity.subject}`) as Id<"users">,
    name: row?.name ?? identity.name,
    email: row?.email ?? identity.email,
    image: row?.image ?? identity.image,
    isAnonymous: false,
  };
};
