import { useSpringTransition } from "@/lib/motion";
import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { ConstructionWorkbench } from "@/components/mathlab/ConstructionWorkbench";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * The construction bench.
 *
 * Every other view in the Math Lab answers a question. This one refuses to:
 * it hands over a figure built from constraints and lets the student try to
 * break it. The numbers under the drawing are measured from the points on
 * screen on every frame, so when a value does not move it is because the
 * geometry says it cannot — not because it was printed there.
 *
 * Three figures, each one the smallest honest statement of its theorem:
 *
 *   midpoint    two midpoints, one segment, always parallel and half.
 *   semicircle  a point on an arc, the angle it subtends, always a right angle.
 *   cyclic      four points on one circle, opposite angles, always 180°.
 *
 * Dashed lines are *given*: the diameter, the sides. Solid ink is *derived*:
 * the segment the theorem is about. The distinction is the point — the
 * dashed line is what you may move, the solid one is what the moving proves.
 *
 * Dragging is pointer-captured on the handle and clamped to the figure, so a
 * fast drag cannot throw a vertex off the plate. Every handle is also a
 * keyboard control (arrow keys, Shift for a larger step), because a theorem
 * you can only test with a mouse is a theorem half the class cannot test.
 */

const W = 640;
const H = 420;
const MARGIN = 64;

type Pt = { x: number; y: number };
type Scene = "midpoint" | "semicircle" | "cyclic" | "construct";
type DragTarget =
  | { kind: "vertex"; index: 0 | 1 | 2 }
  | { kind: "arc" }
  | { kind: "quad"; index: number };

const SCENES: Array<{
  id: Scene;
  label: string;
  title: string;
  hint: string;
  invariant: string;
}> = [
  {
    id: "midpoint",
    label: "Midpoint",
    title: "The midpoint theorem",
    hint: "Drag A, B or C",
    invariant:
      "The segment joining two midpoints is parallel to the third side, and exactly half of it. Move any vertex; both statements stay exact.",
  },
  {
    id: "semicircle",
    label: "Semicircle",
    title: "Angle in a semicircle",
    hint: "Drag P around the arc",
    invariant:
      "An angle in a semicircle is a right angle. P can go anywhere on the arc — only the two ends of the diameter are excluded, where the angle collapses.",
  },
  {
    id: "cyclic",
    label: "Cyclic",
    title: "Cyclic quadrilateral",
    hint: "Drag any vertex along its arc",
    invariant:
      "Opposite angles of a cyclic quadrilateral add to 180°. It holds for any four points on one circle, in any order.",
  },
  {
    id: "construct",
    label: "Construct",
    title: "Compass and straightedge",
    hint: "Build the figure, then justify it",
    invariant:
      "A construction is marked on the figure and on the reason. Draw the arcs, join the points they create, and check the result against the givens.",
  },
];

/* Geometry ------------------------------------------------------------ */

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** The angle at `v`, between the rays to `a` and `b`, in degrees. */
function angleAt(v: Pt, a: Pt, b: Pt) {
  const u = { x: a.x - v.x, y: a.y - v.y };
  const w = { x: b.x - v.x, y: b.y - v.y };
  const denominator = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
  if (!denominator) return 0;
  const cosine = clamp((u.x * w.x + u.y * w.y) / denominator, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** An arc of radius `r` at `v`, sweeping the short way from ray `a` to ray `b`. */
function angleArc(v: Pt, a: Pt, b: Pt, r: number) {
  const start = Math.atan2(a.y - v.y, a.x - v.x);
  let delta = Math.atan2(b.y - v.y, b.x - v.x) - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const p0 = { x: v.x + r * Math.cos(start), y: v.y + r * Math.sin(start) };
  const p1 = {
    x: v.x + r * Math.cos(start + delta),
    y: v.y + r * Math.sin(start + delta),
  };
  const sweep = delta > 0 ? 1 : 0;
  const large = Math.abs(delta) > Math.PI ? 1 : 0;
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
}

/** Screen-space unit perpendicular to a→b. */
function normal(a: Pt, b: Pt) {
  const length = dist(a, b) || 1;
  return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
}

/** A tick across a segment's midpoint — the "these halves are equal" mark. */
function tick(a: Pt, b: Pt, size = 7) {
  const p = mid(a, b);
  const n = normal(a, b);
  return { x1: p.x - n.x * size, y1: p.y - n.y * size, x2: p.x + n.x * size, y2: p.y + n.y * size };
}

const O = { x: W / 2, y: H / 2 + 8 };
const R = 146;
const pointOn = (cx: number, cy: number, radius: number, degrees: number): Pt => {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
};

/* The quadrants the four cyclic vertices live in. Each is a slot, so a drag
   can reorder the angles inside a figure but never across it: no crossing
   sides, no self-intersecting quadrilateral, no degenerate vertex. */
const QUAD_SLOTS: Array<[number, number]> = [
  [192, 252],
  [282, 342],
  [8, 68],
  [100, 160],
];
const QUAD_START = [216, 306, 36, 126];

const INK = "var(--text-main)";
const line = (alpha: number) =>
  `color-mix(in srgb, var(--text-main) ${Math.round(alpha * 100)}%, transparent)`;

/* The bench ----------------------------------------------------------- */

export function ConstructionBench() {
  const transition = useSpringTransition();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const [scene, setScene] = useState<Scene>("midpoint");
  const [touched, setTouched] = useState(false);

  const [triangle, setTriangle] = useState<[Pt, Pt, Pt]>([
    { x: 170, y: 326 },
    { x: 508, y: 318 },
    { x: 336, y: 96 },
  ]);
  const [arcAngle, setArcAngle] = useState(58);
  const [quadAngles, setQuadAngles] = useState<number[]>(QUAD_START);

  /* Pointer → viewBox. The SVG is laid out at exactly this aspect ratio, so a
     rect-relative fraction is already the viewBox fraction; no matrix work and
     no layout read beyond the rect itself. */
  const localPoint = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: ((clientX - box.left) / box.width) * W,
      y: ((clientY - box.top) / box.height) * H,
    };
  };

  const applyDrag = (target: DragTarget, point: Pt) => {
    if (target.kind === "vertex") {
      const next: Pt = {
        x: clamp(point.x, MARGIN, W - MARGIN),
        y: clamp(point.y, MARGIN, H - MARGIN),
      };
      setTriangle((current) => {
        const copy: [Pt, Pt, Pt] = [...current] as [Pt, Pt, Pt];
        copy[target.index] = next;
        return copy;
      });
      return;
    }

    if (target.kind === "arc") {
      const degrees = (Math.atan2(point.y - O.y, point.x - O.x) * 180) / Math.PI;
      /* The two ends of the diameter are the degenerate case: the angle there
         is 0° or 180°, which is true but teaches nothing. The point stops
         just short of them instead. */
      if (Math.abs(degrees) < 8 || Math.abs(degrees) > 172) return;
      setArcAngle(degrees);
      return;
    }

    const [low, high] = QUAD_SLOTS[target.index];
    const raw = (Math.atan2(point.y - O.y, point.x - O.x) * 180 + 360) % 360;
    const next = clamp(raw, low, high);
    setQuadAngles((current) => {
      const copy = [...current];
      copy[target.index] = next;
      return copy;
    });
  };

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const point = localPoint(event.clientX, event.clientY);
    if (point) applyDrag(dragRef.current, point);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const startDrag = (event: PointerEvent<SVGElement>, target: DragTarget) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = target;
    setTouched(true);
    const point = localPoint(event.clientX, event.clientY);
    if (point) applyDrag(target, point);
  };

  /* One keyboard step per handle. Vertex handles move in the plane; the arc
     and cyclic handles rotate, which is the only move their constraint allows. */
  const nudge = (event: KeyboardEvent<SVGElement>, target: DragTarget) => {
    const step = event.shiftKey ? 18 : 6;
    let handled = true;
    if (target.kind === "vertex") {
      const delta = { x: 0, y: 0 };
      if (event.key === "ArrowLeft") delta.x = -step;
      else if (event.key === "ArrowRight") delta.x = step;
      else if (event.key === "ArrowUp") delta.y = -step;
      else if (event.key === "ArrowDown") delta.y = step;
      else handled = false;
      if (handled) {
        const current = triangle[target.index];
        applyDrag(target, { x: current.x + delta.x, y: current.y + delta.y });
      }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (target.kind === "arc") {
        setArcAngle((current) => {
          const next = current + direction * 4;
          if (next > 172 || next < -172) return current;
          return next;
        });
      } else {
        const [low, high] = QUAD_SLOTS[target.index];
        setQuadAngles((current) =>
          current.map((angle, index) =>
            index === target.index ? clamp(angle + direction * 4, low, high) : angle,
          ),
        );
      }
      setTouched(true);
    } else {
      handled = false;
    }
    if (handled) event.preventDefault();
  };

  const reset = () => {
    if (scene === "midpoint") {
      setTriangle([
        { x: 170, y: 326 },
        { x: 508, y: 318 },
        { x: 336, y: 96 },
      ]);
    } else if (scene === "semicircle") {
      setArcAngle(58);
    } else {
      setQuadAngles(QUAD_START);
    }
    setTouched(false);
  };

  const active = SCENES.find((entry) => entry.id === scene) ?? SCENES[0];

  return (
    <div className="cbench">
      <header className="cbench-head">
        <div className="min-w-0">
          <p className="mathlab-card__kicker">Construction bench</p>
          <h2 className="mathlab-card__title">Drag the figure, not the proof</h2>
          <p className="cbench-sub">
            Every length and angle below is measured from the point you are
            holding — nothing is printed in advance. The theorem has to survive
            your hand.
          </p>
        </div>
        <div className="cbench-tabs" role="tablist" aria-label="Construction figures">
          {SCENES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === scene}
              aria-pressed={entry.id === scene}
              className="cbench-tab"
              onClick={() => {
                setScene(entry.id);
                setTouched(false);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      {scene === "construct" ? (
        <ConstructionWorkbench />
      ) : (
      <div className="cbench-body">
        <div className="cbench-stage">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`${active.title}. ${active.hint}.`}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
          >
            <defs>
              <pattern id="cbench-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke={line(0.07)}
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#cbench-grid)" />

            {scene === "midpoint" ? (
              <Midpoint
                points={triangle}
                onStart={startDrag}
                onNudge={nudge}
              />
            ) : scene === "semicircle" ? (
              <Semicircle angle={arcAngle} onStart={startDrag} onNudge={nudge} />
            ) : (
              <Cyclic
                angles={quadAngles}
                onStart={startDrag}
                onNudge={nudge}
              />
            )}
          </svg>

          <motion.div
            className="cbench-float"
            initial={false}
            animate={{ opacity: touched ? 0 : 1 }}
            transition={transition}
            aria-hidden
          >
            {active.hint}
          </motion.div>

          {scene !== "construct" ? (
            <button type="button" className="cbench-reset" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          ) : null}
        </div>

        <aside className="cbench-panel">
          <div>
            <p className="cbench-label">{active.label}</p>
            <p className="cbench-title">{active.title}</p>
          </div>

          <dl className="cbench-measures">
            {scene === "midpoint" ? (
              <MidpointReadout points={triangle} />
            ) : scene === "semicircle" ? (
              <SemicircleReadout angle={arcAngle} />
            ) : (
              <CyclicReadout angles={quadAngles} />
            )}
          </dl>

          <p className="cbench-invariant">{active.invariant}</p>
        </aside>
      </div>
      )}
    </div>
  );
}

/* Figures ------------------------------------------------------------- */

type HandleProps = {
  point: Pt;
  label: string;
  onStart: (event: PointerEvent<SVGElement>, target: DragTarget) => void;
  onNudge: (event: KeyboardEvent<SVGElement>, target: DragTarget) => void;
  target: DragTarget;
  /** The figure already prints this point's letter outside the arc. */
  bare?: boolean;
};

/** A draggable vertex: a filled punch-hole in the figure, with a wide invisible
 *  hit ring so it can be caught without precision. */
function Handle({ point, label, onStart, onNudge, target, bare }: HandleProps) {
  return (
    <g
      className="cbench-handle"
      tabIndex={0}
      role="button"
      aria-label={`Point ${label}`}
      onPointerDown={(event) => onStart(event, target)}
      onKeyDown={(event) => onNudge(event, target)}
    >
      <circle cx={point.x} cy={point.y} r={20} fill="transparent" />
      <circle
        className="cbench-grab"
        cx={point.x}
        cy={point.y}
        r={6.5}
        fill={INK}
        stroke="var(--card)"
        strokeWidth={2}
      />
      {bare ? null : (
        <text
          x={point.x + 12}
          y={point.y - 11}
          fontSize="12.5"
          fontWeight="600"
          fill={INK}
          style={{ userSelect: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Midpoint({
  points,
  onStart,
  onNudge,
}: {
  points: [Pt, Pt, Pt];
  onStart: HandleProps["onStart"];
  onNudge: HandleProps["onNudge"];
}) {
  const [a, b, c] = points;
  const d = mid(a, b);
  const e = mid(a, c);

  return (
    <g>
      <path
        d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} Z`}
        fill="none"
        stroke={line(0.24)}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path
        d={`M ${d.x} ${d.y} L ${e.x} ${e.y}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      {[tick(a, d), tick(d, b), tick(a, e), tick(e, c)].map((segment, index) => (
        <line
          key={index}
          {...segment}
          stroke={line(0.45)}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      ))}
      <circle cx={d.x} cy={d.y} r={4.5} fill="var(--card)" stroke={INK} strokeWidth={1.5} />
      <circle cx={e.x} cy={e.y} r={4.5} fill="var(--card)" stroke={INK} strokeWidth={1.5} />
      <text x={d.x + 9} y={d.y + 15} fontSize="11.5" fill={line(0.62)}>
        D
      </text>
      <text x={e.x + 9} y={e.y + 15} fontSize="11.5" fill={line(0.62)}>
        E
      </text>
      <Handle point={a} label="A" target={{ kind: "vertex", index: 0 }} onStart={onStart} onNudge={onNudge} />
      <Handle point={b} label="B" target={{ kind: "vertex", index: 1 }} onStart={onStart} onNudge={onNudge} />
      <Handle point={c} label="C" target={{ kind: "vertex", index: 2 }} onStart={onStart} onNudge={onNudge} />
    </g>
  );
}

function Semicircle({
  angle,
  onStart,
  onNudge,
}: {
  angle: number;
  onStart: HandleProps["onStart"];
  onNudge: HandleProps["onNudge"];
}) {
  const a = { x: O.x - R, y: O.y };
  const b = { x: O.x + R, y: O.y };
  const p = pointOn(O.x, O.y, R, angle);
  const u = { x: (a.x - p.x) / dist(a, p), y: (a.y - p.y) / dist(a, p) };
  const v = { x: (b.x - p.x) / dist(b, p), y: (b.y - p.y) / dist(b, p) };
  const square = 13;
  const s1 = { x: p.x + u.x * square, y: p.y + u.y * square };
  const s2 = { x: s1.x + v.x * square, y: s1.y + v.y * square };
  const s3 = { x: p.x + v.x * square, y: p.y + v.y * square };

  return (
    <g>
      <circle cx={O.x} cy={O.y} r={R} fill="none" stroke={line(0.2)} strokeWidth={1} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={line(0.4)} strokeWidth={1} strokeDasharray="4 7" />
      <line x1={p.x} y1={p.y} x2={a.x} y2={a.y} stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
      <line x1={p.x} y1={p.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
      <path
        d={`M ${s1.x} ${s1.y} L ${s2.x} ${s2.y} L ${s3.x} ${s3.y}`}
        fill="none"
        stroke={line(0.6)}
        strokeWidth={1.2}
      />
      <circle cx={O.x} cy={O.y} r={3} fill={line(0.55)} />
      <text x={O.x - 4} y={O.y + 20} fontSize="11.5" fill={line(0.55)}>
        O
      </text>
      <text x={a.x - 16} y={a.y + 6} fontSize="12.5" fontWeight="600" fill={INK}>
        A
      </text>
      <text x={b.x + 6} y={b.y + 6} fontSize="12.5" fontWeight="600" fill={INK}>
        B
      </text>
      <Handle point={p} label="P" target={{ kind: "arc" }} onStart={onStart} onNudge={onNudge} />
    </g>
  );
}

function Cyclic({
  angles,
  onStart,
  onNudge,
}: {
  angles: number[];
  onStart: HandleProps["onStart"];
  onNudge: HandleProps["onNudge"];
}) {
  const points = angles.map((angle) => pointOn(O.x, O.y, R, angle));
  const letters = ["A", "B", "C", "D"];
  const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") + " Z";

  return (
    <g>
      <circle cx={O.x} cy={O.y} r={R} fill="none" stroke={line(0.2)} strokeWidth={1} />
      <path d={d} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      {points.map((point, index) => {
        const previous = points[(index + 3) % 4];
        const next = points[(index + 1) % 4];
        return (
          <path
            key={`arc-${index}`}
            d={angleArc(point, previous, next, 22)}
            fill="none"
            stroke={line(index % 2 === 0 ? 0.55 : 0.35)}
            strokeWidth={index % 2 === 0 ? 1.4 : 1}
            strokeDasharray={index % 2 === 0 ? undefined : "3 4"}
          />
        );
      })}
      {points.map((point, index) => {
        const outward = {
          x: (point.x - O.x) / (dist(point, O) || 1),
          y: (point.y - O.y) / (dist(point, O) || 1),
        };
        return (
          <text
            key={`letter-${index}`}
            x={point.x + outward.x * 18}
            y={point.y + outward.y * 18 + 4}
            fontSize="12.5"
            fontWeight="600"
            textAnchor="middle"
            fill={INK}
          >
            {letters[index]}
          </text>
        );
      })}
      {points.map((point, index) => (
        <Handle
          key={`handle-${index}`}
          point={point}
          label={letters[index]}
          target={{ kind: "quad", index }}
          onStart={onStart}
          onNudge={onNudge}
          bare
        />
      ))}
    </g>
  );
}

/* Readouts ------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="cbench-row">
      <dt>{label}</dt>
      <dd className="cbench-num">{value}</dd>
    </div>
  );
}

function MidpointReadout({ points }: { points: [Pt, Pt, Pt] }) {
  const [a, b, c] = points;
  const d = mid(a, b);
  const e = mid(a, c);
  const de = dist(d, e);
  const bc = dist(b, c);
  const u = { x: e.x - d.x, y: e.y - d.y };
  const v = { x: c.x - b.x, y: c.y - b.y };
  const separation =
    (Math.acos(clamp((u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1) * (Math.hypot(v.x, v.y) || 1)), -1, 1)) *
      180) /
    Math.PI;

  return (
    <>
      <Row label="DE" value={(de / 10).toFixed(2)} />
      <Row label="BC" value={(bc / 10).toFixed(2)} />
      <Row label="DE ÷ BC" value={(de / bc).toFixed(3)} />
      <Row label="Angle between DE and BC" value={`${separation.toFixed(1)}°`} />
    </>
  );
}

function SemicircleReadout({ angle }: { angle: number }) {
  const a = { x: O.x - R, y: O.y };
  const b = { x: O.x + R, y: O.y };
  const p = pointOn(O.x, O.y, R, angle);
  return (
    <>
      <Row label="∠APB" value={`${angleAt(p, a, b).toFixed(1)}°`} />
      <Row label="PA" value={(dist(p, a) / 10).toFixed(2)} />
      <Row label="PB" value={(dist(p, b) / 10).toFixed(2)} />
      <Row label="AB (diameter)" value={(dist(a, b) / 10).toFixed(2)} />
    </>
  );
}

function CyclicReadout({ angles }: { angles: number[] }) {
  const [a, b, c, d] = angles.map((angle) => pointOn(O.x, O.y, R, angle));
  const angleA = angleAt(a, b, d);
  const angleB = angleAt(b, c, a);
  const angleC = angleAt(c, d, b);
  const angleD = angleAt(d, a, c);

  return (
    <>
      <Row label="∠A + ∠C" value={`${(angleA + angleC).toFixed(1)}°`} />
      <Row label="∠B + ∠D" value={`${(angleB + angleD).toFixed(1)}°`} />
      <Row label="∠A" value={`${angleA.toFixed(1)}°`} />
      <Row label="∠C" value={`${angleC.toFixed(1)}°`} />
    </>
  );
}

export default ConstructionBench;
