import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { MovingBorderButton } from "./MovingBorderButton";
import { useAuth } from "@/hooks/use-auth";

/**
 * The mobile navigation panel.
 *
 * Replaces the old icon-fan, which read as a long column of unlabeled squares
 * a first-time visitor could not parse. This is a plain, readable menu: every
 * destination is a full-width row with its name, and the one action that
 * matters — Get started (or Open dashboard when signed in) — sits pinned at
 * the top of the panel where it cannot be missed.
 */
export function MobileMenu({
  items,
}: {
  items: { title: string; icon: ReactNode; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative md:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-chip absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl p-2"
          >
            {/* The primary action, first and unmistakable. */}
            <div className="p-1.5 pb-2">
              {isAuthenticated ? (
                <MovingBorderButton
                  to="/dashboard"
                  className="w-full"
                  innerClassName="w-full px-4 py-2.5 text-[13px]"
                >
                  Open dashboard
                </MovingBorderButton>
              ) : (
                <MovingBorderButton
                  to="/auth?returnTo=%2Fdashboard"
                  className="w-full"
                  innerClassName="w-full px-4 py-2.5 text-[13px]"
                >
                  Get started — it's free
                </MovingBorderButton>
              )}
            </div>

            <div className="mx-2 border-t border-[var(--glass-hairline)]" />

            <nav className="mt-1.5 flex flex-col">
              {items.map((item) => {
                const internal = item.href.startsWith("/");
                const row = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--glass-hairline)] text-[var(--signal)]">
                      <span className="h-4 w-4">{item.icon}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                  </>
                );
                const rowClass =
                  "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--signal)_7%,transparent)]";
                return internal ? (
                  <Link
                    key={item.title}
                    to={item.href}
                    className={rowClass}
                    onClick={() => setOpen(false)}
                  >
                    {row}
                  </Link>
                ) : (
                  <a
                    key={item.title}
                    href={item.href}
                    className={rowClass}
                    onClick={() => setOpen(false)}
                  >
                    {row}
                  </a>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center text-foreground",
        )}
      >
        <IconPlus
          className={cn(
            "h-5 w-5 transition-transform duration-300",
            open && "rotate-45",
          )}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}
