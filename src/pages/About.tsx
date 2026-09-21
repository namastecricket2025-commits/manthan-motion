import "@/components/about/about.css";

import BlobBackground from "@/components/BlobBackground";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { settingsRuntime } from "@/lib/app-settings";
import { ScrollTrigger, gsap, prefersReducedMotion } from "@/lib/gsap";
import { motion } from "motion/react";
import { ArrowRight, CloudUpload, GraduationCap, Quote, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------ */
/* copy — rendered exactly as supplied                                 */
/* ------------------------------------------------------------------ */

const NAME_LINES = [
  "Derived from ancient Sanskrit, Manthan (मंथन) literally denotes 'the act of vigorous churning.'",
  "Just as the painstaking churning of milk extracts the richest butter, or the monumental mythological saga of Samudra Manthan yielded invaluable hidden treasures and the ultimate elixir, our platform is engineered to help you distill the absolute essence from your data.",
  "Manthan represents the intellectual alchemy of taking chaotic, unrefined information and crystallising it into pure, actionable comprehension.",
];

const MISSION_PILLARS = [
  {
    n: "01",
    icon: CloudUpload,
    title: "Upload",
    body: "Seamlessly import your raw study materials and unstructured data.",
    side: "left",
  },
  {
    n: "02",
    icon: Wand2,
    title: "Transform",
    body: "'Churn' and transmute that data into diverse, highly digestible formats tailored dynamically to your cognitive style.",
    side: "right",
  },
  {
    n: "03",
    icon: GraduationCap,
    title: "Learn",
    body: "Master complex subjects with structured, lucid, and high-yielding knowledge.",
    side: "float",
  },
] as const;

const WHY_POINTS = [
  {
    title: "Conceived by a Student",
    body: "Engineered with an authentic, firsthand understanding of modern academic friction and pain points.",
  },
  {
    title: "Flawless Transmutation",
    body: "Eradicate hours spent manually formatting notes. Let our infrastructure handle the heavy cognitive lifting.",
  },
  {
    title: "Interactive Cognitive Aid",
    body: "Turn static, uninspiring text into dynamic assets that drastically optimize memory retention.",
  },
];

/* ------------------------------------------------------------------ */
/* motion helpers                                                      */
/* ------------------------------------------------------------------ */

/** Motionless Mode (settings) and the OS reduced-motion flag both disable motion. */
function useMotionOff() {
  return useMemo(() => settingsRuntime.reduceMotion || prefersReducedMotion(), []);
}

/**
 * Multi-axis fluid text: every word rides inside an overflow-clipped mask and
 * flies in on three axes — Y travel, X-rotation and Y-rotation — with a blur
 * burn-off, so headlines land like liquid type rather than a plain fade.
 */
function AxisText({
  segments,
  className,
}: {
  segments: { text: string; className?: string }[];
  className?: string;
}) {
  // Flatten every segment into one word list so a real, unclipped space is
  // always emitted between words — including across segment boundaries, which
  // is what keeps "About Manthan" from collapsing into "AboutManthan".
  const words = segments.flatMap((seg, si) =>
    seg.text
      .split(" ")
      .filter(Boolean)
      .map((word, wi, arr) => ({
        key: `${si}-${wi}`,
        word,
        className: seg.className,
        spaceAfter: wi < arr.length - 1 || si < segments.length - 1,
      })),
  );

  return (
    <span className={className}>
      {words.map((w) => (
        <span key={w.key} className="axis-word">
          <span
            data-axis-word
            className={`axis-word__inner${w.className ? ` ${w.className}` : ""}`}
          >
            {w.word}
            {w.spaceAfter ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Animates every `[data-axis-word]` inside the returned ref. */
function useAxisReveal<T extends HTMLElement>(mode: "load" | "scroll") {
  const ref = useRef<T | null>(null);
  const off = useMotionOff();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const words = root.querySelectorAll<HTMLElement>("[data-axis-word]");
    if (!words.length) return;

    if (off) {
      gsap.set(words, { opacity: 1, yPercent: 0, rotateX: 0, rotateY: 0, filter: "blur(0px)" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0, yPercent: 116, rotateX: -64, rotateY: 14, filter: "blur(8px)" },
        {
          opacity: 1,
          yPercent: 0,
          rotateX: 0,
          rotateY: 0,
          filter: "blur(0px)",
          duration: 1.15,
          ease: "power3.out",
          stagger: 0.05,
          delay: mode === "load" ? 0.15 : 0,
          scrollTrigger:
            mode === "scroll"
              ? { trigger: root, start: "top 84%", toggleActions: "play none none none" }
              : undefined,
        },
      );
    }, root);

    return () => ctx.revert();
  }, [mode, off]);

  return ref;
}

/* ------------------------------------------------------------------ */
/* 1 — hero                                                            */
/* ------------------------------------------------------------------ */

function AboutHero() {
  const ref = useAxisReveal<HTMLHeadingElement>("load");
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const off = useMotionOff();

  useEffect(() => {
    const el = subRef.current;
    if (!el) return;
    if (off) {
      gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 22, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power3.out", delay: 0.55 },
      );
    });
    return () => ctx.revert();
  }, [off]);

  return (
    <section className="about-hero about-shell">
      <span className="about-hero__glow" aria-hidden />
      <div className="about-hero__inner">
        <span className="kicker">About Us</span>
        <h1 ref={ref} className="about-hero__title mt-6">
          <AxisText
            segments={[{ text: "About" }, { text: "Manthan", className: "gradient-text" }]}
          />
        </h1>
        <p ref={subRef} className="about-hero__sub">
          Welcome to Manthan—where raw data is intensively processed into profound knowledge.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2 — the name (pinned left column, scrubbed right column)             */
/* ------------------------------------------------------------------ */

function NameSection() {
  const ref = useAxisReveal<HTMLHeadingElement>("scroll");
  const railRef = useRef<HTMLDivElement | null>(null);
  const off = useMotionOff();

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const lines = rail.querySelectorAll<HTMLElement>(".about-line");

    if (off) {
      gsap.set(lines, { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // Scroll scrubbing: each line lifts from 20% opacity to full vibrancy
      // exactly as it crosses the absolute vertical centre of the window.
      lines.forEach((line) => {
        gsap.fromTo(
          line,
          { opacity: 0.2 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: line, start: "top 50%", end: "bottom 50%", scrub: 0.4 },
          },
        );
      });
    }, rail);

    return () => ctx.revert();
  }, [off]);

  return (
    <section className="about-section">
      <div className="about-rule" />
      <div className="about-shell">
        <div className="about-split">
          <div className="about-split__pin">
            <span className="kicker">The name</span>
            <h2 ref={ref} className="about-split__title mt-5">
              <AxisText segments={[{ text: "The Grand Significance of Our Name" }]} />
            </h2>
          </div>

          <div ref={railRef} className="about-split__rail">
            {NAME_LINES.map((line, i) => (
              <p key={i} className="about-line">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3 — visionary mission (asymmetric parallax pillars)                 */
/* ------------------------------------------------------------------ */

function MissionSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pillarsRef = useRef<HTMLDivElement | null>(null);
  const headRef = useAxisReveal<HTMLHeadingElement>("scroll");
  const off = useMotionOff();

  useEffect(() => {
    const root = pillarsRef.current;
    const section = sectionRef.current;
    if (!root || !section) return;
    const cards = root.querySelectorAll<HTMLElement>(".about-pillar");

    if (off) {
      gsap.set(cards, { opacity: 1, xPercent: 0, yPercent: 0 });
      return;
    }

    // Fluid parallax rig — each card travels at its own speed: the left pillar
    // tracks the scroll closely, the right lags behind (heavier easing), and
    // the bottom pillar floats up on a shallower curve.
    const RIG = [
      { from: { xPercent: -28, yPercent: 6 }, start: "top 88%", end: "center 62%", scrub: 0.9 },
      { from: { xPercent: 28, yPercent: -4 }, start: "top 78%", end: "center 56%", scrub: 1.25 },
      { from: { yPercent: 24 }, start: "top 66%", end: "center 50%", scrub: 0.75 },
    ];

    const ctx = gsap.context(() => {
      cards.forEach((card, i) => {
        const rig = RIG[i] ?? RIG[0];
        gsap.fromTo(
          card,
          { ...rig.from, opacity: 0 },
          {
            xPercent: 0,
            yPercent: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: rig.start,
              end: rig.end,
              scrub: rig.scrub,
            },
          },
        );
      });
    }, root);

    return () => ctx.revert();
  }, [off]);

  return (
    <section ref={sectionRef} className="about-section">
      <div className="about-shell">
        <div className="about-mission__intro">
          <span className="kicker">The mission</span>
          <h2 ref={headRef} className="about-h2 mt-5">
            <AxisText segments={[{ text: "Our Visionary Mission" }]} />
          </h2>
          <p className="about-lede">
            In today&apos;s hyper-digital academic landscape, learners are perpetually inundated with
            overwhelming volumes of raw documentation, chaotic notes, and fragmented files. At
            Manthan, we believe that genuine education should not entail drowning in
            information—it must be about discovering profound insights.
          </p>
        </div>

        <div ref={pillarsRef} className="about-mission__grid">
          {MISSION_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.n}
                className={`about-pillar apple-glass apple-glass--lift about-pillar--${pillar.side}`}
              >
                <span className="about-pillar__index" aria-hidden>
                  {pillar.n}
                </span>
                <span className="about-pillar__icon">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="about-pillar__title">{pillar.title}</h3>
                <p className="about-pillar__body">{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4 — founder                                                         */
/* ------------------------------------------------------------------ */

function FounderSection() {
  const headRef = useAxisReveal<HTMLHeadingElement>("scroll");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bioRef = useRef<HTMLParagraphElement | null>(null);
  const off = useMotionOff();

  useEffect(() => {
    const card = cardRef.current;
    const bio = bioRef.current;
    if (!card || !bio) return;

    if (off) {
      card.classList.remove("about-pre");
      bio.classList.remove("about-pre");
      gsap.set([card, bio], { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // No `filter` tween on the glass card: a persistent `filter` (even
      // blur(0px)) turns the element into its own backdrop root and can flatten
      // the backdrop-filter. Inline styles are cleared once it lands so the
      // card returns to pure CSS glass.
      gsap.fromTo(
        card,
        { opacity: 0, y: 46, scale: 0.975 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 84%", toggleActions: "play none none none" },
          onComplete: () => {
            card.classList.remove("about-pre");
            gsap.set(card, { clearProps: "opacity,transform" });
          },
        },
      );
      gsap.fromTo(
        bio,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: bio, start: "top 90%", toggleActions: "play none none none" },
          onComplete: () => {
            bio.classList.remove("about-pre");
            gsap.set(bio, { clearProps: "opacity,transform" });
          },
        },
      );
    });
    return () => ctx.revert();
  }, [off]);

  return (
    <section className="about-section">
      <div className="about-shell">
        <div className="text-center">
          <span className="kicker">The founder</span>
          <h2 ref={headRef} className="about-h2 mt-5">
            <AxisText segments={[{ text: "Meet the Founder" }]} />
          </h2>
          <p className="mt-4 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Luv Moond - Founder &amp; Innovator
          </p>
        </div>

        <div ref={cardRef} className="about-quote apple-glass about-pre mt-[clamp(2rem,5vw,3.5rem)]">
          <span className="about-quote__glow" aria-hidden />
          <div className="about-quote__inner">
            <Quote className="mx-auto h-6 w-6 text-[var(--signal)]" aria-hidden />
            <p className="about-quote__text">
              As a student myself, I know firsthand how exhausting it is to navigate massive syllabi,
              endless notes, and rigid study formats. I engineered Manthan to bridge the gap between
              merely storing information and truly comprehending it. When we revolutionize how we
              interact with our data, we fundamentally elevate how we learn.
            </p>
          </div>
        </div>

        <p ref={bioRef} className="about-founder__bio about-pre">
          Driven by a fierce passion for technology and a determination to make studying smarter for
          peers globally, Luv Moond conceptualised and built Manthan. Recognizing that conventional
          study methods are often rigid and archaic, Luv created this platform to empower students to
          reshape text into whatever dynamic form serves their intellect best.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5 — why align with Manthan                                          */
/* ------------------------------------------------------------------ */

function WhySection() {
  const headRef = useAxisReveal<HTMLHeadingElement>("scroll");
  const off = useMotionOff();

  /** Genuine spring physics, staggered so the points land one after another. */
  const reveal = (i: number) =>
    off
      ? {}
      : {
          initial: { opacity: 0, y: 46 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.55 },
          transition: {
            type: "spring" as const,
            stiffness: 88,
            damping: 15,
            mass: 0.9,
            delay: i * 0.14,
          },
        };

  return (
    <section className="about-section about-section--last">
      <div className="about-shell">
        <div className="text-center">
          <span className="kicker">The difference</span>
          <h2 ref={headRef} className="about-h2 mt-5">
            <AxisText segments={[{ text: "Why Align with Manthan?" }]} />
          </h2>
        </div>

        <div className="about-why">
          {WHY_POINTS.map((point, i) => (
            <motion.article
              key={point.title}
              className="about-point apple-glass apple-glass--lift"
              {...reveal(i)}
            >
              <span className="about-point__n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="about-point__title">{point.title}</h3>
                <p className="about-point__body">{point.body}</p>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div className="about-badge apple-glass" {...reveal(3)}>
          <p className="about-badge__text">
            Manthan transcends being a mere utility; it is your ultimate{" "}
            <em>intellectual crucible</em>, converting dense study materials into the nectar of
            academic triumph.
          </p>
        </motion.div>

        <div className="mt-[clamp(2.5rem,6vw,4rem)] flex justify-center">
          <MovingBorderButton
            to="/dashboard"
            className="glass-cta"
            innerClassName="px-7 py-3.5 text-sm"
          >
            Start churning
            <ArrowRight className="h-4 w-4" />
          </MovingBorderButton>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function About() {
  // Inertia scroll dampening for this view (reduced motion → native scroll).
  useSmoothScroll(!settingsRuntime.reduceMotion);

  // Scrubbed triggers need fresh measurements once layout and webfonts settle.
  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 140);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BlobBackground />
      <div className="relative z-10">
        <Navbar />
        <main className="about-root">
          <AboutHero />
          <NameSection />
          <MissionSection />
          <FounderSection />
          <WhySection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
