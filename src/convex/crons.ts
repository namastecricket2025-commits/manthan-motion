import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Deployment migration for the public review carousel.
 *
 * Convex deployments are separate databases, so a seed that is only ever run
 * against the dev deployment leaves the production database empty and the live
 * landing page shows "Reviews appear here once a tester has approved theirs".
 * This job runs the same idempotent seed on every deployment the functions are
 * pushed to, including production, so a deploy cannot ship an empty carousel.
 *
 * It is a no-op when the canonical eleven rows already match: the mutation
 * reads them, compares every field, and writes nothing.
 */
const crons = cronJobs();

crons.interval(
  "ensure early-tester quotes",
  { minutes: 10 },
  internal.testimonials.seedEarlyTesters,
  {},
);

export default crons;
