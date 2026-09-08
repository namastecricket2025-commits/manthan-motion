import { gsap, prefersReducedMotion, refreshOnLoad, revealConfig } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarClock,
  Layers,
  ListChecks,
  NotebookPen,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Notebooks — the shelf of study kits, dressed in the same glass language as
 * the dashboard: one card per notebook with a progress bar, kind chips and
 * freshness stamp.
 *
 * Motion:
 * - Scroll-triggered staggered entrance (GSAP) with a gentle per-card sway.
 * - Progress bars draw in (scaleX) when the section scrolls into view.
 * - Pointer devices only: cards tilt in 3D toward the cursor with spring
 *   smoothing. Touch keeps the flat, tap-friendly card with a press scale.
 */
const NOTEBOOKS = [
  {
    title: "Thermodynamics — Ch 4",
    subject: "Physics · JEE",
    progress: 75,
    meta: "18/24 flashcards",
    when: "updated today",
    accent: "var(--signal)",
  },
  {
    title: "Organic reactions overview",
    subject: "Chemistry · NEET",
    progress: 60,
    meta: "6 summaries",
    when: "updated yesterday",
    accent: "var(--signal-2)",
  },
  {
    title: "Electrostatics question bank",
    subject: "Physics",
    progress: 90,
    meta: "12 questions",
    when: "updated 2 days ago",
    accent: "#b97750",
  },
  {
    title: "Mughal history — notes",
    subject: "History · UPSC",
    progress: 45,
    meta: "5 summaries",
    when: "updated 4 days ago",
    accent: "var(--signal)",
  },
  {
    title: "Cell biology crash kit",
    subject: "Biology · NEET",
    progress: 80,
    meta: "30 flashcards",
    when: "updated 3 days ago",
    accent: "#7d8f78",
  },
  {
    title: "Statistics for boards",
    subject: "Maths · Boards",
    progress: 55,
    meta: "15 questions",
    when: "updated 1 week ago",
    accent: "var(--signal-2)",
  },
] as const;

function KindChip({ children }: { children: ReactNode }) {
  return (
    <span className="glass-chip px-2.5 py-0.5 text-[10px] font-semibold text-[var(--signal)]">
      {children}
    </span>
  );
}

/**
 * Pointer-only 3D tilt: rotateX/rotateY follow the cursor with spring
 * smoothing, plus a soft highlight that glides with it. Disabled entirely on
 * touch — the card stays flat and simply presses on tap.
 */
function TiltCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canTilt, setCanTilt] = useState(false);

  useEffect(() => {
    setCanTilt(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 18, mass: 0.6 };
  const rx = useSpring(useTransform(my, [0, 1], [7, -7]), spring);
  const ry = useSpring(useTransform(mx, [0, 1], [-7, 7]), spring);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };

  const reset = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={canTilt ? onMove : undefined}
      onMouseLeave={canTilt ? reset : undefined}
      whileTap={canTilt ? undefined : { scale: 0.985 }}
      // transformPerspective puts the depth directly on the transform, so the
      // card's own rotation reads in 3D without needing perspective on an
      // ancestor.
      style={
        canTilt
          ? { rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" }
          : undefined
      }
      className={cn("relative will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}

export default function Notebooks() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>("[data-notebook-card]");
    const bars = root.querySelectorAll<HTMLElement>("[data-progress]");
    const heading = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set([...cards, ...bars, ...heading], { opacity: 1, y: 0, scale: 1, scaleX: 1 });
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

      // Cards sway in from alternating sides — a small rotation per card so
      // the grid feels alive rather than a uniform block.
      gsap.fromTo(
        cards,
        { opacity: 0, y: 34, scale: 0.97, rotateY: -4 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateY: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          transformOrigin: "center",
          scrollTrigger: { trigger: root, start: "top 78%", toggleActions: "play none none none" },
        },
      );

      // Progress bars draw in after their card lands.
      gsap.fromTo(
        bars,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          ease: "power2.out",
          stagger: 0.09,
          delay: 0.35,
          transformOrigin: "left center",
          scrollTrigger: { trigger: root, start: "top 78%", toggleActions: "play none none none" },
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
      id="notebooks"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <span className="kicker">Notebooks</span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
          Every study kit,{" "}
          <span className="gradient-text">one shelf</span>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-dim">
          Notebooks keep every generated kit organised by subject — track how
          far you've drilled into each one and pick up exactly where you left
          off.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 min-[900px]:grid-cols-3">
        {NOTEBOOKS.map((nb) => (
          <TiltCard key={nb.title}>
            <article
              data-notebook-card
              className="feature-card glass-panel flex h-full flex-col p-6 will-change-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
                  <NotebookPen className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-1.5">
                  <KindChip>
                    {nb.meta.split(" ")[1] === "flashcards"
                      ? "Flashcards"
                      : nb.meta.split(" ")[1] === "summaries"
                        ? "Summary"
                        : "Questions"}
                  </KindChip>
                  <span className="glass-chip px-2.5 py-0.5 text-[10px] font-semibold text-text-dim">
                    {nb.subject}
                  </span>
                </div>
              </div>

              <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-foreground">
                {nb.title}
              </h3>

              {/* Progress: drawn in by GSAP when the section scrolls into view */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-text-dim">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" />
                    {nb.meta}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {nb.progress}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--card-border)]">
                  <div
                    data-progress
                    className="h-full w-full rounded-full"
                    style={{ background: nb.accent }}
                  />
                </div>
              </div>

              <div className="mt-auto flex items-center gap-1.5 pt-5 text-[11px] font-medium text-text-dim">
                <CalendarClock className="h-3.5 w-3.5" />
                {nb.when}
              </div>
            </article>
          </TiltCard>
        ))}
      </div>

      {/* Freshness legend strip */}
      <div
        data-reveal
        className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-medium text-text-dim"
      >
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[var(--signal)]" />
          Flashcard sets
        </span>
        <span className="inline-flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--signal-2)]" />
          Summaries &amp; question banks
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#b97750]" />
          Freshness stamped per kit
        </span>
      </div>
    </section>
  );
}