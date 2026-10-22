import { api } from "@/convex/_generated/api";
import { GRADES } from "@/components/mathlab/mathlab";
import {
  AlertTriangle,
  BookOpen,
  DownloadCloud,
  Calculator,
  Command,
  FileText,
  FlaskConical,
  LayoutDashboard,
  NotebookPen,
  Search,
  Settings2,
  Sigma,
  Sparkles,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

/**
 * ⌘K — one field over the whole workspace.
 *
 * It searches the places a student actually thinks in (pages, chapters of the
 * syllabus, their own notebooks and the questions they have already solved),
 * not just the nav labels. The list is built from real rows: a notebook only
 * appears because it exists on this account.
 */

type Item = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
};

const PAGES: Item[] = [
  {
    id: "page-dashboard",
    title: "Dashboard",
    subtitle: "Your notebooks and study material",
    href: "/dashboard",
    group: "Pages",
    icon: LayoutDashboard,
    keywords: "home overview workspace",
  },
  {
    id: "page-mathlab",
    title: "Math Lab",
    subtitle: "Solve, graph, practise and revise",
    href: "/math-lab",
    group: "Pages",
    icon: Sigma,
    keywords: "maths equations graph practice",
  },
  {
    id: "page-lab",
    title: "STEM Lab",
    subtitle: "Physics, chemistry and biology benches",
    href: "/lab",
    group: "Pages",
    icon: FlaskConical,
    keywords: "science experiment simulation",
  },
  {
    id: "page-pricing",
    title: "Plans & Pricing",
    subtitle: "Free, Sprint, EduVantage and Prime",
    href: "/pricing",
    group: "Pages",
    icon: Tag,
    keywords: "premium subscription upgrade",
  },
  {
    id: "page-settings",
    title: "Settings",
    subtitle: "Account, appearance, privacy",
    href: "/settings",
    group: "Pages",
    icon: Settings2,
    keywords: "theme profile delete",
  },
  {
    id: "page-offline",
    title: "Offline kits",
    subtitle: "Sheets downloaded to this device",
    href: "/offline",
    group: "Pages",
    icon: DownloadCloud,
    keywords: "download offline saved no connection",
  },
  {
    id: "page-mistakes",
    title: "Mistake Bank",
    subtitle: "Retry the answers you missed",
    href: "/mistakes",
    group: "Pages",
    icon: AlertTriangle,
    keywords: "wrong errors quiz practice review",
  },
  {
    id: "page-about",
    title: "About Manthan",
    subtitle: "Why the product exists",
    href: "/about",
    group: "Pages",
    icon: BookOpen,
    keywords: "story founder",
  },
  {
    id: "page-feedback",
    title: "Feedback",
    subtitle: "Tell us what worked and what did not",
    href: "/feedback",
    group: "Pages",
    icon: FileText,
    keywords: "review bug contact",
  },
];

/** Dispatch this from a button — the palette owns its own open state. */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("manthan:command"));
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const notebooks = useQuery(api.notebooks.list);
  const history = useQuery(api.mathHistory.list);

  /* Chapters are static curriculum, so they cost nothing to index. Each one
     opens Practice on that exact chapter via the lab's query params. */
  const chapters = useMemo<Item[]>(
    () =>
      GRADES.flatMap((grade) =>
        grade.chapters.map((chapter, index) => ({
          id: `chapter-${grade.id}-${index}`,
          title: chapter.name,
          subtitle: `Class ${grade.id} · ${chapter.focus}`,
          href: `/math-lab?view=practice&grade=${grade.id}&chapter=${index}`,
          group: "Syllabus",
          icon: Calculator,
          keywords: `class ${grade.id} ${chapter.formulas.join(" ")}`,
        })),
      ),
    [],
  );

  const items = useMemo<Item[]>(() => {
    const own: Item[] = (notebooks ?? []).map((notebook) => ({
      id: `notebook-${notebook.id}`,
      title: notebook.name,
      subtitle: `${notebook.sourceCount} source${
        notebook.sourceCount === 1 ? "" : "s"
      } · ${notebook.materialCount} material${
        notebook.materialCount === 1 ? "" : "s"
      }`,
      href: `/dashboard?notebook=${notebook.id}`,
      group: "Your notebooks",
      icon: NotebookPen,
      keywords: "notebook workspace",
    }));

    const solved: Item[] = (history ?? []).slice(0, 8).map((entry) => ({
      id: `solution-${entry.id}`,
      title: entry.headline || entry.question,
      subtitle: `${entry.chapterName} · ${entry.track}`,
      href: "/math-lab?view=history",
      group: "Recent solutions",
      icon: Sparkles,
      keywords: entry.question,
    }));

    return [...own, ...solved, ...PAGES, ...chapters];
  }, [chapters, history, notebooks]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      /* With no query, show the useful shortlist instead of 40 chapters. */
      return items.slice(0, 12);
    }
    const words = term.split(/\s+/).filter(Boolean);
    return items
      .map((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.group} ${
          item.keywords ?? ""
        }`.toLowerCase();
        if (!words.every((word) => haystack.includes(word))) return null;
        const title = item.title.toLowerCase();
        const score = title.startsWith(term)
          ? 0
          : title.includes(term)
            ? 1
            : 2;
        return { item, score };
      })
      .filter((entry): entry is { item: Item; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 24)
      .map((entry) => entry.item);
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("manthan:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("manthan:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function go(item: Item) {
    setOpen(false);
    navigate(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        results.length ? (current - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[active];
      if (item) go(item);
    }
  }

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 p-3 pt-[12vh] backdrop-blur-sm sm:p-6 sm:pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search Manthan"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] shadow-2xl"
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--card-border)] px-4">
              <Search className="h-4 w-4 shrink-0 text-text-dim" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages, chapters, notebooks…"
                aria-label="Search pages, chapters and notebooks"
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-dim"
              />
              <kbd className="hidden shrink-0 rounded border border-[var(--card-border)] px-1.5 py-0.5 text-[10px] text-text-dim sm:block">
                esc
              </kbd>
            </div>

            <div
              ref={listRef}
              className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2"
            >
              {results.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm font-medium">Nothing matched “{query}”</p>
                  <p className="mt-1 text-xs text-text-dim">
                    Try a chapter name, a notebook, or “practice”.
                  </p>
                </div>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon;
                  const grouped =
                    index === 0 || results[index - 1].group !== item.group;
                  return (
                    <div key={item.id}>
                      {grouped ? (
                        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim first:pt-1">
                          {item.group}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors " +
                          (index === active
                            ? "bg-[color-mix(in_srgb,var(--signal)_10%,transparent)]"
                            : "hover:bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)]")
                        }
                      >
                        <span
                          className={
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border " +
                            (index === active
                              ? "border-[var(--signal)] text-[var(--signal)]"
                              : "border-[var(--card-border)] text-text-dim")
                          }
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-foreground">
                            {item.title}
                          </span>
                          <span className="block truncate text-[11px] text-text-dim">
                            {item.subtitle}
                          </span>
                        </span>
                        {index === active ? (
                          <span className="hidden shrink-0 text-[10px] text-text-dim sm:block">
                            ↵
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--card-border)] px-4 py-2.5 text-[10.5px] text-text-dim">
              <span className="flex items-center gap-2">
                <Command className="h-3 w-3" />
                <span>⌘K to open from anywhere</span>
              </span>
              <span className="hidden sm:block">↑↓ to move · ↵ to open</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default CommandPalette;
