import { useMemo, useState } from "react";

/**
 * Symmetry studio — Class 8.
 *
 * A line of symmetry is taught with a mirror and a rumour. Here the mirror is
 * real: the shape is reflected across the candidate line and the reflected
 * copy is drawn on top of the original. When the two outlines coincide, the
 * line is an axis — and the verdict says so because the *drawings agree*,
 * not because a counter said "1 of 4".
 *
 * The candidate line rotates through 180°, and the model counts the axes by
 * scanning that range for positions where the reflection error collapses.
 * Rotational order is measured the same way: rotate the shape until it lands
 * on itself, and count how many equal steps that takes. Every number on screen
 * is measured from the vertices, so a shape that has no axis (the
 * parallelogram) honestly reports zero.
 *
 * Circle: any line through the centre is an axis, so the scan finds the
 * candidate wherever it points and the count reads ∞.
 */

type Pt = [number, number];

const SHAPE_IDS = [
  "square",
  "rectangle",
  "equilateral",
  "isosceles",
  "rhombus",
  "parallelogram",
  "pentagon",
  "hexagon",
  "circle",
] as const;
type ShapeId = (typeof SHAPE_IDS)[number];

const SHAPES: Array<{
  id: ShapeId;
  label: string;
  hint: string;
  verts: Pt[];
}> = [
  { id: "square", label: "Square", hint: "4 axes · order 4", verts: [[1, 1], [-1, 1], [-1, -1], [1, -1]] },
  { id: "rectangle", label: "Rectangle", hint: "2 axes · order 2", verts: [[2, 1], [-2, 1], [-2, -1], [2, -1]] },
  {
    id: "equilateral",
    label: "Equilateral triangle",
    hint: "3 axes · order 3",
    verts: [
      [0, -1.15],
      [1, 0.58],
      [-1, 0.58],
    ],
  },
  {
    id: "isosceles",
    label: "Isosceles triangle",
    hint: "1 axis · order 1",
    verts: [
      [0, -1.3],
      [1.1, 0.7],
      [-0.6, 0.7],
    ],
  },
  { id: "rhombus", label: "Rhombus", hint: "2 axes · order 2", verts: [[1.7, 0], [0, 1], [-1.7, 0], [0, -1]] },
  {
    id: "parallelogram",
    label: "Parallelogram",
    hint: "0 axes · order 2",
    verts: [
      [1.4, 0.7],
      [-1.4, 0.7],
      [-0.8, -0.7],
      [2, -0.7],
    ],
  },
  {
    id: "pentagon",
    label: "Regular pentagon",
    hint: "5 axes · order 5",
    verts: regular(5, 1.15, -90),
  },
  {
    id: "hexagon",
    label: "Regular hexagon",
    hint: "6 axes · order 6",
    verts: regular(6, 1.15, 0),
  },
  { id: "circle", label: "Circle", hint: "every diameter is an axis", verts: regular(72, 1.1, 0) },
];

function regular(n: number, r: number, startDeg: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

/** Reflect a point across the line through the origin at angle θ. */
function reflect([x, y]: Pt, theta: number): Pt {
  const c = Math.cos(2 * theta);
  const s = Math.sin(2 * theta);
  return [x * c + y * s, x * s - y * c];
}

/** Rotate a point about the origin. */
function rotate([x, y]: Pt, deg: number): Pt {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c - y * s, x * s + y * c];
}

/** The worst distance from a transformed vertex to its nearest original. */
function mismatch(verts: Pt[], transform: (p: Pt) => Pt): number {
  let worst = 0;
  for (const v of verts) {
    const t = transform(v);
    let best = Infinity;
    for (const w of verts) {
      best = Math.min(best, Math.hypot(t[0] - w[0], t[1] - w[1]));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

const isAxis = (verts: Pt[], theta: number) => mismatch(verts, (p) => reflect(p, theta)) < 0.02;

/** Scan the 180° of candidate lines; also gives the axis count. */
function scanAxes(verts: Pt[]): { axes: number; sample: number[] } {
  const sample: number[] = [];
  let inRun = false;
  for (let d = 0; d < 180; d += 0.25) {
    const hit = isAxis(verts, (d * Math.PI) / 180);
    if (hit && !inRun) sample.push(d);
    inRun = hit;
  }
  /* θ and θ + 180° are the same line, so scanning [0°, 180°) already counts
     each axis exactly once — no wrap adjustment is needed. */
  return { axes: sample.length, sample };
}

/** Rotational order: the smallest positive angle that maps the shape to itself. */
function rotationOrder(verts: Pt[]): number {
  for (let n = 2; n <= 72; n += 1) {
    const step = 360 / n;
    if (mismatch(verts, (p) => rotate(p, step)) < 0.02) return n;
  }
  return 1;
}

/* Drawing scale: shapes live in a ±2.4 unit box, stage is 620×330. */
const S = 62;
const CX = 310;
const CY = 165;
const px = ([x, y]: Pt): [number, number] => [CX + x * S, CY - y * S];
const path = (verts: Pt[]) =>
  verts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + " Z";

export function SymmetryStudio() {
  const [shapeId, setShapeId] = useState<ShapeId>("square");
  const [thetaDeg, setThetaDeg] = useState(30);
  const shape = SHAPES.find((s) => s.id === shapeId) ?? SHAPES[0];
  const isCircle = shapeId === "circle";

  const { axes, sample } = useMemo(() => scanAxes(shape.verts), [shape]);
  const order = useMemo(() => rotationOrder(shape.verts), [shape]);

  const theta = (thetaDeg * Math.PI) / 180;
  /* The circle is the one shape with an answer the scan cannot sample: every
     line through its centre is an axis, so it is true analytically. */
  const aligned = isCircle || isAxis(shape.verts, theta);
  const error = mismatch(shape.verts, (p) => reflect(p, theta));

  /* The candidate line runs along (cos θ, sin θ) through the centre. Reflect
     points across it, not along it — reflecting the x-axis would draw a line
     at 2θ instead. */
  const [ax, ay] = px([-2.6 * Math.cos(theta), -2.6 * Math.sin(theta)]);
  const [bx, by] = px([2.6 * Math.cos(theta), 2.6 * Math.sin(theta)]);

  const verdict = isCircle
    ? "Every line through the centre of a circle is an axis of symmetry — the reflected half always lands on the other."
    : aligned
      ? "This line IS an axis of symmetry: the reflected copy lands exactly on the original."
      : `Not an axis — the reflected copy misses by ${error.toFixed(2)} units. Turn the line until the outlines coincide.`;

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Shape">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="mm-chip"
            aria-pressed={s.id === shapeId}
            onClick={() => setShapeId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg viewBox="0 0 620 330" role="img" aria-label={`${shape.label} with a candidate line of symmetry`}>
            {/* The candidate line, full width of the stage through the centre. */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--text-main)" strokeWidth={1.4} strokeDasharray="6 7" opacity={0.75} />
            <circle cx={CX} cy={CY} r={3} fill="var(--text-main)" opacity={0.7} />

            {/* Measured axes, revealed once found — the answer, drawn by the same scan. */}
            {!isCircle &&
              sample.map((d) => {
                const t = (d * Math.PI) / 180;
                const [x1, y1] = px([-2.4 * Math.cos(t), -2.4 * Math.sin(t)]);
                const [x2, y2] = px([2.4 * Math.cos(t), 2.4 * Math.sin(t)]);
                return (
                  <line
                    key={d}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--verify)"
                    strokeWidth={1}
                    opacity={0.5}
                  />
                );
              })}

            {/* The reflected copy, drawn under the original: where they agree
                the ink of the original covers it, which is the whole proof. */}
            <path d={path(shape.verts.map((p) => reflect(p, theta)))} fill="none" stroke="var(--signal)" strokeWidth={2.4} strokeLinejoin="round" opacity={0.9} />
            <path d={path(shape.verts.map(px))} fill="color-mix(in srgb, var(--text-main) 8%, transparent)" stroke="var(--text-main)" strokeWidth={2} strokeLinejoin="round" />

            <text x={14} y={22} fontSize={11} fill="var(--text-dim)">
              dashed = candidate line · amber = its reflection · green = a true axis
            </text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">Candidate line</p>
            <label style={{ display: "block", marginTop: 8 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                Angle <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{thetaDeg}°</b>
              </span>
              <input className="mm-range" type="range" min={0} max={180} step={0.5} value={thetaDeg} onChange={(e) => setThetaDeg(Number(e.target.value))} />
            </label>
            <div className="mm-verdict" data-on={aligned || isCircle} style={{ marginTop: 10 }}>
              {verdict}
            </div>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Measured, not memorised</p>
            <div className="mm-row"><span>Axes of symmetry</span><b>{isCircle ? "∞" : axes}</b></div>
            <div className="mm-row"><span>Rotational order</span><b>{isCircle ? "∞" : order}</b></div>
            <div className="mm-row"><span>Smallest rotation that maps it</span><b>{isCircle || order === 1 ? "—" : `${(360 / order).toFixed(0)}°`}</b></div>
            <div className="mm-row"><span>{shape.hint}</span><b /></div>
          </div>

          <p className="mm-note">
            The counts come from scanning every candidate line and every rotation
            angle: an axis is wherever the reflected copy lands on the original
            with no gap. The parallelogram is the trap — it turns onto itself
            after 180°, but no mirror line ever makes the halves match.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SymmetryStudio;
