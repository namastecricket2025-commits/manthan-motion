import { useSpringTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The lab's own dropdown.
 *
 * A native `<select>` opens the operating system's menu: the platform's font,
 * its blue highlight bar, its own scrollbar sitting on top of the bench, and a
 * popup that belongs to the browser rather than to the page. Inside a designed
 * panel that reads as "not finished", and on a long list — 118 elements — it
 * reads as a spreadsheet.
 *
 * This one is in the page: the trigger is a lab card that shows what is chosen,
 * the list opens under it with the lab's own colours and a 6 px scrollbar, and
 * every row carries the three things the list is actually searched by — number,
 * symbol, name. Long lists get a search field and period headers, so finding
 * "Chlorine" is typing three letters rather than dragging a scrollbar.
 *
 * The keyboard contract is the standard listbox one: ArrowUp/ArrowDown/Home/End
 * move through the options, Enter or Space chooses, Escape closes and returns
 * focus to the trigger, and a pointer press outside closes without choosing.
 */

export type LabPickerOption = {
  value: string;
  label: string;
  /** The short fact in front of the label: an atomic number, a formula. */
  meta?: string;
  /** A badge after `meta` — an element symbol, an ion. Coloured by `color`. */
  badge?: string;
  /** Category colour: the badge tint and the trigger's dot. */
  color?: string;
  /** Header this option sits under, when the list is grouped. */
  group?: string;
};

export function LabPicker({
  label,
  value,
  options,
  onChange,
  searchPlaceholder = "Search…",
  searchableAfter = 12,
  className,
}: {
  label: string;
  value: string;
  options: LabPickerOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  /** The search field appears once a list is longer than this. */
  searchableAfter?: number;
  className?: string;
}) {
  const spring = useSpringTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.value === value);
  const grouped = options.some((option) => option.group);
  const searchable = options.length > searchableAfter;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      [option.label, option.badge, option.meta, option.group]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [options, query]);

  /* Close on a press outside. The check runs against the composed path, so a
     press inside the animating list still counts as inside. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current || !event.composedPath().includes(rootRef.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* Opening: land on the search field if there is one, otherwise on the chosen
     row, scrolled into view — the list never opens at the top of 118 elements. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = requestAnimationFrame(() => {
      if (searchable) {
        searchRef.current?.focus();
        return;
      }
      const target = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      target?.focus();
      target?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

  /* Filtering moves the chosen row out from under the cursor: follow it. */
  useEffect(() => {
    if (!open || !searchable) return;
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [filtered, open, searchable]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const move = (from: HTMLElement | null, delta: number | "first" | "last") => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (rows.length === 0) return;
    if (delta === "first") return rows[0].focus();
    if (delta === "last") return rows[rows.length - 1].focus();
    const at = from instanceof HTMLElement ? rows.indexOf(from) : -1;
    const next = at === -1 ? rows[0] : rows[(at + delta + rows.length) % rows.length];
    next?.focus();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? "none chosen"}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            close();
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            if (!open) {
              event.preventDefault();
              setOpen(true);
            }
          }
        }}
        className={cn(
          "apple-lab-card group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
          open
            ? "border-[color-mix(in_srgb,var(--lab-ink)_34%,transparent)]"
            : "hover:border-[color-mix(in_srgb,var(--lab-ink)_26%,transparent)]",
        )}
      >
        <span className="apple-lab-micro">{label}</span>
        {selected?.color ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: selected.color, boxShadow: `0 0 8px ${selected.color}` }}
          />
        ) : null}
        {selected?.badge ? (
          <span
            className="font-variant-numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold"
            style={{
              color: selected.color ?? "var(--lab-ink)",
              borderColor: `color-mix(in srgb, ${selected.color ?? "var(--lab-ink)"} 38%, transparent)`,
              background: `color-mix(in srgb, ${selected.color ?? "var(--lab-ink)"} 12%, transparent)`,
            }}
          >
            {selected.badge}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--lab-ink)]">
          {selected?.meta ? <span className="mr-1 text-[var(--lab-ink-dim)]">{selected.meta} ·</span> : null}
          {selected?.label ?? "Choose one"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--lab-ink-dim)] transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={spring}
            style={{ transformOrigin: "top right" }}
            className="apple-lab-card absolute right-0 top-full z-40 mt-2 w-[19rem] max-w-[calc(100vw-2.5rem)] overflow-hidden backdrop-blur-xl"
          >
            {searchable ? (
              <div className="flex items-center gap-2 border-b border-[var(--lab-line-soft)] px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--lab-ink-micro)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      close();
                    }
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      move(null, event.key === "ArrowDown" ? 1 : -1);
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const rows = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
                      rows?.[0]?.click();
                    }
                  }}
                  className="w-full bg-transparent text-[12.5px] text-[var(--lab-ink)] outline-none placeholder:text-[var(--lab-ink-micro)]"
                />
                {query ? (
                  <span className="apple-lab-micro shrink-0">{filtered.length}</span>
                ) : null}
              </div>
            ) : null}

            <div
              ref={listRef}
              role="listbox"
              aria-label={label}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  close();
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(document.activeElement as HTMLElement, 1);
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(document.activeElement as HTMLElement, -1);
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  move(null, "first");
                }
                if (event.key === "End") {
                  event.preventDefault();
                  move(null, "last");
                }
              }}
              className="apple-lab-scroll max-h-[17rem] overflow-y-auto overscroll-contain p-1.5"
            >
              {filtered.length === 0 ? (
                <p className="px-2.5 py-6 text-center text-[12px] text-[var(--lab-ink-dim)]">
                  Nothing matches “{query}”.
                </p>
              ) : null}
              {filtered.map((option, index) => {
                const previous = index === 0 ? null : filtered[index - 1];
                const showHeader = grouped && option.group && option.group !== previous?.group;
                const isSelected = option.value === value;
                return (
                  <div key={option.value}>
                    {showHeader ? (
                      <p className="apple-lab-micro px-2.5 pt-2.5 pb-1">{option.group}</p>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        close();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] transition-colors outline-none",
                        isSelected
                          ? "bg-[color-mix(in_srgb,var(--lab-ink)_13%,transparent)] text-[var(--lab-ink)]"
                          : "text-[var(--lab-ink-dim)] hover:bg-[color-mix(in_srgb,var(--lab-ink)_7%,transparent)] hover:text-[var(--lab-ink)] focus-visible:bg-[color-mix(in_srgb,var(--lab-ink)_9%,transparent)]",
                      )}
                    >
                      {option.meta ? (
                        <span className="apple-lab-value w-6 shrink-0 text-right text-[10.5px] opacity-70">
                          {option.meta}
                        </span>
                      ) : null}
                      {option.badge ? (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10.5px] font-bold"
                          style={{
                            color: option.color ?? "var(--lab-ink)",
                            borderColor: `color-mix(in srgb, ${option.color ?? "var(--lab-ink)"} 34%, transparent)`,
                            background: `color-mix(in srgb, ${option.color ?? "var(--lab-ink)"} 11%, transparent)`,
                          }}
                        >
                          {option.badge}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--lab-ink)]" />
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default LabPicker;
