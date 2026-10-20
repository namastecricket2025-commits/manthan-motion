import { api } from "@/convex/_generated/api";
import { usePlan } from "@/components/plans/PlanProvider";
import { useResolvedTheme } from "@/lib/app-settings";
import {
  revealVariants,
  STILL,
  useSpringTransition,
  useStagger,
  useStillMotion,
} from "@/lib/motion";

import { getTier } from "@/lib/plans";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Check,
  Clock,
  FileText,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Network,
  NotebookPen,
  Play,
  Presentation,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";

/**
 * The workspace overview.
 *
 * Everything on this screen is derived from rows the signed-in user actually
 * created — there is no seeded, sample or hardcoded content anywhere, and a
 * metric this app does not track (a streak, a "due for review" count) is
 * omitted rather than invented. The screen reads as a bento of isolated
 * frosted blocks:
 *
 *   1. quick actions            the three things worth doing next, straight
 *                               under the greeting.
 *   2. "Pick up where you left off"  the focal block: the notebook last worked
 *                               in, its real completion timeline and the
 *                               action that opens it.
 *   3. four metric tiles        real counts — hover, press and click them:
 *                               each one is a control that opens the view its
 *                               number belongs to.
 *   4. the allowance line       used-of-total, in absolute numbers, from the
 *                               same ledger the generation engine writes.
 *   5. the seven-day bars       one column per day, study material beside
 *                               sources added, on a clean card. Marks only:
 *                               no curve, no interpolation, nothing that can
 *                               read as a negative count.
 *   6. twelve-week heatmap      one square per day, intensity from the same
 *                               rows the bars read.
 *   7. your library             one clickable row per material kind, plus the
 *                               last five things that actually happened.
 *
 * Every block arrives on the shared spring (see `@/lib/motion`); every
 * transition collapses to an instant settle when the user asked for less
 * motion.
 */

/** The five generated-artefact kinds, in the order the picker lists them. */
export type MaterialKind =
  | "summary"
  | "flashcards"
  | "quiz"
  | "mindmap"
  | "slides";

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
  /** Twelve weeks of days, oldest first — one cell per calendar day. */
  heatmap: {
    day: string;
    label: string;
    weekday: number;
    materials: number;
    sources: number;
    count: number;
  }[];
  /** The five newest source/material events, newest first. */
  recent: {
    id: string;
    notebookId: string;
    kind: "source" | MaterialKind;
    label: string;
    notebook: string;
    at: number;
  }[];
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

type HeatCell = DashboardSummary["heatmap"][number];
type RecentEvent = DashboardSummary["recent"][number];

/** Where a click on the overview should land inside a notebook workspace. */
export type WorkspaceTarget = {
  focus?: "sources" | "materials";
  tab?: MaterialKind;
};

type ActivityPoint = {
  day: string;
  label: string;
  materials: number;
  sources: number;
};

const MATERIAL_KINDS: MaterialKind[] = [
  "summary",
  "flashcards",
  "quiz",
  "mindmap",
  "slides",
];

const MATERIAL_LABELS: Record<MaterialKind, string> = {
  summary: "Summaries",
  flashcards: "Flashcards",
  quiz: "Quizzes",
  mindmap: "Mind maps",
  slides: "Slides",
};

const MATERIAL_ICONS: Record<MaterialKind, typeof FileText> = {
  summary: FileText,
  flashcards: Layers,
  quiz: ListChecks,
  mindmap: Network,
  slides: Presentation,
};

/**
 * Chart motion. Tween, never spring: these animate SVG geometry and bar
 * heights, and a mark that overshoots its own value is a lie about the data.
 * Each is short and eased out, so the growth reads as a settle, not a bounce.
 */
const GROW: Transition = { type: "tween", duration: 0.55, ease: "easeOut" };
const RISE: Transition = { type: "tween", duration: 0.42, ease: "easeOut" };
const TIP: Transition = { type: "tween", duration: 0.18, ease: "easeOut" };

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
 * SVG presentation attributes do not reliably honour `var(--token)`, so the
 * theme tokens are read once per theme as real colour strings instead of being
 * trusted inside the SVG.
 */
function useChartInk() {
  const theme = useResolvedTheme();
  return useMemo(() => {
    const fallback =
      theme === "dark"
        ? {
            label: "rgba(255, 255, 255, 0.9)",
            grid: "rgba(255, 255, 255, 0.12)",
            primary: "#fafafa",
            secondary: "#a1a1aa",
          }
        : {
            label: "#333f4b",
            grid: "rgba(36, 26, 10, 0.14)",
            primary: "#b45309",
            secondary: "#2f6f6b",
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
    };
  }, [theme]);
}

/**
 * True once the element has been on screen — and it stays true. Count-ups and
 * bar growths hang off this so a number animates the first time it is seen,
 * never again on every re-render.
 */
function useInViewOnce<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen, threshold]);

  return { ref, seen };
}

/**
 * A number that counts up to its value once, on the animation frame clock, and
 * reports when it has finished so a chip can follow it in. `still` jumps
 * straight to the answer instead of travelling through 300 intermediate frames
 * nobody asked for.
 */
function useCountUp(target: number, active: boolean, still: boolean) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;
    if (still || target === 0) {
      setValue(target);
      setDone(true);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const duration = 900;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else setDone(true);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, target, still]);

  return { value, done };
}

/** Container width in pixels, so SVG marks are drawn at true scale. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * A bar: flat on the baseline, rounded on top. Rounding the top only (rather
 * than an `rx` rectangle that rounds all four corners) is what keeps a two-unit
 * bar from looking like a lozenge once it is scaled down to a few pixels.
 * The command structure never changes with height, which is what lets Motion
 * grow the mark from the baseline by interpolating the path itself.
 */
function barPath(x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h));
  const right = x + w;
  const bottom = y + h;
  return [
    `M${x.toFixed(2)},${bottom.toFixed(2)}`,
    `L${x.toFixed(2)},${(y + r).toFixed(2)}`,
    `Q${x.toFixed(2)},${y.toFixed(2)} ${(x + r).toFixed(2)},${y.toFixed(2)}`,
    `L${(right - r).toFixed(2)},${y.toFixed(2)}`,
    `Q${right.toFixed(2)},${y.toFixed(2)} ${right.toFixed(2)},${(y + r).toFixed(2)}`,
    `L${right.toFixed(2)},${bottom.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/* ------------------------------------------------------------------ */
/* Action buttons                                                      */
/* ------------------------------------------------------------------ */

/**
 * The page's action pill.
 *
 * The sheen is clipped to the pill by a `clip-path` on its own wrapper rather
 * than `overflow: hidden` on the button: the quick-action row glides ONE
 * shared highlight pill between its items, and a clipped parent would shear
 * that travel off mid-flight.
 */
function ActionButton({
  children,
  onClick,
  tone = "primary",
  className,
  icon,
  highlightId,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "secondary";
  className?: string;
  icon?: ReactNode;
  /** Shared-layout id: the highlight pill glides instead of appearing. */
  highlightId?: string;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
}) {
  const transition = useSpringTransition();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={transition}
      className={
        "dash-action " +
        (tone === "primary"
          ? "dash-action--primary"
          : "dash-action--secondary") +
        (className ? " " + className : "")
      }
    >
      {highlightId ? (
        <motion.span
          aria-hidden
          layoutId={highlightId}
          className="dash-quick"
          transition={transition}
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* 0. Quick actions                                                    */
/* ------------------------------------------------------------------ */

/**
 * The three next steps worth taking, as one compact row under the greeting.
 * The highlight behind the row travels between items on the shared spring —
 * the same single sliding pill the STEM Lab sidebar uses — so the row reads
 * as one control rather than three unrelated buttons.
 */
function QuickActions({
  onUploadSource,
  onGenerateQuiz,
  onOpenLast,
}: {
  onUploadSource: () => void;
  onGenerateQuiz: () => void;
  onOpenLast: () => void;
}) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const stagger = useStagger(0.05);
  const [active, setActive] = useState<string | null>(null);

  const actions: {
    key: string;
    label: string;
    icon: typeof Upload;
    run: () => void;
  }[] = [
    {
      key: "upload",
      label: "Upload source",
      icon: Upload,
      run: onUploadSource,
    },
    {
      key: "quiz",
      label: "Generate quiz",
      icon: ListChecks,
      run: onGenerateQuiz,
    },
    {
      key: "last",
      label: "Open last notebook",
      icon: NotebookPen,
      run: onOpenLast,
    },
  ];

  return (
    <motion.section
      aria-label="Quick actions"
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      onPointerLeave={() => setActive(null)}
      className="flex flex-wrap items-center gap-1.5"
    >
      {actions.map((action, index) => (
        <motion.span
          key={action.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={still ? STILL : { ...RISE, delay: stagger(index) }}
        >
          <ActionButton
            tone="secondary"
            icon={<action.icon className="h-3.5 w-3.5" />}
            onClick={action.run}
            highlightId={
              active === action.key ? "dashboard-quick-pill" : undefined
            }
            onPointerEnter={() => setActive(action.key)}
            onFocus={() => setActive(action.key)}
          >
            {action.label}
          </ActionButton>
        </motion.span>
      ))}
    </motion.section>
  );
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
  const completion =
    (Number(sourcesReady) + Number(materialReady)) / steps.length;

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Pick up where you left off"
      className="dashboard-bento overflow-hidden p-6 sm:p-8"
    >
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

        <ActionButton
          onClick={() => onResume(notebook.id)}
          className="shrink-0"
          ariaLabel={
            sourcesReady
              ? `Resume ${notebook.name}`
              : `Add sources to ${notebook.name}`
          }
          icon={
            sourcesReady ? (
              <Play className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )
          }
        >
          {sourcesReady ? "Resume" : "Add sources"}
        </ActionButton>
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

/**
 * A metric as a control, not a plaque.
 *
 * It rises and settles with the other three, leans toward the pointer on the
 * shared spring, and carries a radial glow that tracks the cursor. The number
 * counts up from zero the first time the tile is seen, and the context chip
 * only arrives once the count has finished, so the eye reads value then
 * comparison. Pressing it opens the view the number belongs to.
 */
function MetricTile({
  label,
  value,
  detail,
  delta,
  icon: Icon,
  index,
  onOpen,
}: {
  label: string;
  value: number;
  detail: string;
  /** Context chip under the number. */
  delta?: { text: string; tone?: "up" | "down" | "flat" };
  icon: typeof BookOpen;
  index: number;
  onOpen: () => void;
}) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const stagger = useStagger(0.06);
  const { ref, seen } = useInViewOnce<HTMLButtonElement>(0.2);
  const { value: shown, done } = useCountUp(value, seen, still);
  const glow = useRef<HTMLSpanElement | null>(null);
  const tone = delta?.tone ?? "flat";

  /* Written straight to the element: a cursor-tracking glow must not go
     through React state, or every pixel of travel re-renders the tile. */
  const track = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = glow.current;
    if (!node) return;
    const rect = event.currentTarget.getBoundingClientRect();
    node.style.setProperty("--tile-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--tile-y", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onOpen}
      onPointerMove={track}
      aria-label={`${label}: ${value.toLocaleString()}. ${detail}`}
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: still ? STILL : { ...transition, delay: stagger(index) },
        },
      }}
      initial="hidden"
      animate="visible"
      whileHover={still ? undefined : { y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={transition}
      className="dash-tile dashboard-bento group flex flex-col gap-4 p-5"
    >
      <span ref={glow} aria-hidden className="dash-tile__glow" />

      <span className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ArrowUpRight
            aria-hidden
            className="h-3.5 w-3.5 -translate-x-1 text-[var(--signal)] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
            <Icon className="h-4 w-4" />
          </span>
        </span>
      </span>

      <span className="relative z-10 block min-w-0">
        <span className="block font-display text-3xl font-bold tracking-tight tabular-nums">
          {shown.toLocaleString()}
        </span>
        {delta ? (
          <AnimatePresence initial={false}>
            {done ? (
              <motion.span
                key="delta"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={still ? STILL : RISE}
                className={
                  "mt-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold " +
                  (tone === "up"
                    ? "border-[color-mix(in_srgb,var(--signal)_38%,transparent)] text-[var(--signal)]"
                    : tone === "down"
                      ? "border-[color-mix(in_srgb,var(--destructive)_42%,transparent)] text-[var(--destructive)]"
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
              </motion.span>
            ) : null}
          </AnimatePresence>
        ) : null}
        <span className="mt-1.5 block text-xs leading-relaxed text-text-dim">
          {detail}
        </span>
      </span>
    </motion.button>
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
/* 4. Seven days, as bars                                              */
/* ------------------------------------------------------------------ */

const BAR_HEIGHT = 236;
const BAR_LEFT = 40;
const BAR_RIGHT = 14;
const BAR_TOP = 16;
const BAR_BOTTOM = 42;
const BAR_MIN_WIDTH = 460;

function BarTip({ point }: { point: ActivityPoint }) {
  return (
    <div className="w-max rounded-lg border border-[var(--panel-line)] bg-[var(--popover)] px-3 py-2 text-[11.5px]">
      <p className="font-semibold text-[var(--popover-foreground)]">
        {point.day} · {point.label}
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
 * The seven-day bars.
 *
 * Two marks per day — study material in the primary ink, sources added in the
 * second — drawn from the baseline up, so a quiet day is a short bar and an
 * empty day is a dot ON the baseline rather than a gap that reads as broken.
 *
 * Deliberately NOT a curve: the line this replaced smoothed so hard it dipped
 * below zero between two real points, which is a shape no count can take. Bars
 * cannot make that mistake, and the y-axis carries a real scale with three
 * gridlines so a bar's height means something. Hovering a day dims the rest
 * and floats that day's exact counts.
 */
function ActivityBars({ data }: { data: ActivityPoint[] }) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const ink = useChartInk();
  const { ref: viewRef, seen } = useInViewOnce<HTMLElement>(0.15);
  const { ref: wrapRef, width } = useMeasuredWidth();
  const [hover, setHover] = useState<number | null>(null);

  const totals = data.reduce(
    (sum, point) => ({
      materials: sum.materials + point.materials,
      sources: sum.sources + point.sources,
    }),
    { materials: 0, sources: 0 },
  );

  const chartWidth = Math.max(width || BAR_MIN_WIDTH, BAR_MIN_WIDTH);
  const innerW = chartWidth - BAR_LEFT - BAR_RIGHT;
  const innerH = BAR_HEIGHT - BAR_TOP - BAR_BOTTOM;
  const baseline = BAR_TOP + innerH;

  // A whole-number scale: three steps above zero, so every tick label is a
  // count the reader could actually have, never a fraction of an item.
  const peak = Math.max(
    1,
    ...data.map((point) => Math.max(point.materials, point.sources)),
  );
  const step = Math.max(1, Math.ceil(peak / 3));
  const ticks = [0, step, step * 2, step * 3];
  const yMax = ticks[ticks.length - 1];
  const yOf = (value: number) =>
    BAR_TOP + innerH * (1 - Math.min(1, value / yMax));

  const groupWidth = data.length > 0 ? innerW / data.length : innerW;
  const groupPad = Math.min(16, groupWidth * 0.24);
  const barGap = 3;
  const barWidth = Math.max(3, (groupWidth - groupPad * 2 - barGap) / 2);

  const active = hover !== null ? (data[hover] ?? null) : null;
  const activeCenter =
    hover !== null ? BAR_LEFT + hover * groupWidth + groupWidth / 2 : 0;

  return (
    <motion.section
      ref={viewRef}
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Study material generated and sources added over the last seven days"
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

      {/* The measuring node carries no padding: its client width is exactly the
          room the bars have, so a chart that fits never shows a scrollbar and
          a narrow one scrolls instead of crushing the columns. */}
      <div className="dashboard-chart-panel dashboard-chart mt-5 p-3 sm:p-4">
        <div ref={wrapRef} className="dashboard-chart-scroll">
        <div className="relative" style={{ width: chartWidth }}>
          <svg
            width={chartWidth}
            height={BAR_HEIGHT}
            className="block"
            role="img"
            aria-label="Bar chart of study material and sources added per day"
          >
            {/* Faint grid at every tick, with the baseline drawn as the axis. */}
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={BAR_LEFT - 6}
                x2={chartWidth - BAR_RIGHT}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={ink.grid}
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "3 7"}
              />
            ))}
            {ticks.map((tick) => (
              <text
                key={`label-${tick}`}
                x={BAR_LEFT - 12}
                y={yOf(tick) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={ink.label}
                opacity={0.68}
              >
                {tick}
              </text>
            ))}

            {data.map((point, index) => {
              const groupX = BAR_LEFT + index * groupWidth;
              const materialX = groupX + groupPad;
              const sourceX = materialX + barWidth + barGap;
              const dim = hover !== null && hover !== index;
              const materialTop = yOf(point.materials);
              const sourceTop = yOf(point.sources);
              return (
                <g
                  key={point.label}
                  opacity={dim ? 0.26 : 1}
                  style={{ transition: "opacity 220ms ease" }}
                >
                  {/* A quiet column wash marks the day under the pointer. */}
                  <rect
                    x={groupX + 2}
                    y={BAR_TOP}
                    width={Math.max(0, groupWidth - 4)}
                    height={innerH}
                    rx={10}
                    fill={ink.primary}
                    opacity={hover === index ? 0.07 : 0}
                    style={{ transition: "opacity 200ms ease" }}
                  />

                  {point.materials > 0 ? (
                    <motion.path
                      fill={ink.primary}
                      animate={
                        seen
                          ? {
                              d: barPath(
                                materialX,
                                materialTop,
                                barWidth,
                                baseline - materialTop,
                                5,
                              ),
                              opacity: 1,
                            }
                          : {
                              d: barPath(
                                materialX,
                                baseline,
                                barWidth,
                                0,
                                5,
                              ),
                              opacity: 0,
                            }
                      }
                      transition={
                        still
                          ? STILL
                          : { ...GROW, delay: index * 2 * 0.05 }
                      }
                    />
                  ) : (
                    <motion.circle
                      cx={materialX + barWidth / 2}
                      cy={baseline - 2}
                      r={2.4}
                      fill={ink.primary}
                      animate={{ opacity: seen ? 0.9 : 0 }}
                      transition={
                        still ? STILL : { ...RISE, delay: index * 2 * 0.05 }
                      }
                    />
                  )}

                  {point.sources > 0 ? (
                    <motion.path
                      fill={ink.secondary}
                      animate={
                        seen
                          ? {
                              d: barPath(
                                sourceX,
                                sourceTop,
                                barWidth,
                                baseline - sourceTop,
                                5,
                              ),
                              opacity: 1,
                            }
                          : {
                              d: barPath(
                                sourceX,
                                baseline,
                                barWidth,
                                0,
                                5,
                              ),
                              opacity: 0,
                            }
                      }
                      transition={
                        still
                          ? STILL
                          : { ...GROW, delay: (index * 2 + 1) * 0.05 }
                      }
                    />
                  ) : (
                    <motion.circle
                      cx={sourceX + barWidth / 2}
                      cy={baseline - 2}
                      r={2.4}
                      fill={ink.secondary}
                      animate={{ opacity: seen ? 0.9 : 0 }}
                      transition={
                        still
                          ? STILL
                          : { ...RISE, delay: (index * 2 + 1) * 0.05 }
                      }
                    />
                  )}

                  {/* Weekday over date, centred on the day's column. */}
                  <text
                    x={groupX + groupWidth / 2}
                    y={baseline + 16}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={600}
                    fill={ink.label}
                  >
                    {point.day}
                  </text>
                  <text
                    x={groupX + groupWidth / 2}
                    y={baseline + 29}
                    textAnchor="middle"
                    fontSize={10}
                    fill={ink.label}
                    opacity={0.6}
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}

            {/* Invisible hit areas, drawn last so nothing steals the pointer. */}
            {data.map((point, index) => (
              <rect
                key={`hit-${point.label}`}
                x={BAR_LEFT + index * groupWidth}
                y={BAR_TOP}
                width={groupWidth}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(index)}
              />
            ))}
          </svg>

          <AnimatePresence>
            {active ? (
              <motion.div
                key={active.label}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={still ? STILL : TIP}
                className="pointer-events-none absolute z-10"
                style={{
                  left: Math.max(84, Math.min(chartWidth - 84, activeCenter)),
                  top: 0,
                }}
              >
                <div className="-translate-x-1/2">
                  <BarTip point={active} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-text-dim">
        {totals.materials + totals.sources > 0
          ? `${plural(totals.materials, "study item")} and ${plural(totals.sources, "source")} in the last seven days.`
          : "Nothing generated in the last seven days yet — the bars start when you churn your first notebook."}
      </p>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Twelve-week study activity heatmap                               */
/* ------------------------------------------------------------------ */

const HEAT_CELL = 11;
const HEAT_GAP = 3;
const HEAT_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function HeatTip({ cell }: { cell: HeatCell }) {
  return (
    <div className="w-max rounded-lg border border-[var(--panel-line)] bg-[var(--popover)] px-3 py-2 text-[11.5px]">
      <p className="font-semibold text-foreground dark:text-white/95">
        {cell.label}
      </p>
      <p className="mt-1 flex items-center gap-2 text-text-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--dash-series-primary)]" />
        {plural(cell.materials, "study item")}
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-text-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--dash-series-secondary)]" />
        {plural(cell.sources, "source")}
      </p>
    </div>
  );
}

/**
 * A GitHub-style calendar of the last twelve weeks: one square per day, shaded
 * by everything that happened on it — study material generated plus sources
 * added, the sum of the two series the bars above draw. Same rows, same days,
 * so the two views can never disagree.
 *
 * A day with nothing on it is drawn empty rather than skipped: the gap is the
 * information.
 */
function ActivityHeatmap({ cells }: { cells: HeatCell[] }) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const { ref, seen } = useInViewOnce<HTMLDivElement>(0.2);
  const [hover, setHover] = useState<number | null>(null);

  // The first column is padded to the week's start so Sunday sits on row one.
  const lead = cells[0]?.weekday ?? 0;
  const slots: (HeatCell | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...cells,
  ];
  const peak = Math.max(1, ...cells.map((cell) => cell.count));
  const levelOf = (count: number) =>
    count === 0 ? 0 : Math.min(4, Math.ceil((count / peak) * 4));
  const totals = cells.reduce(
    (sum, cell) => ({
      materials: sum.materials + cell.materials,
      sources: sum.sources + cell.sources,
    }),
    { materials: 0, sources: 0 },
  );
  const active = hover !== null ? (slots[hover] ?? null) : null;
  const activeColumn = hover !== null ? Math.floor(hover / 7) : 0;
  // The grid's own width, so the tip can be held inside it at either edge
  // instead of hanging out of the card on the first and last columns.
  const gridWidth =
    Math.ceil(slots.length / 7) * (HEAT_CELL + HEAT_GAP) - HEAT_GAP;
  const tipLeft = Math.min(
    Math.max(activeColumn * (HEAT_CELL + HEAT_GAP) + HEAT_CELL / 2, 76),
    Math.max(76, gridWidth - 76),
  );

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Study activity over the last twelve weeks"
      className="dashboard-bento p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="dashboard-kicker">
            <Clock className="h-3.5 w-3.5" />
            Study activity
          </p>
          <h2 className="mt-2 font-display text-lg font-bold tracking-tight">
            The last twelve weeks
          </h2>
        </div>
        <p className="text-xs font-medium text-text-dim tabular-nums">
          {plural(totals.materials + totals.sources, "item")} in 12 weeks
        </p>
      </div>

      <div className="mt-5 flex items-start gap-2.5">
        <div
          aria-hidden
          className="flex flex-col text-[9px] leading-none text-text-dim"
          style={{ gap: HEAT_GAP }}
        >
          {HEAT_DAYS.map((day, index) => (
            <span
              key={index}
              className="flex items-center"
              style={{ height: HEAT_CELL }}
            >
              {index % 2 === 1 ? day : ""}
            </span>
          ))}
        </div>

        <div
          ref={ref}
          className="relative"
          onPointerLeave={() => setHover(null)}
        >
          <AnimatePresence>
            {active ? (
              <motion.div
                key={active.day}
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 3, scale: 0.97 }}
                transition={still ? STILL : TIP}
                className="pointer-events-none absolute z-10"
                style={{ left: tipLeft, bottom: "calc(100% + 8px)" }}
              >
                <div className="-translate-x-1/2">
                  <HeatTip cell={active} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className="dash-heatmap"
            data-in={seen ? "true" : "false"}
            style={{ gridTemplateRows: `repeat(7, ${HEAT_CELL}px)` }}
          >
            {slots.map((cell, index) =>
              cell ? (
                <button
                  key={cell.day}
                  type="button"
                  onPointerEnter={() => setHover(index)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                  className="dash-heatmap__cell"
                  data-level={levelOf(cell.count)}
                  style={{
                    transitionDelay: still
                      ? undefined
                      : `${Math.floor(index / 7) * 26}ms`,
                  }}
                  aria-label={`${cell.label}: ${plural(cell.count, "item")}`}
                />
              ) : (
                <span
                  key={`pad-${index}`}
                  aria-hidden
                  className="dash-heatmap__cell dash-heatmap__cell--pad"
                />
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[10.5px] text-text-dim">
        <span className="mr-1">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            aria-hidden
            className="dash-heatmap__cell"
            data-level={level}
          />
        ))}
        <span className="ml-1">More</span>
        <span className="ml-auto hidden sm:inline">
          Items generated + sources added, per day
        </span>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Your library                                                     */
/* ------------------------------------------------------------------ */

function LibraryPanel({
  rows,
  busiest,
  onOpenRow,
  onOpenNotebooks,
  onCreateNotebook,
}: {
  rows: { kind: MaterialKind; label: string; value: number; color: string }[];
  busiest: number;
  onOpenRow: (kind: MaterialKind) => void;
  onOpenNotebooks: () => void;
  onCreateNotebook: () => void;
}) {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const { ref, seen } = useInViewOnce<HTMLUListElement>(0.15);

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Study material by kind"
      className="dashboard-bento flex flex-col p-6"
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
          <ActionButton
            tone="secondary"
            icon={<NotebookPen className="h-3.5 w-3.5" />}
            onClick={onOpenNotebooks}
          >
            Open notebooks
          </ActionButton>
          <ActionButton
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={onCreateNotebook}
          >
            New notebook
          </ActionButton>
        </div>
      </div>

      {rows.length > 0 ? (
        <ul ref={ref} className="mt-5 flex flex-col gap-1">
          {rows.map((row, index) => {
            const Icon = MATERIAL_ICONS[row.kind];
            return (
              <li key={row.kind}>
                <motion.button
                  type="button"
                  onClick={() => onOpenRow(row.kind)}
                  whileHover={still ? undefined : { x: 3 }}
                  transition={transition}
                  className="dash-librow group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)]"
                    style={{ color: row.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="w-20 shrink-0 truncate text-[13px] text-text-dim sm:w-24">
                    {row.label}
                  </span>
                  {/* Scaled against the biggest kind, so the bars compare. */}
                  <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]">
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: row.color }}
                      initial={{ width: "0%" }}
                      animate={{
                        width: seen
                          ? `${Math.round((row.value / busiest) * 100)}%`
                          : "0%",
                      }}
                      transition={
                        still ? STILL : { ...transition, delay: 0.06 * index }
                      }
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {row.value.toLocaleString()}
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--signal)] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </motion.button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-text-dim">
          Generated study material will appear here — open a notebook, add
          sources, then churn them into a summary, flashcards, a quiz, a mind
          map and slides.
        </p>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Recent activity                                                  */
/* ------------------------------------------------------------------ */

/**
 * The last five things that happened, straight from the rows: a source
 * landing or an artefact being generated, each with the timestamp the database
 * actually recorded. Nothing is rendered when nothing has happened.
 */
function RecentActivity({
  events,
  onOpen,
}: {
  events: RecentEvent[];
  onOpen: (event: RecentEvent) => void;
}) {
  const still = useStillMotion();
  const transition = useSpringTransition();

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Recent activity"
      className="dashboard-bento flex flex-col p-6"
    >
      <p className="dashboard-kicker">
        <Clock className="h-3.5 w-3.5" />
        Recent activity
      </p>
      <h2 className="mt-2 font-display text-lg font-bold tracking-tight">
        The last five things that happened
      </h2>

      <ul className="mt-4 flex flex-col gap-0.5">
        {events.map((event) => {
          const Icon =
            event.kind === "source" ? Upload : MATERIAL_ICONS[event.kind];
          return (
            <li key={`${event.kind}-${event.id}`}>
              <motion.button
                type="button"
                onClick={() => onOpen(event)}
                whileHover={still ? undefined : { x: 3 }}
                transition={transition}
                className="dash-librow group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] text-[var(--signal)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {event.label}
                  </span>
                  <span className="block truncate text-[11px] text-text-dim">
                    {event.kind === "source"
                      ? "Source added"
                      : `${MATERIAL_LABELS[event.kind]} generated`}{" "}
                    · {event.notebook} · {timeAgo(event.at)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-text-dim transition-transform group-hover:translate-x-0.5"
                />
              </motion.button>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Momentum                                                            */
/* ------------------------------------------------------------------ */

/**
 * Today's progress, as a streak and two checkable actions.
 *
 * The streak is computed from the same heatmap cells the calendar below
 * draws — consecutive days with at least one real row — so it cannot claim a
 * day the database has nothing for. The two steps are the only actions that
 * count: a source added today and one study item generated today. It exists to
 * make the next small action obvious, not to invent a reward.
 */
function MomentumCard({
  summary,
  onAddSource,
  onGenerate,
  onResume,
}: {
  summary: DashboardSummary;
  onAddSource: () => void;
  onGenerate: () => void;
  onResume: () => void;
}) {
  const transition = useSpringTransition();
  const cells = summary.heatmap;
  const todayIndex = cells.length - 1;
  const todaySources = summary.byDay?.[todayIndex]?.count ?? 0;
  const todayMaterials = (() => {
    const day = summary.materialsByDay[todayIndex];
    if (!day) return 0;
    return day.summary + day.flashcards + day.quiz + day.mindmap + day.slides;
  })();

  let streak = 0;
  let i = todayIndex;
  // Today only breaks a streak once it is over; an unfinished day is not a
  // missed day, so the walk starts at yesterday when today is still empty.
  if (i >= 0 && cells[i].count === 0) i -= 1;
  while (i >= 0 && cells[i].count > 0) {
    streak += 1;
    i -= 1;
  }

  const steps = [
    { label: "Add a source today", done: todaySources > 0 },
    { label: "Generate one study item", done: todayMaterials > 0 },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const complete = doneCount === steps.length;
  const next = todaySources === 0 ? "source" : todayMaterials === 0 ? "generate" : "resume";

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Today's momentum"
      className="dashboard-bento flex flex-col gap-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="dashboard-kicker">
            <Target className="h-3.5 w-3.5" />
            Today
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <Flame
              className="h-5 w-5 shrink-0 text-[var(--signal)]"
              aria-hidden
            />
            <span className="font-display text-2xl font-bold tracking-tight">
              {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
            </span>
          </p>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-text-dim">
            {complete
              ? "Today is done. Anything else from here is a bonus."
              : streak > 0
                ? "Today is not counted yet — one small action keeps the chain alive."
                : "One source or one generated item is all a day needs to count."}
          </p>
        </div>

        <button
          type="button"
          onClick={
            next === "source" ? onAddSource : next === "generate" ? onGenerate : onResume
          }
          className="dash-action dash-action--primary shrink-0"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {next === "resume" ? (
              <ArrowRight className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {next === "source"
              ? "Add today's source"
              : next === "generate"
                ? "Generate one item"
                : "Open notebook"}
          </span>
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.label}
            className={
              "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px] " +
              (step.done
                ? "border-[color-mix(in_srgb,var(--signal)_38%,transparent)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] text-foreground"
                : "border-[var(--card-border)] text-text-dim")
            }
          >
            <span
              className={
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                (step.done
                  ? "border-[var(--signal)] text-[var(--signal)]"
                  : "border-[var(--card-border)]")
              }
            >
              {step.done ? <Check className="h-3 w-3" /> : null}
            </span>
            {step.label}
          </div>
        ))}
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Weak spots                                                          */
/* ------------------------------------------------------------------ */

/**
 * The mistakes Check My Work has actually logged, grouped by the move that
 * went wrong.
 *
 * Every row here comes from `mathHistory.mistakes`, so the panel can only
 * point at a slip the student really made — the count is how many times that
 * exact move was marked wrong, not an estimate. It exists to close the loop:
 * the dashboard says what to revise, and the button opens the bench where it
 * gets practised.
 */
function WeakSpots({ onOpenMathLab }: { onOpenMathLab: () => void }) {
  const transition = useSpringTransition();
  const summary = useQuery(api.mathHistory.mistakes);
  const entries = (summary?.entries ?? []).slice(0, 3);

  return (
    <motion.section
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
      aria-label="Your weak spots"
      className="dashboard-bento flex flex-col gap-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="dashboard-kicker">
            <ListChecks className="h-3.5 w-3.5" />
            Weak spots
          </p>
          <p className="mt-2 font-display text-base font-semibold tracking-tight sm:text-lg">
            {entries.length > 0
              ? "The slips that keep costing marks"
              : summary && summary.total > 0
                ? "Your checked work is clean"
                : "Nothing to fix yet"}
          </p>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-text-dim">
            {entries.length > 0
              ? "Every row below was marked wrong by Check My Work — most frequent first."
              : summary && summary.total > 0
                ? `${summary.attempts} checked ${summary.attempts === 1 ? "problem" : "problems"}, no recurring slip. Keep the bar high.`
                : "Run one problem through Check My Work and the moves you keep missing surface here."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenMathLab}
          className="dash-action dash-action--secondary shrink-0"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {entries.length > 0 ? "Practise these" : "Try Check My Work"}
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>

      {entries.length > 0 ? (
        <ul className="flex flex-col divide-y divide-[var(--card-border)]">
          {entries.map((entry) => (
            <li key={`${entry.stepTitle}-${entry.rule}`}>
              <button
                type="button"
                onClick={onOpenMathLab}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-foreground"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">
                    {entry.stepTitle}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-relaxed text-text-dim">
                    {entry.rule || entry.note}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10.5px] tabular-nums text-text-dim">
                  ×{entry.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] px-3 py-3 text-[11.5px] leading-relaxed text-text-dim">
          Solve, then paste your working into Check My Work in the Math Lab. Each
          slip the checker flags lands here, and repeats climb the list.
        </div>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function DashboardOverview({
  summary,
  notebooks,
  onOpenNotebook,
  onOpenNotebooks,
  onCreateNotebook,
  onOpenMathLab,
}: {
  summary: DashboardSummary | undefined;
  notebooks: DashboardNotebook[];
  /** Open a notebook, optionally landing on one of its panels. */
  onOpenNotebook: (notebookId: string, target?: WorkspaceTarget) => void;
  onOpenNotebooks: () => void;
  onCreateNotebook: () => void;
  /** Open the Math Lab, where weak-spot practice lives. */
  onOpenMathLab: () => void;
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
      day: day.day,
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
          <ResumeBlock
            notebook={resumeTarget}
            onResume={(notebookId) => onOpenNotebook(notebookId)}
          />
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

  const resumeId = resumeTarget?.id ?? null;
  const openWorkspace = (target?: WorkspaceTarget) => {
    if (resumeId) onOpenNotebook(resumeId, target);
    else onOpenNotebooks();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 0. The three next steps, under the greeting. */}
      {resumeTarget && (
        <QuickActions
          onUploadSource={() => openWorkspace({ focus: "sources" })}
          onGenerateQuiz={() =>
            openWorkspace({ tab: "quiz", focus: "materials" })
          }
          onOpenLast={() => openWorkspace()}
        />
      )}

      {/* 1. The focal block: the notebook last worked in. */}
      {resumeTarget && (
        <ResumeBlock
          notebook={resumeTarget}
          onResume={(notebookId) => onOpenNotebook(notebookId)}
        />
      )}

      {/* 2. Today's momentum — the small daily loop that brings students back. */}
      <MomentumCard
        summary={summary}
        onAddSource={() => openWorkspace({ focus: "sources" })}
        onGenerate={() => openWorkspace({ tab: "quiz", focus: "materials" })}
        onResume={() => openWorkspace()}
      />

      {/* 3. What the checker says keeps going wrong — the return loop. */}
      <WeakSpots onOpenMathLab={onOpenMathLab} />

      {/* 4. Real counts, as controls. */}
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
          onOpen={onOpenNotebooks}
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
          onOpen={() => openWorkspace({ focus: "sources" })}
        />
        <MetricTile
          index={2}
          label="This week"
          value={summary.addedThisWeek}
          detail="Sources added in 7 days"
          delta={deltaChip(summary.addedThisWeek, summary.sourcesPrevWeek)}
          icon={NotebookPen}
          onOpen={() => openWorkspace({ focus: "materials" })}
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
          onOpen={() => openWorkspace({ focus: "materials" })}
        />
      </section>

      {/* 5. Used out of total, in absolute numbers. */}
      <AllowanceLine />

      {/* 6. Seven days, as bars. */}
      <ActivityBars data={activity} />

      {/* 7. Twelve weeks, as a calendar. */}
      <ActivityHeatmap cells={summary.heatmap} />

      {/* 8. What the material is made of, and what just happened. */}
      <div
        className={
          summary.recent.length > 0 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"
        }
      >
        <LibraryPanel
          rows={materialRows}
          busiest={busiestKind}
          onOpenRow={(kind) =>
            openWorkspace({ tab: kind, focus: "materials" })
          }
          onOpenNotebooks={onOpenNotebooks}
          onCreateNotebook={onCreateNotebook}
        />
        {summary.recent.length > 0 && (
          <RecentActivity
            events={summary.recent}
            onOpen={(event) =>
              onOpenNotebook(event.notebookId, {
                focus: event.kind === "source" ? "sources" : "materials",
                tab: event.kind === "source" ? undefined : event.kind,
              })
            }
          />
        )}
      </div>
    </div>
  );
}

