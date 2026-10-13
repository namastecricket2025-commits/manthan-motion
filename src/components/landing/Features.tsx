import { gsap, prefersReducedMotion, refreshOnLoad, revealConfig } from "@/lib/gsap";
import {
  BarChart3,
  FileUp,
  Layers,
  Smartphone,
  SunMoon,
  Workflow,
} from "lucide-react";
import { useEffect, useRef } from "react";

const FEATURES = [
  {
    icon: FileUp,
    title: "Source anything",
    body: "Drop in PDFs, slides, pasted notes or a link — the upload queue keeps every source visible and removable before you generate.",
  },
  {
    icon: Workflow,
    title: "Five-step pipeline",
    body: "Every generation runs a guided pipeline you can watch: parse, summarise, structure, distill and deliver — live status at every step.",
  },
  {
    icon: Layers,
    title: "Material mix",
    body: "Get the mix you choose — summaries, flashcards, question banks and concept maps, weighted per chapter or topic.",
  },
  {
    icon: BarChart3,
    title: "Study activity",
    body: "Weekly activity bars and a material-mix donut keep streaks and coverage visible at a glance, on any screen.",
  },
  {
    icon: Smartphone,
    title: "Made for your phone",
    body: "Off-canvas navigation, stacked cards and a 60fps background tuned for mid-range devices — most traffic happens here.",
  },
  {
    icon: SunMoon,
    title: "Night & day themes",
    body: "Both themes are built from the same design tokens — ink, signal and text — so the app looks intentional in either.",
  },
];

export default function Features() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>("[data-card]");
    const heading = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set([...cards, ...heading], { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        heading,
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
      gsap.fromTo(
        cards,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: { trigger: root, start: "top 80%", toggleActions: "play none none none" },
        },
      );
    }, root);

    const stopRefresh = refreshOnLoad();
    return () => {
      ctx.revert();
      stopRefresh();
    };
  }, []);

  return (
    <section
      id="features"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <span className="kicker">Why Manthan</span>
        <h2 className="text-fade mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
          Everything you need to go from{" "}
          <span className="gradient-text">notes</span> to study material
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-dim">
          One upload queue, one guided pipeline, and a study kit that matches
          how you revise — summaries when you're scanning, flashcards when
          you're drilling.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 min-[900px]:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            data-card
            className="feature-card glass-panel p-6 will-change-transform"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-foreground">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              {feature.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

