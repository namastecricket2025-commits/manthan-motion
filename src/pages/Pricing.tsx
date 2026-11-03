import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { TestimonialStrip } from "@/components/landing/Testimonials";
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
  type ComparisonPlanId,
  type DurationId,
  type PlanTier,
} from "@/lib/plans";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, ChevronDown, Minus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

/**
 * Plans and pricing.
 *
 * Four cards in one panel. Free, EduVantage, Prime and the one-week Sprint
 * Pass are four cards with different surfaces rather than one table divided
 * into columns, because a price page should feel like choosing a room, not
 * reading a grid. The recommended plan is the only lit card; the pass sits
 * beside them as a card too — a fixed length and one price, no strip.
 *
 * One billing switch sits above the cards and moves every term plan at once,
 * because three separate switches on three cards made the reader compare four
 * prices in three different units.
 *
 * Below: one comparison table, read from `PLAN_MATRIX` in `src/lib/plans.ts` —
 * the same module that names the capability each lock checks, so the table
 * cannot promise a workspace the app will refuse. Above the footnote: the
 * questions a student asks before paying, answered with the numbers on this
 * page.
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

/** One plan on the stage: the lit hero, or one of the three rows beside it. */
function PlanCard({
  name,
  tag,
  metalTag,
  summary,
  price,
  priceSuffix,
  billingLine,
  hook,
  features,
  includedLabel,
  rail,
  free,
  pass,
  featured,
  prime,
  current,
  onChoose,
  ctaLabel,
}: {
  name: string;
  /** A short status tag that sits beside the name, never above it. */
  tag?: string;
  metalTag?: boolean;
  summary: string;
  price: number;
  priceSuffix: string;
  billingLine: string;
  hook?: string;
  /** Only the large card lists its features; the rows stay scannable. */
  features?: string[];
  includedLabel?: string;
  rail?: boolean;
  free?: boolean;
  pass?: boolean;
  featured?: boolean;
  /** The top tier: same layout, warmer metal, no glow. */
  prime?: boolean;
  current: boolean;
  onChoose?: () => void;
  ctaLabel: string;
}) {
  return (
    <article
      className={cn(
        "plan-card",
        rail && "plan-card--rail",
        free && "plan-card--free",
        pass && "plan-card--pass",
        featured && "plan-card--featured",
        prime && "plan-card--prime",
      )}
    >
      <div className="plan-card__head">
        <h2 className="plan-card__name">{name}</h2>
        {tag ? (
          <span
            className={cn("plan-card__tag", metalTag && "plan-card__tag--metal")}
          >
            {tag}
          </span>
        ) : null}
      </div>

      <p className="plan-card__summary">{summary}</p>

      {/* The number glides when the term changes — one animated figure per
          card, never a second price in the small print. */}
      <div className="plan-card__price">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${name}-${price}`}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
            className="plan-card__amount"
          >
            {formatINR(price)}
          </motion.span>
        </AnimatePresence>
        <span className="plan-card__suffix">{priceSuffix}</span>
      </div>

      <p className="plan-card__billing">{billingLine}</p>
      {hook ? <p className="plan-card__hook">{hook}</p> : null}

      {features && features.length > 0 ? (
        <>
          <p className="plan-card__label">{includedLabel}</p>
          <ul className="plan-card__features">
            {features.map((feature) => (
              <li key={feature}>
                <Check aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="plan-card__foot">
        <button
          type="button"
          onClick={onChoose}
          disabled={current}
          className={cn(
            "plan-card__cta",
            featured && "plan-card__cta--solid",
            current && "plan-card__cta--current",
          )}
        >
          {current ? (
            "Your current plan"
          ) : (
            <>
              {ctaLabel}
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </article>
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

const COLUMNS: Array<{ id: ComparisonPlanId; name: string; price: string }> = [
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

  /* `plans.ts` owns the order and every number: the pass is a card in the
     same panel as the term plans, second after Free. */
  const featuredTier =
    PLAN_TIERS.find((tier) => tier.featured) ?? PLAN_TIERS[0];
  const primeTier =
    PLAN_TIERS.find((tier) => tier.id === "prime") ?? PLAN_TIERS[0];
  const passTiers = PLAN_TIERS.filter((tier) => !tier.flexible);

  const tierDisplay = (tier: PlanTier) => {
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

          {/* One lit hero and three rows, not four equal cards. The pass sits
              beside the term plans because it is bought here, not on a
              schedule of its own. */}
          <div data-reveal className="mt-12">
            <div className="plans-stage">
              <PlanCard
                tag="Most popular"
                name={featuredTier.name}
                summary={featuredTier.summary}
                price={tierDisplay(featuredTier).price}
                priceSuffix={tierDisplay(featuredTier).suffix}
                billingLine={tierDisplay(featuredTier).billing}
                hook={tierDisplay(featuredTier).hook}
                features={featuredTier.features}
                includedLabel="Everything in Free, plus"
                featured
                current={plan === featuredTier.id}
                ctaLabel={`Choose ${featuredTier.name}`}
                onChoose={() => setCheckout(featuredTier)}
              />

              <PlanCard
                rail
                free
                name={FREE_PLAN.name}
                summary={FREE_PLAN.summary}
                price={0}
                priceSuffix="/ forever"
                billingLine="No card, no trial clock."
                current={plan === "free"}
                ctaLabel="Switch to Free"
                onChoose={() => setPlan("free")}
              />

              {passTiers.map((tier) => (
                <PlanCard
                  key={tier.id}
                  rail
                  pass
                  name={tier.name}
                  summary={tier.summary}
                  price={tier.price}
                  priceSuffix={`/ ${tier.unit}`}
                  billingLine="One payment, nothing renews."
                  current={plan === tier.id}
                  ctaLabel="Take the pass"
                  onChoose={() => setCheckout(tier)}
                />
              ))}

              <PlanCard
                rail
                prime
                tag="Top tier"
                metalTag
                name={primeTier.name}
                summary={primeTier.summary}
                price={tierDisplay(primeTier).price}
                priceSuffix={tierDisplay(primeTier).suffix}
                billingLine={tierDisplay(primeTier).billing}
                hook={tierDisplay(primeTier).hook}
                current={plan === primeTier.id}
                ctaLabel={`Choose ${primeTier.name}`}
                onChoose={() => setCheckout(primeTier)}
              />
            </div>
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
                  Same engine on every plan. What changes is how much it will
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
                                    "bg-[color-mix(in_srgb,#4cc9f0_5%,transparent)]",
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
