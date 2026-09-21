import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { Gauge } from "lucide-react";

/**
 * The daily-allowance card in the notebook workspace.
 *
 * Reads the same usage ledger the generation engine writes, so the meter the
 * student sees is the meter the engine enforces: tokens used today, the day's
 * cap, requests made, and the UTC reset time. When the day is spent the card
 * says so plainly and points at the plans page instead of a raw error.
 */
export function UsageCard() {
  const usage = useQuery(api.usage.myUsage);

  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const remaining = Math.max(0, usage.limit - usage.used);
  const out = usage.used >= usage.limit;
  const resetsAt = new Date(usage.resetsAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-[var(--card-border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--signal)]" />
          <h3 className="text-sm font-semibold">Today's allowance</h3>
        </div>
        <span className="text-[11px] font-medium text-text-dim">
          resets {resetsAt}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--card-border)_45%,transparent)]">
        <div
          className={
            "h-full rounded-full transition-[width] duration-500 " +
            (out
              ? "bg-[var(--signal-2)]"
              : "bg-[var(--signal)]")
          }
          style={{ width: `${Math.max(pct, usage.used > 0 ? 4 : 0)}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-text-dim">
            Used today
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {usage.used.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-text-dim">
            Left
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {remaining.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-text-dim">
            Daily cap
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {usage.limit.toLocaleString()}
          </dd>
        </div>
      </dl>

      {/* Truth in metering: only a genuinely spent day may say "used up".
          A per-minute provider limit is NOT a spent day — the meter stays
          showing allowance remaining, so the card and the ledger agree. */}
      {out ? (
        <p className="mt-3 text-xs leading-relaxed text-text-dim">
          You have used today's full allowance. It resets at {resetsAt} — or
          look at the plans for a higher cap.
        </p>
      ) : (
        <p className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-dim">
          <span>
            {remaining.toLocaleString()} tokens left · {usage.requests}
            {" "}
            generation{usage.requests === 1 ? "" : "s"} today. Tokens are what
            the AI reads and writes.
          </span>
          <Link
            to="/pricing"
            className="font-medium text-[var(--signal)] hover:underline"
          >
            Plans
          </Link>
        </p>
      )}
    </div>
  );
}
