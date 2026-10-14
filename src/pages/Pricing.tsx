import BlobBackground from "@/components/BlobBackground";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { CheckoutModal } from "@/components/plans/CheckoutModal";
import { usePlan } from "@/components/plans/PlanProvider";
import {
  DEFAULT_DURATION,
  DURATIONS,
  durationSavings,
  durationTotal,
  formatINR,
  getDuration,
  PLAN_TIERS,
  planName,
  type DurationId,
  type PlanTier,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

/**
 * Plans and pricing.
 *
 * Three tiers, each priced honestly: the Sprint Pass is a single seven-day
 * pass, while EduVantage and Manthan Prime offer the 1 / 6 / 12 month schemes
 * with the discount applied to the running total. Checkout is an explicit
 * sandbox simulation — nothing here contacts a payment network.
 *
 * The layout is the one a product site uses, because it is the one that makes
 * a price table readable:
 *
 *   centred heading → one row of equal cards → the CTA inside each card,
 *   immediately under the price → the feature list, in the same order on
 *   every card so the eye can compare across rather than scan down.
 *
 * The term control is a segmented switcher rather than a `<select>` all on its
 * own: a dropdown hides two thirds of the offer behind a click, and the whole
 * point of the multi-month terms is that the saving is visible.
 */

/** Short segment labels — the saving is rendered separately, as a chip. */
const TERM_LABEL: Record<DurationId, string> = {
  "1m": "1 month",
  "6m": "6 months",
  "12m": "12 months",
};

export default function Pricing() {
  const { plan, setPlan } = usePlan();
  const [durations, setDurations] = useState<Record<string, DurationId>>({
    eduvantage: DEFAULT_DURATION,
    prime: DEFAULT_DURATION,
  });
  const [checkout, setCheckout] = useState<PlanTier | null>(null);

  const checkoutDuration = checkout
    ? getDuration(durations[checkout.id] ?? DEFAULT_DURATION)
    : getDuration(DEFAULT_DURATION);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BlobBackground />
      <div className="relative z-10">
        {/* Page-top aurora — ambient light spilling in from above. */}
        <div className="glow-aura" aria-hidden="true" />
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <span className="kicker">Pricing</span>
            <h1 className="text-fade mt-5 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl md:text-[56px] md:leading-[1.05]">
              Pricing for every study plan
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim">
              Every account starts free and stays useful — 60,000 tokens a day,
              every notebook, every source. The tiers below raise the ceiling and
              open the advanced workspaces. Checkout is a sandbox: nothing is
              charged.
            </p>
          </div>

          {/* What free already includes — stated once, above the table, so the
              paid cards only have to sell the difference. */}
          <div
            data-reveal
            className="glass-panel mt-12 flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="font-display text-sm font-semibold tracking-tight">
                Free · included with every account
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-dim">
                60,000 tokens per day · unlimited notebooks and sources ·
                summaries, flashcards, quizzes, mind maps and slides · full STEM
                Lab
              </p>
            </div>
            <span className="premium-chip">
              {plan === "free" ? "Current plan" : "Included"}
            </span>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {PLAN_TIERS.map((tier) => {
              const duration = getDuration(durations[tier.id] ?? DEFAULT_DURATION);
              const total = tier.flexible
                ? durationTotal(tier, duration)
                : tier.price;
              const savings = tier.flexible ? durationSavings(tier, duration) : 0;
              const isCurrent = plan === tier.id;

              return (
                <section
                  key={tier.id}
                  data-reveal
                  className={cn(
                    "premium-card",
                    tier.featured && "premium-card--featured",
                  )}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold tracking-tight">
                        {tier.name}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-text-dim">
                        {tier.summary}
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="premium-chip shrink-0">Current</span>
                    ) : tier.featured ? (
                      <span className="premium-chip shrink-0">Popular</span>
                    ) : null}
                  </header>

                  {/* Term switcher — only the tiers sold by term carry one. */}
                  {tier.flexible && (
                    <div className="mt-5 inline-flex w-fit rounded-lg border border-[var(--panel-line)] p-0.5">
                      {DURATIONS.map((option) => {
                        const active =
                          (durations[tier.id] ?? DEFAULT_DURATION) === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setDurations((current) => ({
                                ...current,
                                [tier.id]: option.id,
                              }))
                            }
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                              active
                                ? "bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)] text-foreground"
                                : "text-text-dim hover:text-foreground",
                            )}
                          >
                            {TERM_LABEL[option.id]}
                            {option.discount > 0 && (
                              <span className="ml-1 text-[10px] text-text-dim">
                                −{Math.round(option.discount * 100)}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Animated total — the number glides when the term changes. */}
                  <div className="mt-5 flex items-end gap-2">
                    <div className="relative h-11 overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={`${tier.id}-${total}`}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                          className="block font-display text-[40px] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                        >
                          {formatINR(total)}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <span className="pb-1.5 text-sm text-text-dim">
                      {tier.flexible
                        ? duration.months === 1
                          ? "/ month"
                          : `/ ${duration.months} months`
                        : `/ ${tier.unit}`}
                    </span>
                  </div>

                  <div className="mt-1.5 min-h-[20px]">
                    {savings > 0 ? (
                      <motion.p
                        key={`${tier.id}-saving-${savings}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                        className="text-xs text-text-dim"
                      >
                        Save {formatINR(savings)} over {duration.months} monthly
                        payments.
                      </motion.p>
                    ) : !tier.flexible ? (
                      <p className="text-xs text-text-dim">
                        Single seven-day pass · {tier.allowance}
                      </p>
                    ) : null}
                  </div>

                  {/* The action sits directly under the price on every card, at
                      the same offset, so the three buttons line up across the
                      row and do not have to be hunted for. */}
                  <div className="mt-6">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-default rounded-full border border-[var(--panel-line)] px-5 py-2.5 text-[13px] font-medium text-text-dim"
                      >
                        Current plan
                      </button>
                    ) : tier.featured ? (
                      <MovingBorderButton
                        onClick={() => setCheckout(tier)}
                        className="w-full"
                        innerClassName="w-full px-5 py-2.5 text-[13px]"
                      >
                        Choose {tier.name}
                      </MovingBorderButton>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCheckout(tier)}
                        className="w-full rounded-full border border-[var(--panel-line)] px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-[var(--panel-line-strong)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)]"
                      >
                        Choose {tier.name}
                      </button>
                    )}
                  </div>

                  <div className="premium-divider my-6" />

                  <ul className="flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-text-dim" />
                        <span className="leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPlan("free")}
              className="text-xs text-text-dim transition-colors hover:text-foreground"
            >
              Return this account to the Free plan
            </button>
            <span className="text-xs text-text-dim">
              · currently on {planName(plan)}
            </span>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-text-dim">
            Daily allowances count the tokens the AI reads from your sources and
            writes back as study material. They reset at midnight UTC. Paid tiers
            raise the cap and unlock the advanced workspaces; they never change
            your notebooks or the material already inside them.
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
