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
  CYAN,
  MINT,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Electrostatics — Class 12.
 *
 * Two point charges, their field, and a probe that measures it. The lines are
 * traced from the same 1/r² field the readouts use, so a line leaving a positive
 * charge is a real solution of dr/ds = Ê — it bends exactly as much as the two
 * pulls tell it to, and it terminates on a negative charge instead of being
 * drawn to the edge for looks.
 *
 * The probe is the experiment: move it and E is recomputed as a vector sum, with
 * its two components, the potential there, and the force a test charge would
 * feel. The line through the probe is not decoration either — it is the local
 * direction of E, found by evaluating the field, and the angle it prints agrees
 * with the arrow drawn.
 *
 * Presets matter here: a dipole's lines all run from + to −, while like charges
 * have a neutral point between them where E = 0 and no line crosses. Same
 * equations, different topology. Sweeping the probe walks it along the axis
 * through that point, so |E| visibly collapses to zero and climbs again — the
 * one number the plate cannot draw for you.
 */

type Pair = "dipole" | "like";

/* The plate is taller and narrower than it was: the field gets the whole
   panel instead of a band across its middle. */
const W = 780;
const H = 540;
const CX = W / 2;
const CY = H / 2;
const PX_PER_CM = 15;
const K = 8.99e9;

/** Seconds a full probe sweep takes. */
const SWEEP_SECONDS = 16;

type Charge = { x: number; y: number; q: number }; /* x, y in cm; q in µC */

function fieldAt(x: number, y: number, charges: Charge[]) {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2) || 1e-4;
    /* k q / r² with q in µC and r in cm → N/C. */
    const k = (K * (c.q * 1e-6)) / (r2 * 1e-4);
    ex += (k * dx) / r;
    ey += (k * dy) / r;
  }
  return { x: ex, y: ey };
}

function potentialAt(x: number, y: number, charges: Charge[]) {
  let v = 0;
  for (const c of charges) {
    const r = Math.hypot(x - c.x, y - c.y) || 0.3;
    v += (K * (c.q * 1e-6)) / (r / 100);
  }
  return v;
}

const toPlate = (x: number, y: number): [number, number] => [CX + x * PX_PER_CM, CY - y * PX_PER_CM];

export function ElectrostaticsBench() {
  const [pair, setPair] = useState<Pair>("dipole");
  const [q1, setQ1] = useState(4);
  const [q2, setQ2] = useState(-4);
  const [sep, setSep] = useState(16);
  const [probeX, setProbeX] = useState(0);
  const [probeY, setProbeY] = useState(9);
  const [showLines, setShowLines] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const charges = useMemo<Charge[]>(
    () => [
      { x: -sep / 2, y: 0, q: pair === "dipole" ? Math.abs(q1) : q1 },
      { x: sep / 2, y: 0, q: pair === "dipole" ? -Math.abs(q2) : q2 },
    ],
    [pair, q1, q2, sep],
  );

  /* Field lines: seed a ring around each positive charge, walk along E. */
  const lines = useMemo(() => {
    const traced: Array<Array<[number, number]>> = [];
    const unit = (v: { x: number; y: number }) => {
      const m = Math.hypot(v.x, v.y) || 1e-9;
      return { x: v.x / m, y: v.y / m };
    };
    const walk = (sx: number, sy: number, direction: 1 | -1) => {
      const pts: Array<[number, number]> = [];
      let x = sx;
      let y = sy;
      for (let i = 0; i < 700; i += 1) {
        pts.push([x, y]);
        const p1 = unit(fieldAt(x, y, charges));
        const p2 = unit(fieldAt(x + (0.8 * p1.x) / 2, y + (0.8 * p1.y) / 2, charges));
        const p3 = unit(fieldAt(x + (0.8 * p2.x) / 2, y + (0.8 * p2.y) / 2, charges));
        const p4 = unit(fieldAt(x + 0.8 * p3.x, y + 0.8 * p3.y, charges));
        x += direction * 0.8 * ((p1.x + 2 * p2.x + 2 * p3.x + p4.x) / 6);
        y += direction * 0.8 * ((p1.y + 2 * p2.y + 2 * p3.y + p4.y) / 6);
        if (Math.abs(x) * PX_PER_CM > W / 2 - 20 || Math.abs(y) * PX_PER_CM > H / 2 - 16) break;
        let inside = false;
        for (const c of charges) {
          if (Math.hypot(x - c.x, y - c.y) < 0.9) inside = true;
        }
        if (inside) break;
      }
      return pts;
    };

    for (const c of charges) {
      if (c.q <= 0) continue;
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2;
        traced.push(walk(c.x + Math.cos(a) * 1.6, c.y + Math.sin(a) * 1.6, 1));
      }
    }
    for (const c of charges) {
      if (c.q >= 0) continue;
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2;
        traced.push(walk(c.x + Math.cos(a) * 1.6, c.y + Math.sin(a) * 1.6, -1));
      }
    }
    return traced;
  }, [charges]);

  const E = fieldAt(probeX, probeY, charges);
  const Emag = Math.hypot(E.x, E.y);
  const V = potentialAt(probeX, probeY, charges);
  const angle = (Math.atan2(E.y, E.x) * 180) / Math.PI;
  const [probePx, probePy] = toPlate(probeX, probeY);
  const arrow = 58;

  /* The neutral point between like charges: on the axis, where the two fields
     cancel. Only exists for same-sign charges; solve it from the 1/r² balance. */
  const neutral =
    pair === "like" && q1 * q2 > 0
      ? (() => {
          const r1 = (sep * Math.sqrt(Math.abs(q1))) / (Math.sqrt(Math.abs(q1)) + Math.sqrt(Math.abs(q2)));
          return -sep / 2 + r1;
        })()
      : null;

  /* ---- the sweep ------------------------------------------------------ */
  /* The probe runs the full span of the plate at the current height, through
     the neutral point when there is one. */
  const sweepMin = -Math.min(26, sep / 2 + 8);
  const sweepMax = Math.min(26, sep / 2 + 8);
  const last = useRef<number | null>(null);
  const sweepPhase = useRef(0);
  useAnimationFrame((now) => {
    if (!sweeping) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current);
    last.current = now;
    sweepPhase.current = (sweepPhase.current + dt / 1000 / SWEEP_SECONDS) % 2;
    const triangle = sweepPhase.current <= 1 ? sweepPhase.current : 2 - sweepPhase.current;
    setProbeX(Math.round(sweepMin + triangle * (sweepMax - sweepMin)));
  });

  const toggleSweep = () => {
    if (!sweeping) last.current = null;
    setSweeping((value) => !value);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 12 · Electric charges and fields"
        title="Two charges, their field, one probe"
        meta={
          <>
            <span className="apple-lab-chip">
              |E| at the probe = {Emag > 1e5 ? Emag.toExponential(2) : Emag.toFixed(0)} N/C
            </span>
            <LiveDot on={sweeping} label={sweeping ? "sweeping probe" : neutral !== null && Math.abs(probeX - neutral) < 0.6 ? "at E = 0" : "probing"} />
          </>
        }
        toolbar={
          <>
            <Picker
              label="Pair"
              value={pair}
              options={[
                { id: "dipole", label: "Dipole (+ −)" },
                { id: "like", label: "Like charges (+ +)" },
              ]}
              onChange={(next) => {
                setPair(next);
                setQ1(4);
                setQ2(next === "dipole" ? -4 : 4);
                setSweeping(false);
              }}
            />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageToggle label="Field lines" checked={showLines} onChange={setShowLines} />
              </div>
            </div>
            {neutral !== null ? (
              <button
                type="button"
                className="apple-lab-btn"
                onClick={() => {
                  setSweeping(false);
                  setProbeX(Math.round(neutral));
                  setProbeY(0);
                }}
              >
                Jump to E = 0
              </button>
            ) : null}
          </>
        }
        rail={
          <>
            <button
              type="button"
              className={`apple-lab-btn ${sweeping ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
              onClick={toggleSweep}
            >
              {sweeping ? "Hold the probe" : "Sweep the probe"}
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(((probeX - sweepMin) / Math.max(1, sweepMax - sweepMin)) * 100).toFixed(1)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              probe at ({probeX.toFixed(0)}, {probeY.toFixed(0)}) cm · |E| ={" "}
              {Emag > 1e5 ? Emag.toExponential(2) : Emag.toFixed(0)} N/C
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="|E| at the probe" value={`${Emag > 1e5 ? Emag.toExponential(2) : Emag.toFixed(0)} N/C`} tone="amber" />
            <StageStat label="Direction" value={`${angle.toFixed(0)}°`} />
            <StageStat label="Ex" value={`${E.x > 1e5 ? E.x.toExponential(2) : E.x.toFixed(0)} N/C`} tone="cyan" />
            <StageStat label="Ey" value={`${Math.abs(E.y) > 1e5 ? E.y.toExponential(2) : E.y.toFixed(0)} N/C`} tone="cyan" />
            <StageStat label="Potential V" value={`${(V / 1000).toFixed(1)} kV`} tone="violet" />
            <StageStat label="Force on +1 µC" value={`${(Emag * 1e-6).toExponential(2)} N`} tone="mint" />
          </>
        }
        note={
          pair === "dipole"
            ? "On the axis outside the dipole both fields point the same way; between the charges they oppose. The negative charge is where lines end, not where they start."
            : neutral !== null
              ? `Between two positive charges the fields cancel at ${neutral.toFixed(1)} cm, where the closer charge's larger field exactly matches the farther one's. No line passes through that point.`
              : "Like charges push field lines away from the space between them."
        }
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Electric field of two point charges with a probe">
          {showLines &&
            lines.map((line, i) => (
              <polyline
                key={i}
                points={line.map(([x, y]) => toPlate(x, y).map((n) => n.toFixed(1)).join(",")).join(" ")}
                fill="none"
                stroke={MINT}
                strokeWidth={1.25}
                opacity={0.65}
              />
            ))}

          {/* Charges */}
          {charges.map((c, i) => {
            const [x, y] = toPlate(c.x, c.y);
            const positive = c.q > 0;
            const r = 13 + Math.min(12, Math.abs(c.q) * 1.8);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={r} fill={plate(1)} stroke={positive ? AMBER : CYAN} strokeWidth={2.6} />
                <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill={positive ? AMBER : CYAN}>
                  {positive ? "+" : "−"}
                </text>
                <text
                  x={x}
                  y={y + r + 17}
                  textAnchor="middle"
                  fontSize={12}
                  fill={ink(0.6)}
                  paintOrder="stroke"
                  stroke={plate(0.95)}
                  strokeWidth={3}
                >
                  {c.q.toFixed(0)} µC
                </text>
              </g>
            );
          })}

          {/* Neutral point */}
          {neutral !== null && (
            <g>
              <circle cx={toPlate(neutral, 0)[0]} cy={toPlate(neutral, 0)[1]} r={4.5} fill={plate(1)} stroke={ink(0.5)} strokeWidth={1.4} strokeDasharray="3 3" />
              <text
                x={toPlate(neutral, 0)[0]}
                y={CY - 20}
                textAnchor="middle"
                fontSize={11}
                fill={ink(0.55)}
                paintOrder="stroke"
                stroke={plate(0.95)}
                strokeWidth={3}
              >
                E = 0
              </text>
            </g>
          )}

          {/* The probe: a point, the field arrow, and the components. */}
          <g>
            <line x1={probePx} y1={probePy} x2={probePx} y2={probePy + 14} stroke={ink(0.4)} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={probePx} cy={probePy} r={6} fill={plate(1)} stroke={ink(0.75)} strokeWidth={2} />
            <line
              x1={probePx}
              y1={probePy}
              x2={probePx + (Emag ? (E.x / (Emag || 1)) * arrow : 0)}
              y2={probePy - (Emag ? (E.y / (Emag || 1)) * arrow : 0)}
              stroke={AMBER}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <text
              x={probePx + 14}
              y={probePy - 14}
              fontSize={11.5}
              fill={AMBER}
              paintOrder="stroke"
              stroke={plate(0.95)}
              strokeWidth={3}
            >
              probe
            </text>
          </g>
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the charges</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">the field is traced live</span>
          </div>
          <Range label="Charge 1" value={q1} min={1} max={6} step={1} unit="µC" format={(v) => v.toFixed(0)} onChange={(v) => { setQ1(v); setSweeping(false); }} />
          {pair === "like" && <Range label="Charge 2" value={q2} min={1} max={6} step={1} unit="µC" format={(v) => v.toFixed(0)} onChange={(v) => { setQ2(v); setSweeping(false); }} />}
          <Range label="Separation" value={sep} min={6} max={34} step={1} unit="cm" format={(v) => v.toFixed(0)} onChange={(v) => { setSep(v); setSweeping(false); }} />
          <Range label="Probe · across" value={probeX} min={-26} max={26} step={1} unit="cm" format={(v) => v.toFixed(0)} onChange={(v) => { setProbeX(v); setSweeping(false); }} />
          <Range label="Probe · up" value={probeY} min={-17} max={17} step={1} unit="cm" format={(v) => v.toFixed(0)} onChange={(v) => { setProbeY(v); setSweeping(false); }} />
        </div>

        <div className="apple-lab-card px-3.5 py-3">
          <p className="apple-lab-micro">Try this</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            {pair === "like"
              ? "Switch to Like charges and press Sweep. Watch |E| fall to zero at the marked point between them and climb again — that is the neutral point, where a test charge would feel nothing at all."
              : "Press Sweep and watch the probe cross the midpoint: |E| does not vanish there, it reverses, because both charges pull the same way. The potential, though, passes smoothly through zero — a scalar sum."}
          </p>
        </div>

        <Questions
          columns={1}
          items={[
            { q: "Why do field lines never cross?", a: "A field line is the direction of E at each point. At a crossing there would be two directions, which a single vector field cannot have." },
            { q: "What is special about the neutral point?", a: "The two fields are equal and opposite, so E = 0 there. A test charge placed exactly there feels no force — but any nudge pushes it away." },
            { q: "Why does V not vanish where E does?", a: "Potential is a scalar sum; at the neutral point between two positive charges the two potentials add rather than cancel, so V is large while E is zero." },
          ]}
        />
      </div>
    </div>
  );
}

export default ElectrostaticsBench;
