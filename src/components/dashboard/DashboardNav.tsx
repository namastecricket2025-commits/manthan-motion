import { api } from "@/convex/_generated/api";
import { useSpringTransition } from "@/lib/motion";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ClipboardCheck,
  FlaskConical,
  Info,
  LayoutDashboard,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sigma,
  Tag,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

/**
 * Every destination reachable from the app sidebar.
 * The workspace path runs Dashboard -> Notebooks -> Mock exam -> Math Lab ->
 * STEM Lab -> Plans -> Settings -> About Us. Daily review and Voice viva stay
 * as routes, but they are reached from the dashboard cards rather than from
 * the rail: two extra rows pushed Math Lab off the fold on a laptop.
 */
export type DashboardSection =
  | "dashboard"
  | "notebooks"
  | "review"
  | "exam"
  | "viva"
  | "mathlab"
  | "lab"
  | "settings"
  | "pricing"
  | "about";

const ITEMS: {
  key: DashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "notebooks", label: "Notebooks", icon: NotebookPen },
  { key: "exam", label: "Mock exam", icon: ClipboardCheck },
  { key: "mathlab", label: "Math Lab", icon: Sigma },
  { key: "lab", label: "STEM Lab", icon: FlaskConical },
  { key: "pricing", label: "Plans & Pricing", icon: Tag },
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "about", label: "About Us", icon: Info },
];

/** One notebook under its section entry. Split out so each row can own the
 *  shared spring without calling a hook inside a loop. */
function NotebookRow({
  name,
  sourceCount,
  selected,
  onOpen,
}: {
  name: string;
  sourceCount: number;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className={
        "group flex touch-manipulation items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors " +
        (selected
          ? "bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)] text-foreground"
          : "text-text-dim hover:text-foreground")
      }
    >
      <span className="min-w-0 flex-1 truncate transition-transform duration-200 group-hover:translate-x-0.5">
        {name}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-text-dim">
        {sourceCount}
      </span>
    </motion.button>
  );
}

/** The one control that folds the rail to icons, and back. */
export function SidebarCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="glass-chip inline-flex h-8 w-8 shrink-0 items-center justify-center text-text-dim transition-colors hover:text-foreground"
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * Shared sidebar navigation.
 *
 * Each page owns what a click *means* (the dashboard swaps an in-place view,
 * every other destination pushes a route), so the markup and active styling
 * stay in one place.
 *
 * The Notebooks entry carries the user's own notebooks: named by them, counted
 * from their own sources, and never seeded with anything. Clicking one scopes
 * `/dashboard` to it via `?notebook=`, and the inline "+ New notebook" row
 * creates and opens one without leaving the sidebar.
 *
 * The list is folded away by default. A rail that is always nine rows plus
 * every notebook the student owns turns into a wall of small buttons; one
 * Notebooks row that opens its own drawer keeps the eight destinations
 * readable and lets the panel below it slide down when the list opens. The
 * drawer opens on the Notebooks click and stays open while a notebook is in
 * scope, so the current notebook is never hidden by a fold the student did not
 * make.
 *
 * Every entry is a state shift, so every entry moves on the shared spring: the
 * row leans toward the pointer and gives slightly under the press, and the
 * active rail lights up where you are.
 */
export function DashboardNav({
  active,
  onSelect,
  collapsed = false,
}: {
  active: DashboardSection;
  onSelect: (key: DashboardSection) => void;
  /** Icon rail: labels and the notebook list fold away, the icons stay. */
  collapsed?: boolean;
}) {
  const notebooks = useQuery(api.notebooks.list);
  const createNotebook = useMutation(api.notebooks.create);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const transition = useSpringTransition();

  const activeNotebookId = searchParams.get("notebook");
  const [openList, setOpenList] = useState(Boolean(searchParams.get("notebook")));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const notebooksActive = active === "notebooks" || Boolean(activeNotebookId);
  const listOpen = openList || adding;

  async function submitNotebook() {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const id = await createNotebook({ name });
      setDraft("");
      setAdding(false);
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

  return (
    <nav className={collapsed ? "flex flex-col gap-1.5" : "flex flex-col gap-1"}>
      {ITEMS.map((item) => {
        const isActive =
          item.key === "notebooks" ? notebooksActive : item.key === active;
        return (
          <div key={item.key} className="flex flex-col gap-1">
            <motion.button
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              aria-expanded={
                item.key === "notebooks" && !collapsed ? listOpen : undefined
              }
              title={collapsed ? item.label : undefined}
              onClick={() => {
                // One click always does the thing the row says: open Notebooks.
                // The chevron is the drawer — a click on the open list folds it
                // away again without a second destination change.
                if (item.key === "notebooks" && !collapsed) {
                  setOpenList((value) => !value);
                }
                onSelect(item.key);
              }}
              className={
                "group relative flex w-full touch-manipulation items-center rounded-xl border text-left text-sm font-medium transition-colors " +
                (collapsed
                  ? "justify-center px-0 py-2.5 "
                  : "gap-3 px-3.5 py-2.5 ") +
                (isActive
                  ? "border-[color-mix(in_srgb,var(--text-main)_24%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-transparent text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
              }
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--text-main)]"
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  scaleY: isActive ? 1 : 0.3,
                }}
                transition={transition}
              />
              <item.icon
                className={
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 " +
                  (isActive ? "text-[var(--text-main)]" : "")
                }
              />
              {collapsed ? null : (
                <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                  {item.label}
                </span>
              )}
              {item.key === "notebooks" && !collapsed ? (
                <motion.span
                  aria-hidden
                  className="shrink-0 text-text-dim"
                  initial={false}
                  animate={{ rotate: listOpen ? 180 : 0 }}
                  transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.span>
              ) : null}
            </motion.button>

            {/* The notebooks themselves, nested under the section entry. */}
            <AnimatePresence initial={false}>
              {item.key === "notebooks" && !collapsed && listOpen && (
              <motion.div
                key="notebook-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
              <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--card-border)] pl-3">
                {notebooks === undefined && (
                  <span className="px-2.5 py-1.5 text-xs text-text-dim">
                    Loading…
                  </span>
                )}

                {notebooks?.length === 0 && !adding && (
                  <span className="px-2.5 py-1.5 text-xs leading-relaxed text-text-dim">
                    No notebooks yet.
                  </span>
                )}

                {notebooks?.map((notebook) => (
                  <NotebookRow
                    key={notebook.id}
                    name={notebook.name}
                    sourceCount={notebook.sourceCount}
                    selected={notebook.id === activeNotebookId}
                    onOpen={() =>
                      navigate(`/dashboard?notebook=${notebook.id}`)
                    }
                  />
                ))}

                <AnimatePresence initial={false} mode="wait">
                  {adding ? (
                    <motion.div
                      key="draft"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={transition}
                      className="flex items-center gap-1 px-1 py-1"
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void submitNotebook();
                          if (e.key === "Escape") {
                            setAdding(false);
                            setDraft("");
                          }
                        }}
                        placeholder="Notebook name"
                        className="min-w-0 flex-1 rounded-lg border border-[var(--card-border)] bg-transparent px-2 py-1 text-[13px] outline-none placeholder:text-text-dim/85 focus:border-[var(--signal)]"
                      />
                      <button
                        type="button"
                        aria-label="Create notebook"
                        onClick={() => void submitNotebook()}
                        disabled={busy || !draft.trim()}
                        className="rounded-lg p-1 text-[var(--signal)] disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel"
                        onClick={() => {
                          setAdding(false);
                          setDraft("");
                        }}
                        className="rounded-lg p-1 text-text-dim"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="new"
                      type="button"
                      onClick={() => setAdding(true)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex touch-manipulation items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-text-dim transition-colors hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New notebook
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

export default DashboardNav;
