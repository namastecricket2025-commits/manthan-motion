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

      // Onboarding answers. They are optional because an account created
      // before onboarding existed (or one that skipped it) is still valid;
      // `onboardedAt` is the flag the first-run gate reads.
      grade: v.optional(v.string()),
      board: v.optional(v.string()),
      subjects: v.optional(v.array(v.string())),
      onboardedAt: v.optional(v.number()),
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

    // A wrong answer worth revisiting. Quiz rows keep their option list so the
    // question can be reattempted exactly; practice rows keep the answer and
    // create a route back into a fresh set. Maths Check-My-Work rows stay in
    // `mathMistakes` and are surfaced alongside these in the Mistake Bank.
    studyMistakes: defineTable({
      ownerId: v.id("users"),
      source: v.union(v.literal("quiz"), v.literal("practice")),
      prompt: v.string(),
      options: v.optional(v.array(v.string())),
      answerIndex: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
      givenAnswer: v.optional(v.string()),
      explanation: v.optional(v.string()),
      materialId: v.optional(v.id("materials")),
      chapter: v.optional(v.string()),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_created", ["ownerId", "createdAt"]),

    // One cached translation of a generated material. Translation is a model
    // call, so it is stored once per (material, language) and reused; the
    // original payload is never overwritten, so switching back is free.
    materialTranslations: defineTable({
      materialId: v.id("materials"),
      lang: v.string(),
      payload: v.any(),
      model: v.string(),
      createdAt: v.number(),
    })
      .index("by_material_lang", ["materialId", "lang"])
      .index("by_material", ["materialId"]),

    // A read-only public link to one generated material. The token is the
    // capability: anyone holding it can read the sheet, and revoking it makes
    // every existing copy of the link stop working. Only the owner can create
    // or revoke one, and the material is re-checked on each read.
    sharedMaterials: defineTable({
      token: v.string(),
      ownerId: v.id("users"),
      materialId: v.id("materials"),
      notebookName: v.string(),
      createdAt: v.number(),
      revokedAt: v.optional(v.number()),
    })
      .index("by_token", ["token"])
      .index("by_material", ["materialId"])
      .index("by_owner", ["ownerId"]),

    // One card in the daily spaced-repetition queue. Cards are materialised
    // from real study material and Math Lab mistakes, never invented; `key` is
    // stable across regeneration so a rebuilding pass updates the schedule
    // instead of duplicating the card.
    reviewCards: defineTable({
      ownerId: v.id("users"),
      key: v.string(),
      notebookId: v.optional(v.id("notebooks")),
      materialId: v.optional(v.id("materials")),
      mistakeId: v.optional(v.id("studyMistakes")),
      kind: v.union(
        v.literal("flashcard"),
        v.literal("quiz"),
        v.literal("practice"),
      ),
      prompt: v.string(),
      answer: v.string(),
      options: v.optional(v.array(v.string())),
      answerIndex: v.optional(v.number()),
      explanation: v.optional(v.string()),
      source: v.optional(v.string()),
      dueAt: v.number(),
      intervalDays: v.number(),
      ease: v.number(),
      reps: v.number(),
      lapses: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_due", ["ownerId", "dueAt"])
      .index("by_owner_key", ["ownerId", "key"]),

    // One generated mock paper. Questions and answers stay server-side: while
    // an attempt is in progress the public query strips answer keys so the
    // browser cannot read the marking scheme before submitting.
    mockExams: defineTable({
      ownerId: v.id("users"),
      // A paper comes either from a notebook the student built or from the
      // school syllabus; the second kind has no notebook at all.
      notebookId: v.optional(v.id("notebooks")),
      syllabus: v.optional(
        v.object({
          className: v.string(),
          subject: v.string(),
          chapters: v.array(v.string()),
          paperKind: v.string(),
        }),
      ),
      title: v.string(),
      instructions: v.optional(v.string()),
      pattern: v.union(v.literal("objective"), v.literal("board")),
      durationMinutes: v.number(),
      totalMarks: v.number(),
      questions: v.any(),
      status: v.union(
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("submitted"),
        v.literal("graded"),
      ),
      startedAt: v.optional(v.number()),
      endsAt: v.optional(v.number()),
      submittedAt: v.optional(v.number()),
      responses: v.optional(v.any()),
      objectiveScore: v.optional(v.number()),
      score: v.optional(v.number()),
      report: v.optional(v.any()),
      model: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_notebook", ["notebookId"]),

    // One row per chapter a student has marked as revised. Progress is stored
    // on the account (not in localStorage) so it follows the student to a new
    // device, and `chapterName` is kept beside the index because curriculum
    // indexes can move between editions.
    syllabusProgress: defineTable({
      ownerId: v.id("users"),
      track: v.string(),
      grade: v.string(),
      chapterIndex: v.number(),
      chapterName: v.string(),
      doneAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_grade", ["ownerId", "track", "grade"]),

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
    // Public reads go through `testimonials.approved`, which returns only rows
    // that are approved AND consented to publish. Signed-in users submit their
    // own rows as `pending`; the owner approves them through the mutations in
    // `testimonials.ts`.
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
      // "user" for in-app submissions, "early_tester" for the seeded six.
      source: v.string(),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_userId_status", ["userId", "status"])
      .index("by_created", ["createdAt"]),

    // The landing page's live search demo.
    //
    // A signed-out visitor cannot use `webSearch.search`: it meters against a
    // plan and needs an account, and inventing an account to search would be a
    // lie. So the home page's preview reads and writes here instead. One row
    // per distinct question, kept for good — a question that has already been
    // asked once costs nothing to answer for the next visitor, which is what
    // lets the demo stay live at forty lookups a day. `query` is normalised
    // (trimmed, single-spaced, lowercased) before it is used as a key.
    searchDemo: defineTable({
      query: v.string(),
      provider: v.optional(v.string()),
      answer: v.optional(
        v.object({
          text: v.string(),
          title: v.optional(v.string()),
          url: v.optional(v.string()),
        }),
      ),
      results: v.array(
        v.object({ title: v.string(), url: v.string(), snippet: v.string() }),
      ),
      updatedAt: v.number(),
    }).index("by_query", ["query"]),

    // One row per UTC day, same bucket convention as `usage`. This is the
    // ceiling on what anonymous traffic can spend: the demo claims a slot
    // before it calls Google or a model, and when the day's slots are gone the
    // panel says so and offers the sign-in instead of failing.
    searchDemoDay: defineTable({
      day: v.string(), // "2026-10-27"
      spent: v.number(), // searches + follow-ups run that day
      updatedAt: v.number(),
    }).index("by_day", ["day"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
