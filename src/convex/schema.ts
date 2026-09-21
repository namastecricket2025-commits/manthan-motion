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
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // A notebook is the user's own workspace: the thing they name, fill with
    // sources, and churn into study material. Everything on the dashboard is
    // scoped to one, so a brand-new account starts genuinely empty.
    notebooks: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    // A source is something the user actually added: a file they picked or a
    // link they pasted. Nothing here is ever seeded — an empty table means a
    // new user sees an empty dashboard.
    sources: defineTable({
      ownerId: v.id("users"),
      notebookId: v.id("notebooks"),
      kind: v.union(v.literal("file"), v.literal("link")),
      name: v.string(),
      detail: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_notebook", ["notebookId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
