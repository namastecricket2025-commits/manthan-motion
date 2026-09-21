import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import BlobBackground from "@/components/BlobBackground";
import Bar from "@/components/charts/bar";
import BarChart from "@/components/charts/bar-chart";
import BarXAxis from "@/components/charts/bar-x-axis";
import Grid from "@/components/charts/grid";
import PieCenter from "@/components/charts/pie-center";
import PieChart from "@/components/charts/pie-chart";
import PieSlice from "@/components/charts/pie-slice";
import { ChartTooltip } from "@/components/charts/tooltip";
import {
  DashboardNav,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { NotebookWorkspace } from "@/components/dashboard/NotebookWorkspace";
import { Logo } from "@/components/landing/Logo";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  ArrowLeft,
  ArrowRight,
  Check,
  LogOut,
  Menu,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

/**
 * The dashboard has three faces:
 *
 *   /dashboard                    the overview — real counts, real charts
 *   /dashboard?view=notebooks     manage notebooks (create, rename, delete)
 *   /dashboard?notebook=<id>      the notebook workspace: sources in,
 *                                 study material out
 *
 * Every number shown comes from rows the signed-in user created. There is no
 * sample data anywhere: a new account sees an empty state and a first step.
 */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Shared "no rows yet" block, so empty states stay consistent. */
function EmptyHint({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof NotebookPen;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-[var(--signal)]" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-text-dim">{body}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const view =
    searchParams.get("view") === "notebooks" ? "notebooks" : "overview";
  const notebookParam = searchParams.get("notebook");

  const notebooks = useQuery(api.notebooks.list);
  const summary = useQuery(api.notebooks.summary);
  const createNotebook = useMutation(api.notebooks.create);
  const renameNotebook = useMutation(api.notebooks.rename);
  const removeNotebook = useMutation(api.notebooks.remove);

  const openNotebook = notebooks?.find((n) => n.id === notebookParam);

  const [hovered, setHovered] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.07 },
      );
    }, root);
    return () => ctx.revert();
  }, [view, notebookParam, notebooks?.length]);

  /* ---------------- actions ---------------- */

  async function handleCreateNotebook(event?: React.FormEvent) {
    event?.preventDefault();
    const name = draftName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const id = await createNotebook({ name });
      setDraftName("");
      toast("Notebook created", { description: name });
      navigate(`/dashboard?notebook=${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create notebook",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(notebookId: Id<"notebooks">) {
    const name = renameValue.trim();
    if (!name) return;
    try {
      await renameNotebook({ notebookId, name });
      setRenamingId(null);
      toast("Notebook renamed", { description: name });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rename notebook",
      );
    }
  }

  async function handleDelete(notebookId: Id<"notebooks">, name: string) {
    try {
      await removeNotebook({ notebookId });
      toast("Notebook deleted", { description: name });
      if (notebookParam === notebookId) navigate("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete notebook",
      );
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  /** Sidebar navigation: everything except Dashboard/Notebooks pushes a route. */
  const selectSection = (key: DashboardSection) => {
    setSheetOpen(false);
    if (key === "lab") navigate("/lab");
    else if (key === "settings") navigate("/settings");
    else if (key === "about") navigate("/about");
    else if (key === "notebooks") navigate("/dashboard?view=notebooks");
    else navigate("/dashboard");
  };

  const nav = (
    <DashboardNav
      active={view === "notebooks" ? "notebooks" : "dashboard"}
      onSelect={selectSection}
    />
  );

  const hasNotebooks = (notebooks?.length ?? 0) > 0;
  const mixData = summary
    ? [
        { label: "Files", value: summary.fileCount, color: "var(--signal)" },
        { label: "Links", value: summary.linkCount, color: "#b97750" },
      ].filter((d) => d.value > 0)
    : [];
  const weekData = summary?.byDay ?? [];
  const weekTotal = weekData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen bg-background text-foreground"
    >
      <BlobBackground />
      <div className="relative z-10">
        {/* ---- Sidebar (desktop) ---- */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between overflow-y-auto border-r border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-5 backdrop-blur-xl min-[760px]:flex">
          <div className="flex flex-col gap-8">
            <Logo />
            {nav}
          </div>
          <div className="flex items-center justify-between pt-6">
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
                className="w-[80vw] max-w-xs overflow-y-auto border-r border-[var(--card-border)] bg-[var(--ink)]/95 backdrop-blur-xl"
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
            <div
              data-reveal
              className="flex flex-wrap items-end justify-between gap-3"
            >
              <div className="min-w-0">
                {openNotebook ? (
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All notebooks
                  </button>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                    {greeting()}
                  </p>
                )}
                <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {openNotebook ? openNotebook.name : (user?.name ?? "Welcome")}
                  <span className="text-[var(--signal)]">.</span>
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
                  {openNotebook
                    ? "Add your sources, then churn them into study material."
                    : view === "notebooks"
                      ? "A notebook is one subject, chapter or exam. Name it, fill it with sources, then churn them."
                      : hasNotebooks
                        ? "Open a notebook to add sources and generate study material."
                        : "Create your first notebook, drop in your notes, and Manthan turns them into study material."}
                </p>
              </div>
              {openNotebook && (
                <MovingBorderButton
                  onClick={() => navigate("/dashboard?view=notebooks")}
                  innerClassName="px-5 py-2.5 text-[13px]"
                >
                  <NotebookPen className="h-4 w-4" />
                  All notebooks
                </MovingBorderButton>
              )}
            </div>

            {/* ================= WORKSPACE ================= */}
            {openNotebook ? (
              <NotebookWorkspace
                notebookId={openNotebook.id as Id<"notebooks">}
                notebookName={openNotebook.name}
              />
            ) : view === "notebooks" ? (
              /* ================= NOTEBOOKS MANAGER ================= */
              <>
                <div data-reveal className="glass-panel p-5 sm:p-6">
                  <h2 className="font-display text-base font-bold tracking-tight">
                    New notebook
                  </h2>
                  <form
                    onSubmit={handleCreateNotebook}
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="e.g. Physics — Electrostatics"
                      className="min-w-0 flex-1 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                    />
                    <MovingBorderButton
                      type="submit"
                      disabled={busy || !draftName.trim()}
                      className="w-full sm:w-fit"
                      innerClassName="px-6 py-3 text-sm"
                    >
                      Create notebook
                      <ArrowRight className="h-4 w-4" />
                    </MovingBorderButton>
                  </form>
                </div>

                <div
                  data-reveal
                  className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2"
                >
                  {notebooks?.map((notebook) => (
                    <div
                      key={notebook.id}
                      className="glass-panel flex flex-col gap-3 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {renamingId === notebook.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    void handleRename(
                                      notebook.id as Id<"notebooks">,
                                    );
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                className="w-44 rounded-lg border border-[var(--card-border)] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--signal)]"
                              />
                              <button
                                type="button"
                                aria-label="Save name"
                                onClick={() =>
                                  void handleRename(
                                    notebook.id as Id<"notebooks">,
                                  )
                                }
                                className="rounded-lg p-1 text-[var(--signal)]"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <h3 className="truncate font-display text-base font-bold tracking-tight">
                              {notebook.name}
                            </h3>
                          )}
                          <p className="mt-1 text-xs text-text-dim">
                            {notebook.sourceCount}{" "}
                            {notebook.sourceCount === 1 ? "source" : "sources"}
                            {" · "}
                            {notebook.fileCount} files · {notebook.linkCount}{" "}
                            links
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Rename ${notebook.name}`}
                            onClick={() => {
                              setRenamingId(notebook.id);
                              setRenameValue(notebook.name);
                            }}
                            className="rounded-lg p-1.5 text-text-dim transition-colors hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Delete ${notebook.name}`}
                                className="rounded-lg p-1.5 text-text-dim transition-colors hover:text-[var(--signal)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete “{notebook.name}”?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the notebook, the{" "}
                                  {notebook.sourceCount}{" "}
                                  {notebook.sourceCount === 1
                                    ? "source"
                                    : "sources"}{" "}
                                  inside it, and everything generated from them.
                                  It cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void handleDelete(
                                      notebook.id as Id<"notebooks">,
                                      notebook.name,
                                    )
                                  }
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <MovingBorderButton
                        onClick={() =>
                          navigate(`/dashboard?notebook=${notebook.id}`)
                        }
                        className="w-fit"
                        innerClassName="px-4 py-2 text-[13px]"
                      >
                        Open notebook
                        <ArrowRight className="h-3.5 w-3.5" />
                      </MovingBorderButton>
                    </div>
                  ))}
                </div>

                {notebooks?.length === 0 && (
                  <div data-reveal className="glass-panel p-5 sm:p-6">
                    <EmptyHint
                      icon={NotebookPen}
                      title="No notebooks yet"
                      body="Name a notebook after the subject or chapter you are revising, then add your sources to it."
                    />
                  </div>
                )}
              </>
            ) : (
              /* ================= OVERVIEW ================= */
              <>
                {notebooks === undefined && (
                  <div
                    data-reveal
                    className="glass-panel p-6 text-sm text-text-dim"
                  >
                    Loading your workspace…
                  </div>
                )}

                {!hasNotebooks && notebooks !== undefined && (
                  <div
                    data-reveal
                    className="glass-panel flex flex-col gap-5 p-6 sm:p-8"
                  >
                    <div>
                      <h2 className="font-display text-xl font-bold tracking-tight">
                        Start with a notebook
                      </h2>
                      <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
                        Nothing here yet — that is expected. Manthan only ever
                        shows what you have actually added.
                      </p>
                    </div>
                    <form
                      onSubmit={handleCreateNotebook}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Name it — e.g. Biology — Respiration"
                        className="min-w-0 flex-1 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                      />
                      <MovingBorderButton
                        type="submit"
                        disabled={busy || !draftName.trim()}
                        className="w-full sm:w-fit"
                        innerClassName="px-6 py-3 text-sm"
                      >
                        Create notebook
                        <ArrowRight className="h-4 w-4" />
                      </MovingBorderButton>
                    </form>
                    <ol className="grid gap-3 text-sm text-text-dim sm:grid-cols-4">
                      {[
                        "Name a notebook for the chapter you are revising.",
                        "Drop in PDFs, slides, links or pasted notes.",
                        "Churn them into a summary, flashcards, a quiz, a mind map and slides.",
                        "Revise straight from the notebook.",
                      ].map((step, i) => (
                        <li key={step} className="flex gap-2.5">
                          <span className="font-display font-bold text-[var(--signal)]">
                            0{i + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {hasNotebooks && (
                  <>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      {[
                        {
                          label: "Notebooks",
                          value: summary?.notebookCount ?? 0,
                        },
                        { label: "Sources", value: summary?.sourceCount ?? 0 },
                        {
                          label: "Added this week",
                          value: summary?.addedThisWeek ?? 0,
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          data-reveal
                          className="glass-panel p-4 sm:p-5"
                        >
                          <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                            {s.value}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-text-dim sm:text-xs">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Charts only exist once there is something to chart — a
                        brand-new workspace stays focused on its first step. */}
                    {(summary?.sourceCount ?? 0) > 0 && (
                      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                        <div data-reveal className="glass-panel p-5 sm:p-6">
                          <div className="flex items-center justify-between">
                            <h2 className="font-display text-base font-bold tracking-tight">
                              Source mix
                            </h2>
                            <span className="text-[11px] font-medium text-text-dim">
                              all time
                            </span>
                          </div>
                          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
                            <div className="w-full max-w-[220px] shrink-0">
                              <PieChart
                                data={mixData}
                                innerRadius={62}
                                cornerRadius={4}
                                padAngle={0.04}
                                hoveredIndex={hovered}
                                onHoverChange={setHovered}
                                hoverOffset={6}
                              >
                                {mixData.map((_, i) => (
                                  <PieSlice key={i} index={i} />
                                ))}
                                <PieCenter defaultLabel="Sources" />
                              </PieChart>
                            </div>
                            <ul className="w-full space-y-1.5">
                              {mixData.map((m, i) => (
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
                                    <span className="text-text-dim">
                                      {m.label}
                                    </span>
                                    <span className="ml-auto font-medium tabular-nums">
                                      {m.value}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div data-reveal className="glass-panel p-5 sm:p-6">
                          <div className="flex items-center justify-between">
                            <h2 className="font-display text-base font-bold tracking-tight">
                              Sources added
                            </h2>
                            <span className="text-[11px] font-medium text-text-dim">
                              last 7 days
                            </span>
                          </div>
                          <div className="mt-4">
                            {weekData.length > 0 ? (
                              <BarChart
                                data={weekData}
                                xDataKey="day"
                                aspectRatio="16 / 9"
                                margin={{
                                  top: 16,
                                  right: 8,
                                  bottom: 4,
                                  left: 0,
                                }}
                              >
                                <Grid horizontal />
                                <Bar
                                  dataKey="count"
                                  fill="var(--signal)"
                                  lineCap={6}
                                />
                                <BarXAxis />
                                <ChartTooltip showCrosshair={false} />
                              </BarChart>
                            ) : (
                              <p className="py-10 text-center text-xs text-text-dim">
                                Loading…
                              </p>
                            )}
                          </div>
                          {weekData.length > 0 && weekTotal === 0 && (
                            <p className="mt-2 text-xs text-text-dim">
                              Nothing added in the last seven days yet.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div data-reveal className="glass-panel p-5 sm:p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-base font-bold tracking-tight">
                          Your notebooks
                        </h2>
                        <span className="text-[11px] font-medium text-text-dim">
                          {notebooks?.length ?? 0} total
                        </span>
                      </div>
                      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {notebooks?.map((notebook) => (
                          <li key={notebook.id}>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard?notebook=${notebook.id}`)
                              }
                              className="flex w-full items-center gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--signal)]"
                            >
                              <NotebookPen className="h-4 w-4 shrink-0 text-[var(--signal)]" />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {notebook.name}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-text-dim">
                                {notebook.sourceCount}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <MovingBorderButton
                        onClick={() => navigate("/dashboard?view=notebooks")}
                        className="mt-4"
                        innerClassName="px-4 py-2.5 text-[13px]"
                      >
                        <NotebookPen className="h-4 w-4" />
                        New notebook
                      </MovingBorderButton>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
