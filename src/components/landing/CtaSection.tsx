import { useAuth } from "@/hooks/use-auth";
import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { MovingBorderButton } from "./MovingBorderButton";
import { useSpotlight } from "./use-spotlight";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

export default function CtaSection() {
  const ref = useRef<HTMLElement | null>(null);
  const { isAuthenticated } = useAuth();
  // The closing panel carries `.spot-card`, so it needs the listener that
  // drives it — without this the card's light has no pointer to follow and
  // would sit frozen at the gradient's default position.
  useSpotlight(ref);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6 sm:pb-24 sm:pt-8 md:pb-32">
      <div
        data-reveal
        className="glass-panel card-surface spot-card relative overflow-hidden px-6 py-10 text-center sm:px-12 sm:py-14 md:py-20"
      >
        {/* No light pooling inside the card. It used to carry a 130%-wide
            radial at 60% opacity bleeding over the card's top edge, which on
            a #0a0a0a panel is a grey smear across the whole CTA — the thing
            every card on this page was doing. The closing panel is a flat
            surface and a hairline, like the rest. */}
        <div className="relative">
          <h2
            data-reveal
            className="text-fade mx-auto max-w-2xl font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]"
          >
            Your notes are waiting to become{" "}
            <span className="gradient-text">study material</span>
          </h2>
          <p
            data-reveal
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim"
          >
            Sign in, drop in your first file, and watch the five-step pipeline
            turn it into a study kit you can actually use tonight.
          </p>
          <div data-reveal className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MovingBorderButton
              to={isAuthenticated ? "/dashboard" : AUTH_URL}
              innerClassName="px-7 py-3.5 text-sm"
            >
              Generate study material
              <ArrowRight className="h-4 w-4" />
            </MovingBorderButton>
            <a
              href="#features"
              className="btn-ghost glass-chip inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-foreground"
            >
              Explore features
            </a>
          </div>
          {/* The three facts that decide it, on the line where the decision is
              made — the free allowance is the number the server actually
              enforces (`src/lib/plans.ts`). */}
          <p data-reveal className="mt-6 text-[13px] text-text-dim">
            Free plan · 60,000 tokens a day · 8 formats · no card
          </p>
        </div>
      </div>
    </section>
  );
}