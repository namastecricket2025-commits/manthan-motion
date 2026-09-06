import {
  gsap,
  prefersReducedMotion,
  refreshOnLoad,
  revealConfig,
  ScrollTrigger,
} from "@/lib/gsap";
import { FileUp, ListChecks, Network, Layers, PackageCheck } from "lucide-react";
import { useEffect, useRef } from "react";

const STEPS = [
  {
    icon: FileUp,
    num: "01",
    title: "Parse",
    desc: "Files, links and pasted notes are cleaned into plain text — sources stay visible in the queue the whole time.",
  },
  {
    icon: ListChecks,
    num: "02",
    title: "Summarise",
    desc: "Core ideas are condensed into a crisp outline, flagging the concepts worth drilling.",
  },
  {
    icon: Network,
    num: "03",
    title: "Structure",
    desc: "Material is organised by chapter, topic and weight so the mix knows what to emphasise.",
  },
  {
    icon: Layers,
    num: "04",
    title: "Distill",
    desc: "Summaries, flashcards, question banks and concept maps are generated from the structured outline.",
  },
  {
    icon: PackageCheck,
    num: "05",
    title: "Deliver",
    desc: "A study kit lands in your dashboard — every card labelled, every source cited back to the original.",
  },
];

/**
 * "How it works" — the original sticky, horizontally-scrolling card track:
 * the section pins while the cards glide left as the user scrolls down, with
 * a gentle center-focus scale on whichever card is nearest the viewport
 * center. Fires once; fully static (native overflow scroll) when reduced
 * motion is preferred.
 */
export default function Pipeline() {
  const ref = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!root || !viewport || !track) return;

    const cards = Array.from(track.querySelectorAll<HTMLElement>(".how-card"));
    const reduced = prefersReducedMotion();

    if (reduced) {
      // Accessible fallback: native horizontal scroll, no pin, no scrub.
      viewport.style.overflowX = "auto";
      gsap.set([...cards, ...root.querySelectorAll("[data-reveal]")], {
        opacity: 1,
        y: 0,
        scale: 1,
      });
      return;
    }

    const ctx = gsap.context(() => {
      // Entrance reveal for the heading block
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-reveal]"),
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );

      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: viewport,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          start: "top top",
          end: () => `+=${distance() * 1.15}`,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Center-focus scaling: the card nearest the viewport center
            // scales up slightly; neighbours ease back down.
            const x = gsap.getProperty(track, "x") as number;
            const center = viewport.clientWidth / 2 - x;
            for (const card of cards) {
              const cardCenter = card.offsetLeft + card.offsetWidth / 2;
              const delta = Math.abs(center - cardCenter);
              const t = Math.min(1, delta / (card.offsetWidth * 0.85));
              card.style.transform = `scale(${(1 + 0.06 * (1 - t)).toFixed(4)})`;
            }
            if (progressRef.current) {
              progressRef.current.style.transform = `scaleX(${self.progress.toFixed(4)})`;
            }
          },
        },
        defaults: { ease: "none" },
      });

      tl.fromTo(
        track,
        { x: 0 },
        { x: () => -distance(), duration: 1 },
        0,
      );

      tlRef.current = tl;
    }, root);

    // Mobile browsers hide/show the URL bar while scrolling, which fires
    // resize events. ScrollTrigger's auto-refresh-on-resize re-measures and
    // re-pins mid-scroll, visibly jumping the track. Instead: snap the pinned
    // animation to its end (which un-pins the section), then refresh and
    // restore the exact progress once the viewport settles.
    let resizeTimer: number | undefined;
    let savedProgress: number | null = null;
    const onResize = () => {
      const tl = tlRef.current;
      if (!tl) return;
      const st = tl.scrollTrigger;
      if (!st) return;
      if (savedProgress === null) {
        savedProgress = st.progress;
        tl.pause();
        st.animation?.progress(1); // un-pins the section
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        if (savedProgress !== null) {
          st.animation?.progress(savedProgress);
          savedProgress = null;
        }
        tl.play();
      }, 220);
    };
    window.addEventListener("resize", onResize);

    const stopRefresh = refreshOnLoad();
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      ctx.revert();
      stopRefresh();
    };
  }, []);

  return (
    <section
      id="how"
      ref={ref}
      className="relative scroll-mt-24 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <span className="kicker">How it works</span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
            One pipeline,{" "}
            <span className="gradient-text">five guided steps</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-dim">
            Keep scrolling — the cards glide as you go, from raw notes to a
            finished study kit.
          </p>
        </div>
      </div>

      {/* Pinned viewport: full-bleed, cards glide horizontally */}
      <div
        ref={viewportRef}
        className="how-sticky relative mt-12 h-[72svh] min-h-[430px] w-full overflow-hidden md:mt-16"
      >
        {/* scrub progress line */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 mx-auto block h-[2px] w-full max-w-6xl bg-[var(--card-border)]"
        >
          <span
            ref={progressRef}
            className="block h-full w-full origin-left bg-[var(--signal)]"
            style={{ transform: "scaleX(0)" }}
          />
        </span>

        <div ref={trackRef} className="how-track h-full items-center">
          {STEPS.map((step) => (
            <article
              key={step.num}
              data-reveal
              className="how-card glass-panel flex flex-col justify-between p-6 will-change-transform sm:p-8"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-bold tracking-tight text-[color-mix(in_srgb,var(--signal)_38%,transparent)]">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-dim sm:text-base">
                  {step.desc}
                </p>
              </div>
              <span className="mt-8 h-0.5 w-12 rounded-full bg-[var(--signal)] opacity-70" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
