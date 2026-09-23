import BlobBackground from "@/components/BlobBackground";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { Logo } from "@/components/landing/Logo";
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
import { Check, ChevronDown, Clock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

/**
 * Plans and pricing.
 *
 * Three tiers, each priced honestly: the Sprint Pass is a single seven-day
 * pass, while EduVantage and Manthan Prime offer the 1 / 6 / 12 month schemes
 * with the discount applied to the running total. Checkout is an explicit
 * sandbox simulation — nothing here contacts a payment network.
 */

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
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
          <div data-reveal className="text-center">
            <Logo markClassName="mx-auto h-9 w-9" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-text-dim">
              Plans
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Study material, distilled
              <span className="text-[var(--signal)]">.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-dim">
              Every account starts free and stays useful — 60,000 tokens a day,
              every notebook, every source. The tiers below raise the ceiling and
              open the advanced workspaces. Checkout is a sandbox: nothing is
              charged.
            </p>
          </div>

          {/* What free already includes */}
          <div
            data-reveal
            className="premium-glass mt-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="font-display text-sm font-bold tracking-tight">
                Free plan · included with every account
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
                  className={
                    "premium-card" + (tier.featured ? " premium-card--featured" : "")
                  }
                >
                  {/* Filled with --signal-strong, not --signal: the luminous
                      accent is a text tone, and white on it would fail
                      contrast in dark mode. */}
                  {tier.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--signal-strong)] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--primary-foreground)]">
                      Most popular
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold tracking-tight">
                        {tier.name}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-text-dim">
                        {tier.summary}
                      </p>
                    </div>
                    {isCurrent && <span className="premium-chip">Current</span>}
                  </div>

                  {/* Animated total — the number glides when the term changes. */}
                  <div className="mt-6 flex items-end gap-2">
                    <div className="relative h-11 overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={`${tier.id}-${total}`}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                          className="block font-display text-4xl font-bold tabular-nums tracking-tight"
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

                  <div className="mt-1 min-h-[18px]">
                    {savings > 0 && (
                      <motion.p
                        key={`${tier.id}-saving-${savings}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                        className="text-[11.5px] font-medium text-[var(--signal)]"
                      >
                        Save {formatINR(savings)} over{" "}
                        {duration.months} monthly payments.
                      </motion.p>
                    )}
                  </div>

                  {tier.flexible && (
                    <div className="mt-5">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                        Choose your term
                      </label>
                      <div className="premium-select mt-2">
                        <select
                          value={durations[tier.id] ?? DEFAULT_DURATION}
                          onChange={(event) =>
                            setDurations((current) => ({
                              ...current,
                              [tier.id]: event.target.value as DurationId,
                            }))
                          }
                        >
                          {DURATIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {!tier.flexible && (
                    <p className="mt-5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-text-dim">
                      <Clock className="h-3.5 w-3.5" />
                      Single seven-day pass · {tier.allowance}
                    </p>
                  )}

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--signal)]" />
                        <span className="leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-default rounded-full border border-[color-mix(in_srgb,var(--signal)_45%,transparent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--signal)]"
                      >
                        Current plan
                      </button>
                    ) : (
                      <MovingBorderButton
                        onClick={() => setCheckout(tier)}
                        className="w-full"
                        innerClassName="w-full px-5 py-2.5 text-[13px]"
                      >
                        Choose {tier.name}
                      </MovingBorderButton>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPlan("free")}
              className="text-xs font-medium text-text-dim transition-colors hover:text-foreground"
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
