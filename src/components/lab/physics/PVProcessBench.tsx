import { Picker, Questions, Range, Readout, ink, plate, AMBER, MINT } from "@/components/lab/bench-atoms";
import { useMemo, useState } from "react";

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
 * One mole of a diatomic gas; p in kPa and V in litres make pV read directly in
 * joules, which is why the energies are numbers a student can follow.
 */

type Process = "isothermal" | "adiabatic" | "isobaric" | "isochoric";

const GAMMA = 1.4;
const CV = 2.5 * 8.314; /* J/mol·K */
const R = 8.314;
const N = 1;

const W_PLATE = 720;
const H_PLATE = 400;
const PAD_L = 64;
const PAD_B = 54;
const V_MAX = 45; /* litres */
const P_MAX = 360; /* kPa */

const PROCESSES: Array<{ id: Process; label: string }> = [
  { id: "isothermal", label: "Isothermal" },
  { id: "adiabatic", label: "Adiabatic" },
  { id: "isobaric", label: "Isobaric" },
  { id: "isochoric", label: "Isochoric" },
];

export function PVProcessBench() {
  const [process, setProcess] = useState<Process>("isothermal");
  const [p1, setP1] = useState(160); /* kPa */
  const [v1, setV1] = useState(12); /* L */
  const [v2, setV2] = useState(24);
  const [p2Manual, setP2Manual] = useState(240);

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

  const X = (v: number) => PAD_L + (v / V_MAX) * (W_PLATE - PAD_L - 26);
  const Y = (p: number) => H_PLATE - PAD_B - (p / P_MAX) * (H_PLATE - PAD_B - 26);

  const curve = useMemo(() => {
    const pts: string[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i += 1) {
      const f = i / steps;
      const v = v1 + (state.v2 - v1) * f;
      let p = state.p2;
      if (process === "isothermal") p = (p1 * v1) / Math.max(0.2, v);
      if (process === "adiabatic") p = p1 * Math.pow(v1 / Math.max(0.2, v), GAMMA);
      if (process === "isobaric") p = p1;
      if (process === "isochoric") p = p1 + (state.p2 - p1) * f;
      pts.push(`${X(v).toFixed(1)} ${Y(p).toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2]);

  /* The work area: bounded by the curve, the V axis and the two verticals. */
  const area = useMemo(() => {
    const pts: string[] = [`M ${X(v1)} ${Y(0)}`];
    pts.push(`L ${X(v1)} ${Y(p1)}`);
    const steps = 60;
    for (let i = 1; i <= steps; i += 1) {
      const f = i / steps;
      const v = v1 + (state.v2 - v1) * f;
      let p = state.p2;
      if (process === "isothermal") p = (p1 * v1) / Math.max(0.2, v);
      if (process === "adiabatic") p = p1 * Math.pow(v1 / Math.max(0.2, v), GAMMA);
      if (process === "isobaric") p = p1;
      if (process === "isochoric") p = p1 + (state.p2 - p1) * f;
      pts.push(`L ${X(v).toFixed(1)} ${Y(p).toFixed(1)}`);
    }
    pts.push(`L ${X(state.v2)} ${Y(0)} Z`);
    return pts.join(" ");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [process, p1, v1, state.p2, state.v2]);

  const energyWord = (value: number, positive: string, negative: string) =>
    Math.abs(value) < 0.5 ? "zero" : value > 0 ? positive : negative;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
        <svg viewBox={`0 0 ${W_PLATE} ${H_PLATE}`} className="w-full" role="img" aria-label={`p–V diagram of an ${process} process`}>
          {/* Grid */}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`v${i}`} x1={X((i * V_MAX) / 6)} y1={Y(0)} x2={X((i * V_MAX) / 6)} y2={Y(P_MAX)} stroke={ink(0.06)} strokeWidth={1} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`p${i}`} x1={X(0)} y1={Y((i * P_MAX) / 6)} x2={X(V_MAX)} y2={Y((i * P_MAX) / 6)} stroke={ink(0.06)} strokeWidth={1} />
          ))}
          {/* Axes */}
          <line x1={X(0)} y1={Y(0)} x2={X(V_MAX)} y2={Y(0)} stroke={ink(0.45)} strokeWidth={1.6} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(P_MAX)} stroke={ink(0.45)} strokeWidth={1.6} />
          <text x={X(V_MAX)} y={H_PLATE - 22} textAnchor="end" fontSize={11} fill={ink(0.55)}>V (litres) →</text>
          <text x={16} y={Y(P_MAX) + 12} fontSize={11} fill={ink(0.55)}>p (kPa)</text>

          {/* The isotherm through A, for reference */}
          {process !== "isothermal" &&
            (() => {
              const pts: string[] = [];
              for (let i = 1; i <= 60; i += 1) {
                const v = 2 + (i / 60) * (V_MAX - 4);
                const p = (p1 * v1) / v;
                if (p <= P_MAX) pts.push(`${X(v).toFixed(1)} ${Y(p).toFixed(1)}`);
              }
              return <path d={`M${pts.join(" L")}`} fill="none" stroke={ink(0.16)} strokeWidth={1.2} strokeDasharray="5 6" />;
            })()}

          {/* Work area and process curve */}
          <path d={area} fill={MINT} opacity={0.16} />
          <path d={curve} fill="none" stroke={AMBER} strokeWidth={2.6} strokeLinejoin="round" />

          {/* States A and B */}
          <circle cx={X(v1)} cy={Y(p1)} r={5} fill={plate(1)} stroke={ink(0.75)} strokeWidth={2} />
          <text x={X(v1) - 10} y={Y(p1) - 10} fontSize={11.5} fontWeight={700} fill={ink(0.75)} textAnchor="end">A</text>
          <circle cx={X(state.v2)} cy={Y(state.p2)} r={5} fill={plate(1)} stroke={AMBER} strokeWidth={2} />
          <text x={X(state.v2) + 10} y={Y(state.p2) - 10} fontSize={11.5} fontWeight={700} fill={AMBER}>B</text>

          <text x={X((v1 + state.v2) / 2)} y={Y(Math.min(state.p2, p1) * 0.35) + 6} textAnchor="middle" fontSize={11} fill={MINT} fontWeight={700}>
            {process === "isochoric" ? "W = 0 — no area" : `W = ${state.work.toFixed(0)} J (the shaded area)`}
          </text>
          <text x={X(0) + 10} y={26} fontSize={11} fill={ink(0.5)}>
            {PROCESSES.find((p) => p.id === process)?.label} · n = 1 mol of a diatomic gas
          </text>
        </svg>
        <p className="apple-lab-note">
          The shaded area is the work done by the gas. An isochoric process has no
          width, so no area — and no work, whatever the pressure does.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <p className="apple-lab-micro">Class 11 · Thermodynamics — p–V processes</p>
          <Picker label="Process" value={process} options={PROCESSES} onChange={(next) => setProcess(next)} />
          <Range label="State A pressure p₁" value={p1} min={40} max={340} step={5} unit="kPa" format={(v) => v.toFixed(0)} onChange={setP1} />
          <Range label="State A volume V₁" value={v1} min={4} max={20} step={0.5} unit="L" format={(v) => v.toFixed(1)} onChange={setV1} />
          {process === "isochoric" ? (
            <Range label="State B pressure p₂" value={p2Manual} min={40} max={340} step={5} unit="kPa" format={(v) => v.toFixed(0)} onChange={setP2Manual} />
          ) : (
            <Range label="State B volume V₂" value={v2} min={4} max={40} step={0.5} unit="L" format={(v) => v.toFixed(1)} onChange={setV2} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Readout label="p₂" value={`${state.p2.toFixed(0)} kPa`} />
          <Readout label="V₂" value={`${state.v2.toFixed(1)} L`} />
          <Readout label="T₁ → T₂" value={`${state.t1.toFixed(0)} → ${state.t2.toFixed(0)} K`} />
          <Readout label="ΔU = n Cv ΔT" value={`${state.deltaU.toFixed(0)} J`} />
          <Readout label="W by the gas" value={`${state.work.toFixed(0)} J`} />
          <Readout label="Q = ΔU + W" value={`${state.heat.toFixed(0)} J`} />
        </div>

        <div className="apple-lab-card px-3 py-2.5">
          <p className="apple-lab-micro">First law, read off the plate</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            {state.deltaU.toFixed(0)} + {state.work.toFixed(0)} = {state.heat.toFixed(0)} J.
            Heat {energyWord(state.heat, "flows in", "flows out")}; work is done{" "}
            {energyWord(state.work, "by the gas on the surroundings", "on the gas by the surroundings")};
            internal energy {energyWord(state.deltaU, "rises", "falls")}.
          </p>
        </div>

        <Questions
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
