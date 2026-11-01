import {
  BenchStage,
  LiveDot,
  Picker,
  Questions,
  Range,
  StageStat,
  StageToggle,
  ink,
  plate,
  AMBER,
  MINT,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * p–V process explorer — Class 11 thermodynamics.
 *
 * Four ways to move a gas from state A to state B, one diagram:
 *
 *   isothermal  a hyperbola, ΔU = 0 and Q = W
 *   adiabatic   a steeper curve, Q = 0 and W = −ΔU
 *   isobaric    a horizontal line, W = p ΔV and Q = n Cp ΔT
 *   isochoric   a vertical line, W = 0 and Q = ΔU
 *
 * Work is the area under the curve, shaded as the process changes, and the
 * three energy books (Q, W, ΔU) are printed with signs. The first law is not
 * stated as a rule to remember: it is the check on the readouts, and a small
 * line says whether Q came out positive or negative.
 *
 * Running the process moves a marker along the very curve being drawn while
 * the shaded area grows behind it — so "work is the area under the curve" is
 * something the reader watches happen, with the p, V and T of the gas at every
 * instant in the reading strip. One mole of a diatomic gas; p in kPa and V in
 * litres make pV read directly in joules, which is why the energies are
 * numbers a student can follow.
 */

type Process = "isothermal" | "adiabatic" | "isobaric" | "isochoric";

const GAMMA = 1.4;
const CV = 2.5 * 8.314; /* J/mol·K */
const R = 8.314;
const N = 1;

const W_PLATE = 820;
const H_PLATE = 460;
const PAD_L = 68;
const PAD_B = 58;
const V_MAX = 45; /* litres */
const P_MAX = 360; /* kPa */

/** Seconds one full A → B run takes. */
const RUN_SECONDS = 5;

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
  const [run, setRun] = useState(0); /* 0 = at A, 1 = at B */
  const [running, setRunning] = useState(false);

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

  /* An adiabatic squeeze can push p₂ far above the starting range; scale the
     pressure axis to whatever the process actually reaches. */
  const pMax = Math.max(P_MAX, Math.ceil(state.p2 / 100) * 100);

  const X = (v: number) => PAD_L + (v / V_MAX) * (W_PLATE - PAD_L - 30);
  const Y = (p: number) => H_PLATE - PAD_B - (p / pMax) * (H_PLATE - PAD_B - 30);

  const buildCurve = (steps: number, upto: number) => {
    const pts: string[] = [];
    const n = Math.max(2, Math.round(steps * upto));
    for (let i = 0; i <= n; i += 1) {
      const f = (i / steps) * upto;
      const v = v1 + (state.v2 - v1) * f;
      const p = pressureAt(process, p1, v1, v, f, state.p2);
      pts.push(`${X(v).toFixed(1)} ${Y(p).toFixed(1)}`);
    }
    return pts;
  };

  const curve = useMemo(() => `M${buildCurve(80, 1).join(" L")}`, /* eslint-disable-line react-hooks/exhaustive-deps */ [process, p1, v1, state.p2, state.v2]);
  /* The work area, grown to wherever the run has reached. */
  const area = useMemo(() => {
    const pts = [`M ${X(v1)} ${Y(0)}`, `L ${X(v1)} ${Y(p1)}`];
    pts.push(...buildCurve(60, Math.max(0.001, run)).map((p) => `L ${p}`));
    pts.push(`L ${X(v1 + (state.v2 - v1) * run)} ${Y(0)} Z`);
    return pts.join(" ");
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2, run]);

  /* The gas at the run's current position — the live reading. */
  const runV = v1 + (state.v2 - v1) * run;
  const runP = pressureAt(process, p1, v1, runV, run, state.p2);
  const runT = (runP * runV) / (N * R);
  /* Work done up to the marker, for the live area read-out. */
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
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2, run]);

  const energyWord = (value: number, positive: string, negative: string) =>
    Math.abs(value) < 0.5 ? "zero" : value > 0 ? positive : negative;

  /* ---- the clock ------------------------------------------------------ */
  const last = useRef<number | null>(null);
  useAnimationFrame((now) => {
    if (!running) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current);
    last.current = now;
    const next = run + dt / 1000 / RUN_SECONDS;
    if (next >= 1) {
      setRun(1);
      setRunning(false);
    } else {
      setRun(next);
    }
  });

  const toggleRun = () => {
    if (!running && run >= 0.999) setRun(0);
    last.current = null;
    setRunning((value) => !value);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 11 · Thermodynamics — p–V processes"
        title="Run the process, watch the area become work"
        meta={
          <>
            <span className="apple-lab-chip">
              {PROCESSES.find((p) => p.id === process)?.label} · n = 1 mol of a diatomic gas
            </span>
            <LiveDot on={running} label={running ? `at ${(run * 100).toFixed(0)}%` : run >= 1 ? "reached B" : "at A"} />
          </>
        }
        toolbar={
          <>
            <Picker label="Process" value={process} options={PROCESSES} onChange={(next) => { setProcess(next); setRun(0); setRunning(false); }} />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageToggle label="Isotherm through A" checked={showIsotherm} onChange={setShowIsotherm} />
              </div>
            </div>
          </>
        }
        rail={
          <>
            <button
              type="button"
              className={`apple-lab-btn ${running ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
              onClick={toggleRun}
            >
              {running ? "Pause the gas" : run >= 1 ? "Run it again" : run > 0 ? "Resume" : "Run A → B"}
            </button>
            <button type="button" className="apple-lab-btn" onClick={() => { setRunning(false); setRun(0); }} disabled={run === 0}>
              Back to A
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(run * 100).toFixed(1)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              V = {runV.toFixed(1)} L · p = {runP.toFixed(0)} kPa · T = {runT.toFixed(0)} K
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="p₂" value={`${state.p2.toFixed(0)} kPa`} />
            <StageStat label="V₂" value={`${state.v2.toFixed(1)} L`} />
            <StageStat label="T₁ → T₂" value={`${state.t1.toFixed(0)} → ${state.t2.toFixed(0)} K`} tone="cyan" />
            <StageStat label="ΔU = n Cv ΔT" value={`${state.deltaU.toFixed(0)} J`} tone="violet" />
            <StageStat label="W by the gas" value={`${state.work.toFixed(0)} J`} tone="mint" />
            <StageStat label="Q = ΔU + W" value={`${state.heat.toFixed(0)} J`} tone="amber" />
            <StageStat label="W so far" value={`${workSoFar.toFixed(0)} J`} tone="mint" />
            <StageStat label="Area drawn" value={`${(run * 100).toFixed(0)}%`} />
          </>
        }
        note="The shaded area is the work done by the gas. An isochoric process has no width, so no area — and no work, whatever the pressure does."
      >
        <svg viewBox={`0 0 ${W_PLATE} ${H_PLATE}`} role="img" aria-label={`p–V diagram of an ${process} process`}>
          {/* Grid */}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`v${i}`} x1={X((i * V_MAX) / 6)} y1={Y(0)} x2={X((i * V_MAX) / 6)} y2={Y(pMax)} stroke={ink(0.06)} strokeWidth={1} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`p${i}`} x1={X(0)} y1={Y((i * pMax) / 6)} x2={X(V_MAX)} y2={Y((i * pMax) / 6)} stroke={ink(0.06)} strokeWidth={1} />
          ))}
          {/* Axes */}
          <line x1={X(0)} y1={Y(0)} x2={X(V_MAX)} y2={Y(0)} stroke={ink(0.45)} strokeWidth={1.6} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(pMax)} stroke={ink(0.45)} strokeWidth={1.6} />
          <text x={X(V_MAX)} y={H_PLATE - 24} textAnchor="end" fontSize={12} fill={ink(0.55)}>V (litres) →</text>
          <text x={18} y={Y(pMax) + 14} fontSize={12} fill={ink(0.55)}>p (kPa)</text>

          {/* The isotherm through A, for reference */}
          {showIsotherm &&
            process !== "isothermal" &&
            (() => {
              const pts: string[] = [];
              for (let i = 1; i <= 60; i += 1) {
                const v = 2 + (i / 60) * (V_MAX - 4);
                const p = (p1 * v1) / v;
                if (p <= pMax) pts.push(`${X(v).toFixed(1)} ${Y(p).toFixed(1)}`);
              }
              return <path d={`M${pts.join(" L")}`} fill="none" stroke={ink(0.16)} strokeWidth={1.2} strokeDasharray="5 6" />;
            })()}

          {/* Work area and process curve */}
          <path d={area} fill={MINT} opacity={0.16} />
          <path d={curve} fill="none" stroke={AMBER} strokeWidth={2.6} strokeLinejoin="round" />

          {/* States A and B */}
          <circle cx={X(v1)} cy={Y(p1)} r={5.5} fill={plate(1)} stroke={ink(0.75)} strokeWidth={2} />
          <text x={X(v1) - 10} y={Y(p1) - 10} fontSize={12.5} fontWeight={700} fill={ink(0.75)} textAnchor="end">A</text>
          <circle cx={X(state.v2)} cy={Y(state.p2)} r={5.5} fill={plate(1)} stroke={AMBER} strokeWidth={2} />
          <text x={X(state.v2) + 10} y={Y(state.p2) - 10} fontSize={12.5} fontWeight={700} fill={AMBER}>B</text>

          {/* The gas itself, wherever the run has reached. */}
          {run > 0 && run < 1 ? (
            <g>
              <circle cx={X(runV)} cy={Y(runP)} r={9} fill={plate(0.9)} stroke={MINT} strokeWidth={2} />
              <circle cx={X(runV)} cy={Y(runP)} r={3.4} fill={MINT} />
              <line x1={X(runV)} y1={Y(runP)} x2={X(runV)} y2={Y(0)} stroke={MINT} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
              <line x1={X(0)} y1={Y(runP)} x2={X(runV)} y2={Y(runP)} stroke={MINT} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
            </g>
          ) : null}

          <text x={X((v1 + state.v2) / 2)} y={Y(Math.min(state.p2, p1) * 0.35) + 6} textAnchor="middle" fontSize={12} fill={MINT} fontWeight={700}>
            {process === "isochoric" ? "W = 0 — no area" : `W = ${state.work.toFixed(0)} J (the shaded area)`}
          </text>
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the two states</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">pV reads in joules</span>
          </div>
          <Range label="State A pressure p₁" value={p1} min={40} max={340} step={5} unit="kPa" format={(v) => v.toFixed(0)} onChange={(v) => { setP1(v); setRun(0); setRunning(false); }} />
          <Range label="State A volume V₁" value={v1} min={4} max={20} step={0.5} unit="L" format={(v) => v.toFixed(1)} onChange={(v) => { setV1(v); setRun(0); setRunning(false); }} />
          {process === "isochoric" ? (
            <Range label="State B pressure p₂" value={p2Manual} min={40} max={340} step={5} unit="kPa" format={(v) => v.toFixed(0)} onChange={(v) => { setP2Manual(v); setRun(0); setRunning(false); }} />
          ) : (
            <Range label="State B volume V₂" value={v2} min={4} max={40} step={0.5} unit="L" format={(v) => v.toFixed(1)} onChange={(v) => { setV2(v); setRun(0); setRunning(false); }} />
          )}
        </div>

        <div className="apple-lab-card px-3.5 py-3">
          <p className="apple-lab-micro">First law, read off the plate</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            {state.deltaU.toFixed(0)} + {state.work.toFixed(0)} = {state.heat.toFixed(0)} J.
            Heat {energyWord(state.heat, "flows in", "flows out")}; work is done{" "}
            {energyWord(state.work, "by the gas on the surroundings", "on the gas by the surroundings")};
            internal energy {energyWord(state.deltaU, "rises", "falls")}.
          </p>
        </div>

        <Questions
          columns={1}
          items={[
            { q: "Why is ΔU zero for an isothermal process?", a: "For an ideal gas U depends only on temperature. Isothermal means the temperature never changes, so the internal energy never changes and all the heat becomes work." },
            { q: "Why is the adiabatic curve steeper?", a: "No heat is allowed in or out, so the gas spends its own internal energy doing work. Pressure falls faster with volume than it does at constant temperature." },
            { q: "Why can't an isochoric process do work?", a: "Work is ∫p dV and dV = 0 at fixed volume. The area under the path is zero, so all the heat goes into changing the internal energy." },
          ]}
        />
      </div>
    </div>
  );
}

export default PVProcessBench;
