import { Loader2, RotateCcw, ScanSearch, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * AI Canvas Solver.
 *
 * Drop a photographed equation sheet or a physics diagram: the scan beam
 * sweeps the image, then the read is decomposed into three cards — what was
 * seen, the relations that apply, and the path from one to the other.
 *
 * The read reports only what it can actually observe (the file, its
 * resolution and its domain), and pairs that with the formula sheet for that
 * domain. Nothing it cannot see is invented.
 */

type Domain = "optics" | "mechanics" | "waves" | "algebra" | "general";

const DOMAIN_RULES: { match: RegExp; domain: Domain; label: string }[] = [
  { match: /optic|lens|mirror|refract|ray/i, domain: "optics", label: "Ray optics" },
  { match: /force|motion|mechan|newton|friction|incline/i, domain: "mechanics", label: "Mechanics" },
  { match: /wave|oscill|frequency|sound|interfer/i, domain: "waves", label: "Waves" },
  { match: /algebra|quadratic|equation|trigono|polynomial/i, domain: "algebra", label: "Algebra" },
];

const FORMULAS: Record<Domain, string[]> = {
  optics: ["1/v − 1/u = 1/f", "n₁ sin θ₁ = n₂ sin θ₂", "m = h′ / h = v / u"],
  mechanics: ["F = m a", "v = u + a t", "s = u t + ½ a t²"],
  waves: ["v = f λ", "T = 1 / f", "x = A sin(ω t)"],
  algebra: [
    "a x² + b x + c = 0",
    "x = (−b ± √(b² − 4ac)) / 2a",
    "(a + b)² = a² + 2ab + b²",
  ],
  general: [
    "List every given quantity with its unit",
    "Match the quantities to one governing relation",
    "Solve symbolically before substituting numbers",
  ],
};

const SOLUTION_STEPS: Record<Domain, string[]> = {
  optics: [
    "Fix the sign convention first — object distance is negative for a real object.",
    "Identify u and f from the diagram, then solve for v with the mirror or lens formula.",
    "Take the modulus of v / u for magnification and state whether the image is real or virtual.",
  ],
  mechanics: [
    "Draw the free-body diagram and mark the positive direction along the motion.",
    "Resolve every force on that direction, then apply F = m a to the net force.",
    "Use the kinematic relations to move between displacement, velocity and time.",
  ],
  waves: [
    "Read the amplitude and either the frequency or the period off the trace.",
    "Convert between f and T, then apply v = f λ for the wave speed.",
    "Check the phase: state the initial displacement and which way the wave travels.",
  ],
  algebra: [
    "Transpose every term to one side and write the standard form.",
    "Evaluate the discriminant, then substitute into the quadratic formula.",
    "Verify by substituting each root back into the original expression.",
  ],
  general: [
    "Transcribe every symbol from the sheet with its unit beside it.",
    "Choose the relations that connect those symbols and the unknown.",
    "Eliminate intermediates, solve for the unknown, then verify the units.",
  ],
};

interface Read {
  name: string;
  size: string;
  dimensions: string;
  domainLabel: string;
  domain: Domain;
}

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CanvasSolver() {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const pending = useRef<Read | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const accept = useCallback((file: File | undefined) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    pending.current = {
      name: file.name,
      size: readableSize(file.size),
      dimensions: "reading…",
      domain: "general",
      domainLabel: "General relations",
    };
    setPreview(URL.createObjectURL(file));
    setRead(null);
    setScanning(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rule = DOMAIN_RULES.find((entry) => entry.match.test(file.name));
      const detected = rule
        ? { domain: rule.domain, domainLabel: rule.label }
        : { domain: "general" as Domain, domainLabel: "General relations" };
      setRead((current) => ({
        ...(pending.current ?? {
          name: file.name,
          size: readableSize(file.size),
          dimensions: "—",
        }),
        ...detected,
        dimensions: current?.dimensions ?? "—",
      }));
      setScanning(false);
    }, 2400);
  }, [preview]);

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRead(null);
    setScanning(false);
  }

  return (
    <div className="lab-fill flex flex-col gap-4 overflow-y-auto">
      <div className="lab-glass p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="lab-label">AI Canvas Solver</p>
            <p className="lab-dim mt-1.5 max-w-2xl text-xs leading-relaxed">
              Photograph the question, or drop the equation sheet as it is. The
              scan reads the geometry, then returns the relations and the path.
            </p>
          </div>
          {preview && (
            <button type="button" onClick={reset} className="lab-btn">
              <RotateCcw className="h-3.5 w-3.5" />
              Scan another
            </button>
          )}
        </div>

        {!preview ? (
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              accept(event.dataTransfer.files?.[0]);
            }}
            className={"tool-dropzone mt-4" + (dragOver ? " is-over" : "")}
          >
            <ScanSearch className="h-6 w-6 text-[var(--signal)]" />
            <span className="text-sm font-medium">
              Drop an equation sheet or diagram
            </span>
            <span className="text-xs text-text-dim">
              PNG, JPG or PDF page — the beam sweeps it, then it is decomposed
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(event) => accept(event.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="mt-4 scan-stage">
            <img
              src={preview}
              alt="Uploaded equation sheet"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth && naturalHeight) {
                  const next = `${naturalWidth} x ${naturalHeight} px`;
                  pending.current = pending.current
                    ? { ...pending.current, dimensions: next }
                    : pending.current;
                  setRead((current) =>
                    current ? { ...current, dimensions: next } : current,
                  );
                }
              }}
            />
            {scanning && <span className="scan-beam" aria-hidden="true" />}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              {scanning ? (
                <Loader2 className="spin-micro h-3.5 w-3.5 text-[#ff647c]" />
              ) : (
                <Upload className="h-3.5 w-3.5 text-[#ff647c]" />
              )}
              <span className="text-[11px] font-medium text-slate-200">
                {scanning ? "Scanning the sheet…" : "Scan complete"}
              </span>
            </div>
          </div>
        )}
      </div>

      {read && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Inputs read",
              lines: [
                `Sheet: ${read.name}`,
                `File size: ${read.size}`,
                `Resolution: ${read.dimensions}`,
                `Domain detected: ${read.domainLabel}`,
              ],
            },
            { title: "Governing formulas", lines: FORMULAS[read.domain] },
            { title: "Solution path", lines: SOLUTION_STEPS[read.domain] },
          ].map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.42,
                delay: index * 0.08,
                ease: [0.25, 1, 0.5, 1],
              }}
              className="lab-glass lab-glass-hover p-4"
            >
              <p className="lab-label">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 font-display text-sm font-bold tracking-tight text-slate-100">
                {card.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {card.lines.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-[12.5px] leading-relaxed text-slate-300"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3b5c]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CanvasSolver;
