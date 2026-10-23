import { internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Supabase → Convex identity bridge.
 *
 * Supabase Auth issues the access token; the Convex deployment verifies its
 * signature through the ES256 JWKS endpoint configured in `auth.config.ts`.
 * What Convex hands a function is therefore a raw identity (`subject` = the
 * Supabase user id), not a `users` row.
 *
 * `getAuthUserId` below replaces the old `@convex-dev/auth` helper, so
 * notebooks, sources, materials and usage stay scoped to one owner: it resolves
 * the `users` row belonging to the signed-in Supabase account, and the write
 * path (`requireAuthUserId`) creates that row the first time the account
 * actually stores something.
 */

type Ctx = QueryCtx | MutationCtx;

export type SupabaseIdentity = {
  /** Supabase user id (`sub`). */
  subject: string;
  email?: string;
  name?: string;
  image?: string;
};

function claim(identity: Record<string, unknown>, key: string) {
  const direct = identity[key];
  if (typeof direct === "string" && direct) return direct;
  // Convex flattens nested claims to dotted keys (e.g. `user_metadata.name`).
  const dotted = identity[`user_metadata.${key}`];
  return typeof dotted === "string" && dotted ? dotted : undefined;
}

/** Read the signed-in identity out of the verified Supabase access token. */
export async function currentIdentity(
  ctx: Ctx,
): Promise<SupabaseIdentity | null> {
  const identity = (await ctx.auth.getUserIdentity()) as
    | (Record<string, unknown> & { subject?: string })
    | null;
  if (!identity?.subject) return null;
  return {
    subject: identity.subject,
    email: claim(identity, "email"),
    name: claim(identity, "name") ?? claim(identity, "full_name"),
    image: claim(identity, "avatar_url") ?? claim(identity, "picture"),
  };
}

async function lookup(ctx: Ctx, subject: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
    .unique();
}

/**
 * The `users` row id for the signed-in Supabase account, or `null`.
 *
 * Read-only: a query cannot create the row, so an account that has never
 * written anything simply has no rows yet and every list renders empty.
 */
export async function getAuthUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  const identity = await currentIdentity(ctx);
  if (!identity) return null;
  const row = await lookup(ctx, identity.subject);
  return row?._id ?? null;
}

/**
 * The same lookup for actions, which cannot read the database directly.
 * Returns null for a signed-in account that has never written anything.
 */
export const currentUserId = internalQuery({
  args: {},
  handler: async (ctx) => await getAuthUserId(ctx),
});

/**
 * Write-path variant: the row is created on first use and its cached name and
 * email are kept in step with the provider (a Google rename, a settings edit).
 */
export async function requireAuthUserId(
  ctx: MutationCtx,
): Promise<Id<"users">> {
  const identity = await currentIdentity(ctx);
  if (!identity) throw new Error("You need to be signed in.");

  const existing = await lookup(ctx, identity.subject);
  // Once the row exists it owns the profile: a rename in settings must survive
  // the next write instead of being overwritten by the token's older claim.
  if (existing) return existing._id;

  return await ctx.db.insert("users", {
    authSubject: identity.subject,
    email: identity.email,
    name: identity.name,
    image: identity.image,
  });
}
