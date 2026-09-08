import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import {
  BookOpen,
  CalendarClock,
  Layers,
  ListChecks,
  Plus,
  NotebookPen,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const NOTEBOOKS = [
  {
    title: "Thermodynamics — Ch 4",
    subject: "Physics · JEE",
    progress: 75,
    meta: "18 flashcards",
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
    setCanTilt(
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
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
      style={
        canTilt
          ? {
              rotateX: rx,
              rotateY: ry,
              transformPerspective: 900,
              transformStyle: "preserve-3d",
            }
          : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

function NotebookRow({ nb }: { nb: (typeof NOTEBOOKS)[number] }) {
  return (
    <TiltCard>
      <article className="feature-card glass-panel flex flex-col gap-4 p-5 sm:p-6">
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

        <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
          {nb.title}
        </h3>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-text-dim">
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              {nb.meta}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {nb.progress}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card-border)]">
            <div
              className="h-full w-full rounded-full"
              style={{ background: nb.accent }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-dim">
          <CalendarClock className="h-3.5 w-3.5" />
          {nb.when}
        </div>
      </article>
    </TiltCard>
  );
}

export default function NotebooksSection({
  showHeader = true,
}: {
  /** Page-level headers (e.g. the dashboard tab) render their own title + CTA. */
  showHeader?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>("[data-notebook-card]");
    const bars = root.querySelectorAll<HTMLElement>("[data-progress]");
    const heading = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set(
        [...cards, ...bars, ...heading],
        { opacity: 1, y: 0, scale: 1, scaleX: 1 },
      );
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
          scrollTrigger: {
            trigger: root,
            start: "top 78%",
            toggleActions: "play none none none",
          },
        },
      );

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
          scrollTrigger: {
            trigger: root,
            start: "top 78%",
            toggleActions: "play none none none",
          },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="glass-panel overflow-hidden px-5 py-6 sm:px-6 sm:py-8"
    >
      {showHeader ? (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold tracking-tight">
              Notebooks
            </h2>
            <p className="mt-1 text-xs text-text-dim">
              Every generated kit, organised by subject.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-transparent px-3.5 py-2 text-[11px] font-semibold text-foreground transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
          >
            <Plus className="h-3.5 w-3.5" />
            New notebook
          </button>
        </div>
      ) : null}

      <div
        className={
          "grid grid-cols-1 gap-4 min-[760px]:grid-cols-2" +
          (showHeader ? " mt-5" : "")
        }
      >
        {NOTEBOOKS.map((nb) => (
          <NotebookRow key={nb.title} nb={nb} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-text-dim border-t border-[var(--card-border)] pt-4">
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--signal)]" />
          Flashcard sets
        </span>
        <span className="inline-flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[var(--signal-2)]" />
          Summaries &amp; question banks
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-[#b97750]" />
          Freshness stamped per kit
        </span>
      </div>
    </section>
  );
}
