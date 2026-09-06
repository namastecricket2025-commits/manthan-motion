import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { useEffect, useRef } from "react";

const STATS = [
  { value: 24500, suffix: "+", label: "Study materials generated" },
  { value: 118000, suffix: "+", label: "Flashcards & question banks" },
  { value: 92, suffix: "%", label: "Report faster revision" },
];

export default function Stats() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nums = root.querySelectorAll<HTMLElement>("[data-num]");

    if (prefersReducedMotion()) {
      nums.forEach((el) => {
        el.textContent = (el.dataset.value ?? "0") + (el.dataset.suffix ?? "");
      });
      return;
    }

    const ctx = gsap.context(() => {
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
      nums.forEach((el) => {
        const target = Number(el.dataset.value ?? 0);
        const suffix = el.dataset.suffix ?? "";
        const state = { v: 0 };
        gsap.to(state, {
          v: target,
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: root, start: "top 82%", toggleActions: "play none none none" },
          onUpdate: () => {
            el.textContent = Math.round(state.v).toLocaleString("en-US") + suffix;
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20"
    >
      <div
        data-reveal
        className="glass-panel grid grid-cols-3 divide-x divide-[var(--card-border)] px-2 py-8 sm:px-8 md:py-10"
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="px-2 text-center sm:px-6">
            <p className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px]">
              <span data-num data-value={stat.value} data-suffix={stat.suffix}>
                0
              </span>
            </p>
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-text-dim sm:text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}