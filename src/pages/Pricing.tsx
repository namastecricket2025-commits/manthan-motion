import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { TestimonialStrip } from "@/components/landing/Testimonials";
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
 * The card deliberately carries as little as possible: a name, one line of
 * description, the term, the number, ONE muted line of billing context, the
 * action, and the feature list.
 *
 * What was removed, and why it was removed rather than restyled:
 *
 *   - the "Popular" / "Current" bordered pills. A bordered micro-chip is a
 *     third type of box competing with the card, the button and the field
 *     around it; the featured plan is already told apart by a brighter border,
 *     and this account's state is already told apart by its button.
 *   - the `/ month` suffix and the `−10%` / `−20%` chips in the term switcher.
 *     The unit and the saving belong in one sentence under the price, not
 *     scattered as punctuation around it.
 *   - the eyebrow pill above the heading.
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
      <div className="relative z-10">
        {/* Page-top wash — the same faint neutral light as the landing page. */}
        <div className="glow-aura" aria-hidden="true" />
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <h1 className="text-fade font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl md:text-[56px] md:leading-[1.05]">
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
                summaries, flashcards, quizzes, mind maps and slides · AI
                notebook chat, audio overviews and Hindi one-shot lecture picks
                · full STEM Lab
              </p>
            </div>
            <p className="text-xs font-medium text-text-dim">
              {plan === "free" ? "Your current plan" : "Included"}
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {PLAN_TIERS.map((tier) => {
              const duration = getDuration(durations[tier.id] ?? DEFAULT_DURATION);
              const total = tier.flexible
                ? durationTotal(tier, duration)
                : tier.price;
              const savings = tier.flexible ? durationSavings(tier, duration) : 0;
              const isCurrent = plan === tier.id;
              /* The daily figure is the hook that actually lands: a student can
                 compare ₹7 a day with a bus fare; ₹349 a month is abstract. */
              const perDay = Math.max(
                1,
                Math.round(
                  tier.flexible
                    ? total / (duration.months * 30)
                    : tier.price / 7,
                ),
              );
              const hook =
                tier.id === "sprint"
                  ? `About ${formatINR(perDay)} a day for one revision week.`
                  : tier.id === "eduvantage"
                    ? `About ${formatINR(perDay)} a day — less than one photocopied test.`
                    : `About ${formatINR(perDay)} a day for every workspace, unlocked.`;

              return (
                <section
                  key={tier.id}
                  data-reveal
                  className={cn(
                    "premium-card",
                    tier.featured && "premium-card--featured",
                  )}
                >
                  {/* A plain, unboxed label — the popular plan is named, not
                      badged, and its card's brighter border does the rest. */}
                  {tier.featured && !isCurrent && (
                    <p className="mb-3 text-xs font-medium text-foreground">
                      Most popular
                    </p>
                  )}

                  <h2 className="font-display text-base font-semibold tracking-tight">
                    {tier.name}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-dim">
                    {tier.summary}
                  </p>

                  {/* Term switcher — plain text, no discount chips: the saving
                      is stated once, in the billing line under the price. */}
                  {tier.flexible && (
                    <div className="mt-5 flex items-center gap-1">
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
                              "rounded-md px-2 py-1 text-[13px] transition-colors",
                              active
                                ? "bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] font-medium text-foreground"
                                : "text-text-dim hover:text-foreground",
                            )}
                          >
                            {option.months} mo
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Animated total — the number glides when the term changes. */}
                  <div className="mt-5 h-11 overflow-hidden">
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

                  <p className="mt-3 min-h-[20px] text-xs leading-relaxed text-text-dim">
                    {tier.flexible
                      ? duration.months === 1
                        ? "Billed monthly. Cancel any time."
                        : `Billed every ${duration.months} months · saves ${formatINR(savings)}`
                      : `One 7-day pass · ${tier.allowance}`}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-dim">
                    {hook}
                  </p>

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

                  <p className="mb-3 text-[11.5px] text-text-dim">
                    Everything in Free, plus:
                  </p>
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

          {/* What the price is for, stated in outcomes rather than adjectives. */}
          <section data-reveal className="mt-14">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              What the money actually buys
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-dim">
              The free account is not a demo. Paid tiers raise how much you can
              make and which workbenches open — never which chapters you can
              read.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "The same engine on every plan",
                  body: "A free account already churns sources into summaries, flashcards, quizzes, mind maps and slides. Paying buys more tokens and the advanced workspaces, not a better answer.",
                },
                {
                  title: "Priced around an exam, not a feature list",
                  body: "Sprint is one revision week. EduVantage is a month of assignments. Prime is the full Math Lab and the voice tutor, for the term you are actually in.",
                },
                {
                  title: "Your notes are never held hostage",
                  body: "Every notebook, source and generated item can be exported from Settings. Deleting an account removes the material with it, not just the login.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[var(--panel-line)] p-5"
                >
                  <p className="text-sm font-semibold tracking-tight">{card.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-dim">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <TestimonialStrip />

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
