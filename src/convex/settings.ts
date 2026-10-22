import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentIdentity, getAuthUserId, requireAuthUserId } from "./identity";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Supabase puts the sign-in provider and this session's claims on the token. */
function identityMeta(identity: Record<string, unknown> | null) {
  if (!identity) return { providers: [] as string[], sessionId: null as string | null, issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000 };

  const single = identity["app_metadata.provider"];
  const list = identity["app_metadata.providers"];
  const providers = Array.isArray(list)
    ? list.filter((p): p is string => typeof p === "string")
    : typeof single === "string"
      ? [single]
      : [];

  const issuedAt = typeof identity.iat === "number" ? identity.iat * 1000 : Date.now();
  const expiresAt =
    typeof identity.exp === "number" ? identity.exp * 1000 : issuedAt + 3_600_000;

  return {
    providers,
    sessionId: typeof identity.session_id === "string" ? identity.session_id : null,
    issuedAt,
    expiresAt,
  };
}

/* ------------------------------------------------------------------ */
/* Profile + active sessions (drives the account section of settings)  */
/* ------------------------------------------------------------------ */

/** The signed-in user's profile plus the session making the request. */
export const myAccount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await currentIdentity(ctx);
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    const row = userId ? await ctx.db.get(userId) : null;
    const raw = (await ctx.auth.getUserIdentity()) as Record<string, unknown> | null;
    const meta = identityMeta(raw);

    return {
      name: row?.name ?? identity.name ?? "",
      email: row?.email ?? identity.email ?? "",
      providers: meta.providers.length > 0 ? meta.providers : ["email"],
      // Supabase does not expose a per-user session list to browsers, so the
      // only session we can honestly report is the one reading this page.
      sessions: [
        {
          id: meta.sessionId ?? "current",
          createdAt: meta.issuedAt,
          expiresAt: meta.expiresAt,
          current: true,
        },
      ],
    };
  },
});

/** Update the display name (and the contact email kept alongside it). */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const patch: { name?: string; email?: string } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2) throw new Error("Display name must be at least 2 characters.");
      if (name.length > 60) throw new Error("Display name must be 60 characters or fewer.");
      patch.name = name;
    }

    if (args.email !== undefined) {
      const email = args.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
      patch.email = email;
    }

    if (Object.keys(patch).length === 0) return { ok: true as const, changed: false };
    await ctx.db.patch(userId, patch);
    return { ok: true as const, changed: true };
  },
});

/* ------------------------------------------------------------------ */
/* Account deletion — permanent                                        */
/* ------------------------------------------------------------------ */

/**
 * Erase everything Manthan stores for this account: notebooks, sources (and
 * their uploaded files), generated material, usage history and the profile row.
 *
 * The credentials themselves live in Supabase Auth, so the browser signs the
 * account out right after this runs; the sign-in record is reclaimed from the
 * Supabase dashboard.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You need to be signed in.");

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const source of sources) {
      if (source.storageId) await ctx.storage.delete(source.storageId);
      await ctx.db.delete(source._id);
    }

    const materials = await ctx.db
      .query("materials")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const material of materials) {
      const translations = await ctx.db
        .query("materialTranslations")
        .withIndex("by_material", (q) => q.eq("materialId", material._id))
        .collect();
      for (const translation of translations) {
        await ctx.db.delete(translation._id);
      }
      await ctx.db.delete(material._id);
    }

    const shares = await ctx.db
      .query("sharedMaterials")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const share of shares) await ctx.db.delete(share._id);

    const studyMistakes = await ctx.db
      .query("studyMistakes")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of studyMistakes) await ctx.db.delete(row._id);

    const progress = await ctx.db
      .query("syllabusProgress")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of progress) await ctx.db.delete(row._id);

    const reviewCards = await ctx.db
      .query("reviewCards")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of reviewCards) await ctx.db.delete(row._id);

    const exams = await ctx.db
      .query("mockExams")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of exams) await ctx.db.delete(row._id);

    const notebooks = await ctx.db
      .query("notebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const notebook of notebooks) await ctx.db.delete(notebook._id);

    // The Math Lab keeps its own rows, and the export/download copy shown in
    // Settings promises that deletion is complete. Leaving these behind meant
    // "permanently erased" was not true for a student's solved questions or
    // their mistake history.
    const solutions = await ctx.db
      .query("mathSolutions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of solutions) await ctx.db.delete(row._id);

    const mistakes = await ctx.db
      .query("mathMistakes")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of mistakes) await ctx.db.delete(row._id);

    const feedback = await ctx.db
      .query("testimonials")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId))
      .collect();
    for (const row of feedback) await ctx.db.delete(row._id);

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    for (const row of usage) await ctx.db.delete(row._id);

    await ctx.db.delete(userId);
    return { ok: true as const };
  },
});
