import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { api } from "@/convex/_generated/api";
import { useResolvedTheme } from "@/lib/app-settings";
import {
  revealVariants,
  STILL,
  useSpringTransition,
  useStagger,
  useStillMotion,
} from "@/lib/motion";
import { usePlan } from "@/components/plans/PlanProvider";
import { getTier } from "@/lib/plans";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock,
  FileText,
  Gauge,
  NotebookPen,
  Play,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { Link } from "react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * The workspace overview.
 *
 * Everything on this screen is derived from rows the signed-in user actually
 * created — there is no seeded or sample content anywhere. The screen reads
 * as a bento of isolated frosted blocks:
 *
 *   1. "Pick up where you left off"  the focal block: the notebook last worked
 *      in, its real chapter name, its real completion timeline and the action
 *      that opens it.
 *   2. four metric tiles            real counts, no invented denominators.
 *   3. the allowance line           used-of-total, in absolute numbers, taken
 *      from the same ledger the generation engine writes.
 *   4. the seven-day wave           a hand-drawn SVG spline that morphs
 *      between real states on the chart spring (120/18, the vendored bklit
 *      chart motion), on a blurred glass panel.
 *
 * Every block arrives on the shared spring.
 */

export type DashboardSummary = {
  notebookCount: number;
  sourceCount: number;
  fileCount: number;
  linkCount: number;
  notesCount: number;
  readableCount: number;
  failedCount: number;
  addedThisWeek: number;
  sourcesPrevWeek: number;
  materialsThisWeek: number;
  materialsPrevWeek: number;
  activeNotebook: { id: string; name: string; materialCount: number } | null;
  materialsByKind: Record<string, number>;
  materialsByDay: {
    day: string;
    label: string;
    summary: number;
    flashcards: number;
    quiz: number;
    mindmap: number;
    slides: number;
  }[];
  byDay: { day: string; label: string; count: number }[];
};

/** The fields of `api.notebooks.list` this screen needs. */
export type DashboardNotebook = {
  id: string;
  name: string;
  createdAt: number;
  sourceCount: number;
  fileCount: number;
  linkCount: number;
  materialCount: number;
  lastActivityAt: number;
};

const MATERIAL_KINDS = ["summary", "flashcards", "quiz", "mindmap", "slides"] as const;

const MATERIAL_LABELS: Record<(typeof MATERIAL_KINDS)[number], string> = {
  summary: "Summaries",
  flashcards: "Flashcards",
  quiz: "Quizzes",
  mindmap: "Mind maps",
  slides: "Slides",
};

type ActivityPoint = { label: string; materials: number; sources: number };

/** "today", "yesterday", "4 days ago" — plain words, from a real timestamp. */
function timeAgo(timestamp: number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "a month ago" : `${months} months ago`;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * Concrete chart colours.
 *
 * Recharts writes colours as SVG presentation attributes, and `var(--token)`
 * is not reliably honoured there — so the theme tokens are read once per theme
 * as real colour strings instead of being trusted inside the SVG.
 */
function useChartInk() {
  const theme = useResolvedTheme();
  return useMemo(() => {
    const fallback =
      theme === "dark"
        ? {
            label: "rgba(255, 255, 255, 0.9)",
            grid: "rgba(255, 255, 255, 0.12)",
            primary: "#8b93ff",
            secondary: "#5eead4",
            frostTop: "rgba(255, 255, 255, 0.15)",
            frostBottom: "rgba(255, 255, 255, 0)",
          }
        : {
            label: "#333f4b",
            grid: "rgba(36, 20, 18, 0.14)",
            primary: "#c81f27",
            secondary: "#2f6f6b",
            frostTop: "rgba(36, 20, 18, 0.16)",
            frostBottom: "rgba(36, 20, 18, 0)",
          };
    if (typeof document === "undefined") return fallback;
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, value: string) =>
      styles.getPropertyValue(name).trim() || value;
    return {
      label: read("--dash-chart-label", fallback.label),
      grid: read("--dash-chart-grid", fallback.grid),
      primary: read("--dash-series-primary", fallback.primary),
      secondary: read("--dash-series-secondary", fallback.secondary),
      frostTop: read("--dash-frost-top", fallback.frostTop),
      frostBottom: read("--dash-frost-bottom", fallback.frostBottom),
    };
  }, [theme]);
}

/* ------------------------------------------------------------------ */
/* 1. Pick up where you left off                                       */
/* ------------------------------------------------------------------ */

function ResumeBlock({
  notebook,
  onResume,
}: {
  notebook: DashboardNotebook;
  onResume: (notebookId: string) => void;
}) {
  const transition = useSpringTransition();
  const sourcesReady = notebook.sourceCount > 0;
  const materialReady = notebook.materialCount > 0;
  const steps = [
    {
      label: "Sources in",
      detail: sourcesReady
        ? plural(notebook.sourceCount, "source")
        : "Nothing added yet",
      done: sourcesReady,
    },
    {
      label: "Material generated",
      detail: materialReady
        ? plural(notebook.materialCount, "item")
        : "Ready to churn",
      done: materialReady,
    },
    {
      label: "Revise",
      detail: materialReady ? "Open the notebook" : "After generating",
      done: false,
    },
  ];
  const completion = (Number(sourcesReady) + Number(materialReady)) / steps.length;

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Pick up where you left off"
      className="dashboard-bento overflow-hidden p-6 sm:p-8"
    >
      {/* The block's own light: the accent glinting through the glass. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--signal)_28%,transparent)] opacity-70 blur-3xl"
      />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="dashboard-kicker">
            <Sparkles className="h-3.5 w-3.5" />
            Pick up where you left off
          </p>
          <h2 className="mt-3 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {notebook.name}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-dim">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last touched {timeAgo(notebook.lastActivityAt)}
            </span>
            <span aria-hidden className="text-[var(--card-border)]">
              /
            </span>
            <span>
              {plural(notebook.sourceCount, "source")} ·{" "}
              {plural(notebook.materialCount, "study item")}
            </span>
          </p>
        </div>

        <motion.button
          type="button"
          onClick={() => onResume(notebook.id)}
          className="dashboard-resume shrink-0"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 1.07 }}
          transition={transition}
        >
          {sourcesReady ? <Play className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          {sourcesReady ? "Resume" : "Add sources"}
        </motion.button>
      </div>

      {/* Completion timeline — a smooth linear track with the real steps. */}
      <div className="mt-8">
        <div className="relative h-2.5">
          <span className="dashboard-timeline__rail absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" />
          <motion.span
            className="dashboard-timeline__fill absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${completion * 100}%` }}
            transition={transition}
          />
          {[0, 50, 100].map((position, index) => (
            <motion.span
              key={position}
              className={
                "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full " +
                (steps[index].done
                  ? "bg-[var(--signal)]"
                  : "border border-[color-mix(in_srgb,var(--text-main)_35%,transparent)] bg-[var(--ink)]")
              }
              style={{ left: `${position}%` }}
              initial={{ scale: 0.6 }}
              animate={{ scale: steps[index].done ? 1 : 0.8 }}
              transition={transition}
            />
          ))}
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-3 text-[11px] leading-relaxed">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={
                index === 1 ? "text-center" : index === 2 ? "text-right" : ""
              }
            >
              <p
                className={
                  "font-semibold " +
                  (step.done ? "text-[var(--signal)]" : "text-foreground")
                }
              >
                {step.label}
              </p>
              <p className="text-text-dim">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Metric tiles                                                     */
/* ------------------------------------------------------------------ */

function MetricTile({
  label,
  value,
  detail,
  delta,
  icon: Icon,
  index,
}: {
  label: string;
  value: number;
  detail: string;
  /** Context chip under the number. */
  delta?: { text: string; tone?: "up" | "down" | "flat" };
  icon: typeof BookOpen;
  index: number;
}) {
  const transition = useSpringTransition();
  const stagger = useStagger(0.07);
  const tone = delta?.tone ?? "flat";
  return (
    <motion.div
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={{ ...transition, delay: stagger(index) }}
      whileHover={{ y: -3 }}
      className="dashboard-bento flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">
          {label}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-display text-3xl font-bold tracking-tight tabular-nums">
          {value.toLocaleString()}
        </p>
        {delta ? (
          <span
            className={
              "mt-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold " +
              (tone === "up"
                ? "border-[color-mix(in_srgb,var(--signal)_38%,transparent)] text-[var(--signal)]"
                : tone === "down"
                  ? "border-[color-mix(in_srgb,#f59e0b_42%,transparent)] text-[#fbbf24]"
                  : "border-[var(--card-border)] text-text-dim")
            }
          >
            {tone === "up" ? (
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            ) : tone === "down" ? (
              <ArrowDownRight className="h-3 w-3 shrink-0" />
            ) : (
              <ArrowRight className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{delta.text}</span>
          </span>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed text-text-dim">{detail}</p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. iCloud-style used-of-total line                                  */
/* ------------------------------------------------------------------ */

function AllowanceLine() {
  const usage = useQuery(api.usage.myUsage);
  const { plan } = usePlan();
  const transition = useSpringTransition();
  const stagger = useStagger(0.05);

  if (usage === undefined) {
    return (
      <div className="dashboard-bento p-6 text-sm text-text-dim">
        Reading your allowance…
      </div>
    );
  }
  if (usage === null) return null;

  const used = usage.used;
  const total = usage.limit;
  const remaining = Math.max(0, total - used);
  const ratio = total > 0 ? Math.min(1, used / total) : 0;
  const monthly = usage.window === "month";
  const resetsAt = monthly
    ? new Date(usage.resetsAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })
    : new Date(usage.resetsAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
  const out = used >= total;
  // The subscription the student actually bought names the meter; the ledger
  // decides whether it is a day or a month.
  const tierName = getTier(plan)?.name ?? "Free";
  const windowWord = monthly ? "month" : "day";

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={{ ...transition, delay: stagger(0) }}
      aria-label="Generation allowance"
      className="dashboard-bento p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="dashboard-kicker">
            <Gauge className="h-3.5 w-3.5" />
            Generation allowance
          </p>
          <h2 className="mt-2 font-display text-lg font-bold tracking-tight">
            Used out of total
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[color-mix(in_srgb,var(--signal)_36%,transparent)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--signal)]">
            {tierName}
          </span>
          <span className="text-xs font-medium text-text-dim">
            Resets {resetsAt}
          </span>
        </div>
      </div>

      {/* Absolute numbers, not a percentage shape. */}
      <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-3xl font-bold tracking-tight tabular-nums">
          {used.toLocaleString()}
        </span>
        <span className="text-sm text-text-dim">
          of {total.toLocaleString()} tokens used this {windowWord}
        </span>
      </p>

      {/* The single tracking line. */}
      <div className="mt-4">
        <div className="dashboard-meter">
          <motion.div
            className="dashboard-meter__fill"
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={transition}
          >
            <span className="absolute right-[3px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
          </motion.div>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
          <span className="tabular-nums">
            <span className="font-semibold text-foreground">
              {used.toLocaleString()}
            </span>{" "}
            used
          </span>
          <span className="tabular-nums">
            <span className="font-semibold text-foreground">
              {remaining.toLocaleString()}
            </span>{" "}
            left
          </span>
          <span className="tabular-nums">
            <span className="font-semibold text-foreground">
              {total.toLocaleString()}
            </span>{" "}
            {monthly ? "monthly cap" : "daily cap"}
          </span>
          <span className="tabular-nums">
            {plural(usage.requests, "generation")} this {windowWord}
          </span>
        </div>
      </div>

      {out ? (
        <p className="mt-4 text-xs leading-relaxed text-text-dim">
          This {windowWord}'s allowance is spent — the engine pauses until it
          resets {monthly ? "on" : "at"} {resetsAt}. The{" "}
          <Link
            to="/pricing"
            className="font-medium text-[var(--signal)] hover:underline"
          >
            plans page
          </Link>{" "}
          has higher caps.
        </p>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-text-dim">
          Metered by the same ledger the generation engine writes, so the line
          above is what your notebook will actually spend.
        </p>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Frosted spline area chart                                        */
/* ------------------------------------------------------------------ */

/**
 * The vendored bklit chart motion: a high-damping unit-mass spring. The wave
 * below is hand-drawn (the vendored chart set ships bar and pie only), but it
 * rides this exact spring, so its reveal and its day-to-day morphs feel like
 * the same physics as every other chart in the product.
 */
const CHART_SPRING: Transition = {
  type: "spring",
  mass: 1,
  stiffness: 120,
  damping: 18,
  restDelta: 0.001,
};

const WAVE_HEIGHT = 240;
const WAVE_PAD_X = 10;
const WAVE_TOP = 18;
const WAVE_BOTTOM = 30;

/** Container width in pixels, so the wave is drawn at true scale. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * A cardinal spline through the seven daily points — C1-continuous, so the
 * wave carries no kinks and no overshoot. The command structure never changes
 * (six cubics for seven days), which is exactly what lets Motion morph
 * between real states instead of redrawing.
 */
function waveGeometry(values: number[], max: number, width: number) {
  const innerW = Math.max(0, width - WAVE_PAD_X * 2);
  const innerH = WAVE_HEIGHT - WAVE_TOP - WAVE_BOTTOM;
  const step = values.length > 1 ? innerW / (values.length - 1) : innerW;
  const points = values.map((value, index) => ({
    x: WAVE_PAD_X + index * step,
    y: WAVE_TOP + innerH * (1 - (max > 0 ? Math.min(1, value / max) : 0)),
  }));
  if (points.length < 2) {
    const y = WAVE_TOP + innerH;
    return { step, points, d: `M 0 ${y} L ${width} ${y}` };
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return { step, points, d };
}

function WaveTip({ point }: { point: ActivityPoint }) {
  return (
    <div className="w-max rounded-xl border border-[var(--card-border)] bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur-md dark:bg-[#1a1a24]/95">
      <p className="font-semibold text-foreground dark:text-white/95">
        {point.label}
      </p>
      <p className="mt-1 flex items-center gap-2 text-text-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--dash-series-primary)]" />
        {plural(point.materials, "study item")}
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-text-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--dash-series-secondary)]" />
        {plural(point.sources, "source")}
      </p>
    </div>
  );
}

/**
 * The seven-day wave.
 *
 * Two series — study material (the filled wave) and sources added (the ghost
 * line) — drawn as cardinal splines on one shared height scale. New data does
 * not redraw: the paths MORPH to their new geometry on the chart spring, the
 * way the rest of this workspace moves. Hover snaps a springed crosshair to
 * the nearest day and floats a glass tip with that day's real counts.
 */
function ActivityWave({ data }: { data: ActivityPoint[] }) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const ink = useChartInk();
  const { ref, width } = useMeasuredWidth();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const fillId = useId();

  const totals = data.reduce(
    (sum, point) => ({
      materials: sum.materials + point.materials,
      sources: sum.sources + point.sources,
    }),
    { materials: 0, sources: 0 },
  );

  const waveWidth = width || 720;
  // One shared height scale: the two series read honestly against each other.
  const max = Math.max(4, ...data.map((p) => Math.max(p.materials, p.sources)));
  const material = waveGeometry(
    data.map((p) => p.materials),
    max,
    waveWidth,
  );
  const source = waveGeometry(
    data.map((p) => p.sources),
    max,
    waveWidth,
  );
  const baseline = WAVE_TOP + (WAVE_HEIGHT - WAVE_TOP - WAVE_BOTTOM);
  const areaOf = (line: string) =>
    `${line} L ${waveWidth - WAVE_PAD_X} ${baseline} L ${WAVE_PAD_X} ${baseline} Z`;

  const active = hoverIndex != null ? data[hoverIndex] ?? null : null;
  const activeMaterial =
    hoverIndex != null ? material.points[hoverIndex] ?? null : null;
  const activeSource =
    hoverIndex != null ? source.points[hoverIndex] ?? null : null;
  // Peaks leave no headroom above the panel — near the top the tip flips
  // under the point instead of clipping out of the card.
  const tipBelow = (activeMaterial?.y ?? WAVE_HEIGHT) < 104;

  const indexFromClientX = (clientX: number, rect: DOMRect) => {
    if (data.length < 2) return null;
    const x = ((clientX - rect.left) / rect.width) * waveWidth;
    const index = Math.round((x - WAVE_PAD_X) / material.step);
    return Math.max(0, Math.min(data.length - 1, index));
  };

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Study material generated over the last seven days"
      className="dashboard-bento p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="dashboard-kicker">
            <Sparkles className="h-3.5 w-3.5" />
            Last seven days
          </p>
          <h2 className="mt-2 font-display text-lg font-bold tracking-tight">
            What you generated, day by day
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-dim">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--dash-series-primary)]" />
            Study material
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--dash-series-secondary)]" />
            Sources added
          </span>
        </div>
      </div>

      {/* The wave lives on its own sheet of frosted glass (blur 12px). */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="dashboard-chart-panel dashboard-chart mt-5 p-3 sm:p-4"
      >
        <div
          ref={ref}
          className="relative h-[240px] w-full touch-none select-none"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHoverIndex(indexFromClientX(event.clientX, rect));
          }}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {data.length >= 2 && (
            <svg
              width={waveWidth}
              height={WAVE_HEIGHT}
              className="block"
              role="img"
              aria-hidden
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ink.frostTop} stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor={ink.frostBottom}
                    stopOpacity={1}
                  />
                </linearGradient>
              </defs>

              {/* Quiet horizontal rails. */}
              {[0.25, 0.5, 0.75, 1].map((fraction) => {
                const y = WAVE_TOP + (baseline - WAVE_TOP) * fraction;
                return (
                  <line
                    key={fraction}
                    x1={WAVE_PAD_X}
                    x2={waveWidth - WAVE_PAD_X}
                    y1={y}
                    y2={y}
                    stroke={ink.grid}
                    strokeDasharray="3 7"
                    strokeWidth={1}
                  />
                );
              })}

              {/* Sources: the quiet ghost line. */}
              <motion.path
                fill="none"
                stroke={ink.secondary}
                strokeWidth={1.6}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0, d: source.d }}
                animate={{ pathLength: 1, opacity: 1, d: source.d }}
                transition={still ? STILL : CHART_SPRING}
              />
              {/* Study material: the frosted fill under the main wave. */}
              <motion.path
                fill={`url(#${fillId})`}
                stroke="none"
                initial={{ opacity: 0, d: areaOf(material.d) }}
                animate={{ opacity: 1, d: areaOf(material.d) }}
                transition={
                  still ? STILL : { ...CHART_SPRING, delay: 0.12 }
                }
              />
              {/* Study material: the main wave. */}
              <motion.path
                fill="none"
                stroke={ink.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0, d: material.d }}
                animate={{ pathLength: 1, opacity: 1, d: material.d }}
                transition={still ? STILL : CHART_SPRING}
              />
            </svg>
          )}

          {data.length < 2 && (
            <div className="flex h-full items-center justify-center text-sm text-text-dim">
              The wave starts when you churn your first notebook.
            </div>
          )}

          {/* Day labels sit exactly under their points. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[30px]"
          >
            {material.points.map((pt, index) => (
              <span
                key={data[index]?.label ?? index}
                className={
                  "absolute bottom-1 whitespace-nowrap text-[10.5px] text-text-dim " +
                  (index === 0
                    ? ""
                    : index === material.points.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2")
                }
                style={{ left: pt.x }}
              >
                {data[index]?.label}
              </span>
            ))}
          </div>

          {/* Crosshair, rings and the floating tip for the hovered day. */}
          <AnimatePresence>
            {active && activeMaterial && (
              <motion.div
                key={active.label}
                initial={{ opacity: 0, scale: 0.94, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="pointer-events-none absolute z-10"
                style={{
                  left: Math.max(
                    64,
                    Math.min(waveWidth - 64, activeMaterial.x),
                  ),
                  top: activeMaterial.y,
                }}
              >
                <div
                  className={
                    tipBelow
                      ? "-translate-x-1/2 translate-y-[18px]"
                      : "-translate-x-1/2 -translate-y-[calc(100%+16px)]"
                  }
                >
                  <WaveTip point={active} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {active && activeMaterial && (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[30px] top-[18px] w-px"
              style={{ left: activeMaterial.x, background: ink.grid }}
            />
          )}
          {active && activeMaterial && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{
                  left: activeMaterial.x,
                  top: activeMaterial.y,
                  background: ink.primary,
                }}
              />
              {activeSource && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{
                    left: activeSource.x,
                    top: activeSource.y,
                    background: ink.secondary,
                  }
                  }
                />
              )}
            </>
          )}
        </div>
      </motion.div>

      <p className="mt-4 text-xs leading-relaxed text-text-dim">
        {totals.materials + totals.sources > 0
          ? `${plural(totals.materials, "study item")} and ${plural(totals.sources, "source")} in the last seven days.`
          : "Nothing generated in the last seven days yet — the wave starts when you churn your first notebook."}
      </p>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function DashboardOverview({
  summary,
  notebooks,
  onResumeNotebook,
  onOpenNotebooks,
  onCreateNotebook,
}: {
  summary: DashboardSummary | undefined;
  notebooks: DashboardNotebook[];
  onResumeNotebook: (notebookId: string) => void;
  onOpenNotebooks: () => void;
  onCreateNotebook: () => void;
}) {
  const transition = useSpringTransition();

  const resumeTarget = useMemo(() => {
    if (notebooks.length === 0) return null;
    return [...notebooks].sort(
      (a, b) => b.lastActivityAt - a.lastActivityAt,
    )[0];
  }, [notebooks]);

  const activity = useMemo<ActivityPoint[]>(() => {
    if (!summary) return [];
    return summary.materialsByDay.map((day, index) => ({
      label: day.label,
      materials:
        day.summary + day.flashcards + day.quiz + day.mindmap + day.slides,
      sources: summary.byDay?.[index]?.count ?? 0,
    }));
  }, [summary]);

  if (!summary) {
    /* The focal block only needs the notebook list, so it is already honest
       while the counts are still arriving. */
    return (
      <div className="flex flex-col gap-4">
        {resumeTarget && (
          <ResumeBlock notebook={resumeTarget} onResume={onResumeNotebook} />
        )}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          animate="visible"
          transition={transition}
          className="dashboard-bento p-6 text-sm text-text-dim"
        >
          Reading your library…
        </motion.div>
      </div>
    );
  }

  const generatedCount = MATERIAL_KINDS.reduce(
    (total, kind) => total + (summary.materialsByKind[kind] ?? 0),
    0,
  );
  const readablePercent = summary.sourceCount
    ? Math.round((summary.readableCount / summary.sourceCount) * 100)
    : 0;
  const materialRows = MATERIAL_KINDS.map((kind) => ({
    kind,
    label: MATERIAL_LABELS[kind],
    value: summary.materialsByKind[kind] ?? 0,
    color: `var(--kind-${kind})`,
  })).filter((row) => row.value > 0);
  const busiestKind = materialRows.reduce(
    (largest, row) => Math.max(largest, row.value),
    1,
  );
  /** A compact "+2 vs last week" chip with the matching tone. */
  const deltaChip = (
    current: number,
    previous: number,
  ): { text: string; tone: "up" | "down" | "flat" } => {
    const difference = current - previous;
    if (difference === 0) {
      return {
        text: current === 0 ? "quiet week" : "steady vs last week",
        tone: "flat",
      };
    }
    return {
      text: `${difference > 0 ? "+" : "−"}${Math.abs(difference)} vs last week`,
      tone: difference > 0 ? "up" : "down",
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. The focal block: the notebook last worked in. */}
      {resumeTarget && (
        <ResumeBlock notebook={resumeTarget} onResume={onResumeNotebook} />
      )}

      {/* 2. Real counts. */}
      <section
        aria-label="Workspace summary"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <MetricTile
          index={0}
          label="Notebooks"
          value={notebooks.length}
          detail={
            summary.activeNotebook
              ? `“${summary.activeNotebook.name}” is the one you're working in`
              : `${plural(summary.sourceCount, "source")} across them`
          }
          icon={BookOpen}
        />
        <MetricTile
          index={1}
          label="Sources"
          value={summary.sourceCount}
          detail={`${readablePercent}% read successfully`}
          delta={
            summary.sourceCount === 0
              ? undefined
              : summary.failedCount > 0
                ? {
                    text: plural(summary.failedCount, "source") + " need text",
                    tone: "down",
                  }
                : { text: "all readable", tone: "up" }
          }
          icon={FileText}
        />
        <MetricTile
          index={2}
          label="This week"
          value={summary.addedThisWeek}
          detail="Sources added in 7 days"
          delta={deltaChip(summary.addedThisWeek, summary.sourcesPrevWeek)}
          icon={NotebookPen}
        />
        <MetricTile
          index={3}
          label="Study material"
          value={generatedCount}
          detail={`${plural(summary.materialsThisWeek, "item")} churned in 7 days`}
          delta={deltaChip(
            summary.materialsThisWeek,
            summary.materialsPrevWeek,
          )}
          icon={Sparkles}
        />
      </section>

      {/* 3. Used out of total, in absolute numbers. */}
      <AllowanceLine />

      {/* 4. The seven-day wave. */}
      <ActivityWave data={activity} />

      {/* What the material is made of, plus the way in. */}
      <motion.section
        variants={revealVariants}
        initial="hidden"
        animate="visible"
        transition={transition}
        aria-label="Study material by kind"
        className="dashboard-bento p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="dashboard-kicker">
              <NotebookPen className="h-3.5 w-3.5" />
              Your library
            </p>
            <h2 className="mt-2 font-display text-lg font-bold tracking-tight">
              Keep the momentum
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <MovingBorderButton
              onClick={onOpenNotebooks}
              className="w-fit"
              innerClassName="px-4 py-2 text-xs"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Open notebooks
            </MovingBorderButton>
            <MovingBorderButton
              onClick={onCreateNotebook}
              className="w-fit"
              innerClassName="px-4 py-2 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New notebook
            </MovingBorderButton>
          </div>
        </div>

        {materialRows.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {materialRows.map((row) => (
              <li key={row.kind} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="min-w-0 flex-1 truncate text-text-dim">
                  {row.label}
                </span>
                <span className="w-24 shrink-0">
                  <span className="dashboard-meter block h-1.5">
                    <span
                      className="dashboard-meter__fill"
                      style={{ width: `${(row.value / busiestKind) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                  {row.value.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-text-dim">
            Generated study material will appear here — open a notebook, add
            sources, then churn them into a summary, flashcards, a quiz, a mind
            map and slides.
          </p>
        )}
      </motion.section>
    </div>
  );
}
