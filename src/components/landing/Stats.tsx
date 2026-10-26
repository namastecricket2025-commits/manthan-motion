import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { useLayoutEffect, useRef } from "react";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * One figure, counted the way a mechanical counter counts it.
 *
 * Each decimal place is its own wheel: the ones wheel turns fastest, the tens
 * wheel only catches up when the ones wheel rolls past 9, and so on. That is
 * why a two-digit number reads as two digits rolling rather than a value
 * flickering — and why the effect survives a fast scroll instead of finishing
 * before the rail is on screen.
 *
 * Pace follows magnitude the way the eye expects: a single digit has room to
 * tick over slowly, while a three-digit figure would look stuck at the same
 * rate — so duration grows only logarithmically and the *speed* (digits per
 * second) rises with the number. Every place shares one tween, so the wheels
 * can never drift out of step with each other.
 */
function RollingNumber({ value }: { value: number }) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const strips = useRef<Array<HTMLSpanElement | null>>([]);
  const places = String(value).length;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cols = strips.current.filter((el): el is HTMLSpanElement => Boolean(el));
    if (cols.length === 0) return;

    // Where each wheel sits for a running value. `place` is the value of one
    // unit of that wheel (1, 10, 100…), so one full turn of the wheel is ten
    // units of its own place.
    const paint = (running: number) => {
      cols.forEach((col, index) => {
        const place = Math.pow(10, cols.length - 1 - index);
        const turns = running / place / 10;
        const offset = (turns % 1) * 10;
        col.style.transform = `translate3d(0, ${-offset}em, 0)`;
      });
    };

    if (prefersReducedMotion()) {
      paint(value);
      return;
    }

    paint(0);
    const state = { running: 0 };

    /* Each figure owns its own trigger, and the trigger is the figure itself.

       This used to fire off the whole section at `top 85%`, which is the
       heading's entry — the rail of numbers sits a few hundred pixels below
       that, so the roll had already finished while the numbers were still
       under the fold. The arithmetic was right and nobody could see it. A
       figure now starts counting when the figure is on screen, and the roll
       lasts long enough (≈2s, growing with the magnitude) to read as a count
       rather than a snap. */
    const tween = gsap.to(state, {
      running: value,
      duration: 1.7 + Math.log10(value + 1) * 0.4,
      ease: "power2.out",
      onUpdate: () => paint(state.running),
      scrollTrigger: {
        trigger: root,
        start: "top 75%",
        toggleActions: "play none none none",
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={rootRef} className="inline-flex tabular-nums" aria-hidden="true">
      {Array.from({ length: places }, (_, index) => (
        <span
          key={index}
          className="inline-block overflow-hidden"
          style={{ height: "1em", lineHeight: 1 }}
        >
          <span
            ref={(el) => {
              strips.current[index] = el;
            }}
            className="flex flex-col will-change-transform"
          >
            {DIGITS.map((digit) => (
              <span key={digit} style={{ height: "1em", lineHeight: 1 }}>
                {digit}
              </span>
            ))}
            {/* The wrap row: at 9.6 the wheel is already showing the head of
                the next revolution rather than a blank edge. */}
            <span style={{ height: "1em", lineHeight: 1 }}>0</span>
          </span>
        </span>
      ))}
    </span>
  );
}

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
                {/* The figure itself, on rolling wheels; the real value stays
                    in the tree for search engines and screen readers. */}
                <span className="sr-only">{stat.value}</span>
                <RollingNumber value={stat.value} />
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
