import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Link2,
  NotebookPen,
  Sparkles,
  Type,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { SPRING } from "@/lib/motion";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { cn } from "@/lib/utils";

export type DashboardSummary = {
  notebookCount: number;
  sourceCount: number;
  fileCount: number;
  linkCount: number;
  notesCount: number;
  readableCount: number;
  failedCount: number;
  addedThisWeek: number;
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
};

type ActivityPoint = {
  label: string;
  value: number;
};

const KIND_ORDER = [
  "summary",
  "flashcards",
  "quiz",
  "mindmap",
  "slides",
] as const;

const SOURCE_META = [
  { key: "fileCount" as const, label: "Files", icon: FileText, color: "#0a84ff" },
  { key: "linkCount" as const, label: "Links", icon: Link2, color: "#30d158" },
  { key: "notesCount" as const, label: "Notes", icon: Type, color: "#bf5af2" },
];

function ActivityRing({
  sourceCount,
  readableCount,
  generatedCount,
  failedCount,
}: {
  sourceCount: number;
  readableCount: number;
  generatedCount: number;
  failedCount: number;
}) {
  const reducedMotion = useReducedMotion();
  const readableRatio = sourceCount > 0 ? readableCount / sourceCount : 0;
  const activityUnits = sourceCount + generatedCount;
  const activityRatio = Math.min(1, activityUnits / 20);
  const radius = 67;
  const circumference = 2 * Math.PI * radius;
  const readableOffset = circumference * (1 - Math.min(1, readableRatio));
  const activityOffset = circumference * (1 - activityRatio);
  const readableLabel = sourceCount === 0 ? "No sources yet" : `${readableCount} of ${sourceCount} sources ready`;
  const activityLabel =
    generatedCount > 0
      ? `${generatedCount} study ${generatedCount === 1 ? "item" : "items"} created`
      : sourceCount > 0
        ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} in your library`
        : "Your activity will appear here";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative h-[176px] w-[176px] shrink-0" aria-label={readableLabel}>
        <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_58%)]" />
        <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160" role="img">
          <defs>
            <linearGradient id="activity-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a84ff" />
              <stop offset="0.52" stopColor="#5e5ce6" />
              <stop offset="1" stopColor="#64d2ff" />
            </linearGradient>
            <filter id="activity-ring-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(142,142,147,0.15)" strokeWidth="8" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="rgba(48,209,88,0.82)"
            strokeDasharray={circumference}
            strokeDashoffset={readableOffset}
            strokeLinecap="round"
            strokeWidth="5"
          />
          {activityUnits > 0 && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="url(#activity-ring)"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: activityOffset }}
              filter="url(#activity-ring-glow)"
              strokeLinecap="round"
              strokeWidth="8"
              transition={reducedMotion ? { duration: 0 } : SPRING}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-semibold tracking-[-0.05em] tabular-nums">
            {sourceCount === 0 ? "—" : `${Math.round(readableRatio * 100)}%`}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-text-dim">
            AI ready
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">
          Workspace pulse
        </p>
        <h3 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.025em]">
          {readableLabel}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{activityLabel}</p>
        {failedCount > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-text-dim">
            {failedCount} {failedCount === 1 ? "source needs" : "sources need"} attention before generation.
          </p>
        )}
        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim sm:justify-start">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-[#30d158] shadow-[0_0_8px_rgba(48,209,88,0.55)]" />
            Ready
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-[#64d2ff] shadow-[0_0_8px_rgba(100,210,255,0.55)]" />
            Activity
          </span>
        </div>
      </div>
    </div>
  );
}

function buildSpline(points: ActivityPoint[]) {
  if (points.length < 2) return { line: "", area: "" };
  const width = 760;
  const height = 244;
  const insetX = 18;
  const insetTop = 24;
  const insetBottom = 30;
  const max = Math.max(...points.map((point) => point.value), 1);
  const usableWidth = width - insetX * 2;
  const usableHeight = height - insetTop - insetBottom;
  const coords = points.map((point, index) => ({
    ...point,
    x: insetX + (index * usableWidth) / (points.length - 1),
    y: insetTop + usableHeight - (point.value / max) * usableHeight,
  }));

  let line = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlOffset = (next.x - current.x) * 0.48;
    line += ` C ${current.x + controlOffset} ${current.y}, ${next.x - controlOffset} ${next.y}, ${next.x} ${next.y}`;
  }
  const area = `${line} L ${coords[coords.length - 1].x} ${height - insetBottom} L ${coords[0].x} ${height - insetBottom} Z`;
  return { line, area };
}

function GradientAreaSpline({ data }: { data: ActivityPoint[] }) {
  const reducedMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { line, area } = useMemo(() => buildSpline(data), [data]);
  const active = activeIndex == null ? null : data[activeIndex];

  return (
    <div className="relative h-[250px] w-full select-none">          {data.length > 1 ? (
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 760 244"
          preserveAspectRatio="none"
          role="img"
          aria-label="Study material generated over the last seven days"
          onPointerLeave={() => setActiveIndex(null)}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            setActiveIndex(Math.round(ratio * (data.length - 1)));
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0.94" y2="0">
              <stop offset="0" stopColor="#0a84ff" />
              <stop offset="0.48" stopColor="#5e5ce6" />
              <stop offset="1" stopColor="#bf5af2" />
            </linearGradient>
            <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5e5ce6" stopOpacity="0.34" />
              <stop offset="0.48" stopColor="#0a84ff" stopOpacity="0.12" />
              <stop offset="1" stopColor="#0a84ff" stopOpacity="0" />
            </linearGradient>
            <filter id={`${gradientId}-glow`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`${gradientId}-edge`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.62)" />
              <stop offset="0.35" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.36)" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((lineIndex) => {
            const y = 28 + lineIndex * 61;
            return (
              <line
                key={lineIndex}
                x1="18"
                x2="742"
                y1={y}
                y2={y}
                stroke="var(--glass-hairline)"
                strokeWidth="1"
              />
            );
          })}
          <motion.path
            d={area}
            fill={`url(#${gradientId}-fill)`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { ...SPRING, delay: 0.08 }}
          />
          <motion.path
            d={line}
            fill="none"
            filter={`url(#${gradientId}-glow)`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeWidth="2.4"
            vectorEffect="non-scaling-stroke"
            transition={reducedMotion ? { duration: 0 } : SPRING}
          />
          <path d={line} fill="none" stroke={`url(#${gradientId}-edge)`} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          {active && (
            <g>
              <line
                x1={18 + (760 - 36) * ((activeIndex ?? 0) / Math.max(data.length - 1, 1))}
                x2={18 + (760 - 36) * ((activeIndex ?? 0) / Math.max(data.length - 1, 1))}
                y1="18"
                y2="214"
                stroke="rgba(255,255,255,0.2)"
                strokeDasharray="3 5"
              />
              <circle
                cx={18 + (760 - 36) * ((activeIndex ?? 0) / Math.max(data.length - 1, 1))}
                cy={214 - (active.value / Math.max(...data.map((point) => point.value), 1)) * 190}
                r="4"
                fill="var(--background)"
                stroke="#8e8eff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-text-dim">Loading activity…</div>
      )}

      {active && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-right shadow-xl backdrop-blur-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">{active.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-white tabular-nums">
            {active.value} {active.value === 1 ? "item" : "items"}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[9px] font-medium uppercase tracking-[0.1em] text-text-dim">
        {data.map((point) => (
          <span key={point.label}>{point.label.slice(0, 3)}</span>
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("dashboard-metric group", className)}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      whileHover={{ y: -3, scale: 1.008 }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">{label}</span>
        <span className="dashboard-metric-icon" style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>
      </div>
      <p className="mt-5 font-display text-[2rem] font-semibold leading-none tracking-[-0.055em] tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-text-dim">{detail}</p>
    </motion.div>
  );
}

export function DashboardOverview({
  summary,
  notebookCount,
  onOpenNotebooks,
  onCreateNotebook,
}: {
  summary: DashboardSummary | undefined;
  notebookCount: number;
  onOpenNotebooks: () => void;
  onCreateNotebook: () => void;
}) {
  if (!summary) {
    return <div className="glass-panel p-6 text-sm text-text-dim">Loading your workspace…</div>;
  }

  const generatedCount = KIND_ORDER.reduce(
    (total, kind) => total + (summary.materialsByKind[kind] ?? 0),
    0,
  );
  const activityData: ActivityPoint[] = summary.materialsByDay.map((day) => ({
    label: day.day,
    value:
      day.summary +
      day.flashcards +
      day.quiz +
      day.mindmap +
      day.slides,
  }));
  const generatedThisWeek = activityData.reduce((total, day) => total + day.value, 0);
  const readyRatio = summary.sourceCount
    ? Math.round((summary.readableCount / summary.sourceCount) * 100)
    : 0;
  const mix = SOURCE_META.filter((item) => summary[item.key] > 0);
  const generatedKinds = KIND_ORDER.filter((kind) => (summary.materialsByKind[kind] ?? 0) > 0);

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={SPRING}
    >
      <section aria-label="Workspace summary" className="grid grid-cols-2 gap-3 min-[1080px]:grid-cols-4">
        <MetricTile
          label="Notebooks"
          value={notebookCount}
          detail={notebookCount === 1 ? "One subject in progress" : `${notebookCount} subjects in progress`}
          icon={BookOpen}
          accent="#0a84ff"
        />
        <MetricTile
          label="Sources"
          value={summary.sourceCount}
          detail={`${readyRatio}% ready for generation`}
          icon={NotebookPen}
          accent="#5e5ce6"
        />
        <MetricTile
          label="This week"
          value={summary.addedThisWeek}
          detail={`${generatedThisWeek} study items created`}
          icon={Activity}
          accent="#30d158"
          className="hidden min-[1080px]:block"
        />
        <MetricTile
          label="Study library"
          value={generatedCount}
          detail={`${generatedKinds.length} material ${generatedKinds.length === 1 ? "type" : "types"} ready`}
          icon={BrainCircuit}
          accent="#bf5af2"
          className="hidden min-[540px]:block min-[1080px]:block"
        />
      </section>

      {summary.sourceCount > 0 ? (
        <section className="grid grid-cols-1 gap-4 min-[920px]:grid-cols-[0.9fr_1.35fr]">
          <motion.article
            className="glass-panel dashboard-chart-card p-5 sm:p-6"
            initial={{ opacity: 0, y: 22, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="dashboard-kicker">Storage & activity</p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.025em]">Your learning pulse</h2>
              </div>
              <Sparkles className="h-4 w-4 text-[var(--signal)]" />
            </div>
            <div className="mt-6">
              <ActivityRing
                sourceCount={summary.sourceCount}
                readableCount={summary.readableCount}
                generatedCount={generatedCount}
                failedCount={summary.failedCount}
              />
            </div>
            {mix.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--glass-hairline)] pt-4">
                {mix.map((item) => (
                  <span key={item.key} className="glass-chip inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-text-dim">
                    <item.icon className="h-3 w-3" style={{ color: item.color }} />
                    {item.label} · {summary[item.key]}
                  </span>
                ))}
              </div>
            )}
          </motion.article>

          <motion.article
            className="glass-panel dashboard-chart-card min-w-0 p-5 sm:p-6"
            initial={{ opacity: 0, y: 22, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRING, delay: 0.06 }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="dashboard-kicker">Creation rhythm</p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.025em]">Study material</h2>
                <p className="mt-1 text-[11px] text-text-dim">A single view of everything created over the last seven days.</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold tracking-[-0.04em] tabular-nums">{generatedThisWeek}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-dim">last 7 days</p>
              </div>
            </div>
            <div className="mt-3">
              <GradientAreaSpline data={activityData} />
            </div>
            {generatedThisWeek === 0 && (
              <p className="-mt-1 text-center text-[11px] leading-relaxed text-text-dim">
                No new study material yet. Generate from a notebook and the curve will rise here.
              </p>
            )}
          </motion.article>
        </section>
      ) : (
        <motion.section
          className="glass-panel p-6 sm:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <CheckCircle2 className="h-6 w-6 text-[var(--signal)]" />
          <h2 className="mt-4 font-display text-xl font-semibold tracking-[-0.025em]">Ready for your first source</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
            Add a file, link or note to a notebook. Once it has readable text, your activity ring and weekly curve come alive.
          </p>
        </motion.section>
      )}

      <motion.section
        className="glass-panel overflow-hidden p-5 sm:p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.08 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="dashboard-kicker">Your library</p>
            <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.025em]">Keep the momentum</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <MovingBorderButton
              onClick={onOpenNotebooks}
              className="w-fit"
              innerClassName="px-4 py-2 text-[12px]"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Open notebooks
            </MovingBorderButton>
            <ButtonGlass onClick={onCreateNotebook} icon={Sparkles} label="New notebook" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Summaries", value: summary.materialsByKind.summary ?? 0, color: "#0a84ff" },
            { label: "Flashcards", value: summary.materialsByKind.flashcards ?? 0, color: "#30d158" },
            { label: "Quizzes", value: summary.materialsByKind.quiz ?? 0, color: "#bf5af2" },
          ].map((item) => (
            <div key={item.label} className="dashboard-mini-stat">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color, boxShadow: `0 0 10px ${item.color}99` }} />
              <span className="text-[11px] text-text-dim">{item.label}</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function ButtonGlass({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="glass-chip inline-flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-[var(--card-border)] hover:text-[var(--signal)]"
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.button>
  );
}
