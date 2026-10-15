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
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

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
  "Handwritten notes",
];

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
  const lightRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    // The light trails the pointer — Vercel's own hero behaviour (their scene
    // renderer gives the pointer a light and a 165px glow radius, and the
    // light lags the cursor). Ours is the same idea in CSS: the gradient
    // behind the mark eases toward wherever the pointer is in the hero,
    // clamped to ±24px so it reads as light shifting, not as the logo sliding
    // around. Hovering a row in the rail therefore moves the light right,
    // which is exactly what the reference does on a capability-row hover.
    //
    // Gated on a real pointer and on motion: a touch device has nothing to
    // trail, and this is decoration, so Motionless Mode drops it entirely.
    const root = ref.current;
    const light = lightRef.current;
    if (!root || !light) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const xTo = gsap.quickTo(light, "x", { duration: 0.7, ease: "power3.out" });
    const yTo = gsap.quickTo(light, "y", { duration: 0.7, ease: "power3.out" });
    const clamp = gsap.utils.clamp;

    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;

    // One rAF per move at most: the browser coalesces them, so a fast drag
    // still sets the target twice a frame at worst, and never on scroll.
    const paint = () => {
      frame = 0;
      const box = root.getBoundingClientRect();
      if (!box.width) return;
      xTo(clamp(-24, 24, (pointerX - (box.left + box.width / 2)) * 0.06));
      yTo(clamp(-16, 16, (pointerY - (box.top + box.height / 2)) * 0.05));
    };
    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const recentre = () => {
      xTo(0);
      yTo(0);
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", recentre);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", recentre);
      gsap.killTweensOf(light);
      gsap.set(light, { x: 0, y: 0 });
    };
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
          {/* The announcement line, in Vercel's slot at the top centre: a
              14px/20px line and a 32px transparent pill that fills on hover.
              Theirs is a conference; ours is the pricing fact the rest of the
              page repeats, so it says the same thing the pricing table does. */}
          <div
            data-hero-fade
            className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-4"
          >
            <p className="text-sm leading-5 text-text-dim">
              Manthan is in open beta — no card, no trial timer.
            </p>
            <Link
              to={ctaTarget}
              className="group inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)]"
            >
              Start free
              <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* The composition. `relative` on this layer is what the mark
              centres against below 1280px; from 1280px up the mark is
              absolutely centred and the row below it is the only thing in
              flow, so the row centres in the full height of the hero. */}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-12 py-10 sm:py-14 xl:gap-0">
            {/* THE MARK — the hero's centrepiece, at size, on its own centred
                layer behind the copy.

                `.mark-halo` sits it in white backlight (see index.css). The
                halo is painted by a wrapper GSAP can move with the pointer,
                rather than by the halo element itself — the halo keeps its
                own `translate: -50% -50%`, and the two never have to share a
                transform. */}
            <div
              data-hero-fade
              className="relative h-[clamp(180px,26vw,340px)] w-[clamp(180px,26vw,340px)] xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2"
            >
              <div ref={lightRef} aria-hidden="true" className="absolute inset-0">
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

        {/* The bottom strip, in the slot Vercel gives its customer logos. */}
        <div
          data-hero-fade
          className="mx-auto mt-10 flex w-full max-w-[1400px] flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] font-medium text-[color-mix(in_srgb,var(--text-main)_55%,transparent)]"
        >
          {FORMATS.map((format) => (
            <span key={format}>{format}</span>
          ))}
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
