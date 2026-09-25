import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, FileText, NotebookPen, Sparkles } from "lucide-react";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";

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
  const readablePercent = summary.sourceCount
    ? Math.round((summary.readableCount / summary.sourceCount) * 100)
    : 0;

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
            {sourceData.length > 0 ? (
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>
                      {sourceData.map((entry, index) => <Cell key={entry.name} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--panel-bg)", border: "1px solid var(--card-border)", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-8 text-sm text-text-dim">No readable sources yet.</p>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-text-dim">
              {sourceData.map((item, index) => <span key={item.name} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />{item.name} · {item.value}</span>)}
            </div>
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
              <div className="mt-6 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="var(--card-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "var(--card-border)", opacity: 0.25 }} contentStyle={{ background: "var(--panel-bg)", border: "1px solid var(--card-border)", borderRadius: 12 }} />
                    <Bar dataKey="value" fill="var(--signal)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
