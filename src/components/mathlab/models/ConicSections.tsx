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
 * Both halves come from the same two numbers, which is the point: the shape of
 * the section and the value of e are one fact seen twice.
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

export function ConicSections() {
  const [alpha, setAlpha] = useState(26); /* semi-vertical angle of the cone */
  const [beta, setBeta] = useState(58); /* plane's angle to the axis */

  const { kind, e } = useMemo(() => classify(alpha, beta), [alpha, beta]);

  /* ---- Left plate: the double cone in section, with the cutting plane ---- */
  const apexX = 190;
  const apexY = 190;
  const arm = 168;
  const aRad = (alpha * Math.PI) / 180;
  /* Cone drawn sideways: axis horizontal, nappes to the right. */
  const up = [apexX + arm * Math.cos(aRad), apexY - arm * Math.sin(aRad)];
  const down = [apexX + arm * Math.cos(aRad), apexY + arm * Math.sin(aRad)];

  /* The cutting plane: a line through a point on the axis at angle β. */
  const cutX = apexX + 108;
  const bRad = (beta * Math.PI) / 180;
  const plane = 150;
  const planeA: [number, number] = [cutX - plane * Math.sin(bRad), apexY - plane * Math.cos(bRad)];
  const planeB: [number, number] = [cutX + plane * Math.sin(bRad), apexY + plane * Math.cos(bRad)];

  /* ---- Right plate: the section itself, drawn from e ---- */
  const cx = 452;
  const cy = 190;
  const aLen = 74;
  const curve = useMemo(() => {
    const pts: string[] = [];
    if (kind === "circle") {
      for (let i = 0; i <= 72; i += 1) {
        const t = (i / 72) * Math.PI * 2;
        pts.push(`${(cx + aLen * Math.cos(t)).toFixed(1)} ${(cy + aLen * Math.sin(t)).toFixed(1)}`);
      }
      return `M${pts.join(" L")} Z`;
    }
    if (kind === "ellipse") {
      const bLen = aLen * Math.sqrt(Math.max(0.02, 1 - e * e));
      for (let i = 0; i <= 72; i += 1) {
        const t = (i / 72) * Math.PI * 2;
        pts.push(`${(cx + aLen * Math.cos(t)).toFixed(1)} ${(cy + bLen * Math.sin(t)).toFixed(1)}`);
      }
      return `M${pts.join(" L")} Z`;
    }
    if (kind === "parabola") {
      for (let x = -90; x <= 90; x += 2) {
        const y = (x * x) / (4 * (aLen / 2));
        pts.push(`${(cx + x).toFixed(1)} ${(cy - y + 96).toFixed(1)}`);
      }
      return `M${pts.join(" L")}`;
    }
    /* Hyperbola: x²/a² − y²/b² = 1, both branches. */
    const bLen = aLen * Math.sqrt(Math.max(0.02, e * e - 1));
    for (const sign of [1, -1]) {
      const branch: string[] = [];
      for (let y = -120; y <= 120; y += 3) {
        const x = aLen * Math.sqrt(1 + (y * y) / (bLen * bLen));
        branch.push(`${(cx + sign * x).toFixed(1)} ${(cy + y).toFixed(1)}`);
      }
      pts.push(`M${branch.join(" L")}`);
    }
    return pts.join(" ");
  }, [kind, e, cx, cy, aLen]);

  /* Focus and directrix live at c = ae (ellipse/hyperbola) or a (parabola). */
  const c = kind === "parabola" ? aLen / 2 : e * aLen;
  const focusX = kind === "circle" ? cx : cx + c;
  const directrix = kind === "circle" || kind === "parabola" ? cx + aLen : cx + aLen / Math.max(e, 0.01);

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
            {/* Axis */}
            <line x1={apexX - 30} y1={apexY} x2={apexX + arm + 20} y2={apexY} stroke="var(--text-main)" strokeWidth={1} opacity={0.25} strokeDasharray="4 6" />
            {/* The two nappes */}
            <line x1={apexX} y1={apexY} x2={up[0]} y2={up[1]} stroke="var(--text-main)" strokeWidth={2} strokeLinecap="round" />
            <line x1={apexX} y1={apexY} x2={down[0]} y2={down[1]} stroke="var(--text-main)" strokeWidth={2} strokeLinecap="round" />
            <line x1={up[0]} y1={up[1]} x2={down[0]} y2={down[1]} stroke="var(--text-main)" strokeWidth={1.4} opacity={0.4} strokeDasharray="5 5" />
            {/* The cutting plane */}
            <line x1={planeA[0]} y1={planeA[1]} x2={planeB[0]} y2={planeB[1]} stroke="var(--signal)" strokeWidth={2.6} strokeLinecap="round" />
            {/* Angle marks */}
            <path
              d={`M ${apexX + 42} ${apexY} A 42 42 0 0 ${aRad > 0 ? 0 : 1} ${apexX + 42 * Math.cos(aRad)} ${apexY - 42 * Math.sin(aRad)}`}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth={1}
            />
            <text x={apexX + 52} y={apexY - 20} fontSize={10.5} fill="var(--text-dim)">α</text>
            <text x={cutX + 14} y={apexY - 118} fontSize={10.5} fill="var(--signal)" fontWeight={700}>β</text>
            <text x={apexX - 26} y={apexY + 18} fontSize={11} fontWeight={700} fill="var(--text-dim)">apex</text>

            {/* The section */}
            <path d={curve} fill="none" stroke="var(--text-main)" strokeWidth={2.4} strokeLinejoin="round" />
            {kind !== "circle" && kind !== "parabola" && (
              <>
                <circle cx={focusX} cy={cy} r={3.4} fill="var(--verify)" />
                <line x1={directrix} y1={cy - 120} x2={directrix} y2={cy + 120} stroke="var(--verify)" strokeWidth={1.4} strokeDasharray="5 6" />
              </>
            )}
            {kind === "parabola" && (
              <>
                <circle cx={focusX} cy={cy + 96 - aLen / 2} r={3.4} fill="var(--verify)" />
                <line x1={cx} y1={cy - 40} x2={cx} y2={cy + 130} stroke="var(--verify)" strokeWidth={1.4} strokeDasharray="5 6" />
              </>
            )}
            {kind === "circle" && <circle cx={cx} cy={cy} r={3.4} fill="var(--verify)" />}
            <text x={directrix + 6} y={cy - 108} fontSize={10} fill="var(--verify)">directrix</text>
            <text x={focusX + 6} y={cy + (kind === "parabola" ? 108 : -8)} fontSize={10} fill="var(--verify)">focus</text>
            <text x={452} y={30} fontSize={11} fontWeight={700} fill="var(--text-dim)" textAnchor="middle">
              {kind.toUpperCase()} · e = {kind === "circle" ? "0" : e.toFixed(2)}
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
              <input className="mm-range" type="range" min={14} max={42} step={0.5} value={alpha} onChange={(ev) => setAlpha(Number(ev.target.value))} />
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                Plane angle to axis β <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{beta}°</b>
              </span>
              <input className="mm-range" type="range" min={4} max={90} step={0.5} value={beta} onChange={(ev) => setBeta(Number(ev.target.value))} />
            </label>
            <div className="mm-verdict" data-on style={{ marginTop: 10 }}>
              {KIND_NOTE[kind]}
            </div>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Measured</p>
            {rows.map(([k, v]) => (
              <div className="mm-row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
            <div className="mm-row"><span>Standard equation</span><b style={{ fontSize: 11.5 }}>{KIND_EQN[kind]}</b></div>
          </div>

          <p className="mm-note">
            Push β to α exactly and the eccentricity hits 1: the curve stops
            closing and becomes a parabola. That single boundary is the whole
            difference between "ellipse" and "hyperbola" — the same cone, the
            same formula, one degree of tilt apart.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConicSections;
