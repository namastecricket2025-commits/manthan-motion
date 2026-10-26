import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { TestimonialStrip } from "@/components/landing/Testimonials";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { CheckoutModal } from "@/components/plans/CheckoutModal";
import { usePlan } from "@/components/plans/PlanProvider";
import {
  DEFAULT_DURATION,
  DURATIONS,
  FREE_PLAN,
  PLAN_MATRIX,
  PLAN_TIERS,
  durationTotal,
  formatINR,
  getDuration,
  planName,
  type DurationId,
  type PlanId,
  type PlanTier,
} from "@/lib/plans";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Minus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

/**
 * Plans and pricing.
 *
 * Four columns, priced the way the workspaces actually differ: Free keeps the
 * notebook studio whole, the Sprint Pass buys a week of it with Cram Mode,
 * EduVantage opens the lab graphs and the photo solver, and Prime opens the
 * rest. One billing switch sits above the cards and moves every plan that has
 * a term at once, because three separate switches on three cards made the
 * reader compare four prices in three different units.
 *
 * Below the cards: one comparison table, read from `PLAN_MATRIX` in
 * `src/lib/plans.ts` — the same module that names the capability each lock
 * checks, so the table cannot promise a workspace the app will refuse. Above
 * the footnote: the questions a student asks before paying, answered with the
 * numbers on this page.
 *
 * Checkout is still an explicit sandbox simulation. Nothing here contacts a
 * payment network.
 */

/** The billing switch above the cards — one control for every term plan. */
function BillingSwitch({
  duration,
  onSelect,
}: {
  duration: DurationId;
  onSelect: (next: DurationId) => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2.5">
      <div
        className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--panel)_70%,transparent)] p-1"
        role="group"
        aria-label="Billing term"
      >
        {DURATIONS.map((option) => {
          const active = option.id === duration;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.id)}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-[color-mix(in_srgb,var(--text-main)_12%,transparent)] text-foreground"
                  : "text-text-dim hover:text-foreground",
              )}
            >
              {option.months === 1 ? "Monthly" : `${option.months} months`}
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-text-dim">
        6 months saves 10% · 12 months saves 20% — applied to the total, not
        hidden in it.
      </p>
    </div>
  );
}

/** A plan card. Free and the paid tiers share every rule by construction. */
function PlanCard({
  name,
  summary,
  price,
  priceSuffix,
  billingLine,
  hook,
  features,
  includedLabel,
  featured,
  current,
  onChoose,
  ctaLabel,
}: {
  name: string;
  summary: string;
  price: number;
  priceSuffix: string;
  billingLine: string;
  hook?: string;
  features: string[];
  includedLabel: string;
  featured?: boolean;
  current: boolean;
  onChoose?: () => void;
  ctaLabel: string;
}) {
  return (
    <section
      data-reveal
      className={cn(
        "premium-card relative overflow-hidden",
        featured && "premium-card--featured",
      )}
    >
      {featured ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--signal)] to-transparent opacity-80"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            {name}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-dim">
            {summary}
          </p>
        </div>
        {featured ? (
          <span className="premium-chip premium-chip--featured shrink-0">
            Most popular
          </span>
        ) : current ? (
          <span className="premium-chip shrink-0">Current</span>
        ) : null}
      </div>

      {/* The number glides when the term changes — one animated figure per
          card, never a second price in the small print. */}
      <div className="mt-6 flex items-end gap-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${name}-${price}`}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
            className="block font-display text-[38px] font-semibold leading-none tabular-nums tracking-[-0.02em]"
          >
            {formatINR(price)}
          </motion.span>
        </AnimatePresence>
        <span className="pb-1 text-[11.5px] text-text-dim">{priceSuffix}</span>
      </div>

      <p className="mt-2.5 min-h-[18px] text-[11.5px] leading-relaxed text-text-dim">
        {billingLine}
      </p>
      {hook ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-text-dim">{hook}</p>
      ) : null}

      <div className="mt-6">
        {current ? (
          <button
            type="button"
            disabled
            className="w-full cursor-default rounded-full border border-[var(--panel-line)] px-5 py-2.5 text-[13px] font-medium text-text-dim"
          >
            Your current plan
          </button>
        ) : featured ? (
          <MovingBorderButton
            onClick={onChoose}
            className="w-full"
            innerClassName="w-full px-5 py-2.5 text-[13px]"
          >
            {ctaLabel}
          </MovingBorderButton>
        ) : (
          <button
            type="button"
            onClick={onChoose}
            className="w-full rounded-full border border-[var(--panel-line)] px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-[var(--panel-line-strong)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)]"
          >
            {ctaLabel}
          </button>
        )}
      </div>

      <div className="premium-divider my-6" />

      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-dim">
        {includedLabel}
      </p>
      <ul className="flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[13px]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
            <span className="leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One comparison cell: a tick, a dash, or the plan's own words. */
function CellValue({ value }: { value: string }) {
  if (value === "—") {
    return (
      <>
        <Minus className="mx-auto h-3.5 w-3.5 text-text-dim opacity-60" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  if (value === "Included") {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-[var(--signal)]" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  return <span className="text-[12px] leading-snug">{value}</span>;
}

const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "Is anything actually charged?",
    a: "No. Checkout is a sandbox simulation: it writes the plan onto your account so you can use the workspaces and see the allowance change, and it never contacts a payment network. No card is stored anywhere.",
  },
  {
    q: "What happens when my allowance runs out?",
    a: "Generation pauses until the window resets — midnight UTC on Free, the first of the month on a paid plan. Nothing you already made disappears: notebooks, sources and generated material stay readable and exportable at zero tokens.",
  },
  {
    q: "Do paid plans unlock chapters?",
    a: "Never. Every chapter, every board paper and every formula in Classes 8 to 12 is readable on Free. A plan changes how much you can generate and which workspaces open; it never gates the syllabus.",
  },
  {
    q: "What counts as a study kit?",
    a: "One run of the pipeline over your sources: a summary, flashcards, a quiz, a mind map and slides, all generated together. Five kits a day on Free is five of those, not five cards.",
  },
  {
    q: "Can I change plan in the middle of a term?",
    a: "Yes, in either direction, from this page. The change applies immediately — the allowance and the workspaces move together — and going back to Free never deletes material you made while subscribed.",
  },
];

function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-14 max-w-3xl">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        Questions before you choose
      </h2>
      <div className="glass-panel mt-5 overflow-hidden">
        {PRICING_FAQ.map((item, index) => {
          const isOpen = open === index;
          return (
            <div
              key={item.q}
              className={cn(index > 0 && "border-t border-[var(--panel-line)]")}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)]"
                >
                  <span className="text-[14px] font-medium leading-6">
                    {item.q}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-text-dim transition-transform duration-200 motion-reduce:transition-none",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              </h3>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-[13px] leading-relaxed text-text-dim">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COLUMNS: Array<{ id: PlanId; name: string; price: string }> = [
  { id: "free", name: "Free", price: "₹0" },
  { id: "sprint", name: "Sprint Pass", price: "₹49 / 7 days" },
  { id: "eduvantage", name: "EduVantage", price: "from ₹199 / mo" },
  { id: "prime", name: "Prime", price: "from ₹349 / mo" },
];

export default function Pricing() {
  const { plan, setPlan } = usePlan();
  const { isAuthenticated } = useAuth();
  const [duration, setDuration] = useState<DurationId>(DEFAULT_DURATION);
  const [checkout, setCheckout] = useState<PlanTier | null>(null);

  const term = getDuration(duration);
  const checkoutDuration = getDuration(duration);

  const tierDisplay = (tier: PlanTier) => {
    if (!tier.flexible) {
      return {
        price: tier.price,
        suffix: "/ 7 days",
        billing: `One 7-day pass · ${tier.allowance}`,
        hook:
          "About ₹7 a day for one revision week — the price of a bus fare.",
      };
    }
    const total = durationTotal(tier, term);
    const perMonth = Math.round(total / term.months);
    return {
      price: perMonth,
      suffix: "/ month",
      billing:
        term.months === 1
          ? `Billed monthly · cancel any time`
          : `${formatINR(total)} billed every ${term.months} months`,
      hook:
        perMonth <= 199
          ? `About ₹${Math.max(1, Math.round(perMonth / 30))} a day — less than one photocopied test.`
          : `About ₹${Math.max(1, Math.round(perMonth / 30))} a day for every workspace, unlocked.`,
    };
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        {/* Page-top wash — the same faint neutral light as the landing page. */}
        <div className="glow-aura" aria-hidden="true" />
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">
              Plans
            </p>
            <h1 className="text-fade mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl md:text-[56px] md:leading-[1.05]">
              Pricing for every study plan
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim">
              Every account starts free and stays useful — 60,000 tokens a day,
              three notebooks, six sources in each. The tiers raise the ceiling
              and open the advanced workspaces. Checkout is a sandbox: nothing is
              charged.
            </p>
            <BillingSwitch duration={duration} onSelect={setDuration} />
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <PlanCard
              name={FREE_PLAN.name}
              summary={FREE_PLAN.summary}
              price={0}
              priceSuffix="/ forever"
              billingLine="No card, no trial clock."
              features={FREE_PLAN.features}
              includedLabel="What you get"
              current={plan === "free"}
              ctaLabel="Switch to Free"
              onChoose={() => setPlan("free")}
            />

            {PLAN_TIERS.map((tier) => {
              const display = tierDisplay(tier);
              return (
                <PlanCard
                  key={tier.id}
                  name={tier.name}
                  summary={tier.summary}
                  price={display.price}
                  priceSuffix={display.suffix}
                  billingLine={display.billing}
                  hook={display.hook}
                  features={tier.features}
                  includedLabel="Everything in Free, plus"
                  featured={tier.featured}
                  current={plan === tier.id}
                  ctaLabel={`Choose ${tier.name}`}
                  onChoose={() => setCheckout(tier)}
                />
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-text-dim">
            This account is on {planName(plan)}. Switching is instant and
            reversible from this page.
          </p>

          {/* One table, grouped by workspace: what a student compares is
              "which rooms open", not twelve adjectives. */}
          <section data-reveal className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                  Compare every plan
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
                  Same engine on all four. What changes is how much it will
                  make, how many notebooks it keeps, and which workspaces open.
                </p>
              </div>
              <p className="text-[11px] text-text-dim sm:hidden">
                Swipe the table →
              </p>
            </div>

            <div className="glass-panel mt-5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--panel-line)]">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 bg-[var(--panel)] px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-dim sm:px-5"
                      >
                        Feature
                      </th>
                      {COLUMNS.map((column) => (
                        <th
                          key={column.id}
                          scope="col"
                          className="px-3 py-3 text-center align-bottom"
                        >
                          <span className="block font-display text-[13px] font-semibold">
                            {column.name}
                          </span>
                          <span className="mt-0.5 block text-[10.5px] font-normal text-text-dim">
                            {column.price}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_MATRIX.map((group) => (
                      <Fragment key={group.title}>
                        <tr className="bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)]">
                          <th
                            scope="colgroup"
                            colSpan={COLUMNS.length + 1}
                            className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:px-5"
                          >
                            {group.title}
                          </th>
                        </tr>
                        {group.rows.map((row) => (
                          <tr
                            key={row.label}
                            className="border-t border-[var(--panel-line)]"
                          >
                            <th
                              scope="row"
                              className="sticky left-0 z-10 bg-[var(--panel)] px-4 py-3 text-[12.5px] font-normal leading-snug sm:px-5"
                            >
                              {row.label}
                              {row.detail ? (
                                <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-text-dim">
                                  {row.detail}
                                </span>
                              ) : null}
                            </th>
                            {COLUMNS.map((column) => (
                              <td
                                key={column.id}
                                className={cn(
                                  "px-3 py-3 text-center align-middle",
                                  column.id === "eduvantage" &&
                                    "bg-[color-mix(in_srgb,var(--signal)_4%,transparent)]",
                                )}
                              >
                                <CellValue value={row.values[column.id]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-text-dim">
              Counts are per account and reset with your allowance window. A
              study kit is one run of the pipeline; a mock exam is one paper
              generated from your own chapters.
            </p>
          </section>

          <PricingFaq />

          {/* One closing action, aimed at the reader who is still deciding. */}
          <section
            data-reveal
            className="glass-panel mt-14 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-display text-[15px] font-semibold tracking-tight">
                Start on Free. Upgrade when a workspace gets in the way.
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-dim">
                No card, no countdown, no chapter locked behind a plan. The
                first five kits of the day are yours either way.
              </p>
            </div>
            <Link
              to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}
              className="shrink-0 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              {isAuthenticated ? "Open dashboard" : "Start free"}
            </Link>
          </section>

          <TestimonialStrip />

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-text-dim">
            Daily allowances count the tokens the AI reads from your sources and
            writes back as study material. They reset at midnight UTC; paid tiers
            reset on the first of the month. Plans raise the cap and unlock the
            advanced workspaces; they never change your notebooks or the material
            already inside them.
          </p>
        </main>
        <Footer />
      </div>

      <CheckoutModal
        tier={checkout}
        duration={checkoutDuration}
        onClose={() => setCheckout(null)}
      />
    </div>
  );
}
