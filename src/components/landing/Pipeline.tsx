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
  const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

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
        clearProps: "transform",
      });
      return;
    }

    const ctx = gsap.context(() => {
      // Entrance reveal for the heading block (the cards get their own
      // scroll-driven glide below, so they are excluded here).
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-reveal]:not(.how-card)"),
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
            // Scroll-delta glide: every card still waiting on the right of the
            // viewport axis carries a horizontal offset that decays to zero as
            // it reaches the focus line, so the row reads as a track sliding
            // right-to-left under the pointer. The focused card also lifts
            // (scale + shadow); cards already passed sit clean at rest.
            const x = gsap.getProperty(track, "x") as number;
            const center = viewport.clientWidth / 2 - x;
            for (const card of cards) {
              const cardCenter = card.offsetLeft + card.offsetWidth / 2;
              const ahead = (cardCenter - center) / (card.offsetWidth * 1.5);
              const t = Math.min(1, Math.max(0, ahead));
              const ease = t * t; // ease-out: the glide settles as it lands
              const scale = 1 + 0.06 * (1 - Math.min(1, Math.abs(cardCenter - center) / (card.offsetWidth * 0.85)));
              card.style.transform =
                `translate3d(${(64 * ease).toFixed(2)}px, ${(10 * ease).toFixed(2)}px, 0) ` +
                `scale(${scale.toFixed(4)})`;
              card.style.opacity = (1 - 0.22 * t).toFixed(3);
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

      // Layout stability on viewport change: when the window resizes, the
    // pinned section's end distance changes; ScrollTrigger's own refresh can
    // briefly desync on mobile (where the URL bar shows/hides mid-scroll).
    // On resize we invalidate the existing ScrollTrigger, let refresh
    // recompute the pin span, then restore scroll position relative to the
    // viewport so the track doesn't jump.
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 120);
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
          <h2 className="text-fade font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
            One pipeline:{" "}
            <span className="gradient-text">five guided steps</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-dim">
            Keep scrolling — the cards glide as you go, from raw notes to a
            finished study kit.
          </p>
        </div>
      </div>

      {/* Pinned viewport: full-bleed, cards glide horizontally.
          min-h keeps it tall enough on short screens; on mobile the
          horizontal glide is the focus, so padding is tighter. */}
      <div
        ref={viewportRef}
        className="how-sticky relative mt-10 h-[68svh] min-h-[400px] w-full overflow-hidden md:mt-16"
      >
        {/* scrub progress line — brand crimson, because it reports progress
            rather than ornamenting the section. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 mx-auto block h-[2px] w-full max-w-6xl bg-[var(--card-border)]"
        >
          <span
            ref={progressRef}
            className="block h-full w-full origin-left bg-[var(--brand)]"
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
                {/* Brand crimson on the tile, the number and the rule.

                    These three carried `--signal`, which is the theme's LIGHT
                    — white in dark — so as soon as the theme went dark the
                    card lost every trace of the product's colour and read as
                    a grey box with a white icon in it. `--brand` is the same
                    crimson in both themes (lifted for black), so the card has
                    an identity to look at that is not just brightness. */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-bold tracking-tight text-[color-mix(in_srgb,var(--brand)_72%,transparent)]">
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
              <span className="mt-8 h-0.5 w-12 rounded-full bg-[var(--brand)] opacity-80" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
