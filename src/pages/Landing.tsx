import CtaSection from "@/components/landing/CtaSection";
import Features from "@/components/landing/Features";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import HeroPreview from "@/components/landing/HeroPreview";
import KitShowcase from "@/components/landing/KitShowcase";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import Navbar from "@/components/landing/Navbar";
import OrbitMark from "@/components/landing/OrbitMark";
import Pipeline from "@/components/landing/Pipeline";
import Stats from "@/components/landing/Stats";
import Testimonials from "@/components/landing/Testimonials";
import { TextGenerate } from "@/components/landing/TextGenerate";
import { useAuth } from "@/hooks/use-auth";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { settingsRuntime } from "@/lib/app-settings";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

/**
 * The hero's right-hand stack — Vercel's "capability rail".
 *
 * Three one-line statements about what the product is for, each with a muted
 * continuation that the row reveals on hover (see `.cap-row` in index.css for
 * the measured 24px → 84px expansion). The first line is the claim; the
 * continuation is the receipt, and every one of them is a fact about the
 * pipeline rather than a slogan.
 */
const CAPABILITIES = [
  {
    line: "For PDFs, slides and links",
    more: "Eight formats in all, including handwritten notes read by OCR.",
  },
  {
    line: "To summaries, flashcards, quizzes",
    more: "The mix you choose, weighted per chapter or topic.",
  },
  {
    line: "Watched live, step by step",
    more: "Five stages, each with its own status while it runs.",
  },
];

/**
 * The formats Manthan actually reads — the hero's bottom strip.
 *
 * This sits where Vercel puts its customer logos, and deliberately does not
 * imitate them: we have no customers to name, and inventing a logo wall is the
 * one thing on a landing page that is a flat lie. A row of the eight formats
 * the app accepts is the same structural element carrying something true.
 */
const FORMATS = [
  "PDF",
  "DOCX",
  "PPTX",
  "TXT",
  "Markdown",
  "HTML",
  "EPUB",
  "Images",
];

/** The ninth line was "Handwritten notes" in this list, which made the strip
 *  read as nine formats while the receipts rail and the FAQ both say eight.
 *  Handwriting is read out of the Images format rather than being one of its
 *  own, so it belongs in a note under the row, not in the row. */
const FORMAT_NOTE = "Photos of handwritten notes are read with OCR.";

/**
 * The hero, in Vercel's composition.
 *
 * Their arrangement, from a layout audit of vercel.com at 1440px: a 1400px
 * container with 24px side margins; the copy and the capability rail are a
 * flex row with `justify-between` (left block capped at 444px, rail at 364px);
 * and the lit mark sits on an absolutely centred layer BEHIND both — it is not
 * a third grid column. That distinction is the whole trick: absolutely
 * centring it holds the mark on the exact centre line of the screen no matter
 * how wide either side's content turns out to be, which a three-column grid
 * cannot do (its middle column shifts with its neighbours).
 *
 * The type is theirs to the value too: 64px/64px at weight 400 with −3.84px
 * tracking (−0.06em). Tight, light display type — not the bold 76px we had.
 *
 * The three-part composition only engages from 1280px up. Below that the
 * mark's halo and the copy collide (the light reaches ~174px from centre, so
 * the left column has to stay under about 500px to clear it), and the hero
 * stacks instead: mark, copy, rail.
 */
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
      // Entrance, to the reference set for this kind of site: 10–14px of
      // travel, ~500ms, and an ease-out so steep it is nearly finished by the
      // time the eye arrives (cubic-bezier(.22,1,.36,1) — GSAP's power3.out),
      // with a 60ms stagger between blocks.
      //
      // This used to travel 30px over 850ms on `back.out(1.6)`: a half-second
      // bounce, which reads as a page performing its own entrance rather than
      // one that was already there. A hero settles; it doesn't land.
      //
      // No `filter` here on purpose: a filter on an ancestor turns it into a
      // backdrop root, which would flatten the panels behind it while the
      // entrance plays. The word-level blur lives in TextGenerate instead,
      // where it affects nothing but its own spans.
      gsap.fromTo(
        els,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.06,
          delay: 0.08,
          clearProps: "transform",
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const ctaTarget = isAuthenticated ? "/dashboard" : AUTH_URL;

  return (
    <div ref={ref}>
      {/* The first screen. Its height is capped at 940px so a 27" monitor
          doesn't get a hero mostly made of empty black — Vercel caps theirs
          for the same reason. */}
      <section className="relative flex min-h-[min(100svh,940px)] flex-col px-4 pb-10 pt-24 sm:px-6 sm:pt-28">
        {/* NO page wash and NO bloom behind the product shot.

            The hero used to carry `.glow-aura` (a 460px-tall 42%-white radial
            centred above the top of the viewport) and `.hero-bloom` (an
            1180px white pool under the product frame). Between them they lit
            the entire first screen, which is why a black page measured grey.
            The product's own hero is flat black with exactly one light in it,
            hugging the mark — so that is the only one left here. */}
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
          {/* No announcement strip. There was one here — a centred note on
              the product's maturity, with a Start free pill, borrowed from
              the slot Vercel puts a conference announcement in. It was the
              first thing on the page and it undersold it: the first line a
              visitor read was about how finished the product was rather than
              what it does. The facts worth knowing now sit under the hero's
              buttons, at the point where someone is actually deciding. */}

          {/* The composition. `relative` on this layer is what the mark
              centres against below 1280px; from 1280px up the mark is
              absolutely centred and the row below it is the only thing in
              flow, so the row centres in the full height of the hero. */}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-12 py-10 sm:py-14 xl:gap-0">
            {/* THE MARK — the hero's centrepiece, at size, on its own centred
                layer behind the copy.

                `.mark-halo` sits it in white backlight (see index.css). The
                halo is anchored to the mark and never chases the pointer: a
                light that moves under the cursor reads as a toy, not as a
                lit object. */}
            <div
              data-hero-fade
              className="relative h-[clamp(180px,26vw,340px)] w-[clamp(180px,26vw,340px)] xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2"
            >
              <div aria-hidden="true" className="absolute inset-0">
                <div className="mark-halo" />
              </div>
              <OrbitMark
                className="relative flex h-full w-full items-center justify-center"
                svgClassName="h-full w-full"
              />
            </div>

            <div className="flex w-full flex-col items-center gap-12 xl:flex-row xl:items-center xl:justify-between">
              {/* Left: what it is, what it does, what you do next. Capped at
                  460px so the copy clears the halo, and left-aligned only once
                  the composition is engaged. */}
              <div
                data-hero-fade
                className="w-full max-w-[560px] text-center xl:max-w-[460px] xl:text-left"
              >
                <TextGenerate
                  className="font-display text-[40px] font-normal leading-[1.04] tracking-[-0.04em] text-foreground sm:text-[52px] sm:leading-[1.02] lg:text-[58px] xl:text-[64px] xl:leading-[64px] xl:tracking-[-0.06em]"
                  delay={0.14}
                  segments={[
                    { text: "Churn your notes into" },
                    { text: "clarity.", className: "gradient-text" },
                  ]}
                />

                <p className="mt-6 text-base leading-7 text-text-dim sm:text-lg sm:leading-8">
                  Drop in files, links or pasted notes. Manthan's five-step
                  pipeline distills them into summaries, flashcards and question
                  banks — live, labelled, and ready to revise.
                </p>

                {/* Mobile-first: on a phone both actions run the full column
                    width at a 48px height, so the primary CTA is unmissable and
                    thumb-sized. From sm up they snap back to the inline pair.
                    The row sits 32px under the headline with 12px between the
                    buttons — Vercel's measured spacing for their own hero. */}
                <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center xl:justify-start">
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

                {/* What it costs and what it takes to start, on the line where
                    the decision is made. The allowance is the number the
                    server enforces (`src/lib/plans.ts`), not a marketing
                    figure. */}
                <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-text-dim xl:justify-start">
                  {[
                    "Free plan · 60,000 tokens a day",
                    "8 formats, handwritten notes included",
                    "No card required",
                  ].map((fact) => (
                    <li key={fact} className="inline-flex items-center gap-2">
                      {/* A filled amber disc, not an amber glyph: the mark is
                          the bright brand yellow in both themes now, so a thin
                          stroke of it on paper would not be seen. Same yellow
                          as the button, with the button's ink on top. */}
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)]">
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: the capability rail. Rows are 16px/24px, 8px apart,
                  vertically centred against the copy exactly as the reference
                  does it. */}
              <ul
                data-hero-fade
                className="flex w-full max-w-[420px] flex-col gap-2 xl:max-w-[364px]"
              >
                {CAPABILITIES.map((item) => (
                  <li key={item.line} className="cap-row text-center xl:text-left">
                    <p className="text-base leading-6 text-foreground">
                      {item.line}
                    </p>
                    <p className="cap-more text-base leading-6 text-[color-mix(in_srgb,var(--text-main)_62%,transparent)]">
                      {item.more}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* The formats the app reads, in the slot Vercel gives its customer
            logos. Still deliberately not a logo wall — we have no customers to
            name — but as labelled chips rather than a row of grey words, so the
            strip reads as a specification instead of a caption. */}
        <div
          data-hero-fade
          className="mx-auto mt-10 flex w-full max-w-[1400px] flex-col items-center gap-3"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--text-main)_50%,transparent)]">
            Reads
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {FORMATS.map((format) => (
              <li key={format} className="glass-chip px-3 py-1.5 text-[12px] text-text-dim">
                {format}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-text-dim">{FORMAT_NOTE}</p>
        </div>
      </section>

      {/* The product itself, on flat black, in a hairline frame. It sits
          outside the first screen so the hero is exactly one viewport, which is
          how the reference structures it too. */}
      <div data-hero-fade className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="hero-frame">
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  // Lenis glide-scrolling for the marketing page (reduced-motion — OS or the
  // app's Motionless Mode — falls back to native scrolling inside the hook).
  useSmoothScroll(!settingsRuntime.reduceMotion);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10">
        {/* Anchor target for the "Home" nav item — the header is fixed, so
            an anchor on it can't scroll the page; this spans the top. */}
        <div id="top" aria-hidden="true" />
        <Navbar />
        <main>
          <Hero />
          <Features />
          <Pipeline />
          {/* The output, between "how it works" and the numbers: what the five
              steps were for, shown as four real artifacts. */}
          <KitShowcase />
          <Stats />
          {/* Real quotes from the early testers, read live from the approved
              rows — the count and the average move with the database. */}
          <Testimonials />
          <Faq />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
