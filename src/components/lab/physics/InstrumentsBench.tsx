import { useMemo, useState } from "react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { Picker, Questions, Readout } from "@/components/lab/bench-atoms";
import { useRecorder } from "@/components/lab/practical/useRecorder";
import { ShareSetup, useBenchPreset } from "@/components/lab/practical/preset";

/**
 * Measuring instruments, read the way the practical exam asks for them.
 *
 * The calipers and the screw gauge are drawn to their real scales — a vernier
 * of ten divisions over 9 mm, a thimble of fifty over 0.5 mm — and the student
 * types the reading before the bench will tell them whether it is right. The
 * scale does not label the answer; the coincidence is visible only after the
 * check, which is when a student actually learns to find it.
 */

type Tool = "vernier" | "screw";

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: "vernier", label: "Vernier calipers" },
  { id: "screw", label: "Screw gauge" },
];

type Specimen = { name: string; size: number };

/** Sizes are chosen so every reading lands exactly on a scale division. */
const SPECIMENS: Record<Tool, Specimen[]> = {
  vernier: [
    { name: "Steel rod", size: 2.46 },
    { name: "Glass tube", size: 1.24 },
    { name: "Aluminium block", size: 3.78 },
    { name: "Copper wire bundle", size: 0.86 },
  ],
  screw: [
    { name: "Wire", size: 2.36 },
    { name: "Sheet metal", size: 1.24 },
    { name: "Small ball", size: 3.48 },
    { name: "Thin rod", size: 0.78 },
  ],
};

const VERNIER_LC_CM = 0.01;
const SCREW_PITCH_MM = 0.5;
const SCREW_LC_MM = 0.01;

function vernierParts(cm: number) {
  const mm = cm * 10;
  const msrMm = Math.floor(mm + 1e-9);
  const vsd = Math.round((mm - msrMm) / 0.1);
  return { msrCm: msrMm / 10, vsd, reading: msrMm / 10 + vsd * VERNIER_LC_CM };
}

function screwParts(mm: number) {
  const msr = Math.floor(mm / SCREW_PITCH_MM + 1e-9) * SCREW_PITCH_MM;
  const csd = Math.round((mm - msr) / SCREW_LC_MM);
  return { msr, csd, reading: msr + csd * SCREW_LC_MM };
}

function VernierFigure({ cm, reveal }: { cm: number; reveal: boolean }) {
  const { msrCm, vsd } = vernierParts(cm);
  const x0 = 82;
  const span = 520;
  const perCm = span / 12;
  const perMm = perCm / 10;
  const zeroX = x0 + msrCm * perCm;
  const vernierWidth = perMm * 9;

  return (
    <svg viewBox="0 0 640 220" className="block w-full" role="img" aria-label="Vernier calipers scale">
      <rect x={x0 - 10} y={62} width={span + 40} height={54} rx={6} fill="none" stroke="rgba(var(--lab-diagram-ink), 0.35)" />
      {/* main scale */}
      {Array.from({ length: 121 }, (_, index) => {
        const x = x0 + index * perMm;
        const major = index % 10 === 0;
        return (
          <line
            key={index}
            x1={x}
            y1={72}
            x2={x}
            y2={major ? 94 : 86}
            stroke={`rgba(var(--lab-diagram-ink), ${major ? 0.7 : 0.4})`}
            strokeWidth={major ? 1.2 : 0.8}
          />
        );
      })}
      {Array.from({ length: 13 }, (_, index) => (
        <text
          key={index}
          x={x0 + index * perCm}
          y={112}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(var(--lab-diagram-ink), 0.65)"
        >
          {index}
        </text>
      ))}
      <text x={x0} y={140} fontSize="10" fill="rgba(var(--lab-diagram-ink), 0.5)">
        MAIN SCALE · cm
      </text>

      {/* sliding vernier plate */}
      <g>
        <rect
          x={zeroX}
          y={128}
          width={vernierWidth}
          height={34}
          rx={3}
          fill="rgba(var(--lab-diagram-plate), 0.9)"
          stroke="rgba(var(--lab-diagram-ink), 0.5)"
        />
        {Array.from({ length: 11 }, (_, index) => {
          const x = zeroX + index * perMm * 0.9;
          const coincident = reveal && index === vsd;
          return (
            <line
              key={index}
              x1={x}
              y1={128}
              x2={x}
              y2={coincident ? 158 : index % 5 === 0 ? 150 : 146}
              stroke={coincident ? "var(--lab-diagram-amber)" : "rgba(var(--lab-diagram-ink), 0.6)"}
              strokeWidth={coincident ? 2 : 0.9}
            />
          );
        })}
        <text x={zeroX} y={178} fontSize="9" fill="rgba(var(--lab-diagram-ink), 0.55)">
          0
        </text>
        <text x={zeroX + vernierWidth} y={178} fontSize="9" textAnchor="end" fill="rgba(var(--lab-diagram-ink), 0.55)">
          10
        </text>
      </g>

      {/* workpiece */}
      <rect
        x={x0}
        y={26}
        width={Math.max(8, msrCm * perCm + vsd * VERNIER_LC_CM * perCm)}
        height={16}
        rx={3}
        fill="rgba(var(--lab-diagram-cyan), 0.22)"
        stroke="rgba(var(--lab-diagram-cyan), 0.7)"
      />
    </svg>
  );
}

function ScrewFigure({ mm, reveal }: { mm: number; reveal: boolean }) {
  const { msr, csd } = screwParts(mm);
  const x0 = 92;
  const perMm = 50;
  const angle = csd * (360 / 50);

  return (
    <svg viewBox="0 0 640 220" className="block w-full" role="img" aria-label="Screw gauge scales">
      {/* sleeve */}
      <rect x={x0} y={78} width={300} height={44} rx={4} fill="none" stroke="rgba(var(--lab-diagram-ink), 0.35)" />
      {Array.from({ length: 30 }, (_, index) => {
        const major = index % 5 === 0;
        return (
          <line
            key={index}
            x1={x0 + index * 10}
            y1={78}
            x2={x0 + index * 10}
            y2={major ? 106 : 96}
            stroke={`rgba(var(--lab-diagram-ink), ${major ? 0.68 : 0.36})`}
            strokeWidth={major ? 1.2 : 0.8}
          />
        );
      })}
      {Array.from({ length: 7 }, (_, index) => (
        <text
          key={index}
          x={x0 + index * perMm}
          y={122}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(var(--lab-diagram-ink), 0.6)"
        >
          {index}
        </text>
      ))}
      <text x={x0} y={148} fontSize="10" fill="rgba(var(--lab-diagram-ink), 0.5)">
        SLEEVE · mm
      </text>

      {/* thimble */}
      <g transform={`translate(500 100)`}>
        <circle r={74} fill="rgba(var(--lab-diagram-plate), 0.9)" stroke="rgba(var(--lab-diagram-ink), 0.4)" />
        {Array.from({ length: 50 }, (_, index) => {
          const a = (index * 360) / 50 - 90;
          const major = index % 5 === 0;
          const highlighted = reveal && index === csd;
          const r1 = highlighted ? 58 : 62;
          return (
            <line
              key={index}
              x1={Math.cos((a * Math.PI) / 180) * 48}
              y1={Math.sin((a * Math.PI) / 180) * 48}
              x2={Math.cos((a * Math.PI) / 180) * r1}
              y2={Math.sin((a * Math.PI) / 180) * r1}
              stroke={highlighted ? "var(--lab-diagram-amber)" : `rgba(var(--lab-diagram-ink), ${major ? 0.68 : 0.38})`}
              strokeWidth={highlighted ? 2 : major ? 1.1 : 0.8}
            />
          );
        })}
        {Array.from({ length: 10 }, (_, index) => {
          const a = ((index * 5 * 360) / 50 - 90) * (Math.PI / 180);
          return (
            <text
              key={index}
              x={Math.cos(a) * 40}
              y={Math.sin(a) * 39 + 3}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(var(--lab-diagram-ink), 0.6)"
            >
              {index * 5}
            </text>
          );
        })}
        <line
          x1={0}
          y1={-76}
          x2={0}
          y2={-58}
          stroke="rgba(var(--lab-diagram-ink), 0.75)"
          strokeWidth={1.4}
          transform={`rotate(${angle})`}
        />
      </g>
      <text x={500} y={206} textAnchor="middle" fontSize="10" fill="rgba(var(--lab-diagram-ink), 0.5)">
        THIMBLE · {reveal ? `${csd} × 0.01 mm` : "circular scale"}
      </text>

      {/* spindle / anvil */}
      <rect x={40} y={92} width={44} height={16} rx={2} fill="rgba(var(--lab-diagram-cyan), 0.22)" stroke="rgba(var(--lab-diagram-cyan), 0.7)" />
      <rect x={x0 - 26} y={92} width={26} height={16} rx={2} fill="rgba(var(--lab-diagram-ink), 0.25)" />
      <text x={x0} y={62} fontSize="9" fill="rgba(var(--lab-diagram-ink), 0.45)">
        main scale zero
      </text>
    </svg>
  );
}

export function InstrumentsBench() {
  const { preset, task } = useBenchPreset<{ tool?: Tool; specimen?: number }>();
  const initialTool: Tool =
    preset?.tool === "screw" || preset?.tool === "vernier" ? preset.tool : "vernier";

  const [tool, setTool] = useState<Tool>(initialTool);
  const [index, setIndex] = useState(() => {
    const pool = SPECIMENS[initialTool].length;
    const value = preset?.specimen;
    return typeof value === "number" && Number.isInteger(value)
      ? Math.min(pool - 1, Math.max(0, value))
      : 0;
  });
  const [entry, setEntry] = useState("");
  const [verdict, setVerdict] = useState<"idle" | "right" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);
  const recorder = useRecorder();

  const specimen = SPECIMENS[tool][index] ?? SPECIMENS[tool][0];
  const vernier = useMemo(() => vernierParts(specimen.size), [specimen.size]);
  const screw = useMemo(() => screwParts(specimen.size), [specimen.size]);

  const expected = tool === "vernier" ? vernier.reading : screw.reading;
  const unit = tool === "vernier" ? "cm" : "mm";

  const switchTool = (next: Tool) => {
    setTool(next);
    setIndex(0);
    setEntry("");
    setVerdict("idle");
    setRevealed(false);
    recorder.reset();
  };

  const nextSpecimen = () => {
    setIndex((value) => (value + 1) % SPECIMENS[tool].length);
    setEntry("");
    setVerdict("idle");
    setRevealed(false);
    recorder.reset();
  };

  const check = () => {
    const value = Number(entry);
    if (!Number.isFinite(value) || entry.trim() === "") {
      setVerdict("wrong");
      return;
    }
    const tolerance = tool === "vernier" ? 0.011 : 0.011;
    if (Math.abs(value - expected) <= tolerance) {
      setVerdict("right");
      setRevealed(true);
    } else {
      setVerdict("wrong");
    }
  };

  const record = () => {
    if (tool === "vernier") {
      void recorder.record("physics", "Vernier calipers", [
        { label: "Main scale", value: vernier.msrCm, unit: "cm" },
        { label: "Vernier divisions", value: vernier.vsd, unit: "div" },
        { label: "Reading", value: vernier.reading, unit: "cm" },
      ]);
    } else {
      void recorder.record("physics", "Screw gauge", [
        { label: "Main scale", value: screw.msr, unit: "mm" },
        { label: "Circular divisions", value: screw.csd, unit: "div" },
        { label: "Diameter", value: screw.reading, unit: "mm" },
      ]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {task ? (
        <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
          <span className="apple-lab-micro">Task</span>
          <p className="mt-0.5 text-[var(--lab-ink)]">{task}</p>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="apple-lab-card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="apple-lab-micro">Measuring instruments</p>
              <p className="apple-lab-value mt-1 text-[15px] font-semibold">{specimen.name}</p>
            </div>
            <Picker
              label="Instrument"
              value={tool}
              options={TOOLS.map((entry) => ({ id: entry.id, label: entry.label }))}
              onChange={switchTool}
            />
          </div>

          <div className="rounded-xl border border-[var(--lab-line)] p-2">
            {tool === "vernier" ? (
              <VernierFigure cm={specimen.size} reveal={revealed} />
            ) : (
              <ScrewFigure mm={specimen.size} reveal={revealed} />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1">
              <span className="apple-lab-micro">Your reading ({unit})</span>
              <input
                inputMode="decimal"
                value={entry}
                onChange={(event) => {
                  setEntry(event.target.value);
                  setVerdict("idle");
                  setRevealed(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") check();
                }}
                placeholder={tool === "vernier" ? "e.g. 2.46" : "e.g. 2.36"}
                className="rounded-lg border border-[var(--lab-line)] bg-transparent px-2.5 py-1.5 text-[12.5px] text-[var(--lab-ink)] outline-none focus:border-[var(--lab-accent)]"
              />
            </label>
            <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={check}>
              <Check className="h-3.5 w-3.5" />
              Check reading
            </button>
            <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={nextSpecimen}>
              <RotateCcw className="h-3.5 w-3.5" />
              New specimen
            </button>
          </div>

          {verdict === "right" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--lab-line)] px-3 py-2 text-[11.5px] text-[var(--lab-ink-dim)]">
              <Check className="h-3.5 w-3.5 text-[var(--lab-diagram-mint)]" />
              {tool === "vernier"
                ? `Correct — ${vernier.msrCm.toFixed(2)} cm on the main scale, division ${vernier.vsd} on the vernier, so ${expected.toFixed(2)} cm.`
                : `Correct — ${screw.msr.toFixed(1)} mm on the sleeve, division ${screw.csd} on the thimble, so ${expected.toFixed(2)} mm.`}
            </div>
          ) : verdict === "wrong" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--lab-line)] px-3 py-2 text-[11.5px] text-[var(--lab-ink-dim)]">
              <CircleAlert className="h-3.5 w-3.5 text-[var(--lab-diagram-rose)]" />
              Not yet. Read the last whole division before the zero, then find the division on the moving scale that lines up exactly.
            </div>
          ) : null}

          {verdict === "right" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={record} disabled={recorder.state === "saving"}>
                {recorder.state === "done" ? <Check className="h-3.5 w-3.5" /> : null}
                {recorder.state === "saving" ? "Recording…" : recorder.state === "done" ? "Recorded" : "Record reading"}
              </button>
              {recorder.message ? (
                <span className="text-[11px] text-[var(--lab-ink-dim)]">{recorder.message}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-2">
          <Readout label="Least count" value={tool === "vernier" ? "0.01 cm" : "0.01 mm"} />
          <Readout
            label={tool === "vernier" ? "Main scale" : "Sleeve reading"}
            value={tool === "vernier" ? `${vernier.msrCm.toFixed(2)} cm` : `${screw.msr.toFixed(2)} mm`}
          />
          <Readout
            label={tool === "vernier" ? "Vernier division" : "Thimble division"}
            value={revealed ? String(tool === "vernier" ? vernier.vsd : screw.csd) : "—"}
          />
          <Readout label="Scale" value={tool === "vernier" ? "10 div = 9 mm" : "50 div = 0.5 mm"} />
          <div className="apple-lab-card px-3 py-2.5">
            <p className="apple-lab-micro">Why the zero matters</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
              A reading is only as good as its zero. If the jaws close with the
              vernier zero to the right of the main-scale zero, every reading
              carries a positive zero error — subtract it.
            </p>
          </div>
          <ShareSetup subject="physics" bench="instruments" preset={{ tool, specimen: index }} />
        </aside>
      </div>

      <Questions
        items={[
          {
            q: "Why is the least count of a vernier 0.01 cm?",
            a: "Ten vernier divisions span nine main-scale divisions, so one vernier division is 0.9 mm against 1 mm — a difference of 0.1 mm, or 0.01 cm.",
          },
          {
            q: "Why does the screw gauge need a ratchet?",
            a: "The ratchet slips at a fixed torque so the spindle cannot crush the specimen. Tightening by the thimble alone quietly changes the diameter you are measuring.",
          },
        ]}
      />
    </div>
  );
}

export default InstrumentsBench;
