import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { useEffect, useRef } from "react";

/**
 * No real usage data exists yet, so this section states qualitative
 * strengths instead of invented metrics (revision prompt §1.4). When real
 * figures are available, swap each entry for { value, suffix, label } and
 * restore the GSAP count-up that used to live here.
 */
const STATS = [
  {
    title: "A pipeline you can watch",
    body: "Parse, summarise, structure, distill, deliver — live status at every step, so you always know what's happening to your notes.",
  },
  {
    title: "Built for the phone",
    body: "Off-canvas navigation, stacked cards and an ambient background tuned for mid-range devices. Study happens on the go — so does Manthan.",
  },
  {
    title: "Labelled and cited",
    body: "Every flashcard and question is labelled by topic and traced back to the source it came from — no mystery material, ever.",
  },
];

export default function Stats() {
  const ref = useRef<HTMLElement | null>(null);

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
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <span className="kicker">What Manthan does</span>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 md:mt-12">
        {STATS.map((item) => (
          <div
            key={item.title}
            data-reveal
            className="glass-panel p-6 text-center sm:text-left"
          >
            <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
