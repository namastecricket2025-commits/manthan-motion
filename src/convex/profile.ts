import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Profile maintenance for the local auth system.
 *
 * `completeGoogleProfile` fills a display name for accounts created via
 * "Continue with Google" (their name normally comes from Google itself; this
 * exists for users who somehow have none) and is intentionally the only
 * name-writing mutation — password sign-up captures the name in the sign-up
 * form, so it never asks again.
 */
export const completeGoogleProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.name && user.name.length > 0) return; // already set — never overwrite
    await ctx.db.patch(userId, { name: trimmed });
  },
});

/**
 * Guard for the auth screen: "Continue with Google" is only rendered when the
 * deployment actually has Google credentials configured.
 */
export const authMethods = query({
  args: {},
  handler: async () => {
    // The provider list is fixed at deploy time; the client learns about
    // Google the same way the server does — env vars being present.
    return {
      google: Boolean(
        process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
      ),
    };
  },
});
