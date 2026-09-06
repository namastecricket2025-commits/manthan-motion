import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import {
  Coins,
  FileStack,
  Gauge,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Realistic Manthan facts (no invented user metrics):
 * - 8 file formats — PDF, DOCX, PPTX, TXT, MD, HTML, EPUB, images (OCR)
 * - <60s generation — the five-step pipeline finishes inside a minute
 * - 100% citations — every flashcard/question cites its source passage
 * - 5 pipeline steps — parse, summarise, structure, distill, deliver
 * - ₹0 upfront cost — free while in beta, no card required
 * - 24/7 availability — the pipeline is always awake
 */
const STATS = [
  {
    icon: FileStack,
    value: 8,
    suffix: "",
    label: "File formats",
    body: "PDF, DOCX, PPTX, TXT, MD, HTML, EPUB and images — drop in any of them.",
  },
  {
    icon: Timer,
    value: 60,
    prefix: "<",
    suffix: "s",
    label: "To a full study kit",
    body: "The five-step pipeline finishes before your chai cools.",
  },
  {
    icon: ShieldCheck,
    value: 100,
    suffix: "%",
    label: "Source citations",
    body: "Every flashcard and question traces back to the exact passage it came from.",
  },
  {
    icon: Sparkles,
    value: 5,
    suffix: "",
    label: "Pipeline steps",
    body: "Parse, summarise, structure, distill, deliver — live status at every step.",
  },
  {
    icon: Coins,
    value: 0,
    prefix: "₹",
    label: "Upfront cost",
    body: "Free while in beta. No card, no trial timer, no locked features.",
  },
  {
    icon: Gauge,
    value: 24,
    suffix: "/7",
    label: "Study support",
    body: "Late-night cramming session? Manthan's pipeline is always awake.",
  },
] as const;

export default function Stats() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return; // final values are already rendered in the JSX
    }

    const ctx = gsap.context(() => {
      // Card + heading entrance
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

      // Count-up. Duration scales with the number's magnitude: a 1-digit
      // value counts in a tight, snappy window; a 3-digit value sweeps fast
      // per digit so it feels weighty without dragging on.
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-count]"),
        { textContent: 0 },
        {
          textContent: (i: number, el: unknown) =>
            Number((el as HTMLElement).dataset.count ?? 0),
          duration: (i: number, el: unknown) => {
            const digits = String(
              Number((el as HTMLElement).dataset.count ?? 0),
            ).length;
            return 0.7 + digits * 0.3;
          },
          ease: "power2.out",
          snap: { textContent: 1 },
          stagger: 0.12,
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
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 md:py-20"
    >
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <span className="kicker">What Manthan does</span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
          Numbers that <span className="gradient-text">matter</span> to your
          revision
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-dim">
          No vanity metrics — just the concrete facts of how Manthan turns your
          notes into a ready-to-revise study kit.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 min-[900px]:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            data-reveal
            className="feature-card glass-panel p-6 text-center sm:text-left"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
              <stat.icon className="h-5 w-5" />
            </span>
            <div className="mt-5 font-display text-4xl font-bold tracking-tight text-foreground">
              {"prefix" in stat && stat.prefix ? (
                <span className="mr-0.5 text-3xl text-text-dim">{stat.prefix}</span>
              ) : null}
              {/* Final value rendered server-side (SEO / no-JS); GSAP counts
                  it up from 0 when the section scrolls into view. */}
              <span data-count={stat.value}>{stat.value}</span>
              {"suffix" in stat && stat.suffix ? (
                <span className="text-2xl text-text-dim">{stat.suffix}</span>
              ) : null}
            </div>
            <h3 className="mt-2 font-display text-lg font-bold tracking-tight text-foreground">
              {stat.label}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">{stat.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
