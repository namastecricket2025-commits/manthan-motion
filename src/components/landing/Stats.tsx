import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { useLayoutEffect, useRef } from "react";

/**
 * The numbers, as one panel of receipts rather than six matching cards.
 *
 * Six identical boxes with an icon on top is the shape that reads as filler
 * however good the numbers are — and these numbers are the least decorative
 * thing on the page, so they get the treatment a spec table gets: one surface,
 * hairline dividers, and the value set large enough to scan down the column.
 * The dividers are painted by `.receipt-rail`'s 1px gap over a hairline
 * background, so cells meet on a single line rather than a doubled border.
 *
 * Every figure is a fact the product holds somewhere else: the eight formats
 * it accepts, the five steps, the 60,000-token daily free allowance from
 * `src/lib/plans.ts`, the citation rule. There are no invented user counts —
 * a landing page with no customers cannot quote one.
 */
const STATS: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  body: string;
}[] = [
  {
    value: 8,
    label: "Formats it reads",
    body: "PDF, DOCX, PPTX, TXT, Markdown, HTML, EPUB and images — photos of handwritten notes included.",
  },
  {
    value: 60,
    prefix: "<",
    suffix: "s",
    label: "To a full study kit",
    body: "The five steps run end to end on a chapter-sized document, reporting status as they go.",
  },
  {
    value: 100,
    suffix: "%",
    label: "Cited output",
    body: "Every card, question and summary keeps a pointer back to the passage it was written from.",
  },
  {
    value: 5,
    label: "Pipeline steps",
    body: "Parse, summarise, structure, distill, deliver — the same five on every run, in that order.",
  },
  {
    value: 60,
    suffix: "k",
    label: "Free tokens a day",
    body: "The free plan's daily allowance, with the whole notebook workspace open on it and no card.",
  },
];

export default function Stats() {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return; // final values are already rendered in the JSX
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );

      // Count-up, once, on the way in. Duration scales with the number's
      // magnitude so a single digit lands quickly and a three-digit value
      // sweeps without dragging.
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-count]"),
        { textContent: 0 },
        {
          textContent: (_i: number, el: unknown) =>
            Number((el as HTMLElement).dataset.count ?? 0),
          duration: (_i: number, el: unknown) => {
            const digits = String(Number((el as HTMLElement).dataset.count ?? 0)).length;
            return 0.6 + digits * 0.28;
          },
          ease: "power2.out",
          snap: { textContent: 1 },
          stagger: 0.1,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="stats"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-16 md:py-24"
    >
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]">
          Numbers that <span className="gradient-text">matter</span> to your
          revision
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim">
          No vanity metrics — just the concrete facts of how Manthan turns your
          notes into a ready-to-revise study kit.
        </p>
      </div>

      <div
        data-reveal
        className="glass-panel card-surface mt-12 overflow-hidden md:mt-16"
      >
        <div className="receipt-rail grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-[var(--panel)] p-6">
              <div className="flex items-baseline gap-0.5 font-display text-[38px] font-normal leading-none tracking-[-0.03em] tabular-nums text-foreground">
                {stat.prefix ? (
                  <span className="text-[26px] text-text-dim">{stat.prefix}</span>
                ) : null}
                {/* Final value rendered in the markup (SEO and no-JS); GSAP
                    counts it up from zero when the rail scrolls into view. */}
                <span data-count={stat.value}>{stat.value}</span>
                {stat.suffix ? (
                  <span className="text-[26px] text-text-dim">{stat.suffix}</span>
                ) : null}
              </div>
              <h3 className="mt-4 text-[15px] font-medium tracking-[-0.01em] text-foreground">
                {stat.label}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{stat.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
