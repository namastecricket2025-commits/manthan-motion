import { useMemo, useState } from "react";

/**
 * Motion graphs — Class 9.
 *
 * A walk becomes two graphs. The student picks (or edits) the legs of a
 * journey — rest, walk forward, walk back — and the model draws the
 * distance–time graph and derives the velocity–time graph from its slopes,
 * with the slope triangle drawn on each leg so "gradient = speed" is a line
 * on the picture, not a sentence in the margin.
 *
 * The velocity graph is not a second drawing: every horizontal level is the
 * slope of the segment above it, and its area is recomputed live and shown
 * against the displacement, which is the identity that makes the two graphs
 * one fact.
 */

type Leg = { kind: "rest" | "walk"; speed: number; minutes: number };

const PRESETS: Array<{ id: string; label: string; legs: Leg[] }> = [
  { id: "school", label: "Walk to school", legs: [{ kind: "walk", speed: 80, minutes: 5 }, { kind: "rest", speed: 0, minutes: 2 }, { kind: "walk", speed: 100, minutes: 3 }] },
  { id: "there-back", label: "There and back", legs: [{ kind: "walk", speed: 90, minutes: 6 }, { kind: "rest", speed: 0, minutes: 4 }, { kind: "walk", speed: -90, minutes: 6 }] },
  { id: "late", label: "Late for the bus", legs: [{ kind: "walk", speed: 60, minutes: 4 }, { kind: "walk", speed: 140, minutes: 2 }, { kind: "rest", speed: 0, minutes: 1 }] },
];

const W = 640;
const H = 360;
const PAD = 46;
const GAP = 34;

export function MotionGraphs() {
  const [presetId, setPresetId] = useState("school");
  const [legs, setLegs] = useState<Leg[]>(PRESETS[0].legs);
  const [active, setActive] = useState(0);

  const model = useMemo(() => {
    const totalMin = Math.max(1, legs.reduce((s, l) => s + l.minutes, 0));
    /* Distance accumulates: speed in m/min × minutes. Rest legs hold it flat. */
    const points: Array<{ t: number; d: number }> = [{ t: 0, d: 0 }];
    let d = 0;
    for (const leg of legs) {
      d += leg.speed * leg.minutes;
      points.push({ t: points[points.length - 1].t + leg.minutes, d });
    }
    const maxAbsD = Math.max(50, ...points.map((p) => Math.abs(p.d)));
    return { totalMin, points, maxAbsD };
  }, [legs]);

  const { totalMin, points, maxAbsD } = model;
  const maxSpeed = Math.max(40, ...legs.map((l) => Math.abs(l.speed)));

  const sx = (t: number) => PAD + (t / totalMin) * (W - PAD * 2);
  const topY = (d: number) => PAD + (1 - (d + maxAbsD) / (2 * maxAbsD)) * (H / 2 - PAD);
  const vTop = H / 2 + GAP;
  const vy = (v: number) => vTop + (H - PAD - vTop) / 2 - (v / maxSpeed) * ((H - PAD - vTop) / 2 - 12);

  const displacement = points[points.length - 1].d;
  const distance = legs.reduce((s, l) => s + Math.abs(l.speed * l.minutes), 0);
  /* Area under the v–t graph, summed leg by leg — the same total as the walk. */
  const area = legs.reduce((s, l) => s + l.speed * l.minutes, 0);
  const avgSpeed = distance / totalMin;

  const legLabel = (leg: Leg) => (leg.kind === "rest" ? `rest ${leg.minutes} min` : `${leg.speed > 0 ? "walk" : "return"} ${Math.abs(leg.speed)} m/min × ${leg.minutes} min`);

  const setLeg = (i: number, patch: Partial<Leg>) =>
    setLegs((cur) => cur.map((leg, index) => (index === i ? { ...leg, ...patch } : leg)));

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Preset walks">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="mm-chip"
            aria-pressed={p.id === presetId}
            onClick={() => { setPresetId(p.id); setLegs(p.legs); setActive(0); }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distance-time graph above, velocity-time graph below">
            {/* ---- Distance–time ---- */}
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`g${i}`} x1={PAD} y1={PAD + (i * (H / 2 - PAD)) / 4} x2={W - PAD} y2={PAD + (i * (H / 2 - PAD)) / 4} stroke="var(--text-main)" strokeWidth={1} opacity={0.07} />
            ))}
            <line x1={PAD} y1={topY(0)} x2={W - PAD} y2={topY(0)} stroke="var(--text-main)" strokeWidth={1} opacity={0.25} strokeDasharray="4 6" />
            <path
              d={points.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${topY(p.d).toFixed(1)}`).join(" ")}
              fill="none"
              stroke="var(--text-main)"
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={sx(p.t)} cy={topY(p.d)} r={3.2} fill="var(--text-main)" />
            ))}
            {/* The gradient is drawn on the active leg: run then rise, labelled. */}
            {(() => {
              const leg = legs[active];
              if (!leg || leg.kind === "rest") return null;
              const t0 = legs.slice(0, active).reduce((s, l) => s + l.minutes, 0);
              const t1 = t0 + leg.minutes;
              const d0 = points[active].d;
              const d1 = points[active + 1].d;
              return (
                <g>
                  <line x1={sx(t0)} y1={topY(d0)} x2={sx(t1)} y2={topY(d0)} stroke="var(--signal)" strokeWidth={1.4} strokeDasharray="3 4" />
                  <line x1={sx(t1)} y1={topY(d0)} x2={sx(t1)} y2={topY(d1)} stroke="var(--signal)" strokeWidth={1.4} strokeDasharray="3 4" />
                  <text x={sx((t0 + t1) / 2)} y={topY((d0 + d1) / 2) - 10} fontSize={11} fontWeight={700} fill="var(--signal)" textAnchor="middle">
                    slope = {leg.speed} m/min
                  </text>
                </g>
              );
            })()}
            <text x={12} y={PAD - 24} fontSize={10.5} fontWeight={700} fill="var(--text-dim)">DISTANCE–TIME</text>
            <text x={12} y={PAD - 10} fontSize={10} fill="var(--text-dim)">metres</text>
            <text x={W - PAD} y={PAD - 10} fontSize={10} fill="var(--text-dim)" textAnchor="end">minutes →</text>

            {/* ---- Velocity–time ---- */}
            <line x1={PAD} y1={vTop} x2={W - PAD} y2={vTop} stroke="var(--text-main)" strokeWidth={1} opacity={0.12} />
            <path
              d={
                (() => {
                  let t = 0;
                  const parts: string[] = [];
                  for (let i = 0; i < legs.length; i += 1) {
                    const leg = legs[i];
                    const y = vy(leg.speed);
                    parts.push(`${i ? "L" : "M"}${sx(t).toFixed(1)} ${y.toFixed(1)}`);
                    parts.push(`L${sx(t + leg.minutes).toFixed(1)} ${y.toFixed(1)}`);
                    t += leg.minutes;
                  }
                  return parts.join(" ");
                })()
              }
              fill="none"
              stroke="var(--text-main)"
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            {/* Area under the active leg: the rectangle that *is* the displacement. */}
            {(() => {
              const leg = legs[active];
              if (!leg) return null;
              const t0 = legs.slice(0, active).reduce((s, l) => s + l.minutes, 0);
              const y0 = vy(0);
              const y1 = vy(leg.speed);
              return (
                <rect x={sx(t0)} y={Math.min(y0, y1)} width={sx(t0 + leg.minutes) - sx(t0)} height={Math.abs(y1 - y0)} fill="var(--verify)" opacity={0.16} />
              );
            })()}
            {legs.map((leg, i) => {
              const t0 = legs.slice(0, i).reduce((s, l) => s + l.minutes, 0);
              return (
                <text key={i} x={sx(t0 + leg.minutes / 2)} y={vy(leg.speed) - 7} fontSize={10.5} textAnchor="middle" fill="var(--text-dim)">
                  {leg.speed === 0 ? "0" : `${leg.speed > 0 ? "+" : ""}${leg.speed}`}
                </text>
              );
            })}
            <text x={12} y={vTop + 12} fontSize={10.5} fontWeight={700} fill="var(--text-dim)">VELOCITY–TIME</text>
            <text x={12} y={vTop + 26} fontSize={10} fill="var(--text-dim)">m/min</text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">The walk</p>
            {legs.map((leg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className="mm-chip"
                aria-pressed={i === active}
                style={{ width: "100%", justifyContent: "flex-start", marginTop: i ? 6 : 10, borderRadius: 10 }}
              >
                <span className="mm-chip__grade">leg {i + 1}</span>
                {legLabel(leg)}
              </button>
            ))}
            <div style={{ marginTop: 12, borderTop: "1px solid var(--card-border)", paddingTop: 10 }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                  Speed of leg {active + 1}
                  <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{legs[active]?.speed ?? 0} m/min</b>
                </span>
                <input
                  className="mm-range"
                  type="range"
                  min={-150}
                  max={150}
                  step={5}
                  value={legs[active]?.speed ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLeg(active, { speed: v, kind: v === 0 ? "rest" : "walk" });
                  }}
                />
              </label>
              <label style={{ display: "block", marginTop: 8 }}>
                <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                  Minutes
                  <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{legs[active]?.minutes ?? 1}</b>
                </span>
                <input
                  className="mm-range"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={legs[active]?.minutes ?? 1}
                  onChange={(e) => setLeg(active, { minutes: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Both graphs, one journey</p>
            <div className="mm-row"><span>Total time</span><b>{totalMin} min</b></div>
            <div className="mm-row"><span>Displacement (final distance)</span><b>{displacement.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Distance walked (both legs)</span><b>{distance.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Area under v–t graph</span><b>{area.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Average speed</span><b>{avgSpeed.toFixed(1)} m/min</b></div>
          </div>

          <p className="mm-note">
            The amber gradient on the top graph is the active leg's slope; the
            green rectangle below is the same leg's area. Change the speed and
            watch both change together — slope gives velocity, area gives
            displacement, and neither graph says anything the other does not.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MotionGraphs;
