import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { AlertTriangle, Loader2, RotateCcw, ScanSearch, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { enhancePhoto } from "@/lib/enhance-photo";

/**
 * AI Canvas Solver.
 *
 * Drop a photographed equation sheet or a physics diagram. The image is
 * downscaled in the browser, sent to the model chain with the Canvas Solver
 * system prompt, and the read comes back decomposed: what was on the sheet,
 * the relations that govern it, the path through it, and the verified answer.
 *
 * Two honest fallbacks sit behind it. If no configured model can see images,
 * or every key is out, the sheet is still described from what the client can
 * genuinely observe (file, resolution, shape of the page) and paired with the
 * formula sheet for the domain its filename suggests — and the card says so,
 * rather than pretending to have read the maths.
 */

type Domain = "optics" | "mechanics" | "waves" | "algebra" | "general";

const DOMAIN_RULES: { match: RegExp; domain: Domain; label: string }[] = [
  { match: /optic|lens|mirror|refract|ray|snell/i, domain: "optics", label: "Ray optics" },
  { match: /force|motion|mechan|newton|friction|incline|kinemat/i, domain: "mechanics", label: "Mechanics" },
  { match: /wave|oscill|frequency|sound|interfer|shm/i, domain: "waves", label: "Waves" },
  { match: /algebra|quadratic|trigono|polynomial|calculus|integr|derivat/i, domain: "algebra", label: "Algebra" },
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

/** What the model read off the sheet, when it could see it. */
interface Solve {
  title: string;
  domain: string;
  inputs: string[];
  formulas: string[];
  steps: string[];
  answer: string;
  model: string;
}

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Shrink the upload to something a model can actually take.
 *
 * A 12 MP phone photo is 4–6 MB of JPEG, which no free vision endpoint will
 * accept; at 1400px on the long edge the handwriting is still legible and the
 * payload lands well under a megabyte. PNGs are flattened onto white first —
 * transparent background plus JPEG would otherwise turn a page black.
 */
async function prepareImage(
  file: File,
): Promise<{ dataUrl: string; base64: string; mimeType: string; width: number; height: number }> {
  /* Same clean-up as the Math Lab's photo path: a screenshot of a PDF page is
     often soft and small, and the reader must not confuse a 3 with an 8. */
  const prepared = await enhancePhoto(file);
  const dataUrl = `data:${prepared.mimeType};base64,${prepared.base64}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("That image could not be opened."));
    element.src = dataUrl;
  });
  return {
    dataUrl,
    base64: prepared.base64,
    mimeType: prepared.mimeType,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export function CanvasSolver() {
  const solve = useAction(api.ai.solveCanvas);

  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [solution, setSolution] = useState<Solve | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  /**
   * The preview URL is revoked on unmount only.
   *
   * The last version revoked it inside an effect keyed on the preview, whose
   * cleanup also cancelled the pending scan timer — so choosing a file
   * cancelled its own scan and the beam swept forever. Nothing here is tied to
   * a render anymore.
   */
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);

      const objectUrl = URL.createObjectURL(file);
      previewRef.current = objectUrl;
      setPreview(objectUrl);
      setSolution(null);
      setFallbackNote(null);
      setScanning(true);

      const rule = DOMAIN_RULES.find((entry) => entry.match.test(file.name));
      const detected = rule
        ? { domain: rule.domain, domainLabel: rule.label }
        : { domain: "general" as Domain, domainLabel: "General relations" };
      setRead({
        name: file.name,
        size: readableSize(file.size),
        dimensions: "reading…",
        ...detected,
      });

      const isImage = file.type.startsWith("image/");

      if (!isImage) {
        setRead((current) =>
          current
            ? { ...current, dimensions: `${readableSize(file.size)} · not a raster image` }
            : current,
        );
        setFallbackNote(
          "Only a photograph or screenshot can be read (PNG, JPG, WEBP). A PDF page cannot be handed to the model as an image — screenshot the page and drop that instead. The formula sheet below is matched from the filename.",
        );
        setScanning(false);
        return;
      }

      try {
        const prepared = await prepareImage(file);
        setRead((current) =>
          current
            ? { ...current, dimensions: `${prepared.width} x ${prepared.height} px` }
            : current,
        );

        const result = await solve({
          imageBase64: prepared.base64,
          mimeType: prepared.mimeType,
        });
        setSolution(result);
      } catch {
        setFallbackNote(
          "No configured model could read the image this time (vision needs a Gemini key, and every free key may be out for the day). What follows is matched from the file itself, not from the maths on the sheet.",
        );
      } finally {
        setScanning(false);
      }
    },
    [solve],
  );

  function reset() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setRead(null);
    setSolution(null);
    setFallbackNote(null);
    setScanning(false);
  }

  const cards = solution
    ? [
        {
          title: "Inputs read",
          lines: [
            `Sheet: ${read?.name ?? "upload"}`,
            `Resolution: ${read?.dimensions ?? "—"}`,
            `Domain: ${solution.domain}`,
            ...solution.inputs,
          ],
        },
        { title: "Governing formulas", lines: solution.formulas },
        { title: "Step-by-step breakdown", lines: solution.steps },
        { title: "Final verification", lines: [solution.answer] },
      ]
    : read
      ? [
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
        ]
      : [];

  return (
    <div className="lab-fill flex flex-col gap-4 overflow-y-auto">
      <div className="lab-glass p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="lab-label">AI Canvas Solver</p>
            <p className="lab-dim mt-1.5 max-w-2xl text-xs leading-relaxed">
              Photograph the question, or drop a screenshot of it. The beam reads
              the sheet, then returns the inputs, the relations and the full
              worked path.
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
              void accept(event.dataTransfer.files?.[0]);
            }}
            className={"tool-dropzone mt-4" + (dragOver ? " is-over" : "")}
          >
            <ScanSearch className="h-6 w-6 text-[var(--lab-ink)]" />
            <span className="text-sm font-medium">
              Drop an equation sheet or diagram
            </span>
            <span className="text-xs text-text-dim">
              PNG, JPG or a screenshot of a PDF page — the beam sweeps it, then
              it is solved
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event) => void accept(event.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="mt-4 scan-stage">
            <img src={preview} alt="Uploaded equation sheet" />
            {scanning && <span className="scan-beam" aria-hidden="true" />}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              {scanning ? (
                <Loader2 className="spin-micro h-3.5 w-3.5 text-[#aab3ff]" />
              ) : (
                <Upload className="h-3.5 w-3.5 text-[#aab3ff]" />
              )}
              <span className="text-[11px] font-medium text-slate-200">
                {scanning
                  ? "Reading the sheet…"
                  : solution
                    ? "Read complete"
                    : "Sheet loaded"}
              </span>
            </div>
          </div>
        )}

        {solution && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="lab-chip border-[#8b93ff]/30 bg-[#8b93ff]/10 text-[#aab3ff]">
              {solution.domain}
            </span>
            <span className="lab-dim text-[11px]">{solution.title}</span>
          </div>
        )}

        {fallbackNote && (
          <p className="mt-3 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-[11.5px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{fallbackNote}</span>
          </p>
        )}
      </div>

      {cards.length > 0 && !scanning && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
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
                {card.lines.map((line, lineIndex) => (
                  <li
                    key={`${card.title}-${lineIndex}`}
                    className="flex gap-2 text-[12.5px] leading-relaxed text-slate-300"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b93ff]" />
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
