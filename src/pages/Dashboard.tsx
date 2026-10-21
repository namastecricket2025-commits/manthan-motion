import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DashboardNav,
  SidebarCollapseButton,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { useSidebarCollapsed } from "@/components/dashboard/use-sidebar";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { NotebookWorkspace } from "@/components/dashboard/NotebookWorkspace";
import { FeedbackPrompt } from "@/components/shared/TestimonialsFeedbackPrompt";
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
import { usePlan } from "@/components/plans/PlanProvider";
import { useAuth } from "@/hooks/use-auth";
import { useSpringTransition, viewVariants } from "@/lib/motion";
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
import { AnimatePresence, motion } from "motion/react";
import { useState, type CSSProperties } from "react";
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
 *
 * Changing face is a state shift, not a page load: the outgoing face lifts
 * away and the incoming one slides up and settles on the shared spring (see
 * `@/lib/motion`), the way a window changes state on macOS.
 */

/** Material tabs a deep link from the overview is allowed to select. */
const WORKSPACE_TABS = [
  "summary",
  "flashcards",
  "quiz",
  "mindmap",
  "slides",
] as const;

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
  const { requireAccess } = usePlan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transition = useSpringTransition();

  const view =
    searchParams.get("view") === "notebooks" ? "notebooks" : "overview";
  const notebookParam = searchParams.get("notebook");
  /* A metric card or library row can ask for one material tab by name. */
  const tabParam = searchParams.get("tab");
  const initialTab = WORKSPACE_TABS.find((kind) => kind === tabParam);

  const notebooks = useQuery(api.notebooks.list);
  const summary = useQuery(api.notebooks.summary);
  const createNotebook = useMutation(api.notebooks.create);
  const renameNotebook = useMutation(api.notebooks.rename);
  const removeNotebook = useMutation(api.notebooks.remove);

  const openNotebook = notebooks?.find((n) => n.id === notebookParam);

  const [sheetOpen, setSheetOpen] = useState(false);
  /* The desktop rail collapses to icons, everywhere in the app. */
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  /* Which face is on screen — the key the transition is built around. */
  const face = openNotebook
    ? `notebook-${openNotebook.id}`
    : view === "notebooks"
      ? "notebooks"
      : "overview";

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
    if (key === "mathlab") {
      // The Math Lab is a premium workspace: a free account gets the frosted
      // prompt instead of the route.
      if (requireAccess("mathLabBasic")) navigate("/math-lab");
      return;
    }
    if (key === "lab") navigate("/lab");
    else if (key === "settings") navigate("/settings");
    else if (key === "about") navigate("/about");
    else if (key === "pricing") navigate("/pricing");
    else if (key === "notebooks") navigate("/dashboard?view=notebooks");
    else navigate("/dashboard");
  };

  const nav = (
    <DashboardNav
      active={view === "notebooks" ? "notebooks" : "dashboard"}
      onSelect={selectSection}
      collapsed={collapsed}
    />
  );
  /* The phone drawer always shows full labels, whatever the desktop rail is. */
  const mobileNav = (
    <DashboardNav
      active={view === "notebooks" ? "notebooks" : "dashboard"}
      onSelect={selectSection}
    />
  );

  const hasNotebooks = (notebooks?.length ?? 0) > 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        {/* Page-top texture, then the aura on top of it: the same two layers
            the Math Lab uses, so the two pages read as one product. */}
        <div className="dot-field" aria-hidden="true" />
        <div className="glow-aura" aria-hidden="true" />
        {/* ---- Sidebar (desktop, collapsible) ---- */}
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-[var(--card-border)] bg-[var(--panel-bg)] py-5 backdrop-blur-xl transition-[width,padding] duration-300 ease-out min-[760px]:flex"
          style={{ width: collapsed ? 76 : 240, paddingLeft: collapsed ? 10 : 16, paddingRight: collapsed ? 10 : 16 }}
          data-collapsed={collapsed}
        >
          <div className="flex min-w-0 flex-col gap-7">
            <div className={collapsed ? "flex justify-center" : "flex items-center justify-between gap-2"}>
              {!collapsed && <Logo />}
              <SidebarCollapseButton
                collapsed={collapsed}
                onToggle={() => setCollapsed((value) => !value)}
              />
            </div>
            {nav}
          </div>

          <div
            className={
              collapsed
                ? "flex flex-col items-center gap-3 pt-6"
                : "flex items-center justify-between pt-6"
            }
          >
            <ThemeToggle />
            {collapsed ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-text-dim transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-[var(--card-border)] bg-transparent"
                onClick={handleSignOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            )}
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
                <div className="px-2">{mobileNav}</div>
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
        <main
          className="px-4 py-6 transition-[margin-left] duration-300 ease-out sm:px-6 min-[760px]:ml-[var(--sidebar-w)] md:py-10"
          style={{ "--sidebar-w": collapsed ? "76px" : "240px" } as CSSProperties}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
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
                <motion.h1
                  key={face}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition}
                  className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl"
                >
                  {openNotebook ? openNotebook.name : (user?.name ?? "Welcome")}
                  <span className="text-[var(--signal)]">.</span>
                </motion.h1>
                {/* The dashboard face already says whose it is; a line explaining
                    that it is a study dashboard underneath the greeting was
                    filler. The other faces keep their one useful sentence. */}
                {!openNotebook && view !== "notebooks" && !hasNotebooks ? (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
                    Create your first notebook to get started.
                  </p>
                ) : null}
                {openNotebook || view === "notebooks" ? (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
                    {openNotebook
                      ? "Add your sources, then churn them into study material."
                      : "A notebook is one subject, chapter or exam. Name it, fill it with sources, then churn them."}
                  </p>
                ) : null}
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

            {/* ================= WORKSPACE =================
                One face at a time, swapped on the shared spring: the outgoing
                face lifts away, the incoming one slides up and settles. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={face}
                variants={viewVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transition}
                className="flex flex-col gap-6"
              >
                {openNotebook ? (
                  <NotebookWorkspace
                    notebookId={openNotebook.id as Id<"notebooks">}
                    notebookName={openNotebook.name}
                    initialTab={initialTab}
                  />
                ) : view === "notebooks" ? (
                  /* ================= NOTEBOOKS MANAGER ================= */
                  <>
                    <div className="glass-panel p-5 sm:p-6">
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
                          className="min-w-0 flex-1 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-3 text-base outline-none placeholder:text-text-dim/80 focus:border-[var(--signal)] sm:text-sm"
                        />
                        <MovingBorderButton
                          type="submit"
                          disabled={busy || !draftName.trim()}
                          loading={busy}
                          className="w-full sm:w-fit"
                          innerClassName="px-6 py-3 text-sm"
                        >
                          Create notebook
                          <ArrowRight className="h-4 w-4" />
                        </MovingBorderButton>
                      </form>
                    </div>

                    <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
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
                                    onChange={(e) =>
                                      setRenameValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        void handleRename(
                                          notebook.id as Id<"notebooks">,
                                        );
                                      if (e.key === "Escape")
                                        setRenamingId(null);
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
                                {notebook.sourceCount === 1
                                  ? "source"
                                  : "sources"}
                                {" · "}
                                {notebook.fileCount} files ·{" "}
                                {notebook.linkCount} links
                                {" · "}
                                {notebook.materialCount}{" "}
                                {notebook.materialCount === 1
                                  ? "study item"
                                  : "study items"}
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
                                      inside it, and everything generated from
                                      them. It cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
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
                      <div className="glass-panel p-5 sm:p-6">
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
                      <div className="glass-panel p-6 text-sm text-text-dim">
                        Loading your workspace…
                      </div>
                    )}

                    {!hasNotebooks && notebooks !== undefined && (
                      <div className="glass-panel flex flex-col gap-5 p-6 sm:p-8">
                        <div>
                          <h2 className="font-display text-xl font-bold tracking-tight">
                            Start with a notebook
                          </h2>
                          <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
                            Nothing here yet — that is expected. Manthan only
                            ever shows what you have actually added.
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
                            className="min-w-0 flex-1 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-3 text-base outline-none placeholder:text-text-dim/80 focus:border-[var(--signal)] sm:text-sm"
                          />
                          <MovingBorderButton
                            type="submit"
                            disabled={busy || !draftName.trim()}
                            loading={busy}
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
                      <DashboardOverview
                        summary={summary}
                        notebooks={notebooks ?? []}
                        onOpenNotebook={(notebookId, target) => {
                          const params = new URLSearchParams({
                            notebook: notebookId,
                          });
                          if (target?.tab) params.set("tab", target.tab);
                          navigate(
                            `/dashboard?${params.toString()}${
                              target?.focus ? `#${target.focus}` : ""
                            }`,
                          );
                        }}
                        onOpenNotebooks={() =>
                          navigate("/dashboard?view=notebooks")
                        }
                        onCreateNotebook={() =>
                          navigate("/dashboard?view=notebooks")
                        }
                        onOpenMathLab={() => selectSection("mathlab")}
                      />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* The review prompt appears only after a generation succeeded and only
          once a session; its rows start `pending` and wait for owner approval. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
        <FeedbackPrompt />
      </div>
    </div>
  );
}
