import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A select that does not look like the operating system's.
 *
 * Native `<select>` renders the platform menu: blue highlight bar, OS font,
 * its own colours, and — the part that reads as cheap inside a designed
 * dialog — it overlays whatever is below it instead of making room. This one
 * opens **inline**: the list grows out from under the trigger on a height
 * animation, so a chapter list that is twenty items long pushes the rest of
 * the form down and the dialog simply gets taller. Nothing is clipped, the
 * trigger is always full width (the list is the same width as the control it
 * belongs to), and the colours are the site's own.
 *
 * Behaviour is the standard listbox contract: Enter/Space/ArrowDown opens,
 * Escape closes, clicking an option chooses it and closes, clicking outside
 * closes without choosing.
 */

export type ChoiceOption = {
  value: string;
  label: string;
  /** A secondary line — a source count, a mark weight, a note. */
  hint?: string;
};

export function ChoiceSelect({
  value,
  onChange,
  options,
  placeholder = "Choose one…",
  ariaLabel,
  className,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.value === value);

  /* Close on an outside press. The check runs against the composed path so a
     click inside the animating list still counts as inside. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (!rootRef.current || !path.includes(rootRef.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* Land the keyboard on the chosen row the moment the list opens, so the
     next arrow key moves from there rather than from the top. */
  useEffect(() => {
    if (!open) return;
    const target = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    (target ?? listRef.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            close();
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            if (!open) {
              event.preventDefault();
              setOpen(true);
            }
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text-main)_38%,transparent)]",
          open
            ? "border-[color-mix(in_srgb,var(--text-main)_42%,transparent)] text-foreground"
            : "border-[var(--card-border)] text-foreground hover:border-[color-mix(in_srgb,var(--text-main)_30%,transparent)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-text-dim")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-dim transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduce ? 0 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  close();
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  const rows = Array.from(
                    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
                  );
                  const at = rows.indexOf(document.activeElement as HTMLElement);
                  const next =
                    event.key === "ArrowDown"
                      ? rows[(at + 1 + rows.length) % rows.length]
                      : rows[(at - 1 + rows.length) % rows.length];
                  if (next) {
                    event.preventDefault();
                    next.focus();
                  }
                }
              }}
              className="mt-1.5 max-h-[46vh] overflow-y-auto overscroll-contain rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-1 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)]"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-[13px] leading-snug transition-colors outline-none focus-visible:bg-[color-mix(in_srgb,var(--text-main)_12%,transparent)]",
                      isSelected
                        ? "bg-[color-mix(in_srgb,var(--text-main)_12%,transparent)] font-medium text-foreground"
                        : "text-text-dim hover:bg-[color-mix(in_srgb,var(--text-main)_7%,transparent)] hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block">{option.label}</span>
                      {option.hint ? (
                        <span className="mt-0.5 block text-[11px] text-text-dim">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-main)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default ChoiceSelect;
