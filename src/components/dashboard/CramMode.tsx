import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, FileText, Loader2, Upload, X } from "lucide-react";
import { useMutation, useAction } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Cram Mode.
 *
 * A textbook goes in through the dashed well, it is genuinely read (the bytes
 * are uploaded, decoded on the server and handed to the model), and the result
 * splits in two: the compressed notes on the left, the syllabus benchmarks they
 * are measured against on the right — each one marked covered or a gap.
 *
 * The pipeline used to be theatre: a filename-keyed table of canned syllabus
 * packs behind a two-second timer, so any book produced the same five
 * paragraphs. Nothing here is pre-written now. If the file cannot be read the
 * panel says so instead of inventing notes.
 */

interface CramNote {
  topic: string;
  points: string[];
}

interface Benchmark {
  topic: string;
  weight: number;
  note: string;
  covered: boolean;
}

interface Analysis {
  id: number;
  name: string;
  size: string;
  subject: string;
  notes: CramNote[];
  benchmarks: Benchmark[];
  characters: number;
  model: string;
}

/** Ordered phases — each one a real step, not a progress animation. */
const STAGES = [
  "Uploading the file",
  "Reading the pages",
  "Compressing against the syllabus",
];

const MAX_UPLOAD = 20 * 1024 * 1024;

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Characters, honest about small counts — `Math.round(500 / 1000)` printed
 *  "0k chars", which read as "nothing was read" even when a short page had
 *  been read in full. */
function formatChars(count: number) {
  if (count < 1000) return `${count} characters`;
  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k characters`;
}

export function CramMode({
  notebookName,
  onClose,
}: {
  notebookName: string;
  onClose: () => void;
}) {
  const cramAnalyze = useAction(api.ai.cramAnalyze);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);

  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const idRef = useRef(1);
  const busy = stage !== null;

  const accept = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || busy) return;

      setError(null);
      if (file.size > MAX_UPLOAD) {
        setError(`${file.name} is larger than 20 MB. Split the chapter and add it again.`);
        return;
      }

      setCurrentName(file.name);
      setStage(0);

      try {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };

        setStage(1);
        const result = await cramAnalyze({
          storageId,
          name: file.name,
          mime: file.type || undefined,
        });

        if (!result.ok) {
          // A sentence the student can act on — the action no longer throws,
          // because Convex replaces a thrown message with "Server Error".
          setError(result.error);
          toast.error(result.error);
          return;
        }

        const { ok: _ok, ...analysis } = result;
        setAnalyses((current) => [
          ...current,
          {
            id: idRef.current++,
            name: file.name,
            size: readableSize(file.size),
            ...analysis,
          },
        ]);
      } catch (thrown) {
        const message =
          thrown instanceof Error ? thrown.message : "Cram Mode could not read that file.";
        setError(message);
        toast.error(message);
      } finally {
        setStage(null);
        setCurrentName(null);
      }
    },
    [busy, cramAnalyze, generateUploadUrl],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.34, ease: [0.25, 1, 0.5, 1] }}
      className="premium-glass flex flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Cram Mode
          </h2>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-text-dim">
            A textbook in, exam-ready notes out — genuinely read, then ranked
            against the syllabus with the gaps marked.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-dim transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      {analyses.length === 0 && !busy && (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void accept(event.dataTransfer.files);
          }}
          className={"tool-dropzone" + (dragOver ? " is-over" : "")}
        >
          <Upload className="h-5 w-5 text-[var(--signal)]" />
          <span className="text-sm font-medium">Drop a textbook chapter, or a photo of the pages</span>
          <span className="text-xs text-text-dim">
            PDF, Word, JPG or PNG, text and Markdown — Manthan reads it, then compresses it
            into exam-ready notes for {notebookName}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
            onChange={(event) => {
              const files = event.target.files;
              // Clearing lets the same book be re-run after a failure.
              event.target.value = "";
              void accept(files);
            }}
          />
        </label>
      )}

      {busy && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--glass-line)] p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="spin-micro h-4 w-4 shrink-0 text-[var(--signal)]" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {currentName ?? "Working"}
            </span>
            <span className="shrink-0 text-xs text-text-dim">Working</span>
          </div>
          {/* Indeterminate, because a single model call has no honest
              percentage to report. */}
          <div className="relative h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-dim)_28%,transparent)]">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-[var(--signal)]"
              animate={{ x: ["-40%", "310%"] }}
              transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {STAGES.map((label, index) => (
              <li
                key={label}
                className={
                  "flex items-center gap-1.5 text-[11px] " +
                  (index <= (stage ?? 0) ? "text-foreground" : "text-text-dim")
                }
              >
                {index < (stage ?? 0) ? (
                  <Check className="h-3 w-3 text-[var(--signal)]" />
                ) : (
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (index === stage
                        ? "bg-[var(--signal)]"
                        : "bg-[color-mix(in_srgb,var(--text-dim)_45%,transparent)]")
                    }
                  />
                )}
                {label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-[11.5px] leading-relaxed text-amber-200">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {analyses.map((analysis) => (
          <motion.div
            key={analysis.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
            className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2"
          >
            <div className="rounded-2xl border border-[var(--glass-line)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-bold tracking-tight">
                  Compressed notes
                </h3>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[11px] text-text-dim">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground/80">{analysis.name}</p>
                  <p className="mt-0.5 truncate">
                    {analysis.subject} · {analysis.size} · {formatChars(analysis.characters)} read
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {analysis.notes.map((note) => (
                  <article key={note.topic} className="flex flex-col gap-1.5">
                    <h4 className="font-display text-[12.5px] font-bold tracking-tight">
                      {note.topic}
                    </h4>
                    <ul className="space-y-1.5 pl-4">
                      {note.points.map((point, pointIndex) => (
                        <li
                          key={`${note.topic}-${pointIndex}`}
                          className="list-disc text-[12px] leading-relaxed text-text-dim marker:text-[var(--signal)]"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--glass-line)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-bold tracking-tight">
                  Syllabus benchmarks
                </h3>
              </div>
              <ul className="mt-3 space-y-2.5">
                {analysis.benchmarks.map((benchmark) => (
                  <li key={benchmark.topic} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      {benchmark.covered ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--text-dim)_55%,transparent)]" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                        {benchmark.topic}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                        {benchmark.weight >= 0.9
                          ? "High"
                          : benchmark.weight >= 0.75
                            ? "Medium"
                            : "Low"}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-dim)_28%,transparent)]">
                      <motion.div
                        className="h-full rounded-full bg-[var(--signal)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${benchmark.weight * 100}%` }}
                        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                      />
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-text-dim">
                      {benchmark.covered ? "" : "Not in this file — "}
                      {benchmark.note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {analyses.length > 0 && (
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--signal)]">
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Reading…" : "Add another textbook"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
            onChange={(event) => void accept(event.target.files)}
          />
        </label>
      )}
    </motion.section>
  );
}

export default CramMode;
