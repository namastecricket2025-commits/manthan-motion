import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { SPRING } from "@/lib/motion";
import { BookOpen, FileText, NotebookPen, Sparkles } from "lucide-react";

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

const MATERIAL_KINDS = ["summary", "flashcards", "quiz", "mindmap", "slides"] as const;
const MATERIAL_LABELS: Record<(typeof MATERIAL_KINDS)[number], string> = {
  summary: "Summaries",
  flashcards: "Flashcards",
  quiz: "Quizzes",
  mindmap: "Mind maps",
  slides: "Slides",
};
const SOURCE_COLORS = ["#c81f27", "#b0773c", "#6d7f63"];

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof BookOpen;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)]/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-text-dim">{label}</span>
        <Icon className="h-4 w-4 text-[var(--signal)]" />
      </div>
      <p className="mt-4 font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-text-dim">{detail}</p>
    </div>
  );
}

function SourceBreakdown({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <PieChart
        data={data.map((item) => ({ label: item.name, value: item.value }))}
        size={196}
        innerRadius={0}
        padAngle={0.035}
        cornerRadius={5}
        hoverOffset={8}
        enterTransition={SPRING}
        className="shrink-0"
      >
        {data.map((item, index) => (
          <PieSlice key={item.name} index={index} color={SOURCE_COLORS[index % SOURCE_COLORS.length]} hoverEffect="translate" />
        ))}
      </PieChart>
      <div className="w-full min-w-0">
        <p className="text-xs font-medium text-text-dim">Source breakdown</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight tabular-nums">{total}</p>
        <p className="mt-1 text-xs text-text-dim">total sources in your library</p>
        <div className="mt-5 space-y-3">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />
              <span className="min-w-0 flex-1 truncate text-text-dim">{item.name}</span>
              <span className="font-semibold tabular-nums">{item.value}</span>
              <span className="w-10 text-right text-xs text-text-dim tabular-nums">{total ? Math.round((item.value / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
    return <div className="glass-panel p-6 text-sm text-text-dim">Loading your workspace...</div>;
  }

  const sourceData = [
    { name: "Files", value: summary.fileCount },
    { name: "Links", value: summary.linkCount },
    { name: "Notes", value: summary.notesCount },
  ].filter((item) => item.value > 0);
  const materialData = MATERIAL_KINDS.map((kind) => ({
    name: MATERIAL_LABELS[kind],
    value: summary.materialsByKind[kind] ?? 0,
  })).filter((item) => item.value > 0);
  const activityData = summary.materialsByDay.map((day) => ({
    label: day.label,
    value: day.summary + day.flashcards + day.quiz + day.mindmap + day.slides,
  }));
  const generatedCount = materialData.reduce((total, item) => total + item.value, 0);
  const readablePercent = summary.sourceCount ? Math.round((summary.readableCount / summary.sourceCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Workspace summary">
        <StatCard label="Notebooks" value={notebookCount} detail="Your study spaces" icon={BookOpen} />
        <StatCard label="Sources" value={summary.sourceCount} detail={`${readablePercent}% readable`} icon={NotebookPen} />
        <StatCard label="This week" value={summary.addedThisWeek} detail="New sources added" icon={FileText} />
        <StatCard label="Study material" value={generatedCount} detail="Items generated" icon={Sparkles} />
      </section>

      {summary.sourceCount > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)]/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-text-dim">Source mix</p>
                <h2 className="mt-1 font-display text-lg font-bold tracking-tight">What you are studying</h2>
              </div>
              <span className="text-xs text-text-dim">{summary.sourceCount} total</span>
            </div>
            <div className="mt-5"><SourceBreakdown data={sourceData} /></div>
          </div>

          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)]/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-text-dim">Study material</p>
                <h2 className="mt-1 font-display text-lg font-bold tracking-tight">Created this week</h2>
              </div>
              <span className="text-xs text-text-dim">{generatedCount} total</span>
            </div>
            {activityData.length > 0 ? (
              <div className="mt-5 h-[250px]">
                <BarChart
                  data={activityData}
                  xDataKey="label"
                  aspectRatio="1.7 / 1"
                  margin={{ top: 12, right: 12, bottom: 28, left: 12 }}
                  barGap={0.28}
                  enterTransition={SPRING}
                  revealSignature={`${generatedCount}-${activityData.at(-1)?.value ?? 0}`}
                >
                  <Grid horizontal numTicksRows={4} stroke="var(--card-border)" />
                  <Bar dataKey="value" fill="var(--signal)" lineCap="round" />
                  <BarXAxis maxLabels={7} />
                  <BarYAxis />
                </BarChart>
              </div>
            ) : (
              <p className="mt-8 text-sm text-text-dim">No activity to chart yet.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)]/70 p-6">
          <h2 className="font-display text-lg font-bold tracking-tight">Ready for your first source</h2>
          <p className="mt-2 text-sm text-text-dim">Add a file, link or note to a notebook to start building your study library.</p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)]/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-text-dim">Your library</p>
            <h2 className="mt-1 font-display text-lg font-bold tracking-tight">Keep the momentum</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <MovingBorderButton onClick={onOpenNotebooks} className="w-fit" innerClassName="px-4 py-2 text-xs">
              <NotebookPen className="h-3.5 w-3.5" /> Open notebooks
            </MovingBorderButton>
            <MovingBorderButton onClick={onCreateNotebook} className="w-fit" innerClassName="px-4 py-2 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> New notebook
            </MovingBorderButton>
          </div>
        </div>
        {materialData.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {materialData.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-[var(--card-border)] px-3 py-2.5 text-sm">
                <span className="text-text-dim">{item.name}</span><span className="font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-dim">Generated study material will appear here.</p>
        )}
      </section>
    </div>
  );
}
