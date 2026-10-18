import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // The Supabase account this row belongs to (`sub` of the access token).
      // Auth is handled by Supabase, so this is what ties an identity to the
      // notebooks, sources, materials and usage it owns.
      authSubject: v.optional(v.string()),

      // The subscription plan the account is on ("free" when never set). The
      // usage engine reads this to size the generation allowance, so a plan
      // change moves the meter and the enforcement together.
      plan: v.optional(v.string()),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_auth_subject", ["authSubject"]),

    // A notebook is the user's own workspace: the thing they name, fill with
    // sources, and churn into study material. Everything on the dashboard is
    // scoped to one, so a brand-new account starts genuinely empty.
    notebooks: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    // A source is something the user actually added: a file they uploaded, a
    // link they pasted, or notes they typed. Nothing here is ever seeded — an
    // empty table means a new user sees an empty dashboard.
    //
    // `text` is the extracted plain text the generator reads; `status` records
    // whether extraction worked, so the UI can be honest about a file it could
    // not read instead of silently pretending it was understood.
    sources: defineTable({
      ownerId: v.id("users"),
      notebookId: v.id("notebooks"),
      kind: v.union(v.literal("file"), v.literal("link"), v.literal("text")),
      name: v.string(),
      detail: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      text: v.optional(v.string()),
      status: v.union(v.literal("ready"), v.literal("failed")),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_notebook", ["notebookId"]),

    // Generated study material: the output of churning a notebook's sources.
    // `payload` is the validated JSON for one kind, and `sourceIds` records
    // exactly which sources it was built from so a citation can point back.
    materials: defineTable({
      ownerId: v.id("users"),
      notebookId: v.id("notebooks"),
      kind: v.union(
        v.literal("summary"),
        v.literal("flashcards"),
        v.literal("quiz"),
        v.literal("mindmap"),
        v.literal("slides"),
      ),
      title: v.string(),
      payload: v.any(),
      sourceIds: v.array(v.id("sources")),
      model: v.string(),
      createdAt: v.number(),
    })
      .index("by_notebook", ["notebookId"])
      .index("by_owner", ["ownerId"]),

    // One Math Lab solution the student actually solved while signed in.
    //
    // The Maths Lab engine itself is unauthenticated (like the Canvas Solver),
    // so the row is written from the client after a solve succeeds. `problems`
    // holds the structured solution exactly as it was rendered, which is what
    // lets a past solution be reopened, copied as LaTeX or exported as a PDF
    // without asking a model to reproduce it again.
    mathSolutions: defineTable({
      ownerId: v.id("users"),
      /** What the student typed, or a label for a photographed question. */
      question: v.string(),
      headline: v.string(),
      track: v.string(),
      chapterName: v.string(),
      method: v.string(),
      /** The rendered solution: SolvedProblem[] as the notebook shows it. */
      problems: v.any(),
      model: v.string(),
      /** Set once the student files it into one of their notebooks. */
      savedNotebookId: v.optional(v.id("notebooks")),
      savedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_created", ["ownerId", "createdAt"]),

    // One row per step Check My Work marked wrong.
    //
    // Nothing here is inferred: a row exists only because the checker returned
    // a verdict for that step on that attempt. A mistake summary is then a
    // grouping of these real rows and nothing else.
    mathMistakes: defineTable({
      ownerId: v.id("users"),
      solutionId: v.optional(v.id("mathSolutions")),
      problem: v.string(),
      stepIndex: v.number(),
      stepTitle: v.string(),
      rule: v.string(),
      note: v.string(),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_created", ["ownerId", "createdAt"]),

    // One row per user per UTC day. `used`/`requests` are written by the
    // generation action; the dashboard reads the same row to draw the quota
    // meter, so what the student sees is what the engine counted.
    usage: defineTable({
      userId: v.id("users"),
      day: v.string(), // "2026-09-21" — UTC date bucket
      used: v.number(), // model tokens consumed (prompt + completion)
      requests: v.number(), // successful model calls
      updatedAt: v.number(),
    }).index("by_user_day", ["userId", "day"]),

    // User and early-tester feedback on generated material.
    //
    // Only rows that are approved AND consented to publish are readable by the
    // public (anon + authenticated). Signed-in users may insert their own rows
    // and read their own rows; the owner approval path runs through Convex via
    // the service role, which bypasses RLS.
    testimonials: defineTable({
      // Nullable: early testers (and the six seeded rows) do not have accounts.
      userId: v.optional(v.id("users")),
      rating: v.number(),
      text: v.string(),
      displayName: v.optional(v.string()),
      classLabel: v.optional(v.string()),
      consentToPublish: v.boolean(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      source: v.string(),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_userId_status", ["userId", "status"])
      .index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
