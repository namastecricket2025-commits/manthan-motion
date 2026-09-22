import { query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentIdentity, getAuthUserId } from "./identity";

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
