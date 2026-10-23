import { api } from "@/convex/_generated/api";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import {
  FlashcardsView,
  type FlashcardsPayload,
  type MindmapPayload,
  QuizView,
  type QuizPayload,
  SlidesView,
  type SlidesPayload,
  SummaryView,
  type SummaryPayload,
} from "@/components/dashboard/MaterialViews";
import { MindmapView } from "@/components/dashboard/MindmapView";
import { MaterialPrint } from "@/components/print/MaterialPrint";
import { useQuery } from "convex/react";
import { Loader2, Lock, Printer, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

/**
 * A public share link.
 *
 * It renders exactly one generated sheet and nothing else: no notebook name,
 * no sources, no chat. A visitor without an account can read it and print it,
 * which is what makes a share link useful for a study group; the CTA at the
 * bottom is the only other thing on the page.
 */
export default function SharedMaterial() {
  const { token = "" } = useParams<{ token: string }>();
  const material = useQuery(api.shares.getPublic, { token });

  useEffect(() => {
    if (!material) return;
    const previous = document.title;
    document.title = `${material.title} — shared on Manthan`;
    return () => {
      document.title = previous;
    };
  }, [material]);

  const [printing, setPrinting] = useState(false);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        {material === undefined ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-text-dim">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--signal)]" />
            Opening the shared sheet…
          </div>
        ) : material === null ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--card-border)] text-[var(--signal)]">
              <Lock className="h-5 w-5" />
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">
              This link isn’t available.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-text-dim">
              The owner may have stopped sharing it, or the link may be
              incomplete. Ask them for a fresh link — nothing else in their
              notebook is reachable from this page.
            </p>
            <div className="mt-7">
              <MovingBorderButton to="/" innerClassName="px-6 py-3 text-sm">
                Go to Manthan
              </MovingBorderButton>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                  <Share2 className="h-3.5 w-3.5 text-[var(--signal)]" />
                  Shared study material
                </p>
                <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                  {material.title}
                </h1>
                <p className="mt-2 text-xs text-text-dim">
                  {material.notebookName} · {material.sourceCount} source
                  {material.sourceCount === 1 ? "" : "s"} ·{" "}
                  {new Date(material.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrinting(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-2 text-[11.5px] font-medium text-text-dim transition-colors hover:text-foreground"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / PDF
              </button>
            </header>

            <div className="material-print-area mt-7 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-7">
              {material.kind === "summary" && (
                <SummaryView payload={material.payload as SummaryPayload} />
              )}
              {material.kind === "flashcards" && (
                <FlashcardsView payload={material.payload as FlashcardsPayload} />
              )}
              {material.kind === "quiz" && (
                <QuizView payload={material.payload as QuizPayload} />
              )}
              {material.kind === "mindmap" && (
                <MindmapView payload={material.payload as MindmapPayload} />
              )}
              {material.kind === "slides" && (
                <SlidesView payload={material.payload as SlidesPayload} />
              )}
            </div>

            <section className="mt-8 rounded-2xl border border-[var(--card-border)] p-5 text-center sm:p-6">
              <p className="font-display text-lg font-semibold tracking-tight">
                Turn your own chapter into a sheet like this.
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-text-dim">
                Manthan reads your notes, PDFs and links, then writes the
                summary, flashcards, quiz and slides — with the source attached
                to every line.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <MovingBorderButton
                  to="/auth?returnTo=%2Fdashboard"
                  innerClassName="px-5 py-2.5 text-[13px]"
                >
                  Start free
                </MovingBorderButton>
                <Link
                  to="/pricing"
                  className="text-xs font-medium text-text-dim transition-colors hover:text-foreground"
                >
                  See plans
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
      {printing && material ? (
        <MaterialPrint
          kind={material.kind}
          payload={material.payload}
          title={material.title}
          notebookName={material.notebookName}
          sourceCount={material.sourceCount}
          createdAt={material.createdAt}
          onDone={() => setPrinting(false)}
        />
      ) : null}
    </div>
  );
}
