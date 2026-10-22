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
import { listKits, removeKit, type OfflineKit } from "@/lib/offline";
import {
  BookOpenCheck,
  ChevronDown,
  DownloadCloud,
  Loader2,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const KIND_LABEL: Record<OfflineKit["kind"], string> = {
  summary: "Summary",
  flashcards: "Flashcards",
  quiz: "Quiz",
  mindmap: "Mind map",
  slides: "Slides",
};

function savedLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The device-local library.
 *
 * Deliberately not behind RequireAuth: a student on a train with no signal is
 * exactly the person this page exists for, and the kits are already on their
 * device. The only data shown is what they explicitly downloaded.
 */
export default function OfflineKits() {
  const [kits, setKits] = useState<OfflineKit[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let live = true;
    const load = () => {
      void listKits().then((rows) => {
        if (live) setKits(rows);
      });
    };
    load();
    window.addEventListener("manthan:offline-kits", load);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      live = false;
      window.removeEventListener("manthan:offline-kits", load);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const open = useMemo(
    () => (kits ?? []).find((kit) => kit.id === openId) ?? null,
    [kits, openId],
  );

  async function deleteKit(kit: OfflineKit) {
    const ok = await removeKit(kit.id);
    if (!ok) {
      toast.error("Could not remove that download");
      return;
    }
    if (openId === kit.id) setOpenId(null);
    toast("Removed from this device", { description: kit.title });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
            On this device
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            Offline kits.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">
            Download a generated sheet once and it stays readable without a
            connection — on a train, in a hostel with patchy Wi-Fi, or during an
            outage. Kits live only in this browser and never expire.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] " +
                (online
                  ? "border-[var(--card-border)] text-text-dim"
                  : "border-[var(--signal)]/40 text-[var(--signal)]")
              }
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online — downloads stay available" : "Offline — reading from this device"}
            </span>
            <span className="text-[11px] text-text-dim">
              {kits === null
                ? "Reading storage…"
                : `${kits.length} kit${kits.length === 1 ? "" : "s"} saved`}
            </span>
          </div>

          {kits === null ? (
            <div className="flex min-h-[30vh] items-center justify-center text-sm text-text-dim">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening local storage…
            </div>
          ) : kits.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-[var(--card-border)] px-5 py-12 text-center">
              <DownloadCloud className="h-6 w-6 text-[var(--signal)]" />
              <p className="mt-3 font-display text-lg font-semibold">
                Nothing downloaded yet.
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-text-dim">
                Open a notebook, choose a summary, deck or quiz, then press
                <span className="mx-1 rounded border border-[var(--card-border)] px-1.5 py-0.5 text-[10px] text-foreground">
                  Save offline
                </span>
                above the sheet.
              </p>
              <div className="mt-5">
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  Open a notebook
                </MovingBorderButton>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {kits.map((kit) => {
                const expanded = openId === kit.id;
                return (
                  <section
                    key={kit.id}
                    className="overflow-hidden rounded-2xl border border-[var(--card-border)]"
                  >
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] text-[var(--signal)]">
                        <DownloadCloud className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold">
                          {kit.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-text-dim">
                          {kit.notebookName} · {KIND_LABEL[kit.kind]} ·{" "}
                          {savedLabel(kit.savedAt)}
                          {kit.lang === "hi" ? " · हिंदी" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenId(expanded ? null : kit.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] font-medium transition-colors hover:text-foreground"
                        >
                          {expanded ? "Close" : "Read"}
                          <ChevronDown
                            className={
                              "h-3 w-3 transition-transform " +
                              (expanded ? "rotate-180" : "")
                            }
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteKit(kit)}
                          aria-label={`Remove ${kit.title} from this device`}
                          className="rounded-full p-1.5 text-text-dim transition-colors hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-[var(--card-border)] p-4 sm:p-6">
                        {kit.kind === "summary" && (
                          <SummaryView payload={kit.payload as SummaryPayload} />
                        )}
                        {kit.kind === "flashcards" && (
                          <FlashcardsView payload={kit.payload as FlashcardsPayload} />
                        )}
                        {kit.kind === "quiz" && (
                          <QuizView payload={kit.payload as QuizPayload} />
                        )}
                        {kit.kind === "mindmap" && (
                          <MindmapView payload={kit.payload as MindmapPayload} />
                        )}
                        {kit.kind === "slides" && (
                          <SlidesView payload={kit.payload as SlidesPayload} />
                        )}
                        <p className="mt-5 text-[10.5px] text-text-dim">
                          Stored on this device. Deleting it here does not delete
                          the sheet from your Manthan account.
                        </p>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}

          <p className="mt-8 text-[11px] leading-relaxed text-text-dim">
            Downloads are per browser, not per account. Clearing site data or
            using private mode removes them. Open a sheet online again to
            re-download it.
          </p>

          <p className="mt-4 text-[11px] text-text-dim">
            Need the sheet from another device?{" "}
            <Link to="/dashboard" className="text-[var(--signal)]">
              Re-download it from the notebook
            </Link>
            .
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
