import BlobBackground from "@/components/BlobBackground";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { Logo } from "@/components/landing/Logo";
import { Check } from "lucide-react";

/**
 * Plans & pricing.
 *
 * Purchasing is not wired up yet — this page exists so the usage card has a
 * formal place to point at, and so the tiers are stated honestly: what the
 * free plan includes today, and what the paid tiers will raise. No fake
 * checkout buttons; the CTA is a waitlist-style link into the product.
 */

const TIERS = [
  {
    name: "Free",
    cadence: "Available today",
    price: "₹0",
    blurb: "Everything you need to start churning your notes.",
    features: [
      "Unlimited notebooks and sources",
      "60,000 tokens of generation per day",
      "Summaries, flashcards, quizzes, mind maps, slides",
      "Full STEM Lab and dashboard access",
    ],
    cta: "Included",
    highlight: false,
  },
  {
    name: "Scholar",
    cadence: "Coming soon",
    price: "₹99",
    per: "/month",
    blurb: "For the heavy revision season.",
    features: [
      "Everything in Free",
      "5× the daily generation allowance",
      "Priority generation queue at peak hours",
      "Longer sources — full textbooks per notebook",
    ],
    cta: "Join the waitlist",
    highlight: true,
  },
  {
    name: "Classroom",
    cadence: "Coming soon",
    price: "₹499",
    per: "/month",
    blurb: "For teachers and study groups.",
    features: [
      "Everything in Scholar, for 30 students",
      "Shared notebooks and class material",
      "Consolidated usage view for educators",
      "School billing on one invoice",
    ],
    cta: "Talk to us",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BlobBackground />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
          <div data-reveal className="text-center">
            <Logo markClassName="h-9 w-9 mx-auto" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-text-dim">
              Plans
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Study material, distilled
              <span className="text-[var(--signal)]">.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-dim">
              Every account starts on the Free plan — real generation, every
              day, at no cost. The paid tiers below raise the ceiling; they are
              not purchasable yet, and nothing here will charge you.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <div
                key={tier.name}
                data-reveal
                className={
                  "glass-panel relative flex flex-col p-6 " +
                  (tier.highlight
                    ? "border-[color-mix(in_srgb,var(--signal)_45%,transparent)]"
                    : "")
                }
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--signal)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--primary-foreground)]">
                    Most headroom
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    {tier.name}
                  </h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                    {tier.cadence}
                  </span>
                </div>
                <p className="mt-3">
                  <span className="font-display text-3xl font-bold tracking-tight">
                    {tier.price}
                  </span>
                  {tier.per && (
                    <span className="text-sm text-text-dim">{tier.per}</span>
                  )}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-dim">
                  {tier.blurb}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--signal)]" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {tier.name === "Free" ? (
                    <MovingBorderButton
                      to="/dashboard"
                      className="w-full"
                      innerClassName="w-full px-5 py-2.5 text-[13px]"
                    >
                      Open dashboard
                    </MovingBorderButton>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-full border border-[var(--card-border)] px-5 py-2.5 text-[13px] font-semibold text-text-dim"
                    >
                      {tier.cta} — soon
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p data-reveal className="mx-auto mt-10 max-w-lg text-center text-xs leading-relaxed text-text-dim">
            Daily allowances count the tokens the AI reads from your sources and
            writes back as study material. They reset at midnight UTC. Paid
            tiers simply raise the daily cap — your notebooks and material never
            change plans.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
