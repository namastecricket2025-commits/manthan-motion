import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import HeroPreview from "@/components/landing/HeroPreview";
import BlobBackground from "@/components/landing/BlobBackground";
import BarChart from "@/components/charts/bar-chart";
import Bar from "@/components/charts/bar";
import BarXAxis from "@/components/charts/bar-x-axis";
import Grid from "@/components/charts/grid";
import PieCenter from "@/components/charts/pie-center";
import PieChart from "@/components/charts/pie-chart";
import PieSlice from "@/components/charts/pie-slice";
import { ChartTooltip } from "@/components/charts/tooltip";
import NotebooksSection from "@/components/dashboard/NotebooksSection";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Sample data — clearly labelled in the UI until real data exists.    */
/* ------------------------------------------------------------------ */
const MIX = [
  { label: "Flashcards", value: 14, color: "var(--signal)" },
  { label: "Summaries", value: 6, color: "var(--signal-2)" },
  { label: "Question banks", value: 4, color: "#b97750" },
];

const WEEK = [
  { day: "Mon", Minutes: 35 },
  { day: "Tue", Minutes: 20 },
  { day: "Wed", Minutes: 45 },
  { day: "Thu", Minutes: 25 },
  { day: "Fri", Minutes: 60 },
  { day: "Sat", Minutes: 15 },
  { day: "Sun", Minutes: 40 },
];



interface QueueItem {
  id: number;
  name: string;
  detail: string;
  kind: "file" | "link";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState<number | null>(null);
  /** Sidebar tabs — Notebooks renders its own full section. */
  const [view, setView] = useState<"dashboard" | "notebooks">("dashboard");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: 1, name: "thermo-ch4.pdf", detail: "2.4 MB · PDF", kind: "file" },
    { id: 2, name: "khanacademy.org/electrostatics", detail: "Link", kind: "link" },
  ]);
  const [linkValue, setLinkValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    // Runs on mount and whenever the sidebar tab changes — newly mounted
    // panels glide in as they appear.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.07,
        },
      );
    }, root);
    return () => ctx.revert();
  }, [view]);

  const addToQueue = (items: Omit<QueueItem, "id">[]) => {
    setQueue((q) => [...q, ...items.map((it, i) => ({ ...it, id: Date.now() + i }))]);
    const count = items.length;
    if (count > 0) {
      toast(`${count === 1 ? "Source" : `${count} sources`} added to the queue`, {
        description: "Ready for the five-step pipeline.",
      });
    }
  };

  const removeFromQueue = (id: number, name: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
    toast("Source removed", { description: name });
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addToQueue(
      Array.from(files).map((f) => ({
        name: f.name,
        detail: `${(f.size / 1024 / 1024).toFixed(1)} MB · ${f.type.split("/")[1]?.toUpperCase() ?? "FILE"}`,
        kind: "file" as const,
      })),
    );
  };

  const addLink = () => {
    const url = linkValue.trim();
    if (!url) return;
    addToQueue([{ name: url, detail: "Link", kind: "link" }]);
    setLinkValue("");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {(
        [
          { label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
          { label: "Notebooks", icon: BookOpen, key: "notebooks" },
        ] as const
      ).map((item) => {
        const active = view === item.key;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setView(item.key);
              setSheetOpen(false);
            }}
            className={
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors " +
              (active
                ? "border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-foreground"
                : "border border-transparent text-text-dim hover:text-foreground")
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
      <span className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-dim">
        <Menu className="h-4 w-4" />
        Settings
        <span className="ml-auto text-[10px] uppercase tracking-widest text-text-dim/70">
          soon
        </span>
      </span>
    </nav>
  );

  return (
    <div ref={rootRef} className="relative min-h-screen bg-background text-foreground">
      {/* Same pixelated-blob canvas as the homepage — the dashboard lives in
          the same visual world as the marketing site. */}
      <BlobBackground />
      <div className="relative z-10">
        {/* ---- Sidebar (desktop) ---- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between border-r border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-5 backdrop-blur-xl min-[760px]:flex">
        <div className="flex flex-col gap-8">
          <Logo />
          {nav}
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[var(--card-border)] bg-transparent"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ---- Mobile top bar ---- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-xl min-[760px]:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="glass-chip inline-flex h-10 w-10 items-center justify-center text-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[80vw] max-w-xs border-r border-[var(--card-border)] bg-[var(--ink)]/95 backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <div className="px-2">{nav}</div>
              <div className="mt-auto px-4 pb-8">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-[var(--card-border)] bg-transparent"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ---- Main ---- */}
      <main className="px-4 py-6 sm:px-6 min-[760px]:ml-60 md:py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {view === "dashboard" ? (
            <>
          {/* Greeting */}
          <div data-reveal className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                {greeting()}
              </p>
              <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {user?.name ?? "Welcome back"}
                <span className="text-[var(--signal)]">.</span>
              </h1>
            </div>
            <span className="glass-chip px-3 py-1.5 text-[11px] font-medium text-text-dim">
              Sample data — your kits will appear here
            </span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: "Study kits", value: "3" },
              { label: "Flashcards", value: "24" },
              { label: "Sources", value: "2" },
            ].map((s) => (
              <div key={s.label} data-reveal className="glass-panel p-4 sm:p-5">
                <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1 text-[11px] font-medium text-text-dim sm:text-xs">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Charts row — Bklit UI */}
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            {/* Material mix donut */}
            <div data-reveal className="glass-panel p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold tracking-tight">
                  Material mix
                </h2>
                <span className="text-[11px] font-medium text-text-dim">this week</span>
              </div>
              <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
                <div className="w-full max-w-[220px] shrink-0">
                  <PieChart
                    data={MIX}
                    innerRadius={62}
                    cornerRadius={4}
                    padAngle={0.04}
                    hoveredIndex={hovered}
                    onHoverChange={setHovered}
                    hoverOffset={6}
                  >
                    {MIX.map((_, i) => (
                      <PieSlice key={i} index={i} />
                    ))}
                    <PieCenter defaultLabel="Total items" />
                  </PieChart>
                </div>
                {/* Hover-synced legend */}
                <ul className="w-full space-y-1.5">
                  {MIX.map((m, i) => (
                    <li key={m.label}>
                      <button
                        type="button"
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(i)}
                        onBlur={() => setHovered(null)}
                        className={
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors " +
                          (hovered === i
                            ? "bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                            : "")
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: m.color }}
                        />
                        <span className="text-text-dim">{m.label}</span>
                        <span className="ml-auto font-medium tabular-nums">{m.value}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Weekly activity bars */}
            <div data-reveal className="glass-panel p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold tracking-tight">
                  Study activity
                </h2>
                <span className="text-[11px] font-medium text-text-dim">minutes / day</span>
              </div>
              <div className="mt-4">
                <BarChart data={WEEK} xDataKey="day" aspectRatio="16 / 9" margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                  <Grid horizontal />
                  <Bar dataKey="Minutes" fill="var(--signal)" lineCap={6} />
                  <BarXAxis />
                  <ChartTooltip showCrosshair={false} />
                </BarChart>
              </div>
            </div>
          </div>

          {/* Upload queue + pipeline */}
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div data-reveal className="glass-panel p-5 sm:p-6">
              <h2 className="font-display text-base font-bold tracking-tight">
                Add sources
              </h2>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onFiles(e.dataTransfer.files);
                }}
                className={
                  "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors " +
                  (dragOver
                    ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                    : "border-[var(--card-border)] hover:border-[var(--signal)]")
                }
              >
                <Upload className="h-5 w-5 text-[var(--signal)]" />
                <span className="text-sm font-medium">Drop files or click to browse</span>
                <span className="text-xs text-text-dim">PDF, DOCX, PPTX, images</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                  <input
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                    placeholder="Paste a link…"
                    className="w-full rounded-full border border-[var(--card-border)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                  />
                </div>
                <Button
                  className="gap-1.5 rounded-full bg-[var(--signal)] px-4 text-[var(--primary-foreground)] hover:bg-[var(--signal)]/90"
                  onClick={addLink}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {/* Queue */}
              <ul className="mt-4 space-y-2">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-2.5"
                  >
                    {item.kind === "file" ? (
                      <FileText className="h-4 w-4 shrink-0 text-[var(--signal)]" />
                    ) : (
                      <Link2 className="h-4 w-4 shrink-0 text-[var(--signal)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="hidden text-xs text-text-dim sm:block">{item.detail}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeFromQueue(item.id, item.name)}
                      className="rounded-full p-1 text-text-dim transition-colors hover:bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] hover:text-[var(--signal)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
                {queue.length === 0 && (
                  <li className="rounded-xl border border-dashed border-[var(--card-border)] px-3.5 py-4 text-center text-sm text-text-dim">
                    Queue is empty — add a file or link above.
                  </li>
                )}
              </ul>
            </div>

            {/* Live pipeline preview (reused from the landing hero) */}
            <div data-reveal>
              <HeroPreview />
            </div>
          </div>

            </>
          ) : (
            <>
              {/* Notebooks tab — page header + the same section as the landing */}
              <div data-reveal className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                    Notebooks
                  </p>
                  <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                    Your study kits
                    <span className="text-[var(--signal)]">.</span>
                  </h1>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New notebook
                </button>
              </div>
              <div data-reveal>
                <NotebooksSection showHeader={false} />
              </div>
            </>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
