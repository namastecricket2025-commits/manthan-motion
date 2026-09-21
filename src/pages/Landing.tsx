import BlobBackground from "@/components/BlobBackground";
import CtaSection from "@/components/landing/CtaSection";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";
import HeroPreview from "@/components/landing/HeroPreview";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import Navbar from "@/components/landing/Navbar";
import OrbitMark from "@/components/landing/OrbitMark";
import Pipeline from "@/components/landing/Pipeline";
import Stats from "@/components/landing/Stats";
import { TextGenerate } from "@/components/landing/TextGenerate";
import { useAuth } from "@/hooks/use-auth";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { settingsRuntime } from "@/lib/app-settings";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-hero-fade]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      // Apple-style entrance: the kicker, copy, action links and footnote settle
      // one after another on a spring ease — a touch of overshoot on the way
      // up, a blur burn-off, no bounce wobble once they land.
      // No `filter` here on purpose: a filter on an ancestor turns it into a
      // backdrop root, which would flatten the glass on the hero preview card
      // and the CTA while the entrance plays. The word-level blur lives in
      // TextGenerate instead, where it can't affect any glass surface.
      gsap.fromTo(
        els,
        { opacity: 0, y: 30, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.85,
          ease: "back.out(1.6)",
          stagger: 0.12,
          delay: 0.42,
          clearProps: "transform",
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const ctaTarget = isAuthenticated ? "/dashboard" : AUTH_URL;

  return (
    <div ref={ref}>
      {/* Full-height mark — the landing page centrepiece: the large primary
          circle anchored in the middle with the small light satellite
          orbiting it on a continuous 360° loop. */}
      <section
        aria-label="Manthan"
        className="relative flex min-h-[calc(100svh-72px)] items-center justify-center px-4 pb-10 pt-24"
      >
        <div data-hero-fade className="h-full w-full">
          <OrbitMark />
        </div>
      </section>

      {/* Badge → headline → copy → CTAs */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pb-24">
        <div className="grid items-center gap-12 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,440px)] min-[900px]:gap-16">
          <div>
            <span data-hero-fade className="kicker">
              Manthan · study material, distilled
            </span>

            <TextGenerate
              className="mt-6 font-display text-[40px] font-bold leading-[1.04] tracking-[-0.04em] text-foreground sm:text-6xl md:text-[68px] md:leading-[1.0]"
              delay={0.25}
              spring
              segments={[
                { text: "Churn your notes into" },
                { text: "clarity.", className: "gradient-text" },
              ]}
            />

            <p
              data-hero-fade
              className="mt-6 max-w-xl text-base leading-relaxed text-text-dim sm:text-lg"
            >
              Drop in files, links or pasted notes. Manthan's five-step pipeline
              distills them into summaries, flashcards and question banks — live,
              labelled, and ready to revise.
            </p>

            <div
              data-hero-fade
              className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <MovingBorderButton
                to={ctaTarget}
                innerClassName="px-7 py-3.5 text-sm"
              >
                Generate study material
                <ArrowRight className="h-4 w-4" />
              </MovingBorderButton>
              <a
                href="#how"
                className="btn-ghost glass-chip inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-foreground"
              >
                <Sparkles className="h-4 w-4 text-[var(--signal)]" />
                See how it works
              </a>
            </div>

            <div
              data-hero-fade
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-text-dim"
            >
              <span>
                PDFs · slides · links · handwritten notes — any material works
              </span>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>
    </div>
  );
}

export default function Landing() {
  // Lenis glide-scrolling for the marketing page (reduced-motion — OS or the
  // app's Motionless Mode — falls back to native scrolling inside the hook).
  useSmoothScroll(!settingsRuntime.reduceMotion);

  return (
    <div className="relative min-h-screen">
      {/* The signature crimson blob field — the canvas metaball engine, its
          opacity capped by the theme tokens and the Ambient Intensity slider. */}
      <BlobBackground />
      <div className="relative z-10">
        {/* Anchor target for the "Home" nav item — the header is fixed, so
            an anchor on it can't scroll the page; this spans the top. */}
        <div id="top" aria-hidden="true" />
        <Navbar />
        <main>
          <Hero />
          <Features />
          <Pipeline />
          <Stats />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
