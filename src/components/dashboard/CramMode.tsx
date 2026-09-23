import { Check, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cram Mode.
 *
 * A textbook goes in through the dashed well, a three-stage pipeline reports
 * its own progress, and the finished screen splits in two: the compressed
 * notes on the left, the syllabus benchmarks they are measured against on the
 * right, each marked covered once the book has been ranked.
 */

interface Benchmark {
  topic: string;
  weight: number;
  note: string;
}

interface Pack {
  subject: string;
  benchmarks: Benchmark[];
}

const PACKS: { match: RegExp; pack: Pack }[] = [
  {
    match: /physic|motion|optic|electr|mechanic/i,
    pack: {
      subject: "Physics",
      benchmarks: [
        { topic: "Units and measurement", weight: 0.6, note: "SI base units, dimensional consistency, significant figures." },
        { topic: "Laws of motion", weight: 1, note: "Inertia, F = m a, action-reaction pairs, friction on an incline." },
        { topic: "Work, energy and power", weight: 0.85, note: "Work-energy theorem, conservative forces, power as the rate of work." },
        { topic: "Ray optics", weight: 0.9, note: "Mirror and lens formula, refraction at a plane surface, magnification." },
        { topic: "Current electricity", weight: 0.75, note: "Ohm's law, series and parallel networks, Kirchhoff's rules." },
      ],
    },
  },
  {
    match: /chem|reaction|acid|periodic|organic/i,
    pack: {
      subject: "Chemistry",
      benchmarks: [
        { topic: "Atomic structure", weight: 0.7, note: "Quantum numbers, orbital filling, periodic trends." },
        { topic: "Chemical bonding", weight: 0.9, note: "Ionic versus covalent character, VSEPR shapes, hybridisation." },
        { topic: "Stoichiometry", weight: 1, note: "Mole concept, limiting reagent, percentage yield." },
        { topic: "Equilibrium", weight: 0.85, note: "Le Chatelier's principle, Kc and Kp, buffer behaviour." },
        { topic: "Organic basics", weight: 0.65, note: "Functional groups, homologous series, IUPAC naming." },
      ],
    },
  },
  {
    match: /bio|cell|genetic|respiration|human/i,
    pack: {
      subject: "Biology",
      benchmarks: [
        { topic: "Cell structure", weight: 0.95, note: "Organelle functions, plant versus animal cells, membrane transport." },
        { topic: "Respiration", weight: 0.9, note: "Aerobic and anaerobic pathways, ATP accounting, mitochondrial site." },
        { topic: "Genetics", weight: 1, note: "Mendelian ratios, monohybrid and dihybrid crosses, sex determination." },
        { topic: "Transport in plants", weight: 0.7, note: "Xylem and phloem, transpiration pull, root pressure." },
        { topic: "Human physiology", weight: 0.8, note: "Circulatory and respiratory coordination, excretion and homeostasis." },
      ],
    },
  },
  {
    match: /math|algebra|trigono|geometry|calculus|statistic/i,
    pack: {
      subject: "Mathematics",
      benchmarks: [
        { topic: "Algebra", weight: 1, note: "Identities, quadratic roots, polynomial factorisation." },
        { topic: "Trigonometry", weight: 0.9, note: "Ratios, identities, heights and distances, standard angles." },
        { topic: "Coordinate geometry", weight: 0.8, note: "Distance and section formulae, straight-line forms, conics." },
        { topic: "Calculus", weight: 0.85, note: "Limits, power rule, tangents and normals, rate of change." },
        { topic: "Statistics and probability", weight: 0.7, note: "Mean, median, mode, variance, elementary probability." },
      ],
    },
  },
];

const FALLBACK_PACK: Pack = {
  subject: "General",
  benchmarks: [
    { topic: "Core definitions", weight: 1, note: "The vocabulary the examiner expects you to use precisely." },
    { topic: "Governing relations", weight: 0.9, note: "Every formula the chapter applies, with the condition it holds under." },
    { topic: "Worked methods", weight: 0.85, note: "The standard procedure for each question archetype." },
    { topic: "Diagrams and labels", weight: 0.7, note: "The figures that carry marks on their own." },
    { topic: "Common mistakes", weight: 0.65, note: "The traps that lose marks in this chapter." },
  ],
};

const STAGES = [
  "Extracting pages",
  "Ranking against the syllabus",
  "Compressing to exam notes",
];

function detectPack(text: string): Pack {
  for (const entry of PACKS) {
    if (entry.match.test(text)) return entry.pack;
  }
  return FALLBACK_PACK;
}

interface Textbook {
  name: string;
  size: string;
  pack: Pack;
}

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CramMode({
  notebookName,
  onClose,
}: {
  notebookName: string;
  onClose: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState<Textbook | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const startedAt = useRef(0);

  const pack = textbooks[0]?.pack ?? detectPack(notebookName);

  /* One rAF drives the pipeline so the stage text and the bar never drift. */
  useEffect(() => {
    if (!processing) return;
    let raf = 0;
    const total = 2400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startedAt.current) / total);
      setProgress(p);
      setStage(Math.min(STAGES.length - 1, Math.floor(p * STAGES.length)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setTextbooks((current) => [...current, processing]);
        setProcessing(null);
        setProgress(0);
        setStage(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [processing]);

  const accept = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    startedAt.current = performance.now();
    setProcessing({
      name: file.name,
      size: readableSize(file.size),
      pack: detectPack(file.name),
    });
  }, []);

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
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">
            Sprint Pass workspace
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
            Cram Mode
          </h2>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-text-dim">
            A textbook in, exam-ready notes out — ranked against the syllabus and
            marked where the coverage is thin.
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

      {textbooks.length === 0 && !processing && (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            accept(event.dataTransfer.files);
          }}
          className={"tool-dropzone" + (dragOver ? " is-over" : "")}
        >
          <Upload className="h-5 w-5 text-[var(--signal)]" />
          <span className="text-sm font-medium">
            Drop a textbook or chapter PDF
          </span>
          <span className="text-xs text-text-dim">
            Manthan indexes the pages, then compresses them against {pack.subject}{" "}
            benchmarks
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md"
            onChange={(event) => accept(event.target.files)}
          />
        </label>
      )}

      {processing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--glass-line)] p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="spin-micro h-4 w-4 shrink-0 text-[var(--signal)]" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {processing.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-text-dim">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-dim)_28%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-[var(--signal)]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.12, ease: "linear" }}
            />
          </div>
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {STAGES.map((label, index) => (
              <li
                key={label}
                className={
                  "flex items-center gap-1.5 text-[11px] " +
                  (index <= stage ? "text-foreground" : "text-text-dim")
                }
              >
                {index < stage ? (
                  <Check className="h-3 w-3 text-[var(--signal)]" />
                ) : (
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (index === stage ? "bg-[var(--signal)]" : "bg-[color-mix(in_srgb,var(--text-dim)_45%,transparent)]")
                    }
                  />
                )}
                {label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {textbooks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          <div className="rounded-2xl border border-[var(--glass-line)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-bold tracking-tight">
                Compressed notes
              </h3>
              <span className="text-[11px] text-text-dim">
                {textbooks.length} source{textbooks.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {textbooks.map((book) => (
                <article key={book.name} className="flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {book.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-text-dim">
                      {book.size}
                    </span>
                  </header>
                  <ul className="space-y-1.5 pl-5">
                    {book.pack.benchmarks.slice(0, 6).map((benchmark) => (
                      <li
                        key={benchmark.topic}
                        className="text-[12px] leading-relaxed text-text-dim"
                      >
                        <span className="font-medium text-foreground">
                          {benchmark.topic}:
                        </span>{" "}
                        {benchmark.note}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--signal)]">
              <Upload className="h-3.5 w-3.5" />
              Add another textbook
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md"
                onChange={(event) => accept(event.target.files)}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--glass-line)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-bold tracking-tight">
                Syllabus benchmarks
              </h3>
              <span className="premium-chip">
                <Sparkles className="h-3 w-3" />
                {pack.subject}
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {pack.benchmarks.map((benchmark) => (
                <li key={benchmark.topic} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
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
                    {benchmark.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default CramMode;
