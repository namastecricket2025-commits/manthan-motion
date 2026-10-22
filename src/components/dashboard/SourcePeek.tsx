import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { FileSearch, Loader2, X } from "lucide-react";
import { useEffect } from "react";

export type Citation = {
  name: string;
  excerpt: string;
  sourceId?: string;
  unavailable?: boolean;
};

/**
 * The exact extract behind a citation.
 *
 * This is a receipt, not another generated answer: the text in the panel comes
 * straight from the source row Manthan read. The dialog is deliberately small
 * and read-only — peeking should never pull a student out of the sheet.
 */
export function SourcePeekDialog({
  citation,
  onClose,
  loading = false,
}: {
  citation: Citation | null;
  onClose: () => void;
  loading?: boolean;
}) {
  useEffect(() => {
    if (!citation) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [citation, onClose]);

  return (
    <AnimatePresence>
      {citation ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Source peek: ${citation.name}`}
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] px-5 py-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">
                  <FileSearch className="h-3.5 w-3.5" />
                  Source peek
                </p>
                <h2 className="mt-1.5 truncate font-display text-base font-bold tracking-tight">
                  {citation.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close source peek"
                className="shrink-0 rounded-full border border-[var(--card-border)] p-1.5 text-text-dim transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[11px] leading-relaxed text-text-dim">
                The exact extract from the text Manthan read. It is shown here
                as stored — no model rewrote it.
              </p>
              {loading ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--card-border)] px-4 py-6 text-[12.5px] text-text-dim">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--signal)]" />
                  Reading the source…
                </div>
              ) : citation.unavailable || !citation.excerpt ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-[12.5px] leading-relaxed text-text-dim">
                  This source has no readable text to show. It may be a file
                  whose extraction failed, or a link without a text body.
                </div>
              ) : (
                <blockquote className="mt-4 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] px-4 py-4 text-[13px] leading-relaxed text-foreground">
                  <span className="whitespace-pre-wrap">{citation.excerpt}</span>
                </blockquote>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] px-5 py-3 text-[10.5px] text-text-dim">
              <span>Only this passage is shown, not the whole document.</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-[var(--signal)]"
              >
                Back to the sheet
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A material-linked source chip. The full text is only fetched once the dialog
 * is open, so a notebook with ten sources does not ship all of them to the
 * browser just to render the chips.
 */
export function MaterialSourcePeek({
  materialId,
  sourceName,
  focus,
  onClose,
}: {
  materialId: Id<"materials">;
  sourceName: string;
  focus?: string;
  onClose: () => void;
}) {
  const peek = useQuery(api.sources.peek, { materialId, sourceName, focus });
  const citation: Citation = peek
    ? {
        name: peek.name,
        excerpt: peek.excerpt,
        unavailable: peek.unavailable,
      }
    : { name: sourceName, excerpt: "" };

  return (
    <SourcePeekDialog
      citation={citation}
      loading={peek === undefined}
      onClose={onClose}
    />
  );
}
