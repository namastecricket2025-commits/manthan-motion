import { useMemo, useState, type ReactElement } from "react";

/**
 * Vectors & planes in 3D — Class 12.
 *
 * Two vectors and the plane they span, drawn in an isometric projection the
 * student can turn with a slider. Everything on the plate is computed from the
 * six component sliders: the parallelogram, the cross-product arrow (which is
 * the plane's normal by construction), the dot product, the angle between the
 * vectors, and the plane's own equation.
 *
 * The drawing measures everything it is about to draw at unit scale and then
 * scales and centres the whole scene to the plate, so a three-unit vector
 * uses the same amount of paper as an eight-unit one, and the sheet never
 * runs off the edge while the vectors shrink to the middle of a large canvas.
 * Labels ride out along their own arrow and are then pulled apart if any two
 * would collide — a fixed offset stacked a's coordinates on b's arrow as soon
 * as the view turned.
 *
 * The one thing worth discovering here: when the cross product collapses to
 * the zero vector the parallelogram has no area, the vectors are parallel,
 * and *there is no plane* — the model reports that instead of drawing a
 * phantom one. "a × b = 0 means no normal" is a sentence that never lands
 * from a board; it lands when the plane you were looking at disappears.
 */

type Vec = [number, number, number];

const W = 640;
const H = 400;
const PITCH = (30 * Math.PI) / 180;

/** Screen offset of a point from the origin at unit scale, before fitting. */
function unitOffset(v: Vec, yaw: number): [number, number] {
  const x1 = v[0] * Math.cos(yaw) - v[2] * Math.sin(yaw);
  const z1 = v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw);
  return [x1, -v[1] * Math.cos(PITCH) + z1 * Math.sin(PITCH) * 0.5];
}

/** Two in-plane directions and the sheet's corners: a and (a × n). */
function planeCorners(a: Vec, n: Vec): Vec[] {
  const d2: Vec = [
    n[1] * a[2] - n[2] * a[1],
    n[2] * a[0] - n[0] * a[2],
    n[0] * a[1] - n[1] * a[0],
  ];
  const m1 = Math.hypot(...a) || 1;
  const m2 = Math.hypot(...d2) || 1;
  const R = 3.4;
  return (
    [
      [-R, -R],
      [R, -R],
      [R, R],
      [-R, R],
    ] as Array<[number, number]>
  ).map(([s, t]): Vec => [
    (a[0] / m1) * s + (d2[0] / m2) * t,
    (a[1] / m1) * s + (d2[1] / m2) * t,
    (a[2] / m1) * s + (d2[2] / m2) * t,
  ]);
}

type Spot = { key: string; x: number; y: number; ux: number };

export function VectorsPlanes() {
  const [a, setA] = useState<Vec>([3, 2, 1]);
  const [b, setB] = useState<Vec>([-1, 3, 2]);
  const [view, setView] = useState(35); /* azimuth in degrees */

  const model = useMemo(() => {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross: Vec = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const magA = Math.hypot(...a);
    const magB = Math.hypot(...b);
    const magC = Math.hypot(...cross);
    const angle = magA && magB ? (Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB)))) * 180) / Math.PI : 0;
    const parallelogram = magC;
    const coplanar = magC < 1e-6;
    const equation = coplanar
      ? null
      : `${cross[0].toFixed(0)}x ${cross[1] < 0 ? "−" : "+"} ${Math.abs(cross[1]).toFixed(0)}y ${cross[2] < 0 ? "−" : "+"} ${Math.abs(cross[2]).toFixed(0)}z = 0`;
    return { dot, cross, magA, magB, magC, angle, parallelogram, coplanar, equation };
  }, [a, b]);

  /* The normal drawn at a fixed 3.2 units, so the arrow always reads as one
     whatever the size of the cross product actually is. */
  const nTip = useMemo<Vec | null>(() => {
    if (model.coplanar || model.magC < 1e-6) return null;
    const k = 3.2 / model.magC;
    return [model.cross[0] * k, model.cross[1] * k, model.cross[2] * k];
  }, [model]);

  /* Measure the whole scene at unit scale, then scale and centre it: this is
     what stops the drawing floating in the middle of the plate. */
  const fit = useMemo(() => {
    const yaw = (view * Math.PI) / 180;
    const points: Vec[] = [
      [4.6, 0, 0],
      [0, 4.6, 0],
      [0, 0, 4.6],
      a,
      b,
      [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    ];
    if (nTip) points.push(nTip);
    if (!model.coplanar) points.push(...planeCorners(a, model.cross));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const [x, y] = unitOffset(p, yaw);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);
    /* 104 / 96 px is the room the labels need outside the geometry. */
    const scale = Math.max(16, Math.min((W - 104) / spanX, (H - 96) / spanY, 56));
    return {
      yaw,
      scale,
      cx: W / 2 - ((minX + maxX) / 2) * scale,
      cy: H / 2 - ((minY + maxY) / 2) * scale,
    };
  }, [a, b, view, nTip, model.coplanar, model.cross]);

  const project = (v: Vec): [number, number] => {
    const [ox, oy] = unitOffset(v, fit.yaw);
    return [fit.cx + ox * fit.scale, fit.cy + oy * fit.scale];
  };

  const P = (v: Vec, k = 1): [number, number] => project([v[0] * k, v[1] * k, v[2] * k]);
  const line = (from: Vec, to: Vec, stroke: string, width = 2, dash?: string) => {
    const [x1, y1] = P(from);
    const [x2, y2] = P(to);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />;
  };

  /* The parallelogram spans s·a + t·b for s, t in [0, 1]. */
  const parallelogram = useMemo(() => {
    const pts: string[] = [];
    const N = 12;
    for (let i = 0; i <= N; i += 1) pts.push(P([a[0] * (i / N), a[1] * (i / N), a[2] * (i / N)]).join(" "));
    for (let i = 1; i <= N; i += 1)
      pts.push(P([a[0] + (b[0] * i) / N, a[1] + (b[1] * i) / N, a[2] + (b[2] * i) / N]).join(" "));
    for (let i = N - 1; i >= 0; i -= 1) pts.push(P([(a[0] * i) / N + b[0], (a[1] * i) / N + b[1], (a[2] * i) / N + b[2]]).join(" "));
    for (let i = N - 1; i >= 1; i -= 1) pts.push(P([(b[0] * i) / N, (b[1] * i) / N, (b[2] * i) / N]).join(" "));
    return `M${pts.join(" L")} Z`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [a, b, view]);

  /* The plane through the origin with the same normal, drawn as a hatched
     sheet — it exists exactly when a × b does. */
  const planeQuad = useMemo(() => {
    if (model.coplanar) return null;
    const pts = planeCorners(a, model.cross).map((p) => P(p).join(" "));
    return `M${pts.join(" L")} Z`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [a, b, view, model.coplanar]);

  /* Labels: pushed out along each arrow's own screen direction, then pulled
     apart so no two of them can sit on top of each other. */
  const spots = useMemo<Spot[]>(() => {
    const place = (key: string, v: Vec): Spot => {
      const [x, y] = P(v);
      const [ox, oy] = P([0, 0, 0]);
      const dx = x - ox;
      const dy = y - oy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      return { key, x: x + ux * 15, y: y + (dy / len) * 15 + 5, ux };
    };
    const list: Spot[] = [
      place("a", a),
      place("b", b),
      place("sum", [a[0] + b[0], a[1] + b[1], a[2] + b[2]]),
    ];
    if (nTip) list.push(place("n", nTip));
    const minGap = 58;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const dx = list[j].x - list[i].x;
        const dy = list[j].y - list[i].y;
        const d = Math.hypot(dx, dy);
        if (d < 1e-3 || d >= minGap) continue;
        const push = (minGap - d) / 2;
        list[i].x -= (dx / d) * push;
        list[i].y -= (dy / d) * push;
        list[j].x += (dx / d) * push;
        list[j].y += (dy / d) * push;
      }
    }
    for (const spot of list) {
      spot.x = Math.max(14, Math.min(W - 14, spot.x));
      spot.y = Math.max(18, Math.min(H - 10, spot.y));
    }
    return list;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [a, b, view, nTip]);

  const spot = (key: string): Spot | undefined => spots.find((s) => s.key === key);

  const arrowHead = (v: Vec, color: string) => {
    const [x, y] = P(v);
    const [ox, oy] = P([0, 0, 0]);
    const angle = Math.atan2(y - oy, x - ox);
    const size = 8;
    const p1 = [x - size * Math.cos(angle - 0.4), y - size * Math.sin(angle - 0.4)];
    const p2 = [x - size * Math.cos(angle + 0.4), y - size * Math.sin(angle + 0.4)];
    return <polygon points={`${x},${y} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={color} />;
  };

  const label = (key: string, text: string, color: string) => {
    const s = spot(key);
    if (!s) return null;
    return (
      <text
        x={s.x}
        y={s.y}
        fontSize={12.5}
        fontWeight={700}
        fill={color}
        textAnchor={s.ux < -0.15 ? "end" : s.ux > 0.15 ? "start" : "middle"}
        paintOrder="stroke"
        stroke="var(--panel)"
        strokeWidth={3.5}
        strokeLinejoin="round"
      >
        {text}
      </text>
    );
  };

  /* Unit grid on the floor (z = 0 plane) for depth cues. */
  const grid: ReactElement[] = [];
  for (let i = -4; i <= 4; i += 1) {
    grid.push(<line key={`gx${i}`} {...xy(P([i, 0, -4]), P([i, 0, 4]))} stroke="var(--text-main)" strokeWidth={0.9} opacity={0.13} />);
    grid.push(<line key={`gz${i}`} {...xy(P([-4, 0, i]), P([4, 0, i]))} stroke="var(--text-main)" strokeWidth={0.9} opacity={0.13} />);
  }

  const setComponent = (which: "a" | "b", index: 0 | 1 | 2, value: number) => {
    const target = which === "a" ? a : b;
    const next: Vec = [...target] as Vec;
    next[index] = value;
    if (which === "a") setA(next);
    else setB(next);
  };

  return (
    <div className="mm-root">
      <div className="mm-grid">
        <div className="mm-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two vectors in 3D with their parallelogram and cross product">
            <defs>
              <pattern id="vp-plane" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                <line x1="0" y1="0" x2="0" y2="9" stroke="var(--verify)" strokeWidth="1.2" opacity="0.55" />
              </pattern>
            </defs>

            {grid}
            {/* The plane they span — a hatched sheet, gone when the vectors align. */}
            {planeQuad && (
              <>
                <path d={planeQuad} fill="var(--verify)" opacity={0.1} />
                <path
                  d={planeQuad}
                  fill="url(#vp-plane)"
                  opacity={0.55}
                  stroke="var(--verify)"
                  strokeWidth={1.3}
                  strokeDasharray="7 6"
                  strokeLinejoin="round"
                />
              </>
            )}
            {/* Parallelogram outline */}
            <path d={parallelogram} fill="var(--signal)" opacity={0.13} stroke="var(--signal)" strokeWidth={1.6} strokeLinejoin="round" />
            {/* Axes */}
            {(["x", "y", "z"] as const).map((axis, i) => {
              const tip: Vec = [0, 0, 0];
              tip[i] = 4.6;
              return (
                <g key={axis}>
                  {line([0, 0, 0], tip, "var(--text-main)", 1.3)}
                  {arrowHead(tip, "var(--text-main)")}
                  <text {...labelPos(P(tip))} fontSize={11} fontWeight={600} fill="var(--text-dim)"
                    paintOrder="stroke" stroke="var(--panel)" strokeWidth={3} strokeLinejoin="round">
                    {axis}
                  </text>
                </g>
              );
            })}
            {/* Vectors */}
            {line([0, 0, 0], a, "var(--text-main)", 2.6)}
            {arrowHead(a, "var(--text-main)")}
            {label("a", `a = (${a[0]}, ${a[1]}, ${a[2]})`, "var(--text-main)")}
            {line([0, 0, 0], b, "var(--signal)", 2.6)}
            {arrowHead(b, "var(--signal)")}
            {label("b", `b = (${b[0]}, ${b[1]}, ${b[2]})`, "var(--signal)")}
            {/* a + b diagonal */}
            {line([0, 0, 0], [a[0] + b[0], a[1] + b[1], a[2] + b[2]], "var(--text-dim)", 1.4, "5 5")}
            {label("sum", "a + b", "var(--text-dim)")}
            {/* The normal — the plane's own vector, scaled to fit. */}
            {nTip && (
              <>
                {line([0, 0, 0], nTip, "var(--verify)", 2.6)}
                {arrowHead(nTip, "var(--verify)")}
                {label("n", "a × b", "var(--verify)")}
              </>
            )}
            <text x={16} y={24} fontSize={11} fill="var(--text-dim)"
              paintOrder="stroke" stroke="var(--panel)" strokeWidth={4} strokeLinejoin="round">
              {model.coplanar
                ? "a × b = 0 — the vectors are parallel: no plane, no normal."
                : "hatched sheet = the plane · green arrow = a × b, its normal · gold = parallelogram · grid = 1 unit"}
            </text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">Vector a</p>
            {(["x", "y", "z"] as const).map((axis, i) => (
              <ComponentRow key={axis} label={axis} value={a[i]} set={(v) => setComponent("a", i as 0 | 1 | 2, v)} />
            ))}
          </div>
          <div className="mm-panel">
            <p className="mm-panel__title">Vector b</p>
            {(["x", "y", "z"] as const).map((axis, i) => (
              <ComponentRow key={axis} label={axis} value={b[i]} set={(v) => setComponent("b", i as 0 | 1 | 2, v)} />
            ))}
          </div>
          <div className="mm-panel">
            <p className="mm-panel__title">Measured</p>
            <div className="mm-row"><span>|a|</span><b>{model.magA.toFixed(2)}</b></div>
            <div className="mm-row"><span>|b|</span><b>{model.magB.toFixed(2)}</b></div>
            <div className="mm-row"><span>a · b</span><b>{model.dot.toFixed(2)}</b></div>
            <div className="mm-row"><span>Angle between</span><b>{model.angle.toFixed(1)}°</b></div>
            <div className="mm-row"><span>|a × b| = area</span><b>{model.magC.toFixed(2)}</b></div>
            <div className="mm-row"><span>Plane</span><b style={{ fontSize: 11 }}>{model.equation ?? "does not exist"}</b></div>
          </div>
          <label className="mm-panel" style={{ display: "block" }}>
            <span className="mm-panel__title">Turn the view</span>
            <input className="mm-range" type="range" min={0} max={360} step={1} value={view} onChange={(e) => setView(Number(e.target.value))} style={{ marginTop: 8 }} />
          </label>
          <p className="mm-note">
            The dot product measures agreement; the cross product measures the
            area they enclose and points perpendicular to both. Set b to a
            multiple of a — the parallelogram flattens to a line, the normal
            vanishes, and the plane goes with it.
          </p>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ label, value, set }: { label: string; value: number; set: (v: number) => void }) {
  return (
    <label style={{ display: "block", marginTop: 8 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
        {label} <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{value}</b>
      </span>
      <input className="mm-range" type="range" min={-4} max={4} step={1} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}

function xy(a: [number, number], b: [number, number]) {
  return { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
}

function labelPos(p: [number, number]) {
  return { x: p[0] + 6, y: p[1] - 6 };
}

export default VectorsPlanes;
