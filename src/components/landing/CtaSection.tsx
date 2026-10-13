import { useAuth } from "@/hooks/use-auth";
import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { MovingBorderButton } from "./MovingBorderButton";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

export default function CtaSection() {
  const ref = useRef<HTMLElement | null>(null);
  const { isAuthenticated } = useAuth();

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
    <section ref={ref} className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 md:pb-32">
      <div
        data-reveal
        className="glass-panel relative overflow-hidden px-6 py-14 text-center sm:px-12 md:py-20"
      >
        {/* soft signal glow behind the card content */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--signal)_12%,transparent)] blur-3xl"
        />
        <div className="relative">
          <span className="kicker">Start churning</span>
          <h2
            data-reveal
            className="text-fade mx-auto mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-[1.12]"
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
        </div>
      </div>
    </section>
  );
}