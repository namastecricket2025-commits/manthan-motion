import BlobBackground from "@/components/landing/BlobBackground";
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
import { gsap, prefersReducedMotion } from "@/lib/gsap";
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
      gsap.fromTo(
        els,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.1,
          delay: 0.35,
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const ctaTarget = isAuthenticated ? "/dashboard" : AUTH_URL;

  return (
    <div ref={ref}>
      {/* Full-height mark — the original hero: the small circle slowly
          orbiting the large one, centered on its own screen. */}
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
              className="mt-6 font-display text-[40px] font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-[68px] md:leading-[1.02]"
              delay={0.25}
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
                className="btn-ghost inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-6 py-3 text-sm font-semibold text-foreground"
              >
                <Sparkles className="h-4 w-4 text-[var(--signal)]" />
                See how it works
              </a>
            </div>

            <div
              data-hero-fade
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-text-dim"
            >
              <span>Boards · JEE/NEET · UPSC · semester exams</span>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen">
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
