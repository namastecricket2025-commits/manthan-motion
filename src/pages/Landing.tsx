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
      // Entrance: the mark, the headline, the copy, the actions and the
      // footnote settle one after another on a spring ease — a touch of
      // overshoot on the way up, no bounce wobble once they land.
      // No `filter` here on purpose: a filter on an ancestor turns it into a
      // backdrop root, which would flatten the panels behind it while the
      // entrance plays. The word-level blur lives in TextGenerate instead,
      // where it affects nothing but its own spans.
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
      {/* The hero.

          Centred, top-aligned and bounded by its own padding — NOT a
          full-viewport art piece. The previous version opened with a 100svh
          section holding only the orbiting mark, which pushed the headline,
          the copy and both call to actions below the fold: a visitor saw a
          logo animation instead of what the product does. The mark survives
          at brand-mark size above the badge, where a product site puts one.

          The reading order is the one every premium site uses, and it is a
          deliberate sequence: badge (what's new) → headline (what it is) →
          subcopy (what it does) → actions → the product itself, presented in
          a lit frame. */}
      <section className="relative px-4 pb-20 pt-20 sm:px-6 sm:pt-24">
        {/* The page wash — a very faint neutral lift at the top of the page,
            scaled by the Ambient Intensity slider (`--bg-glow-opacity`).
            Rendered first, with everything below set `relative`, so it sits
            behind the content instead of over it. */}
        <div className="glow-aura" aria-hidden="true" />

        {/* THE MARK — the hero's centrepiece, at size.

            This is Vercel's hero composition: one large, lit object owning the
            centre of the first screen, with everything else arranged around
            it. The mark had been shrunk to a 56px badge so the headline could
            start higher up, which inverted the whole design — a 56px logo is a
            favicon, and a hero whose focal point is the size of a bullet point
            has no focal point at all.

            `.mark-halo` sits it in white backlight (see index.css): the mark
            reads as an object lit from behind rather than a shape pasted on
            black — the same trick as Vercel's own hero, where the triangle is
            outlined by a white halo that falls off into nothing. */}
        <div
          data-hero-fade
          className="relative flex items-center justify-center py-6 sm:py-10"
        >
          <div className="relative h-[clamp(180px,30svh,300px)] w-[clamp(180px,30svh,300px)]">
            <div className="mark-halo" aria-hidden="true" />
            <OrbitMark className="flex h-full w-full items-center justify-center" svgClassName="h-full w-full" />
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <TextGenerate
            className="font-display text-[42px] font-bold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-6xl md:text-[76px] md:leading-[0.98]"
            delay={0.25}
            spring
            segments={[
              { text: "Churn your notes into" },
              { text: "clarity.", className: "gradient-text" },
            ]}
          />

          <p
            data-hero-fade
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-dim sm:text-lg"
          >
            Drop in files, links or pasted notes. Manthan's five-step pipeline
            distills them into summaries, flashcards and question banks — live,
            labelled, and ready to revise.
          </p>

          {/* Mobile-first: on a phone both actions run the full column width at
              a 48px height, so the primary CTA is unmissable and thumb-sized.
              From sm up they snap back to the inline pair. */}
          <div
            data-hero-fade
            className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          >
            <MovingBorderButton
              to={ctaTarget}
              className="w-full sm:w-auto"
              innerClassName="w-full justify-center px-7 py-3.5 text-sm sm:w-auto"
            >
              Generate study material
              <ArrowRight className="h-4 w-4" />
            </MovingBorderButton>
            <a
              href="#how"
              className="btn-ghost inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--panel-line)] px-6 py-3 text-sm font-medium text-foreground sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              See how it works
            </a>
          </div>

          <p
            data-hero-fade
            className="mt-7 text-[13px] font-medium text-text-dim"
          >
            PDFs · slides · links · handwritten notes — any material works
          </p>
        </div>

        {/* The product itself, in its lit frame. The bloom is painted behind
            the frame (z-index -1 inside the page's stacking context), so the
            light appears to come from the screenshot rather than over it. */}
        <div
          data-hero-fade
          className="relative mx-auto mt-20 max-w-5xl sm:mt-24"
        >
          <div className="hero-bloom" aria-hidden="true" />
          <div className="hero-frame">
            <HeroPreview />
          </div>
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
