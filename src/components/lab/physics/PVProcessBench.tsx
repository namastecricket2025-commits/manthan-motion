import {
  Picker,
  Questions,
  Range,
  ink,
  plate,
  AMBER,
  CYAN,
  MINT,
} from "@/components/lab/bench-atoms";
import { useMemo, useRef, useState } from "react";

/**
 * p–V process explorer — Class 11 thermodynamics.
 *
 * Four ways to move a gas from state A to state B, drawn twice: once as the
 * cylinder it happens in, once as the p–V diagram the chapter uses. The piston
 * is the control — drag it and the marker walks the curve, the shaded area
 * grows, and the gas in the cylinder is the same gas at the same instant.
 *
 *   isothermal  a hyperbola, ΔU = 0 and Q = W
 *   adiabatic   a steeper curve, Q = 0 and W = −ΔU
 *   isobaric    a horizontal line, W = p ΔV and Q = n Cp ΔT
 *   isochoric   a vertical line, W = 0 and Q = ΔU
 *
 * Work is the area under the curve. One mole of a diatomic gas; p in kPa and V
 * in litres make pV read directly in joules, which is why the energies are
 * numbers a student can follow. There is no run button: a quasi-static process
 * has no natural clock, and dragging the piston *is* the process.
 */

type Process = "isothermal" | "adiabatic" | "isobaric" | "isochoric";

const GAMMA = 1.4;
const CV = 2.5 * 8.314; /* J/mol·K */
const R = 8.314;
const N = 1;

const W_PLATE = 880;
const H_PLATE = 430;
const V_MAX = 45; /* litres */

const PROCESSES: Array<{ id: Process; label: string }> = [
  { id: "isothermal", label: "Isothermal" },
  { id: "adiabatic", label: "Adiabatic" },
  { id: "isobaric", label: "Isobaric" },
  { id: "isochoric", label: "Isochoric" },
];

/** Pressure on the path at fraction f between A and B. */
function pressureAt(process: Process, p1: number, v1: number, v: number, f: number, p2: number) {
  if (process === "isothermal") return (p1 * v1) / Math.max(0.2, v);
  if (process === "adiabatic") return p1 * Math.pow(v1 / Math.max(0.2, v), GAMMA);
  if (process === "isobaric") return p1;
  return p1 + (p2 - p1) * f; /* isochoric: straight up (or down) */
}

export function PVProcessBench() {
  const [process, setProcess] = useState<Process>("isothermal");
  const [p1, setP1] = useState(160); /* kPa */
  const [v1, setV1] = useState(12); /* L */
  const [v2, setV2] = useState(24);
  const [p2Manual, setP2Manual] = useState(240);
  const [showIsotherm, setShowIsotherm] = useState(true);
  const [run, setRun] = useState(0.62);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const state = useMemo(() => {
    const t1 = (p1 * v1) / (N * R);
    let p2 = p1;
    let vv2 = v2;
    if (process === "isothermal") p2 = (p1 * v1) / v2;
    if (process === "adiabatic") p2 = p1 * Math.pow(v1 / v2, GAMMA);
    if (process === "isobaric") p2 = p1;
    if (process === "isochoric") {
      p2 = p2Manual;
      vv2 = v1;
    }
    const t2 = (p2 * vv2) / (N * R);

    let work = 0;
    if (process === "isothermal") work = N * R * t1 * Math.log(vv2 / v1);
    if (process === "adiabatic") work = (p1 * v1 - p2 * vv2) / (GAMMA - 1);
    if (process === "isobaric") work = p1 * (vv2 - v1);
    if (process === "isochoric") work = 0;

    const deltaU = N * CV * (t2 - t1);
    const heat = deltaU + work;
    return { t1, t2, p2, v2: vv2, work, deltaU, heat };
  }, [process, p1, v1, v2, p2Manual]);

  /* The pressure axis follows the process, so a small process is not a flat
     line at the bottom of a fixed 0–360 kPa frame. */
  const pMax = Math.max(120, Math.ceil((Math.max(state.p2, p1) * 1.18) / 50) * 50);

  /* ---- graph geometry ---- */
  const GL = 402; /* graph left */
  const GR = W_PLATE - 26;
  const GT = 54;
  const GB = 352;
  const gX = (v: number) => GL + (v / V_MAX) * (GR - GL);
  const gY = (p: number) => GB - (p / pMax) * (GB - GT);

  /* ---- cylinder geometry ---- */
  const CYL_L = 104;
  const CYL_R = 252;
  const CYL_TOP = 96;
  const CYL_BOTTOM = 344;
  const gasTop = (volume: number) =>
    CYL_BOTTOM - (Math.min(volume, V_MAX) / V_MAX) * (CYL_BOTTOM - CYL_TOP);

  const buildCurve = (steps: number, upto: number) => {
    const pts: string[] = [];
    const n = Math.max(2, Math.round(steps * upto));
    for (let i = 0; i <= n; i += 1) {
      const f = (i / steps) * upto;
      const v = v1 + (state.v2 - v1) * f;
      const p = pressureAt(process, p1, v1, v, f, state.p2);
      pts.push(`${gX(v).toFixed(1)} ${gY(p).toFixed(1)}`);
    }
    return pts;
  };

  const curve = useMemo(
    () => `M${buildCurve(80, 1).join(" L")}`,
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [process, p1, v1, state.p2, state.v2, pMax],
  );

  const area = useMemo(() => {
    const pts = [`M ${gX(v1)} ${gY(0)}`, `L ${gX(v1)} ${gY(p1)}`];
    pts.push(...buildCurve(60, Math.max(0.001, run)).map((p) => `L ${p}`));
    pts.push(`L ${gX(v1 + (state.v2 - v1) * run)} ${gY(0)} Z`);
    return pts.join(" ");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2, run, pMax]);

  const runV = v1 + (state.v2 - v1) * run;
  const runP = pressureAt(process, p1, v1, runV, run, state.p2);
  const runT = (runP * runV) / (N * R);

  const workSoFar = useMemo(() => {
    const steps = 120;
    if (run <= 0) return 0;
    let sum = 0;
    for (let i = 0; i < steps; i += 1) {
      const f0 = (i / steps) * run;
      const f1 = ((i + 1) / steps) * run;
      const va = v1 + (state.v2 - v1) * f0;
      const vb = v1 + (state.v2 - v1) * f1;
      const pa = pressureAt(process, p1, v1, va, f0, state.p2);
      const pb = pressureAt(process, p1, v1, vb, f1, state.p2);
      sum += ((pa + pb) / 2) * (vb - va);
    }
    return sum;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2, run]);

  const energyWord = (value: number, positive: string, negative: string) =>
    Math.abs(value) < 0.5 ? "zero" : value > 0 ? positive : negative;

  const pistonY = gasTop(runV);
  const expanding = runV > v1 + 0.05;
  const compressing = runV < v1 - 0.05;
  const hot = runT / Math.max(state.t1, 1);

  /* Dragging the piston is the same act as moving the slider: the pointer's
     height is turned back into a volume, then into a fraction of the path. */
  const canDrag = Math.abs(state.v2 - v1) > 1e-6;
  const dragTo = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg || !canDrag) return;
    const box = svg.getBoundingClientRect();
    const yPx = ((clientY - box.top) / box.height) * H_PLATE;
    const volume = ((CYL_BOTTOM - yPx) / (CYL_BOTTOM - CYL_TOP)) * V_MAX;
    const f = (volume - v1) / (state.v2 - v1);
    setRun(Math.min(1, Math.max(0, f)));
  };

  /* Fixed particle field: the same gas, rearranged by the piston. */
  const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
    fx: ((i * 37 + 11) % 97) / 97,
    fy: ((i * 61 + 7) % 93) / 93,
  }));

  return (
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 11 · Thermodynamics · p–V processes</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              Move the piston; the area becomes the work
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              The cylinder and the graph show the same gas. Drag the piston
              through the process and watch p, V and T change together — the
              shaded strip is ∫p dV, which is the work by the gas.
            </p>
          </div>
          <Picker label="Process" value={process} options={PROCESSES} onChange={(next) => {
            setProcess(next);
            setRun(0.62);
          }} />
        </div>

        <div className="px-2 py-2 sm:px-3 sm:py-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W_PLATE} ${H_PLATE}`}
            className="block w-full"
            role="img"
            aria-label={`A gas in a cylinder beside the p–V diagram of an ${process} process`}
          >
            {/* ---------------- the cylinder ---------------- */}
            <text x={24} y={30} fontSize={11.5} fill={ink(0.45)}>
              the gas · n = 1 mol, diatomic
            </text>

            {/* Gas fill between piston and base */}
            <rect
              x={CYL_L}
              y={pistonY}
              width={CYL_R - CYL_L}
              height={CYL_BOTTOM - pistonY}
              fill={runT > state.t1 ? AMBER : CYAN}
              opacity={0.1 + Math.min(0.16, Math.abs(hot - 1) * 0.1)}
            />
            {PARTICLES.map((particle, i) => {
              const height = CYL_BOTTOM - pistonY - 16;
              if (height < 12) return null;
              return (
                <circle
                  key={i}
                  cx={CYL_L + 12 + particle.fx * (CYL_R - CYL_L - 24)}
                  cy={pistonY + 10 + particle.fy * height}
                  r={1.9}
                  fill={AMBER}
                  opacity={0.5}
                />
              );
            })}

            {/* Cylinder walls and base */}
            <line x1={CYL_L} y1={CYL_TOP} x2={CYL_L} y2={CYL_BOTTOM} stroke={ink(0.55)} strokeWidth={3} strokeLinecap="round" />
            <line x1={CYL_R} y1={CYL_TOP} x2={CYL_R} y2={CYL_BOTTOM} stroke={ink(0.55)} strokeWidth={3} strokeLinecap="round" />
            <line x1={CYL_L - 8} y1={CYL_BOTTOM} x2={CYL_R + 8} y2={CYL_BOTTOM} stroke={ink(0.55)} strokeWidth={3} strokeLinecap="round" />
            {Array.from({ length: 6 }, (_, i) => (
              <line key={i} x1={CYL_L - 8} y1={CYL_BOTTOM + 4 + i * 6} x2={CYL_L - 22} y2={CYL_BOTTOM + 10 + i * 6} stroke={ink(0.16)} strokeWidth={1.2} />
            ))}

            {/* Piston and rod. The transparent column above the piston is the
                drag target; the slider below stays as the keyboard control. */}
            <rect
              x={CYL_L - 8}
              y={CYL_TOP - 6}
              width={CYL_R - CYL_L + 16}
              height={CYL_BOTTOM - CYL_TOP + 8}
              fill="transparent"
              style={{ cursor: canDrag ? "ns-resize" : undefined, touchAction: canDrag ? "none" : undefined }}
              onPointerDown={(event) => {
                if (!canDrag) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragging.current = true;
                dragTo(event.clientY);
              }}
              onPointerMove={(event) => {
                if (dragging.current) dragTo(event.clientY);
              }}
              onPointerUp={() => {
                dragging.current = false;
              }}
              onPointerCancel={() => {
                dragging.current = false;
              }}
            />
            <rect x={CYL_L - 6} y={pistonY - 12} width={CYL_R - CYL_L + 12} height={13} rx={2} fill={plate(0.96)} stroke={ink(0.62)} strokeWidth={2} />
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={(CYL_L + CYL_R) / 2 - 14 + i * 14}
                y1={pistonY - 8}
                x2={(CYL_L + CYL_R) / 2 - 14 + i * 14}
                y2={pistonY - 3}
                stroke={ink(0.3)}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            ))}
            <line x1={(CYL_L + CYL_R) / 2} y1={pistonY - 12} x2={(CYL_L + CYL_R) / 2} y2={64} stroke={ink(0.5)} strokeWidth={5} strokeLinecap="round" />
            <line x1={(CYL_L + CYL_R) / 2 - 30} y1={70} x2={(CYL_L + CYL_R) / 2 + 30} y2={70} stroke={ink(0.5)} strokeWidth={5} strokeLinecap="round" />

            {/* Volume bracket */}
            <line x1={CYL_L + 34} y1={CYL_BOTTOM - 4} x2={CYL_L + 34} y2={pistonY} stroke={MINT} strokeWidth={1.2} strokeDasharray="4 4" />
            <line x1={CYL_L + 28} y1={CYL_BOTTOM - 4} x2={CYL_L + 40} y2={CYL_BOTTOM - 4} stroke={MINT} strokeWidth={1.2} />
            <line x1={CYL_L + 28} y1={pistonY} x2={CYL_L + 40} y2={pistonY} stroke={MINT} strokeWidth={1.2} />
            <text
              x={CYL_L + 46}
              y={(CYL_BOTTOM + pistonY) / 2 + 4}
              fontSize={11.5}
              fill={MINT}
              paintOrder="stroke"
              stroke={plate(0.9)}
              strokeWidth={3}
            >
              V = {runV.toFixed(1)} L
            </text>

            {/* Work arrow, outside the cylinder: up when the gas expands, down
                when it is compressed. */}
            <g opacity={Math.abs(runV - v1) < 0.05 ? 0.25 : 1}>
              <line
                x1={CYL_R + 40}
                y1={pistonY + (expanding ? 0 : 40)}
                x2={CYL_R + 40}
                y2={pistonY + (expanding ? -40 : 0)}
                stroke={AMBER}
                strokeWidth={2.4}
              />
              <path
                d={
                  expanding
                    ? `M${CYL_R + 40} ${pistonY - 46} l-6 10 l12 0 z`
                    : compressing
                      ? `M${CYL_R + 40} ${pistonY + 46} l-6 -10 l12 0 z`
                      : ""
                }
                fill={AMBER}
              />
              <text x={CYL_R + 52} y={pistonY - 22} fontSize={10.5} fill={AMBER}>
                W = {workSoFar.toFixed(0)} J
              </text>
            </g>

            {/* Heat arrow at the base. */}
            <g opacity={Math.abs(state.heat) < 0.5 ? 0.25 : 1}>
              <path
                d={`M ${(CYL_L + CYL_R) / 2} ${CYL_BOTTOM + 34} q -10 -8 0 -16 q 10 -8 0 -16`}
                fill="none"
                stroke={CYAN}
                strokeWidth={2}
              />
              <path
                d={
                  state.heat > 0
                    ? `M${(CYL_L + CYL_R) / 2} ${CYL_BOTTOM + 2} l-5 9 l10 0 z`
                    : `M${(CYL_L + CYL_R) / 2} ${CYL_BOTTOM + 34} l-5 -9 l10 0 z`
                }
                fill={CYAN}
              />
            </g>
            <text x={CYL_R + 16} y={CYL_BOTTOM + 8} fontSize={10.5} fill={CYAN}>
              Q = {state.heat.toFixed(0)} J
            </text>
            <text x={CYL_L} y={CYL_BOTTOM + 54} fontSize={10.5} fill={ink(0.45)}>
              {state.heat > 0 ? "heat in" : state.heat < 0 ? "heat out" : "no heat"}
              {" · "}T = {runT.toFixed(0)} K
            </text>

            {/* ---------------- the p–V diagram ---------------- */}
            <line x1={GL - 14} y1={GT - 14} x2={GL - 14} y2={GB + 6} stroke={ink(0.18)} strokeWidth={1} />
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`v${i}`} x1={gX((i * V_MAX) / 6)} y1={gY(0)} x2={gX((i * V_MAX) / 6)} y2={gY(pMax)} stroke={ink(0.055)} strokeWidth={1} />
            ))}
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`p${i}`} x1={gX(0)} y1={gY((i * pMax) / 6)} x2={gX(V_MAX)} y2={gY((i * pMax) / 6)} stroke={ink(0.055)} strokeWidth={1} />
            ))}
            <line x1={gX(0)} y1={gY(0)} x2={gX(V_MAX)} y2={gY(0)} stroke={ink(0.45)} strokeWidth={1.5} />
            <line x1={gX(0)} y1={gY(0)} x2={gX(0)} y2={gY(pMax)} stroke={ink(0.45)} strokeWidth={1.5} />
            <text x={GR} y={GB + 26} textAnchor="end" fontSize={11.5} fill={ink(0.5)}>V (litres) →</text>
            <text x={GL + 6} y={GT - 6} fontSize={11.5} fill={ink(0.5)}>p (kPa)</text>

            {showIsotherm && process !== "isothermal" && (() => {
              const pts: string[] = [];
              for (let i = 1; i <= 60; i += 1) {
                const v = 2 + (i / 60) * (V_MAX - 4);
                const p = (p1 * v1) / v;
                if (p <= pMax) pts.push(`${gX(v).toFixed(1)} ${gY(p).toFixed(1)}`);
              }
              return <path d={`M${pts.join(" L")}`} fill="none" stroke={ink(0.15)} strokeWidth={1.2} strokeDasharray="5 6" />;
            })()}

            <path d={area} fill={MINT} opacity={0.17} />
            <path d={curve} fill="none" stroke={AMBER} strokeWidth={2.6} strokeLinejoin="round" />

            <circle cx={gX(v1)} cy={gY(p1)} r={5.5} fill={plate(1)} stroke={ink(0.75)} strokeWidth={2} />
            <text x={gX(v1) - 10} y={gY(p1) - 10} fontSize={12.5} fontWeight={700} fill={ink(0.75)} textAnchor="end">A</text>
            <circle cx={gX(state.v2)} cy={gY(state.p2)} r={5.5} fill={plate(1)} stroke={AMBER} strokeWidth={2} />
            <text x={gX(state.v2) + 10} y={gY(state.p2) - 10} fontSize={12.5} fontWeight={700} fill={AMBER}>B</text>

            {/* The live point, tied to the cylinder above by the same run. */}
            <circle cx={gX(runV)} cy={gY(runP)} r={8} fill={plate(0.9)} stroke={MINT} strokeWidth={2} />
            <circle cx={gX(runV)} cy={gY(runP)} r={2.8} fill={MINT} />
            <line x1={gX(runV)} y1={gY(runP)} x2={gX(runV)} y2={gY(0)} stroke={MINT} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
            <line x1={gX(0)} y1={gY(runP)} x2={gX(runV)} y2={gY(runP)} stroke={MINT} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />

            <text x={GL + 10} y={GB - 10} fontSize={11} fill={MINT}>
              {process === "isochoric" ? "W = 0 — the path has no width" : `W = ${state.work.toFixed(0)} J by the gas`}
            </text>
          </svg>
        </div>

        {/* The piston control: one scrubber, no clock. */}
        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-[230px] flex-1">
              <Range
                label="Piston · A → B"
                value={run}
                min={0}
                max={1}
                step={0.01}
                unit="of the path"
                format={(value) => `${(value * 100).toFixed(0)}%`}
                onChange={setRun}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" className="apple-lab-btn" onClick={() => setRun(0)} disabled={run === 0}>
                Back to A
              </button>
              <button type="button" className="apple-lab-btn" onClick={() => setRun(1)} disabled={run === 1}>
                Push to B
              </button>
            </div>
            <p className="text-[11px] leading-snug text-[var(--lab-ink-micro)]">
              V = {runV.toFixed(1)} L · p = {runP.toFixed(0)} kPa · T = {runT.toFixed(0)} K
              <br />
              W so far = {workSoFar.toFixed(0)} J
            </p>
          </div>

          <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
            <Range label="State A pressure p₁" value={p1} min={40} max={340} step={5} unit="kPa" format={(value) => value.toFixed(0)} onChange={(value) => {
              setP1(value);
              setRun(0.62);
            }} />
            <Range label="State A volume V₁" value={v1} min={4} max={20} step={0.5} unit="L" format={(value) => value.toFixed(1)} onChange={(value) => {
              setV1(value);
              setRun(0.62);
            }} />
            {process === "isochoric" ? (
              <Range label="State B pressure p₂" value={p2Manual} min={40} max={340} step={5} unit="kPa" format={(value) => value.toFixed(0)} onChange={(value) => {
                setP2Manual(value);
                setRun(0.62);
              }} />
            ) : (
              <Range label="State B volume V₂" value={v2} min={4} max={40} step={0.5} unit="L" format={(value) => value.toFixed(1)} onChange={(value) => {
                setV2(value);
                setRun(0.62);
              }} />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--lab-line-soft)] pt-2">
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              data-active={showIsotherm}
              role="switch"
              aria-checked={showIsotherm}
              onClick={() => setShowIsotherm((value) => !value)}
            >
              Isotherm through A
            </button>
            <span className="font-mono text-[11px] text-[var(--lab-ink-dim)]">
              ΔU {state.deltaU.toFixed(0)} J + W {state.work.toFixed(0)} J = Q{" "}
              {state.heat.toFixed(0)} J
            </span>
            <span className="text-[11px] text-[var(--lab-ink-micro)]">
              heat {energyWord(state.heat, "in", "out")} · work{" "}
              {energyWord(state.work, "by the gas", "on the gas")} · ΔU{" "}
              {energyWord(state.deltaU, "rises", "falls")}
            </span>
          </div>
        </div>
      </section>

      <Questions
        items={[
          {
            q: "Why is ΔU zero for an isothermal process?",
            a: "For an ideal gas U depends only on temperature. Isothermal means the temperature never changes, so the internal energy never changes and all the heat becomes work.",
          },
          {
            q: "Why is the adiabatic curve steeper?",
            a: "No heat is allowed in or out, so the gas spends its own internal energy doing work. Pressure falls faster with volume than it does at constant temperature.",
          },
          {
            q: "Why can't an isochoric process do work?",
            a: "Work is ∫p dV and dV = 0 at fixed volume. The area under the path is zero, so all the heat goes into changing the internal energy.",
          },
          {
            q: "Why does the piston not always move?",
            a: "In an isochoric process the volume is held fixed — the piston is pinned, no area appears under the path, and every joule of heat goes into ΔU. Move to any other process and the piston travels.",
          },
        ]}
      />
    </div>
  );
}

export default PVProcessBench;
