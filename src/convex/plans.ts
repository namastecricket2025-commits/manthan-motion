import { getAuthUserId } from "./identity";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PLAN_ALLOWANCES, allowanceWindow } from "../lib/plans";

/**
 * Plans on the server.
 *
 * The plan is stored on the user row so the *engine* — not just the browser —
 * knows what a subscription buys. `PLAN_ALLOWANCES` lives in one shared module
 * so the pricing page, the dashboard meter and this registry can never drift.
 *
 * The checkout flow is an explicit sandbox simulation (no payment provider),
 * so `setPlan` is a plain authenticated mutation: the client that legally
 * changes a plan is the checkout simulation, and every allowance number it can
 * write comes from the same single map.
 */

const PLAN_IDS = Object.keys(PLAN_ALLOWANCES) as (keyof typeof PLAN_ALLOWANCES)[];
const planValidator = v.union(...PLAN_IDS.map((id) => v.literal(id)));

/** The signed-in account's plan, allowance size and reset window. */
export const myPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const plan = (user?.plan ?? "free") as keyof typeof PLAN_ALLOWANCES;
    return {
      plan,
      limit: PLAN_ALLOWANCES[plan],
      window: allowanceWindow(plan),
    };
  },
});

/** Point the signed-in account at a plan (sandbox checkout / plan changes). */
export const setPlan = mutation({
  args: { plan: planValidator },
  handler: async (ctx, { plan }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to change your plan.");
    await ctx.db.patch(userId, { plan });
    return { plan, limit: PLAN_ALLOWANCES[plan], window: allowanceWindow(plan) };
  },
});
