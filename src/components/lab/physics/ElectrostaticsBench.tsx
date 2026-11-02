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
import { useMemo, useState } from "react";

/**
 * Electrostatics — Class 12, "Electric Charges and Fields".
 *
 * Two point charges, their field, and a probe that measures it. The lines are
 * traced from the same 1/r² field the readouts use, so a line leaving a positive
 * charge is a real solution of dr/ds = Ê — it bends exactly as much as the two
 * pulls tell it to, and it ends on a negative charge (or leaves the plate).
 *
 * The probe is the experiment, and it is the pointer: slide over the map and E
 * is recomputed as a vector sum, with both components, the potential there and
 * the force a test charge would feel. No sweep and no run button — a field is
 * not a process, it is a place, and the reader can walk anywhere in it.
 *
 * Presets matter here: a dipole's lines all run from + to −, while like charges
 * have a neutral point between them where E = 0 and no line passes. Same
 * equations, different topology.
 */

type Pair = "dipole" | "like";

const W = 1000;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const PX_PER_CM = 15;
const K = 8.99e9;
const PROBE_LIMIT_X = 32;
const PROBE_LIMIT_Y = 16;

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

const fmtE = (value: number) => (Math.abs(value) > 1e5 ? value.toExponential(1) : value.toFixed(0));

export function ElectrostaticsBench() {
  const [pair, setPair] = useState<Pair>("dipole");
  const [q1, setQ1] = useState(4);
  const [q2, setQ2] = useState(-4);
  const [sep, setSep] = useState(16);
  const [probeX, setProbeX] = useState(4);
  const [probeY, setProbeY] = useState(7);
  const [showLines, setShowLines] = useState(true);
  const [hovered, setHovered] = useState(false);

  const charges = useMemo<Charge[]>(
    () => [
      { x: -sep / 2, y: 0, q: pair === "dipole" ? Math.abs(q1) : q1 },
      { x: sep / 2, y: 0, q: pair === "dipole" ? -Math.abs(q2) : q2 },
    ],
    [pair, q1, q2, sep],
  );

  /* Field lines: seed a ring around each charge, walk along E. */
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
  const arrow = 62;
  /* The halo around the probe grows with log|E| — a second, glanceable read of
     strength that does not depend on reading the number. */
  const halo = 9 + Math.min(26, Math.log10(Emag + 1) * 7);

  /* The neutral point between like charges: on the axis, where the two fields
     cancel. Only exists for same-sign charges; solve it from the 1/r² balance. */
  const neutral =
    pair === "like" && q1 * q2 > 0
      ? (() => {
          const r1 = (sep * Math.sqrt(Math.abs(q1))) / (Math.sqrt(Math.abs(q1)) + Math.sqrt(Math.abs(q2)));
          return -sep / 2 + r1;
        })()
      : null;

  const moveProbe = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xPx = ((event.clientX - rect.left) / rect.width) * W;
    const yPx = ((event.clientY - rect.top) / rect.height) * H;
    setProbeX(Math.max(-PROBE_LIMIT_X, Math.min(PROBE_LIMIT_X, (xPx - CX) / PX_PER_CM)));
    setProbeY(Math.max(-PROBE_LIMIT_Y, Math.min(PROBE_LIMIT_Y, (CY - yPx) / PX_PER_CM)));
  };

  return (
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 12 · Electric charges and fields</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              Two charges, their field, one probe
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              Move the pointer over the map: the probe reads E where you point,
              and the arrow is the field a +1 µC test charge would feel.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-3">
            <Picker
              label="Pair"
              value={pair}
              options={[
                { id: "dipole", label: "Dipole (+ −)" },
                { id: "like", label: "Like (+ +)" },
              ]}
              onChange={(next) => {
                setPair(next);
                setQ1(4);
                setQ2(next === "dipole" ? -4 : 4);
              }}
            />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <button
                type="button"
                className="apple-lab-btn mt-1.5 !px-2.5 !py-1 !text-[11px]"
                data-active={showLines}
                role="switch"
                aria-checked={showLines}
                onClick={() => setShowLines((value) => !value)}
              >
                Field lines
              </button>
            </div>
          </div>
        </div>

        <div className="relative px-2 pt-2 sm:px-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full cursor-crosshair"
            style={{ touchAction: "pan-y" }}
            role="img"
            aria-label="Electric field of two point charges, with a probe that follows the pointer"
            onPointerMove={moveProbe}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              moveProbe(event);
              setHovered(true);
            }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          >
            {showLines &&
              lines.map((line, i) => (
                <polyline
                  key={i}
                  points={line.map(([x, y]) => toPlate(x, y).map((n) => n.toFixed(1)).join(",")).join(" ")}
                  fill="none"
                  stroke={MINT}
                  strokeWidth={1.25}
                  opacity={0.62}
                />
              ))}

            {/* Direction ticks on the lines: the field runs + → −. */}
            {showLines &&
              lines.map((line, i) => {
                if (line.length < 8) return null;
                const at = Math.floor(line.length * 0.5);
                const [x1, y1] = toPlate(...line[at]);
                const [x2, y2] = toPlate(...line[Math.min(line.length - 1, at + 2)]);
                const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                return (
                  <polygon
                    key={`arrow${i}`}
                    points="0,0 -6,-3.2 -6,3.2"
                    transform={`translate(${x1} ${y1}) rotate(${a})`}
                    fill={MINT}
                    opacity={0.7}
                  />
                );
              })}

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
                <circle cx={toPlate(neutral, 0)[0]} cy={CY} r={4.5} fill={plate(1)} stroke={ink(0.5)} strokeWidth={1.4} strokeDasharray="3 3" />
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

            {/* The probe: a point, a strength halo, the field arrow. */}
            <g>
              <circle cx={probePx} cy={probePy} r={halo} fill={AMBER} opacity={0.08} />
              <circle cx={probePx} cy={probePy} r={halo} fill="none" stroke={AMBER} strokeWidth={1} opacity={0.3} />
              <line x1={probePx} y1={probePy} x2={probePx} y2={probePy + 16} stroke={ink(0.4)} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={probePx} cy={probePy} r={6} fill={plate(1)} stroke={ink(0.78)} strokeWidth={2} />
              <line
                x1={probePx}
                y1={probePy}
                x2={probePx + (Emag ? (E.x / Emag) * arrow : 0)}
                y2={probePy - (Emag ? (E.y / Emag) * arrow : 0)}
                stroke={AMBER}
                strokeWidth={2.8}
                strokeLinecap="round"
              />
              <circle
                cx={probePx + (Emag ? (E.x / Emag) * arrow : 0)}
                cy={probePy - (Emag ? (E.y / Emag) * arrow : 0)}
                r={3.4}
                fill={AMBER}
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

            <text x={22} y={26} fontSize={11} fill={ink(0.42)}>
              {pair === "dipole"
                ? "lines leave + and end on −"
                : "both charges positive — lines leave both and end at the plate edge"}
            </text>
          </svg>

          {/* The instrument panel, floating on the map rather than beside it. */}
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[268px] rounded-xl border border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-diagram-plate)_88%,transparent)] px-3 py-2 backdrop-blur-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--lab-ink-micro)]">
                at the probe
              </span>
              <span className="text-[9.5px] text-[var(--lab-ink-micro)]">
                ({probeX.toFixed(0)}, {probeY.toFixed(0)}) cm
              </span>
            </div>
            <p className="mt-1 font-display text-[19px] font-semibold leading-none tabular-nums" style={{ color: AMBER }}>
              {fmtE(Emag)} <span className="text-[11px] font-normal text-[var(--lab-ink-dim)]">N/C</span>
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              Ex {fmtE(E.x)} · Ey {fmtE(E.y)} N/C · {angle.toFixed(0)}°
              <br />
              V = {(V / 1000).toFixed(1)} kV · force on +1 µC = {(Emag * 1e-6).toExponential(2)} N
            </p>
          </div>

          {!hovered ? (
            <p className="pointer-events-none absolute right-3 top-3 rounded-full border border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-diagram-plate)_88%,transparent)] px-3 py-1 text-[10.5px] text-[var(--lab-ink-dim)]">
              move over the field to probe it
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
            <Range
              label="Charge 1"
              value={q1}
              min={1}
              max={6}
              step={1}
              unit="µC"
              format={(value) => value.toFixed(0)}
              onChange={setQ1}
            />
            {pair === "like" ? (
              <Range
                label="Charge 2"
                value={q2}
                min={1}
                max={6}
                step={1}
                unit="µC"
                format={(value) => value.toFixed(0)}
                onChange={setQ2}
              />
            ) : (
              <div className="flex flex-col justify-end">
                <p className="apple-lab-micro">Charge 2</p>
                <p className="mt-1.5 text-[11.5px] text-[var(--lab-ink-dim)]">
                  −{Math.abs(q2)} µC — a dipole with one of each.
                </p>
              </div>
            )}
            <Range
              label="Separation"
              value={sep}
              min={6}
              max={34}
              step={1}
              unit="cm"
              format={(value) => value.toFixed(0)}
              onChange={setSep}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--lab-line-soft)] pt-2">
            {neutral !== null ? (
              <button
                type="button"
                className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                onClick={() => {
                  setProbeX(neutral);
                  setProbeY(0);
                }}
              >
                Jump to E = 0
              </button>
            ) : null}
            <p className="text-[11px] leading-snug text-[var(--lab-ink-micro)]">
              {pair === "dipole"
                ? "Outside the dipole on the axis both fields point the same way; between the charges they oppose, so E dips but never reaches zero."
                : neutral !== null
                  ? `Between two positive charges the fields cancel at ${neutral.toFixed(1)} cm — nearer the smaller charge — and no line passes through that point.`
                  : ""}
            </p>
          </div>
        </div>
      </section>

      <Questions
        items={[
          {
            q: "Why do field lines never cross?",
            a: "A field line is the direction of E at each point. At a crossing there would be two directions, which a single vector field cannot have.",
          },
          {
            q: "What is special about the neutral point?",
            a: "The two fields are equal and opposite, so E = 0 there. A test charge placed exactly there feels no force — but any nudge pushes it away.",
          },
          {
            q: "Why does V not vanish where E does?",
            a: "Potential is a scalar sum; at the neutral point between two positive charges the two potentials add rather than cancel, so V is large while E is zero.",
          },
          {
            q: "Why does the arrow flip direction across the midpoint of a dipole?",
            a: "On the far side the negative charge is nearer, so the net field points toward it; on the near side the positive charge dominates and the field points away. E is a vector, and it reverses.",
          },
        ]}
      />
    </div>
  );
}

export default ElectrostaticsBench;
