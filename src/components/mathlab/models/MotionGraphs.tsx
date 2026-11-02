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
 *
 * Both panels share one time axis and one set of vertical grid lines, and both
 * have numbered axes that expand to the journey's own range. A walk that never
 * goes backwards should not spend half its plate on an empty negative region.
 */

type Leg = { kind: "rest" | "walk"; speed: number; minutes: number };

const PRESETS: Array<{ id: string; label: string; legs: Leg[] }> = [
  { id: "school", label: "Walk to school", legs: [{ kind: "walk", speed: 80, minutes: 5 }, { kind: "rest", speed: 0, minutes: 2 }, { kind: "walk", speed: 100, minutes: 3 }] },
  { id: "there-back", label: "There and back", legs: [{ kind: "walk", speed: 90, minutes: 6 }, { kind: "rest", speed: 0, minutes: 4 }, { kind: "walk", speed: -90, minutes: 6 }] },
  { id: "late", label: "Late for the bus", legs: [{ kind: "walk", speed: 60, minutes: 4 }, { kind: "walk", speed: 140, minutes: 2 }, { kind: "rest", speed: 0, minutes: 1 }] },
];

const W = 700;
const H = 478;
const LEFT = 64;
const RIGHT = 676;
const D_TOP = 56;
const D_BOTTOM = 214;
const V_TOP = 292;
const V_BOTTOM = 424;

/** A round step (1, 2 or 5 × a power of ten) for an axis. */
function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const normal = raw / magnitude;
  const step = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
  return Math.max(1e-6, step * magnitude);
}

/** Values on an axis, including zero, that fall inside [lo, hi]. */
function axisTicks(lo: number, hi: number, count = 4) {
  const step = niceStep(hi - lo, count);
  const first = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= hi + step * 1e-6; value += step) {
    const clean = Math.abs(value) < step / 1000 ? 0 : value;
    ticks.push(Number(clean.toFixed(4)));
  }
  return ticks;
}

const tickText = (value: number, step: number) =>
  step < 1 ? value.toFixed(1) : `${Math.round(value)}`;

export function MotionGraphs() {
  const [presetId, setPresetId] = useState("school");
  const [legs, setLegs] = useState<Leg[]>(PRESETS[0].legs);
  const [active, setActive] = useState(0);

  const model = useMemo(() => {
    const totalMin = Math.max(1, legs.reduce((sum, leg) => sum + leg.minutes, 0));
    /* Distance accumulates: speed in m/min × minutes. Rest legs hold it flat. */
    const points: Array<{ t: number; d: number }> = [{ t: 0, d: 0 }];
    let d = 0;
    for (const leg of legs) {
      d += leg.speed * leg.minutes;
      points.push({ t: points[points.length - 1].t + leg.minutes, d });
    }

    const distanceList = points.map((point) => point.d);
    const speedList = legs.map((leg) => leg.speed);
    const dMaxData = Math.max(0, ...distanceList);
    const dMinData = Math.min(0, ...distanceList);
    const vMaxData = Math.max(0, ...speedList);
    const vMinData = Math.min(0, ...speedList);
    const dSpan = Math.max(1, dMaxData - dMinData);
    const vSpan = Math.max(1, vMaxData - vMinData);
    const dPad = dSpan * 0.08;
    const vPad = vSpan * 0.1;

    return {
      totalMin,
      points,
      dLo: dMinData < 0 ? dMinData - dPad : 0,
      dHi: dMaxData + dPad,
      vLo: vMinData < 0 ? vMinData - vPad : 0,
      vHi: vMaxData + vPad,
      dStep: niceStep(dMaxData - dMinData || 1, 4),
      vStep: niceStep(vMaxData - vMinData || 1, 4),
    };
  }, [legs]);

  const { totalMin, points, dLo, dHi, vLo, vHi, dStep, vStep } = model;

  const sx = (t: number) => LEFT + (t / totalMin) * (RIGHT - LEFT);
  const distY = (d: number) =>
    D_BOTTOM - ((d - dLo) / Math.max(1e-6, dHi - dLo)) * (D_BOTTOM - D_TOP);
  const velY = (v: number) =>
    V_BOTTOM - ((v - vLo) / Math.max(1e-6, vHi - vLo)) * (V_BOTTOM - V_TOP);

  const displacement = points[points.length - 1].d;
  const distance = legs.reduce((sum, leg) => sum + Math.abs(leg.speed * leg.minutes), 0);
  /* Area under the v–t graph, summed leg by leg — the same total as the walk. */
  const area = legs.reduce((sum, leg) => sum + leg.speed * leg.minutes, 0);
  const avgSpeed = distance / totalMin;
  const avgVelocity = displacement / totalMin;

  const timeTicks = axisTicks(0, totalMin, totalMin <= 10 ? totalMin : 5).filter(
    (tick) => tick <= totalMin + 1e-6,
  );
  if (timeTicks[timeTicks.length - 1] !== totalMin) timeTicks.push(totalMin);

  const dTicks = axisTicks(dLo, dHi, 4);
  const vTicks = axisTicks(vLo, vHi, 3);

  const legLabel = (leg: Leg) =>
    leg.kind === "rest"
      ? `rest ${leg.minutes} min`
      : `${leg.speed > 0 ? "walk" : "return"} ${Math.abs(leg.speed)} m/min × ${leg.minutes} min`;

  const legTimes = legs.map((_, index) => {
    const start = legs.slice(0, index).reduce((sum, leg) => sum + leg.minutes, 0);
    return { start, end: start + legs[index].minutes };
  });

  const setLeg = (index: number, patch: Partial<Leg>) => {
    setPresetId("");
    setLegs((current) =>
      current.map((leg, at) => (at === index ? { ...leg, ...patch } : leg)),
    );
  };

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Preset walks">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="mm-chip"
            aria-pressed={preset.id === presetId}
            onClick={() => {
              setPresetId(preset.id);
              setLegs(preset.legs);
              setActive(0);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Distance-time graph above, velocity-time graph below, sharing one time axis"
          >
            {/* ---- shared time grid ---- */}
            {timeTicks.map((tick) => (
              <line
                key={`time-${tick}`}
                x1={sx(tick)}
                y1={D_TOP}
                x2={sx(tick)}
                y2={V_BOTTOM}
                stroke="var(--text-main)"
                strokeWidth={1}
                opacity={tick === 0 || tick === totalMin ? 0.12 : 0.055}
              />
            ))}

            {/* ---- distance axis ---- */}
            <text x={LEFT} y={38} fontSize={10.5} fontWeight={700} letterSpacing="0.1em" fill="var(--text-dim)">
              DISTANCE · m
            </text>
            {dTicks.map((value) => (
              <line
                key={`dgrid-${value}`}
                x1={LEFT}
                x2={RIGHT}
                y1={distY(value)}
                y2={distY(value)}
                stroke="var(--text-main)"
                strokeWidth={1}
                opacity={value === 0 ? 0.2 : 0.06}
                strokeDasharray={value === 0 ? "4 6" : undefined}
              />
            ))}
            {dTicks.map((value) => (
              <text
                key={`dtick-${value}`}
                x={LEFT - 9}
                y={distY(value) + 3.5}
                textAnchor="end"
                fontSize={9.5}
                fill="var(--text-dim)"
                fontVariantNumeric="tabular-nums"
              >
                {tickText(value, dStep)}
              </text>
            ))}
            <line x1={LEFT} y1={D_TOP} x2={LEFT} y2={D_BOTTOM} stroke="var(--text-main)" strokeWidth={1} opacity={0.24} />
            <line x1={LEFT} y1={D_BOTTOM} x2={RIGHT} y2={D_BOTTOM} stroke="var(--text-main)" strokeWidth={1} opacity={0.12} />

            {/* Whole journey, then the active leg on top of it. */}
            <path
              d={points.map((point, index) => `${index ? "L" : "M"}${sx(point.t).toFixed(1)} ${distY(point.d).toFixed(1)}`).join(" ")}
              fill="none"
              stroke="var(--text-main)"
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            {(() => {
              const times = legTimes[active];
              const leg = legs[active];
              if (!leg || !times) return null;
              const d0 = points[active]?.d ?? 0;
              const d1 = points[active + 1]?.d ?? 0;
              return (
                <line
                  x1={sx(times.start)}
                  y1={distY(d0)}
                  x2={sx(times.end)}
                  y2={distY(d1)}
                  stroke="var(--signal)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })()}
            {points.map((point, index) => (
              <circle
                key={`point-${index}`}
                cx={sx(point.t)}
                cy={distY(point.d)}
                r={3}
                fill="var(--text-main)"
              />
            ))}

            {/* The active leg's slope triangle: rise over run, labelled. */}
            {(() => {
              const times = legTimes[active];
              const leg = legs[active];
              if (!leg || !times) return null;
              const d0 = points[active]?.d ?? 0;
              const d1 = points[active + 1]?.d ?? 0;
              const x0 = sx(times.start);
              const x1 = sx(times.end);
              const y0 = distY(d0);
              const y1 = distY(d1);
              if (leg.kind === "rest") {
                return (
                  <text x={(x0 + x1) / 2} y={y0 - 12} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--signal)">
                    slope 0 · at rest
                  </text>
                );
              }
              const wide = Math.abs(x1 - x0) > 54;
              const tall = Math.abs(y1 - y0) > 14;
              return (
                <g>
                  <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="var(--signal)" strokeWidth={1.3} strokeDasharray="3 4" />
                  <line x1={x1} y1={y0} x2={x1} y2={y1} stroke="var(--signal)" strokeWidth={1.3} strokeDasharray="3 4" />
                  {wide ? (
                    <text x={(x0 + x1) / 2} y={y0 + 15} textAnchor="middle" fontSize={9.5} fill="var(--signal)" opacity={0.8}>
                      Δt = {leg.minutes} min
                    </text>
                  ) : null}
                  {tall ? (
                    <text x={x1 + 7} y={(y0 + y1) / 2 + 3} fontSize={9.5} fill="var(--signal)" opacity={0.8}>
                      Δd = {leg.speed * leg.minutes} m
                    </text>
                  ) : null}
                  <text
                    x={(x0 + x1) / 2}
                    y={Math.min(y0, y1) - 9}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={700}
                    fill="var(--signal)"
                    paintOrder="stroke"
                    stroke="var(--panel)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  >
                    slope = {leg.speed} m/min
                  </text>
                </g>
              );
            })()}

            {/* ---- the hinge between the two readings ---- */}
            <text x={LEFT} y={D_BOTTOM + 28} fontSize={10} fill="var(--text-dim)">
              the slope of the line above ↑ is the level of the line below ↓
            </text>

            {/* ---- velocity axis ---- */}
            <text x={LEFT} y={V_TOP - 12} fontSize={10.5} fontWeight={700} letterSpacing="0.1em" fill="var(--text-dim)">
              VELOCITY · m/min
            </text>
            {vTicks.map((value) => (
              <line
                key={`vgrid-${value}`}
                x1={LEFT}
                x2={RIGHT}
                y1={velY(value)}
                y2={velY(value)}
                stroke="var(--text-main)"
                strokeWidth={1}
                opacity={value === 0 ? 0.2 : 0.06}
                strokeDasharray={value === 0 ? "4 6" : undefined}
              />
            ))}
            {vTicks.map((value) => (
              <text
                key={`vtick-${value}`}
                x={LEFT - 9}
                y={velY(value) + 3.5}
                textAnchor="end"
                fontSize={9.5}
                fill="var(--text-dim)"
                fontVariantNumeric="tabular-nums"
              >
                {tickText(value, vStep)}
              </text>
            ))}
            <line x1={LEFT} y1={V_TOP} x2={LEFT} y2={V_BOTTOM} stroke="var(--text-main)" strokeWidth={1} opacity={0.24} />

            {/* Step graph; one horizontal level per leg. */}
            <path
              d={(() => {
                let t = 0;
                const parts: string[] = [];
                for (let index = 0; index < legs.length; index += 1) {
                  const leg = legs[index];
                  const y = velY(leg.speed);
                  parts.push(`${index ? "L" : "M"}${sx(t).toFixed(1)} ${y.toFixed(1)}`);
                  parts.push(`L${sx(t + leg.minutes).toFixed(1)} ${y.toFixed(1)}`);
                  t += leg.minutes;
                }
                return parts.join(" ");
              })()}
              fill="none"
              stroke="var(--text-main)"
              strokeWidth={2.1}
              strokeLinejoin="round"
            />

            {/* The signed area of the active leg *is* its displacement. */}
            {(() => {
              const times = legTimes[active];
              const leg = legs[active];
              if (!leg || !times) return null;
              const y0 = velY(0);
              const y1 = velY(leg.speed);
              const x0 = sx(times.start);
              const x1 = sx(times.end);
              const signed = leg.speed * leg.minutes;
              return (
                <g>
                  <rect
                    x={x0}
                    y={Math.min(y0, y1)}
                    width={x1 - x0}
                    height={Math.abs(y1 - y0)}
                    fill="var(--verify)"
                    opacity={0.15}
                    stroke="var(--verify)"
                    strokeWidth={1}
                    strokeDasharray="4 5"
                  />
                  <line
                    x1={x0}
                    y1={y1}
                    x2={x1}
                    y2={y1}
                    stroke="var(--signal)"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  {x1 - x0 > 54 ? (
                    <text
                      x={(x0 + x1) / 2}
                      y={(y0 + y1) / 2 + 3}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill="var(--verify)"
                      paintOrder="stroke"
                      stroke="var(--panel)"
                      strokeWidth={3}
                    >
                      area = {signed > 0 ? "+" : ""}{signed} m
                    </text>
                  ) : null}
                </g>
              );
            })()}

            {legs.map((leg, index) => (
              <text
                key={`level-${index}`}
                x={sx(legTimes[index].start + leg.minutes / 2)}
                y={velY(leg.speed) - 8}
                fontSize={10}
                textAnchor="middle"
                fill={index === active ? "var(--signal)" : "var(--text-dim)"}
                fontWeight={index === active ? 700 : 400}
              >
                {leg.speed === 0 ? "0" : `${leg.speed > 0 ? "+" : ""}${leg.speed}`}
              </text>
            ))}

            {/* ---- shared time axis ---- */}
            <line x1={LEFT} y1={V_BOTTOM} x2={RIGHT} y2={V_BOTTOM} stroke="var(--text-main)" strokeWidth={1} opacity={0.3} />
            {timeTicks.map((tick) => (
              <g key={`tlabel-${tick}`}>
                <line x1={sx(tick)} y1={V_BOTTOM} x2={sx(tick)} y2={V_BOTTOM + 4} stroke="var(--text-main)" strokeWidth={1} opacity={0.3} />
                <text x={sx(tick)} y={V_BOTTOM + 17} textAnchor="middle" fontSize={9.5} fill="var(--text-dim)" fontVariantNumeric="tabular-nums">
                  {tick}
                </text>
              </g>
            ))}
            <text x={RIGHT} y={V_BOTTOM + 35} textAnchor="end" fontSize={9.5} fill="var(--text-dim)">
              time · min
            </text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">The walk</p>
            {legs.map((leg, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActive(index)}
                className="mm-chip"
                aria-pressed={index === active}
                style={{ width: "100%", justifyContent: "flex-start", marginTop: index ? 6 : 10, borderRadius: 10 }}
              >
                <span className="mm-chip__grade">leg {index + 1}</span>
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
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setLeg(active, { speed: value, kind: value === 0 ? "rest" : "walk" });
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
                  onChange={(event) => setLeg(active, { minutes: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Both graphs, one journey</p>
            <div className="mm-row"><span>Total time</span><b>{totalMin} min</b></div>
            <div className="mm-row"><span>Displacement (final position)</span><b>{displacement.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Distance walked</span><b>{distance.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Area under v–t</span><b>{area.toFixed(0)} m</b></div>
            <div className="mm-row"><span>Average speed</span><b>{avgSpeed.toFixed(1)} m/min</b></div>
            <div className="mm-row"><span>Average velocity</span><b>{avgVelocity.toFixed(1)} m/min</b></div>
          </div>

          <p className="mm-note">
            The amber gradient on the top graph is the active leg&apos;s slope;
            the green rectangle below is the same leg&apos;s area. Change the
            speed and watch both change together — slope gives velocity, area
            gives displacement, and neither graph says anything the other does
            not.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MotionGraphs;
