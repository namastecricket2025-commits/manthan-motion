import { useMemo, useState } from "react";

/**
 * Conic sections — Class 11.
 *
 * A cone, a cutting plane, and the eccentricity that decides which conic you
 * get. The plane's angle to the axis is the only control that matters: at 90°
 * the section is a circle, tilting it makes an ellipse, tilting it to the
 * generator's own angle gives a parabola, and steeper cuts the far nappe for a
 * hyperbola. The eccentricity e = cos β / cos α is computed from those two
 * angles and the curve beside the cone is *that* e, drawn as a real ellipse /
 * parabola / hyperbola with its focus and directrix.
 *
 * The cut is drawn on the cone as a shaded chord, so the section is something
 * the student watches being made, not a shape that appears in a second box.
 * The section itself is drawn with its own axes, foci and directrix, and the
 * parabola uses the standard y² = 4ax orientation so the focus and directrix
 * sit where the equation says they do.
 */

type Kind = "circle" | "ellipse" | "parabola" | "hyperbola";

const W = 640;
const H = 380;

/** e = cos β / cos α — β measured from the axis, α the semi-vertical angle. */
function classify(alphaDeg: number, betaDeg: number): { kind: Kind; e: number } {
  const e = Math.cos((betaDeg * Math.PI) / 180) / Math.cos((alphaDeg * Math.PI) / 180);
  if (Math.abs(betaDeg - 90) < 0.6) return { kind: "circle", e: 0 };
  if (Math.abs(e - 1) < 0.02) return { kind: "parabola", e: 1 };
  return { kind: e < 1 ? "ellipse" : "hyperbola", e };
}

const KIND_NOTE: Record<Kind, string> = {
  circle: "Plane ⟂ axis: every point of the section is equally far from the apex.",
  ellipse: "Plane cuts one nappe at a shallower angle than the generator: a closed curve, e < 1.",
  parabola: "Plane parallel to a generator: the curve never closes, e = 1 exactly.",
  hyperbola: "Plane steeper than the generator, cutting both nappes: two open branches, e > 1.",
};

const KIND_EQN: Record<Kind, string> = {
  circle: "x² + y² = r²",
  ellipse: "x²/a² + y²/b² = 1,  b² = a²(1 − e²)",
  parabola: "y² = 4ax",
  hyperbola: "x²/a² − y²/b² = 1,  b² = a²(e² − 1)",
};

type Pt = { x: number; y: number };

/** Where two segments cross, or null. Used to mark the cut on the cone. */
function crossing(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * sy - (b1.y - a1.y) * sx) / denom;
  const u = ((b1.x - a1.x) * ry - (b1.y - a1.y) * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * rx, y: a1.y + t * ry };
}

export function ConicSections() {
  const [alpha, setAlpha] = useState(26); /* semi-vertical angle of the cone */
  const [beta, setBeta] = useState(58); /* plane's angle to the axis */

  const { kind, e } = useMemo(() => classify(alpha, beta), [alpha, beta]);

  /* ---- Left plate: the double cone in section, with the cutting plane ---- */
  const apex: Pt = { x: 158, y: 190 };
  const arm = 146;
  const aRad = (alpha * Math.PI) / 180;
  const up: Pt = { x: apex.x + arm * Math.cos(aRad), y: apex.y - arm * Math.sin(aRad) };
  const down: Pt = { x: apex.x + arm * Math.cos(aRad), y: apex.y + arm * Math.sin(aRad) };
  const baseX = up.x;

  const delta = 100; /* distance of the cut from the apex along the axis */
  const cutX = apex.x + delta;
  const bRad = (beta * Math.PI) / 180;
  const plane = 154;
  const planeA: Pt = {
    x: cutX - plane * Math.sin(bRad),
    y: apex.y - plane * Math.cos(bRad),
  };
  const planeB: Pt = {
    x: cutX + plane * Math.sin(bRad),
    y: apex.y + plane * Math.cos(bRad),
  };

  const sectionPts = [
    crossing(apex, up, planeA, planeB),
    crossing(apex, down, planeA, planeB),
  ].filter((point): point is Pt => point !== null);

  /* One arc from the axis to the plane, so β is an angle on the drawing. */
  const betaAngle = Math.atan2(planeA.y - apex.y, planeA.x - apex.x);
  const betaR = 30;
  const betaArcEnd = {
    x: cutX + betaR * Math.cos(betaAngle),
    y: apex.y + betaR * Math.sin(betaAngle),
  };
  const betaLabel = {
    x: cutX + (betaR + 12) * Math.cos(betaAngle / 2),
    y: apex.y + (betaR + 12) * Math.sin(betaAngle / 2),
  };

  /* ---- Right plate: the section itself, drawn from e ---- */
  const sx = 492;
  const sy = 194;
  const aLen = 78;
  const plotTop = 64;
  const plotBottom = 344;

  /* A parabola in the standard y² = 4ax orientation, opening right. */
  const p = 30;
  const vertexX = sx - 32;
  const parabolaFocus = vertexX + p;
  const parabolaDirectrix = vertexX - p;
  const parabolaPath = useMemo(() => {
    const points: string[] = [];
    for (let y = -118; y <= 118; y += 3) {
      points.push(`${(vertexX + (y * y) / (4 * p)).toFixed(1)} ${(sy + y).toFixed(1)}`);
    }
    return `M${points.join(" L")}`;
  }, [sx, sy, vertexX, p]);

  const bLen = e < 1 ? aLen * Math.sqrt(Math.max(0.001, 1 - e * e)) : aLen * Math.sqrt(Math.max(0.001, e * e - 1));
  const focusC = e * aLen;
  const directrixD = e > 0.02 ? aLen / e : Infinity;

  /* The hyperbola is sampled y-first, then scaled to stay on the plate. */
  const hyperbola = useMemo(() => {
    if (kind !== "hyperbola") return null;
    const yMax = 112;
    const xAtMax = aLen * Math.sqrt(1 + (yMax / bLen) ** 2);
    const scale = Math.min(1, 128 / xAtMax);
    const branch = (sign: 1 | -1) => {
      const points: string[] = [];
      for (let y = -yMax; y <= yMax; y += 2) {
        const x = aLen * Math.sqrt(1 + (y / bLen) ** 2);
        points.push(`${(sx + sign * x * scale).toFixed(1)} ${(sy + y * scale).toFixed(1)}`);
      }
      return `M${points.join(" L")}`;
    };
    return { d: `${branch(-1)} ${branch(1)}`, scale };
  }, [kind, bLen, aLen, sx, sy]);

  const rows: Array<[string, string]> = [
    ["Cone semi-angle α", `${alpha.toFixed(1)}°`],
    ["Plane angle to axis β", `${beta.toFixed(1)}°`],
    ["e = cos β / cos α", kind === "circle" ? "0 (limit)" : e.toFixed(3)],
    ["Curve", kind],
  ];

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Standard cuts">
        {([
          ["circle", 90],
          ["ellipse", 58],
          ["parabola", alpha],
          ["hyperbola", 12],
        ] as Array<[string, number]>).map(([label, angle]) => (
          <button
            key={label}
            type="button"
            className="mm-chip"
            aria-pressed={label === kind}
            onClick={() => {
              if (label === "parabola") setBeta(alpha);
              else setBeta(angle);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A double cone cut by a plane, and the resulting conic">
            <defs>
              <clipPath id="conic-cone">
                <path d={`M${apex.x} ${apex.y} L${up.x} ${up.y} L${down.x} ${down.y} Z`} />
              </clipPath>
            </defs>

            {/* Plate labels */}
            <text x={22} y={26} fontSize={10.5} fontWeight={700} letterSpacing="0.1em" fill="var(--text-dim)">
              THE CUT
            </text>
            <text x={372} y={26} fontSize={10.5} fontWeight={700} letterSpacing="0.1em" fill="var(--text-dim)">
              THE SECTION
            </text>
            <line x1={358} y1={38} x2={358} y2={352} stroke="var(--text-main)" strokeWidth={1} opacity={0.1} />

            {/* The double cone: two shaded nappes with a base at the right. */}
            <path
              d={`M${apex.x} ${apex.y} L${up.x} ${up.y} L${baseX} ${apex.y} L${down.x} ${down.y} Z`}
              fill="color-mix(in srgb, var(--text-main) 4%, transparent)"
              stroke="var(--text-main)"
              strokeWidth={1.6}
              opacity={0.9}
            />
            <line x1={up.x} y1={up.y} x2={down.x} y2={down.y} stroke="var(--text-main)" strokeWidth={1.4} opacity={0.45} strokeDasharray="4 5" />

            {/* Axis and the α arc */}
            <line x1={apex.x - 22} y1={apex.y} x2={baseX + 22} y2={apex.y} stroke="var(--text-main)" strokeWidth={1} opacity={0.28} strokeDasharray="4 6" />
            <path
              d={`M ${apex.x + 40} ${apex.y} A 40 40 0 0 ${aRad > 0 ? 0 : 1} ${apex.x + 40 * Math.cos(aRad)} ${apex.y - 40 * Math.sin(aRad)}`}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth={1}
            />
            <text x={apex.x + 50} y={apex.y - 17} fontSize={10.5} fill="var(--text-dim)">α</text>

            {/* The cutting plane, and the chord where it actually cuts. */}
            <line x1={planeA.x} y1={planeA.y} x2={planeB.x} y2={planeB.y} stroke="var(--signal)" strokeWidth={1.6} opacity={0.65} strokeDasharray="6 5" />
            <g clipPath="url(#conic-cone)">
              <line x1={planeA.x} y1={planeA.y} x2={planeB.x} y2={planeB.y} stroke="var(--signal)" strokeWidth={9} opacity={0.2} />
              <line x1={planeA.x} y1={planeA.y} x2={planeB.x} y2={planeB.y} stroke="var(--signal)" strokeWidth={2.2} />
            </g>
            {sectionPts.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r={3.2} fill="var(--signal)" />
            ))}

            {/* β: the plane's angle to the axis, drawn at the cut. */}
            <path
              d={`M ${cutX + betaR} ${apex.y} A ${betaR} ${betaR} 0 0 ${betaAngle < 0 ? 0 : 1} ${betaArcEnd.x} ${betaArcEnd.y}`}
              fill="none"
              stroke="var(--signal)"
              strokeWidth={1.1}
            />
            <text x={betaLabel.x} y={betaLabel.y} fontSize={10.5} fontWeight={700} fill="var(--signal)">β</text>
            <text x={cutX + 8} y={apex.y + 20} fontSize={9.5} fill="var(--text-dim)">
              {beta.toFixed(0)}° to the axis
            </text>

            {/* Cone annotations */}
            <text x={apex.x - 26} y={apex.y + 18} fontSize={10.5} fill="var(--text-dim)">apex</text>
            <text x={up.x + 8} y={up.y + 4} fontSize={9.5} fill="var(--text-dim)">generator</text>
            <text x={baseX + 8} y={apex.y - 6} fontSize={9.5} fill="var(--text-dim)">base</text>
            <text x={apex.x + 18} y={up.y - 6} fontSize={9.5} fill="var(--text-dim)">upper nappe</text>
            <text x={apex.x + 18} y={down.y + 14} fontSize={9.5} fill="var(--text-dim)">lower nappe</text>

            {/* ---- the section ---- */}
            <text x={sx} y={36} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--text-main)">
              {kind.toUpperCase()} · e = {kind === "circle" ? "0" : e.toFixed(2)}
            </text>

            {/* Axes for the section */}
            <line x1={366} y1={sy} x2={628} y2={sy} stroke="var(--text-main)" strokeWidth={1} opacity={0.14} strokeDasharray="4 6" />
            <line x1={sx} y1={plotTop} x2={sx} y2={plotBottom} stroke="var(--text-main)" strokeWidth={1} opacity={0.1} strokeDasharray="4 6" />

            {kind === "circle" && (
              <>
                <circle cx={sx} cy={sy} r={aLen} fill="var(--verify)" opacity={0.07} stroke="var(--text-main)" strokeWidth={2.4} />
                <circle cx={sx} cy={sy} r={3} fill="var(--verify)" />
                <line x1={sx} y1={sy} x2={sx + aLen} y2={sy} stroke="var(--verify)" strokeWidth={1.4} />
                <text x={sx + aLen / 2} y={sy - 7} textAnchor="middle" fontSize={9.5} fill="var(--verify)">r</text>
                <text x={sx + 7} y={sy + 16} fontSize={9.5} fill="var(--text-dim)">centre</text>
              </>
            )}

            {kind === "ellipse" && (
              <>
                <ellipse cx={sx} cy={sy} rx={aLen} ry={bLen} fill="var(--verify)" opacity={0.06} stroke="var(--text-main)" strokeWidth={2.4} />
                <line x1={sx - aLen} y1={sy} x2={sx + aLen} y2={sy} stroke="var(--text-main)" strokeWidth={1} opacity={0.35} />
                <line x1={sx} y1={sy - bLen} x2={sx} y2={sy + bLen} stroke="var(--text-main)" strokeWidth={1} opacity={0.35} />
                <line x1={sx - aLen} y1={sy - 14} x2={sx - aLen} y2={sy + 14} stroke="var(--text-dim)" strokeWidth={1} opacity={0.7} />
                <line x1={sx + aLen} y1={sy - 14} x2={sx + aLen} y2={sy + 14} stroke="var(--text-dim)" strokeWidth={1} opacity={0.7} />
                <circle cx={sx - focusC} cy={sy} r={3.2} fill="var(--verify)" />
                <circle cx={sx + focusC} cy={sy} r={3.2} fill="var(--verify)" />
                <text x={sx + focusC + 7} y={sy - 7} fontSize={9.5} fill="var(--verify)">F</text>
                <text x={sx - focusC - 7} y={sy - 7} fontSize={9.5} textAnchor="end" fill="var(--verify)">F′</text>
                <line x1={sx + directrixD} y1={plotTop} x2={sx + directrixD} y2={plotBottom} stroke="var(--verify)" strokeWidth={1.2} strokeDasharray="5 6" opacity={0.7} />
                <line x1={sx - directrixD} y1={plotTop} x2={sx - directrixD} y2={plotBottom} stroke="var(--verify)" strokeWidth={1.2} strokeDasharray="5 6" opacity={0.35} />
                <text x={sx + directrixD - 6} y={plotTop + 12} textAnchor="end" fontSize={9.5} fill="var(--verify)">d</text>
                <text x={sx + aLen} y={sy - 18} textAnchor="middle" fontSize={9.5} fill="var(--text-dim)">a</text>
              </>
            )}

            {kind === "parabola" && (
              <>
                <path d={parabolaPath} fill="none" stroke="var(--text-main)" strokeWidth={2.4} strokeLinejoin="round" />
                <line x1={parabolaDirectrix} y1={plotTop} x2={parabolaDirectrix} y2={plotBottom} stroke="var(--verify)" strokeWidth={1.3} strokeDasharray="5 6" />
                <line x1={parabolaDirectrix} y1={sy} x2={sx + 116} y2={sy} stroke="var(--text-main)" strokeWidth={1} opacity={0.3} strokeDasharray="4 6" />
                <circle cx={parabolaFocus} cy={sy} r={3.2} fill="var(--verify)" />
                <circle cx={vertexX} cy={sy} r={2.6} fill="var(--text-main)" />
                <text x={parabolaFocus + 7} y={sy - 7} fontSize={9.5} fill="var(--verify)">focus</text>
                <text x={parabolaDirectrix - 6} y={plotTop + 12} textAnchor="end" fontSize={9.5} fill="var(--verify)">directrix</text>
                <text x={vertexX - 6} y={sy + 17} textAnchor="end" fontSize={9.5} fill="var(--text-dim)">vertex</text>
              </>
            )}

            {kind === "hyperbola" && hyperbola && (
              <>
                {/* Asymptotes first: they are the shape's frame. */}
                <line
                  x1={sx - 140}
                  y1={sy - (140 * bLen) / aLen}
                  x2={sx + 140}
                  y2={sy + (140 * bLen) / aLen}
                  stroke="var(--text-main)"
                  strokeWidth={1}
                  opacity={0.16}
                  strokeDasharray="5 6"
                />
                <line
                  x1={sx - 140}
                  y1={sy + (140 * bLen) / aLen}
                  x2={sx + 140}
                  y2={sy - (140 * bLen) / aLen}
                  stroke="var(--text-main)"
                  strokeWidth={1}
                  opacity={0.16}
                  strokeDasharray="5 6"
                />
                <path d={hyperbola.d} fill="none" stroke="var(--text-main)" strokeWidth={2.4} strokeLinejoin="round" />
                <circle cx={sx + focusC} cy={sy} r={3.2} fill="var(--verify)" />
                <circle cx={sx - focusC} cy={sy} r={3.2} fill="var(--verify)" />
                <text x={sx + focusC + 7} y={sy - 8} fontSize={9.5} fill="var(--verify)">F</text>
                <text x={sx - focusC - 7} y={sy - 8} textAnchor="end" fontSize={9.5} fill="var(--verify)">F′</text>
                <line x1={sx + directrixD} y1={plotTop} x2={sx + directrixD} y2={plotBottom} stroke="var(--verify)" strokeWidth={1.2} strokeDasharray="5 6" opacity={0.7} />
                <line x1={sx - directrixD} y1={plotTop} x2={sx - directrixD} y2={plotBottom} stroke="var(--verify)" strokeWidth={1.2} strokeDasharray="5 6" opacity={0.35} />
                <text x={sx + directrixD - 6} y={plotTop + 12} textAnchor="end" fontSize={9.5} fill="var(--verify)">d</text>
              </>
            )}

            <text x={366} y={366} fontSize={11} fill="var(--text-dim)">
              {KIND_EQN[kind]}
            </text>
            <text x={628} y={366} textAnchor="end" fontSize={10} fill="var(--text-dim)">
              {KIND_NOTE[kind].split(":")[0]}
            </text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">Cut</p>
            <label style={{ display: "block", marginTop: 8 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                Cone semi-angle α <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{alpha}°</b>
              </span>
              <input className="mm-range" type="range" min={14} max={42} step={0.5} value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} />
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                Plane angle to axis β <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{beta}°</b>
              </span>
              <input className="mm-range" type="range" min={4} max={90} step={0.5} value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
            </label>
            <div className="mm-verdict" data-on style={{ marginTop: 10 }}>
              {KIND_NOTE[kind]}
            </div>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Measured</p>
            {rows.map(([key, value]) => (
              <div className="mm-row" key={key}><span>{key}</span><b>{value}</b></div>
            ))}
            <div className="mm-row"><span>Standard equation</span><b style={{ fontSize: 11.5 }}>{KIND_EQN[kind]}</b></div>
          </div>

          <p className="mm-note">
            Push β to α exactly and the eccentricity hits 1: the curve stops
            closing and becomes a parabola. That single boundary is the whole
            difference between &quot;ellipse&quot; and &quot;hyperbola&quot; —
            the same cone, the same formula, one degree of tilt apart.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConicSections;
