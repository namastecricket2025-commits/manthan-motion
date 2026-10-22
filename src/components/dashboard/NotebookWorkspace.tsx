import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { CramMode } from "@/components/dashboard/CramMode";
import { MindmapView } from "@/components/dashboard/MindmapView";
import { NotebookChat } from "@/components/dashboard/NotebookChat";
import { MaterialSourcePeek } from "@/components/dashboard/SourcePeek";
import { AudioOverview } from "@/components/dashboard/AudioOverview";
import { setRecentKind } from "@/components/shared/TestimonialsFeedbackPrompt";
import { usePlan } from "@/components/plans/PlanProvider";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { useCdPill } from "@/components/landing/use-cd-pill";
import { SITE_URL } from "@/lib/site";
import { isKitSaved, offlineKitId, saveKit } from "@/lib/offline";
import { UsageCard } from "@/components/dashboard/UsageCard";
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Languages,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  NotebookPen,
  Printer,
  Share2,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

/**
 * The notebook workspace: where the product actually happens.
 *
 * Sources go in (uploaded files, fetched links, typed notes), the extracted
 * text is what the generator reads, and the artefacts it returns are rendered
 * here. Nothing on this screen is decorative — every count, status and
 * artefact traces back to a row the user created.
 */

type Kind = "summary" | "flashcards" | "quiz" | "mindmap" | "slides";

const KIND_META: { kind: Kind; label: string; hint: string }[] = [
  { kind: "summary", label: "Summary", hint: "Structured revision notes" },
  { kind: "flashcards", label: "Flashcards", hint: "Active-recall cards" },
  { kind: "quiz", label: "Quiz", hint: "Multiple choice practice" },
  { kind: "mindmap", label: "Mind map", hint: "One-page hierarchy" },
  { kind: "slides", label: "Slides", hint: "A deck to present from" },
];

const MAX_UPLOAD = 20 * 1024 * 1024;

function relativeTime(timestamp: number) {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function SourceIcon({ kind }: { kind: "file" | "link" | "text" }) {
  if (kind === "file") return <FileText className="h-4 w-4 shrink-0" />;
  if (kind === "link") return <Link2 className="h-4 w-4 shrink-0" />;
  return <Type className="h-4 w-4 shrink-0" />;
}

export function NotebookWorkspace({
  notebookId,
  notebookName,
  initialTab,
}: {
  notebookId: Id<"notebooks">;
  notebookName: string;
  /** Which material tab to open on arrival — the overview deep-links here. */
  initialTab?: Kind;
}) {
  const sources = useQuery(api.sources.listForNotebook, { notebookId });
  const materials = useQuery(api.materials.listForNotebook, { notebookId });

  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);
  const addText = useMutation(api.sources.addText);
  const removeSource = useMutation(api.sources.remove);
  const removeMaterial = useMutation(api.materials.remove);
  const recordMistake = useMutation(api.studyMistakes.record);

  const ingestFile = useAction(api.ai.ingestFile);
  const ingestLink = useAction(api.ai.ingestLink);
  const reExtract = useAction(api.ai.reExtract);
  const generate = useAction(api.ai.generate);
  const translate = useAction(api.ai.translateMaterial);

  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<
    { key: number; name: string; error?: string }[]
  >([]);
  const [linkValue, setLinkValue] = useState("");
  const [busyLink, setBusyLink] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTitle, setNotesTitle] = useState("");
  const [notesBody, setNotesBody] = useState("");
  const [busyNotes, setBusyNotes] = useState(false);
  const [selected, setSelected] = useState<Kind[]>(
    KIND_META.map((meta) => meta.kind),
  );
  const [running, setRunning] = useState<Kind[]>([]);
  const [tab, setTab] = useState<Kind>(initialTab ?? "summary");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [tool, setTool] = useState<"cram" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [hindi, setHindi] = useState(false);
  const [translated, setTranslated] = useState<unknown>(null);
  const [translating, setTranslating] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [peekSource, setPeekSource] = useState<string | null>(null);
  const createShare = useMutation(api.shares.create);
  const revokeShare = useMutation(api.shares.revoke);
  const regenerateRef = useCdPill<HTMLButtonElement>(running.length > 0);
  const { can, requireAccess } = usePlan();

  /*
   * A metric card on the overview lands here with an anchor — `#sources` for
   * the source list, `#materials` for what the notebook churned out — so the
   * click arrives at the panel it promised instead of the top of the page.
   * Once, on mount: scrolling again on every re-render would fight the user.
   */
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target !== "sources" && target !== "materials" && target !== "studio") return;
    const reduced =
      document.documentElement.dataset.motion === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const readyCount =
    sources?.filter((s) => s.status !== "failed" && s.characters > 0).length ??
    0;
  const failedCount = sources?.filter((s) => s.status === "failed").length ?? 0;

  /* ----------------------------- ingest ----------------------------- */

  const uploadKeyRef = useRef(0);

  /**
   * Every selected file uploads in parallel — picking five PDFs adds five
   * sources, not one. Rows are keyed by a counter (names can repeat); a
   * failure marks just its own row and the rest continue.
   */
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const accepted = list.filter((file) => {
      if (file.size > MAX_UPLOAD) {
        toast.error(`${file.name} is larger than 20 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    const keys = accepted.map(() => uploadKeyRef.current++);
    setUploads((u) => [
      ...u,
      ...accepted.map((file, i) => ({ key: keys[i], name: file.name })),
    ]);

    await Promise.all(
      accepted.map(async (file, i) => {
        const key = keys[i];
        try {
          const url = await generateUploadUrl();
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!response.ok) {
            throw new Error(`Upload failed (${response.status}).`);
          }
          const { storageId } = (await response.json()) as {
            storageId: Id<"_storage">;
          };
          await ingestFile({
            notebookId,
            storageId,
            name: file.name,
            mime: file.type || undefined,
            size: file.size,
          });
          setUploads((u) => u.filter((item) => item.key !== key));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not add that file.";
          setUploads((u) =>
            u.map((item) =>
              item.key === key ? { ...item, error: message } : item,
            ),
          );
          toast.error(`${file.name}: ${message}`);
        }
      }),
    );
  }

  /**
   * Print the material that is on screen, not the whole dashboard. The body
   * class scopes the print stylesheet; `afterprint` clears it even if the
   * dialog is cancelled, so the screen never stays half-printed.
   */
  function printMaterial() {
    const cleanup = () => document.body.classList.remove("material-printing");
    document.body.classList.add("material-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  async function submitLink() {
    const url = linkValue.trim();
    if (!url || busyLink) return;
    setBusyLink(true);
    try {
      await ingestLink({ notebookId, url });
      setLinkValue("");
      toast("Link read", { description: "Its text is now part of this notebook." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read link");
    } finally {
      setBusyLink(false);
    }
  }

  async function submitNotes() {
    if (busyNotes) return;
    setBusyNotes(true);
    try {
      await addText({
        notebookId,
        name: notesTitle.trim() || "Pasted notes",
        text: notesBody,
      });
      setNotesBody("");
      setNotesTitle("");
      setNotesOpen(false);
      toast("Notes added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save notes",
      );
    } finally {
      setBusyNotes(false);
    }
  }

  /* --------------------------- generation --------------------------- */

  function toggleKind(kind: Kind) {
    setSelected((current) =>
      current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    );
  }

  async function runGeneration(kinds: Kind[]) {
    if (kinds.length === 0) {
      toast.error("Pick at least one thing to generate.");
      return;
    }
    setRunning(kinds);
    setTab(kinds[0]);
    try {
      const results = await generate({ notebookId, kinds });
      const failed = results.filter((r) => !r.ok);
      const ok = results.length - failed.length;
      if (ok > 0) {
        // The feedback prompt asks about what was just made, once.
        const label =
          kinds.length === 1
            ? (KIND_META.find((meta) => meta.kind === kinds[0])?.label.toLowerCase() ??
              "study material")
            : "study kit";
        setRecentKind(label);
        toast("Study material ready", {
          description: `Generated ${ok} of ${results.length} item${results.length === 1 ? "" : "s"} from your sources.`,
        });
      }
      for (const failure of failed) {
        if (failure.providerExhausted) {
          // The providers' free capacity, not the student's allowance. Saying
          // otherwise sent people to the Plans page over a limit they had not
          // reached.
          toast.error("The AI's free capacity is used up for today", {
            description:
              "Every model behind Manthan has hit its provider's daily free limit. Your own allowance is untouched — add another key in the Keys tab, or see Plans for a higher cap.",
            duration: 8000,
          });
        } else if (failure.quotaExceeded) {
          toast.error("Today's generation allowance is used up", {
            description:
              "It resets at midnight UTC — see the allowance meter in this panel, or the Plans page for a higher cap.",
            duration: 8000,
          });
        } else if (failure.rateLimited) {
          toast.error("The AI models are busy right now", {
            description:
              "Nothing was generated and your allowance is untouched. Give it a minute and generate again.",
            duration: 8000,
          });
        } else {
          toast.error(`${failure.kind}: ${failure.error ?? "not generated"}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed.";
      if (/allowance/i.test(message)) {
        toast.error("Today's generation allowance is used up", {
          description:
            "It resets at midnight UTC — see the allowance meter in this panel, or the Plans page for a higher cap.",
          duration: 8000,
        });
      } else {
        toast.error(message);
      }
    } finally {
      setRunning([]);
    }
  }

  /* ----------------------------- render ----------------------------- */

  const byKind = new Map<Kind, NonNullable<typeof materials>[number]>();
  for (const material of materials ?? []) {
    if (!byKind.has(material.kind as Kind)) {
      byKind.set(material.kind as Kind, material);
    }
  }
  const availableTabs = KIND_META.filter((meta) => byKind.has(meta.kind));
  const active =
    byKind.get(tab) ??
    (availableTabs[0] ? byKind.get(availableTabs[0].kind) : undefined);
  const activeKind = (active?.kind ?? tab) as Kind;
  /* A live share link for the sheet on screen, so the button can say "Copy"
     instead of silently creating a second token. */
  const share = useQuery(
    api.shares.forMaterial,
    active ? { materialId: active._id } : "skip",
  );
  const translation = useQuery(
    api.translations.get,
    active ? { materialId: active._id, lang: "hi" } : "skip",
  );

  /* A new sheet starts in its source language; the cache is per material. */
  useEffect(() => {
    setHindi(false);
    setTranslated(null);
  }, [active?._id]);

  const shownPayload = hindi
    ? (translated ?? translation?.payload ?? active?.payload)
    : active?.payload;

  async function toggleHindi() {
    if (!active || translating) return;
    if (hindi) {
      setHindi(false);
      return;
    }
    if (translation?.payload) {
      setHindi(true);
      return;
    }
    setTranslating(true);
    try {
      const result = await translate({ materialId: active._id });
      setTranslated(result.payload);
      setHindi(true);
      toast.success("Hindi version ready", {
        description: "The original is unchanged; this is cached for next time.",
      });
    } catch (error) {
      toast.error("Could not make the Hindi version", {
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
      });
    } finally {
      setTranslating(false);
    }
  }

  useEffect(() => {
    let live = true;
    if (!active) {
      setOfflineSaved(false);
      return;
    }
    void isKitSaved(offlineKitId(active._id, hindi ? "hi" : "en")).then(
      (saved) => {
        if (live) setOfflineSaved(saved);
      },
    );
    return () => {
      live = false;
    };
  }, [active, hindi]);

  async function saveOffline() {
    if (!active || savingOffline || offlineSaved) return;
    setSavingOffline(true);
    const lang = hindi ? "hi" : "en";
    const ok = await saveKit({
      id: offlineKitId(active._id, lang),
      materialId: active._id,
      notebookId,
      notebookName,
      kind: active.kind as Kind,
      title: active.title,
      payload: shownPayload ?? active.payload,
      lang,
      savedAt: Date.now(),
    });
    setSavingOffline(false);
    if (!ok) {
      toast.error("Could not save offline", {
        description:
          "This browser may be blocking storage, or the sheet is too large for the remaining space.",
      });
      return;
    }
    setOfflineSaved(true);
    toast.success("Saved for offline", {
      description: `${active.title} is now on this device. Open it from Offline kits.`,
    });
    /* Warm the library chunk while there is still a connection, so the route
       itself is cached by the service worker even if the student goes offline
       before opening it for the first time. */
    void import("@/pages/OfflineKits");
  }

  async function shareActive() {
    if (!active || sharing) return;
    setSharing(true);
    try {
      const { token } = await createShare({ materialId: active._id });
      const url = `${SITE_URL}/s/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(share ? "Link copied again" : "Share link copied", {
          description: "Anyone with the link can read this sheet, not your notebook.",
        });
      } catch {
        toast("Share link", {
          description: url,
          duration: 10000,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create a share link",
      );
    } finally {
      setSharing(false);
    }
  }

  async function stopSharing() {
    if (!active) return;
    try {
      await revokeShare({ materialId: active._id });
      toast("Sharing stopped", {
        description: "Every existing link to this sheet now shows as unavailable.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not stop sharing",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Work-area top bar: the advanced tool, as a text-link action.
          On phones the link grows to a 40px-tall target and the descriptor
          drops away, so the bar stays a single tidy row.

          The spoken tutor is deliberately NOT here. It lives as the single
          floating orb in the corner of every route, so there is one voice and
          one conversation no matter where the student is working. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--glass-line)] px-3 py-1.5 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            type="button"
            aria-pressed={tool === "cram"}
            onClick={() => {
              if (tool === "cram") setTool(null);
              else if (requireAccess("cramMode")) setTool("cram");
            }}
            className={
              "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-[12.5px] font-semibold transition-colors sm:min-h-0 sm:px-0 " +
              (tool === "cram"
                ? "text-[var(--signal)]"
                : "text-text-dim hover:text-[var(--signal)]")
            }
          >
            <Zap className="h-3.5 w-3.5" />
            Cram Mode
            {!can("cramMode") && <Lock className="h-3 w-3 opacity-70" />}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              document.getElementById("studio")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-[12.5px] font-semibold text-text-dim transition-colors hover:text-[var(--signal)] sm:min-h-0 sm:px-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask this notebook
          </button>
          <span className="hidden text-[11px] text-text-dim lg:inline">
            Advanced study tools for this notebook
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tool === "cram" && (
          <CramMode
            key="cram"
            notebookName={notebookName}
            onClose={() => setTool(null)}
          />
        )}
      </AnimatePresence>

      {/* ------------------------- studio -------------------------
          Chat, audio and video sit above the artefacts: talking to the sources
          is the work; the summary and decks are what falls out of it. */}
      <section
        id="studio"
        className="glass-panel scroll-mt-6 p-5 sm:p-6"
        aria-label="Notebook studio"
      >
        <div className="grid grid-cols-1 gap-5 min-[980px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <NotebookChat
            notebookId={notebookId}
            notebookName={notebookName}
            readyCount={readyCount}
          />
          <div className="flex min-w-0 flex-col gap-3">
            {/* Audio is the only artefact beside the chat. Video suggestions
                belong to a specific answer, so the chat offers one under the
                answer that needs it instead of this column listing channels
                nobody asked for. */}
            <AudioOverview notebookId={notebookId} readyCount={readyCount} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ------------------------- sources ------------------------- */}
        <div
          id="sources"
          className="glass-panel flex scroll-mt-6 flex-col gap-4 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold tracking-tight">
              Sources
            </h2>
            <span className="text-[11px] font-medium text-text-dim">
              {readyCount} readable
              {failedCount > 0 ? ` · ${failedCount} needs text` : ""}
            </span>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void uploadFiles(e.dataTransfer.files);
            }}
            className={
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition-colors " +
              (dragOver
                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                : "border-[var(--card-border)] hover:border-[var(--signal)]")
            }
          >
            <Upload className="h-5 w-5 text-[var(--signal)]" />
            <span className="text-sm font-medium">
              Drop files or click to browse — as many as you like
            </span>
            <span className="text-xs text-text-dim">
              PDF, Word, JPG or PNG, text and CSV — up to 20 MB each, added in
              parallel
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.rtf,.html,.htm,.png,.jpg,.jpeg,.webp,.heic,.bmp"
              className="hidden"
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitLink()}
                placeholder="Paste a link to read…"
                className="w-full rounded-full border border-[var(--card-border)] bg-transparent py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)] sm:text-sm"
              />
            </div>
            <MovingBorderButton
              onClick={() => void submitLink()}
              disabled={busyLink || !linkValue.trim()}
              loading={busyLink}
              className="shrink-0"
              innerClassName="px-4 py-2.5 text-[13px]"
            >
              {busyLink ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Read"
              )}
            </MovingBorderButton>
          </div>

          {notesOpen ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--card-border)] p-3.5">
              <input
                value={notesTitle}
                onChange={(e) => setNotesTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)] sm:py-2 sm:text-sm"
              />
              <textarea
                value={notesBody}
                onChange={(e) => setNotesBody(e.target.value)}
                rows={5}
                placeholder="Paste or type your notes here…"
                className="w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
              />
              <div className="flex items-center gap-2">
                <MovingBorderButton
                  onClick={() => void submitNotes()}
                  disabled={busyNotes || notesBody.trim().length < 20}
                  loading={busyNotes}
                  innerClassName="px-4 py-2 text-[13px]"
                >
                  Save notes
                </MovingBorderButton>
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="text-xs text-text-dim hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="w-fit text-xs font-medium text-text-dim transition-colors hover:text-foreground"
            >
              + Paste notes instead
            </button>
          )}

          <ul className="space-y-2">
            {uploads.map((upload) => (
              <li
                key={upload.key}
                className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-2.5"
              >
                {upload.error ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-[var(--signal)]" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--signal)]" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {upload.name}
                </span>
                <span className="text-xs text-text-dim">
                  {upload.error ?? "Uploading…"}
                </span>
              </li>
            ))}

            {sources?.map((source) => (
              <li
                key={source._id}
                className="rounded-xl border border-[var(--card-border)] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      source.status === "failed"
                        ? "text-[var(--signal)]"
                        : "text-text-dim"
                    }
                  >
                    <SourceIcon kind={source.kind} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {source.name}
                  </span>
                  <span className="hidden shrink-0 text-xs text-text-dim sm:block">
                    {source.status === "failed"
                      ? source.detail
                      : source.characters > 0
                        ? `${source.characters.toLocaleString()} chars`
                        : source.detail}
                  </span>
                  {source.status !== "failed" && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${source.name}`}
                    onClick={async () => {
                      await removeSource({ sourceId: source._id });
                      toast("Source removed", { description: source.name });
                    }}
                    className="shrink-0 rounded-full p-1 text-text-dim transition-colors hover:text-[var(--signal)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {source.status === "failed" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                    <p className="text-xs leading-relaxed text-text-dim">
                      {source.error ?? "No readable text."}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        setRetrying(source._id);
                        try {
                          const result = await reExtract({
                            sourceId: source._id,
                          });
                          if (result.ok) toast("Text extracted");
                          else toast.error(result.error ?? "Still unreadable");
                        } finally {
                          setRetrying(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-foreground"
                    >
                      {retrying === source._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Try again
                    </button>
                  </div>
                )}
              </li>
            ))}

            {sources?.length === 0 && uploads.length === 0 && (
              <li className="rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-6 text-center">
                <p className="text-sm font-medium">Nothing in this notebook</p>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">
                  Add a file, a link or pasted notes. Manthan reads the text and
                  cites it back in everything it generates.
                </p>
              </li>
            )}
          </ul>
        </div>

        {/* ------------------------ generation ------------------------ */}
        <div className="glass-panel flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold tracking-tight">
              Churn
            </h2>
            <Sparkles className="h-4 w-4 text-[var(--signal)]" />
          </div>

          <p className="text-xs leading-relaxed text-text-dim">
            {readyCount === 0
              ? "Add a source first — generation reads only the text you have given it."
              : `Generate from the ${readyCount} readable source${readyCount === 1 ? "" : "s"} in this notebook.`}
          </p>

          {readyCount > 0 && (
            <p className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11px] leading-relaxed text-text-dim">
              Everything is written in the language of your sources.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {KIND_META.map((meta) => {
              const on = selected.includes(meta.kind);
              const isRunning = running.includes(meta.kind);
              const hasMaterial = byKind.has(meta.kind);
              return (
                <button
                  key={meta.kind}
                  type="button"
                  onClick={() => toggleKind(meta.kind)}
                  aria-pressed={on}
                  className={
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors " +
                    (on
                      ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                      : "border-[var(--card-border)]")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border " +
                      (on
                        ? "border-[var(--signal)] text-[var(--signal)]"
                        : "border-[var(--card-border)]")
                    }
                  >
                    {isRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : on ? (
                      <Check className="h-3 w-3" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{meta.label}</span>
                    <span className="block text-[11px] text-text-dim">
                      {hasMaterial ? "Ready — regenerate any time" : meta.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <MovingBorderButton
            onClick={() => void runGeneration(selected)}
            disabled={running.length > 0 || readyCount === 0 || selected.length === 0}
            loading={running.length > 0}
            className="w-full"
            innerClassName="w-full px-5 py-3 text-sm"
          >
            {running.length > 0 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Churning {running.length} item
                {running.length === 1 ? "" : "s"}…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate study material
              </>
            )}
          </MovingBorderButton>

          <UsageCard />
        </div>
      </div>

      {/* ------------------------- materials ------------------------- */}
      <div id="materials" className="glass-panel scroll-mt-6 p-5 sm:p-6">
        {availableTabs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <NotebookPen className="h-5 w-5 text-[var(--signal)]" />
            <p className="text-sm font-medium">No study material yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-text-dim">
              Whatever you generate lands here — a summary, flashcards, a quiz, a
              mind map and a slide deck, all built from this notebook&apos;s
              sources.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {availableTabs.map((meta) => (
                <button
                  key={meta.kind}
                  type="button"
                  onClick={() => setTab(meta.kind)}
                  className={
                    "rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors sm:py-1.5 " +
                    (activeKind === meta.kind
                      ? "border-[var(--signal)] text-foreground"
                      : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                  }
                >
                  {meta.label}
                </button>
              ))}
            </div>

            {active && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] pb-3">
                  <p className="text-[11px] text-text-dim">
                    {active.title} · from {active.sourceIds.length} source
                    {active.sourceIds.length === 1 ? "" : "s"} ·{" "}
                    {relativeTime(active.createdAt)} · {active.model}
                    {hindi ? " · हिंदी" : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleHindi()}
                      disabled={translating}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 " +
                        (hindi
                          ? "border-[var(--signal)] text-foreground"
                          : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                      }
                      title="Translate this sheet into Hindi without changing the original"
                    >
                      {translating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Languages className="h-3 w-3" />
                      )}
                      {translating ? "Making Hindi…" : hindi ? "English" : "हिंदी"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareActive()}
                      disabled={sharing}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-foreground disabled:opacity-50"
                      title="Create a read-only link to this sheet"
                    >
                      {sharing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Share2 className="h-3 w-3" />
                      )}
                      {share ? "Copy link" : "Share"}
                    </button>
                    {share ? (
                      <button
                        type="button"
                        onClick={() => void stopSharing()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-[var(--signal)]"
                        title="Revoke every link to this sheet"
                      >
                        <Link2Off className="h-3 w-3" />
                        Stop sharing
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveOffline()}
                      disabled={savingOffline || offlineSaved}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-70 " +
                        (offlineSaved
                          ? "border-[var(--signal)] text-foreground"
                          : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                      }
                      title="Store this sheet on this device for offline reading"
                    >
                      {savingOffline ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : offlineSaved ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      {offlineSaved ? "Offline saved" : "Save offline"}
                    </button>
                    <button
                      type="button"
                      onClick={printMaterial}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-foreground"
                      title="Print or save this material as a PDF"
                    >
                      <Printer className="h-3 w-3" />
                      Print / PDF
                    </button>
                    <button
                      type="button"
                      ref={regenerateRef}
                      onClick={() => void runGeneration([activeKind])}
                      disabled={running.length > 0}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-foreground disabled:opacity-50 " +
                        (running.length > 0 ? "cd-pill is-busy" : "cd-pill")
                      }
                    >
                      <RotateCcw className="h-3 w-3" />
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeMaterial({ materialId: active._id });
                        toast("Deleted");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium text-text-dim transition-colors hover:text-[var(--signal)]"
                    >
                      <X className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="material-print-area mt-5">
                  {activeKind === "summary" && (
                    <SummaryView
                      payload={shownPayload as SummaryPayload}
                      onSourcePeek={setPeekSource}
                    />
                  )}
                  {activeKind === "flashcards" && (
                    <FlashcardsView
                      payload={shownPayload as FlashcardsPayload}
                    />
                  )}
                  {activeKind === "quiz" && (
                    <QuizView
                      payload={shownPayload as QuizPayload}
                      onSourcePeek={setPeekSource}
                      onWrongAnswer={({ question, pickedIndex }) => {
                        if (!active) return;
                        void recordMistake({
                          source: "quiz",
                          prompt: question.question,
                          options: question.options,
                          answerIndex: question.answer,
                          givenAnswer: question.options[pickedIndex] ?? "",
                          explanation: question.explanation,
                          materialId: active._id,
                          chapter: active.title,
                        }).catch(() => {
                          /* The quiz must keep working even if the bank write
                             fails (for example while signing out). */
                        });
                      }}
                    />
                  )}
                  {activeKind === "mindmap" && (
                    <MindmapView payload={shownPayload as MindmapPayload} />
                  )}
                  {activeKind === "slides" && (
                    <SlidesView payload={shownPayload as SlidesPayload} />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {active && peekSource ? (
        <MaterialSourcePeek
          materialId={active._id}
          sourceName={peekSource}
          focus={active.title}
          onClose={() => setPeekSource(null)}
        />
      ) : null}
    </div>
  );
}

export default NotebookWorkspace;
