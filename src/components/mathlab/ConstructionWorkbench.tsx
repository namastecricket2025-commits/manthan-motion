import { useMemo, useState, type PointerEvent } from "react";
import { Check, CircleDashed, Minus, RotateCcw, TriangleAlert, Undo2 } from "lucide-react";

/**
 * Construct, don't drag.
 *
 * The three figures beside this bench let a student test a theorem. This one
 * asks them to build a figure with the two instruments a board paper allows:
 * a compass and a straightedge. Nothing is snapped to the answer — the arcs
 * keep the radius the student drew, the straightedge joins the points they
 * picked, and the check measures the actual result. A line that is 4° off
 * perpendicular is reported as 4° off, not quietly accepted.
 *
 * The reason question comes after the construction, because a construction
 * without its justification earns half the marks.
 */

const W = 640;
const H = 420;
const SCALE = 40; // px per cm
const HIT = 20; // click radius, px

type Pt = { x: number; y: number; key: string; label?: string; derived?: boolean };
type Circle = { id: string; cx: number; cy: number; r: number };
type Segment = { id: string; ax: number; ay: number; bx: number; by: number; ak: string; bk: string };
type Tool = "compass" | "straightedge";

type TaskId = "bisector" | "angle" | "triangle";

type Task = {
  id: TaskId;
  label: string;
  title: string;
  prompt: string;
  steps: string[];
  given: Pt[];
  /** Measurement helper: what the check compares, in student language. */
  hint: string;
  reason: { question: string; options: string[]; correct: number; note: string };
};

const P = (x: number, y: number, key: string, label?: string): Pt => ({ x, y, key, label });

const TASKS: Task[] = [
  {
    id: "bisector",
    label: "Perpendicular bisector",
    title: "Bisect a segment at right angles",
    prompt: "Construct the perpendicular bisector of AB.",
    steps: [
      "Open the compass wider than half of AB and draw an arc from A.",
      "Keep the same radius and draw an arc from B.",
      "Join the two points where the arcs cross.",
    ],
    given: [P(190, 290, "A", "A"), P(470, 150, "B", "B")],
    hint:
      "The line has to cross AB at its midpoint, at 90°. Two arcs of equal radius give the two crossing points.",
    reason: {
      question: "Why does that construction produce the perpendicular bisector?",
      options: [
        "Both crossing points are equidistant from A and B, and the points equidistant from two fixed points form their perpendicular bisector.",
        "The two arcs have the same radius, so the line joining their crossings is parallel to AB.",
        "The midpoint of AB is the centre of both arcs, so the line through it is perpendicular.",
      ],
      correct: 0,
      note:
        "Each crossing point is the same distance from A as from B, because both arcs were drawn with one radius. Two such points fix the perpendicular bisector exactly.",
    },
  },
  {
    id: "angle",
    label: "Angle bisector",
    title: "Split an angle into two equal halves",
    prompt: "Construct the bisector of ∠AOB.",
    steps: [
      "With centre O, draw an arc that cuts OA and OB.",
      "From those two cuts, draw equal arcs that meet between the rays.",
      "Join O to the meeting point.",
    ],
    given: [P(150, 300, "O", "O"), P(520, 300, "A", "A"), P(300, 40, "B", "B")],
    hint:
      "The first arc cuts both rays at the same distance from O. Equal arcs from those cuts then meet on the bisector.",
    reason: {
      question: "Which congruence makes the two halves of ∠AOB equal?",
      options: [
        "SSS — the two triangles have all three sides equal, so the angles at O are equal.",
        "SAS — the arcs meet, so the two triangles share a side and an angle.",
        "RHS — the bisector is perpendicular to AB.",
      ],
      correct: 0,
      note:
        "The construction gives two triangles sharing OR, with OP = OQ (same first arc) and PR = QR (same second radius). SSS makes the angles at O equal.",
    },
  },
  {
    id: "triangle",
    label: "Triangle (SSS)",
    title: "Build a triangle from three sides",
    prompt: "Construct △ABC with AB = 7 cm, AC = 7 cm and BC = 6 cm.",
    steps: [
      "Draw an arc of radius 7 cm from A.",
      "Draw an arc of radius 6 cm from B.",
      "Join A and B to the point where the arcs cross.",
    ],
    given: [P(180, 320, "A", "A"), P(460, 320, "B", "B")],
    hint:
      "AC is 7 cm, so the arc from A is 280 px. BC is 6 cm, so the arc from B is 240 px. Their crossing is C.",
    reason: {
      question: "Three given sides fix the triangle. Which criterion says so?",
      options: [
        "SSS — if three sides of one triangle equal three sides of another, the triangles are congruent.",
        "SAS — two sides and a non-included angle are enough.",
        "AAA — equal angles give an equal triangle.",
      ],
      correct: 0,
      note:
        "SSS is the criterion: the three lengths decide the shape completely. AAA would only make the triangles similar, not necessarily equal.",
    },
  },
];

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** The two intersections of two circles (empty when they miss or are nested). */
function circleCross(a: Circle, b: Circle): Pt[] {
  const d = dist(a, b);
  if (d < 1e-6 || d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
  const x = (d * d + a.r * a.r - b.r * b.r) / (2 * d);
  const h2 = a.r * a.r - x * x;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const ux = (b.cx - a.cx) / d;
  const uy = (b.cy - a.cy) / d;
  const mx = a.cx + ux * x;
  const my = a.cy + uy * x;
  const base = `cc:${a.id}:${b.id}`;
  return [
    { x: mx - uy * h, y: my + ux * h, key: `${base}:0`, derived: true },
    { x: mx + uy * h, y: my - ux * h, key: `${base}:1`, derived: true },
  ];
}

/** The point at distance r from O along the ray O→A, if it lands on the ray. */
function rayCut(O: Pt, A: Pt, circle: Circle, side: string): Pt | null {
  const length = dist(O, A);
  if (circle.r > length + 0.5) return null;
  const ux = (A.x - O.x) / (length || 1);
  const uy = (A.y - O.y) / (length || 1);
  return {
    x: O.x + ux * circle.r,
    y: O.y + uy * circle.r,
    key: `cut:${circle.id}:${side}`,
    derived: true,
  };
}

/** Signed distance from P to the infinite line through A and B. */
function distanceToLine(p: Pt, a: Pt, b: Pt) {
  const length = dist(a, b);
  if (length < 1e-6) return Number.POSITIVE_INFINITY;
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
}

/** The acute angle between two directions, in degrees. */
function angleBetween(ax: number, ay: number, bx: number, by: number) {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (!la || !lb) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
  const degrees = (Math.acos(cosine) * 180) / Math.PI;
  return degrees > 90 ? 180 - degrees : degrees;
}

function pointAngle(from: Pt, to: Pt) {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

export function ConstructionWorkbench() {
  const [taskId, setTaskId] = useState<TaskId>("bisector");
  const task = TASKS.find((entry) => entry.id === taskId) ?? TASKS[0];

  const [tool, setTool] = useState<Tool>("compass");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [compassFrom, setCompassFrom] = useState<Pt | null>(null);
  const [lineFrom, setLineFrom] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [checked, setChecked] = useState<null | { pass: boolean; message: string }>(null);
  const [reasonPick, setReasonPick] = useState<number | null>(null);
  const [reasonDone, setReasonDone] = useState(false);

  const reset = () => {
    setCircles([]);
    setSegments([]);
    setCompassFrom(null);
    setLineFrom(null);
    setChecked(null);
    setReasonPick(null);
    setReasonDone(false);
  };

  const chooseTask = (next: TaskId) => {
    setTaskId(next);
    setCircles([]);
    setSegments([]);
    setCompassFrom(null);
    setLineFrom(null);
    setChecked(null);
    setReasonPick(null);
    setReasonDone(false);
    setTool("compass");
  };

  /* Given points plus everything the arcs create. Derived points are computed
     from the arcs themselves, so they move and vanish with them. */
  const points = useMemo<Pt[]>(() => {
    const list: Pt[] = [...task.given];
    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        list.push(...circleCross(circles[i], circles[j]));
      }
    }
    if (task.id === "angle") {
      const [O, A, B] = task.given;
      for (const circle of circles) {
        const cutA = rayCut(O, A, circle, "A");
        const cutB = rayCut(O, B, circle, "B");
        if (cutA) list.push(cutA);
        if (cutB) list.push(cutB);
      }
    }
    /* Only one point per key: two arcs meeting at the same crossing should not
       show two handles in the same place. */
    const seen = new Map<string, Pt>();
    for (const point of list) if (!seen.has(point.key)) seen.set(point.key, point);
    return [...seen.values()];
  }, [circles, task]);

  const validSegments = useMemo(
    () =>
      segments.filter(
        (segment) =>
          points.some((point) => point.key === segment.ak) &&
          points.some((point) => point.key === segment.bk),
      ),
    [points, segments],
  );

  const localPoint = (event: { clientX: number; clientY: number }, svg: SVGSVGElement | null) => {
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: ((event.clientX - box.left) / box.width) * W,
      y: ((event.clientY - box.top) / box.height) * H,
      key: "",
    };
  };

  const nearest = (point: { x: number; y: number } | null) => {
    if (!point) return null;
    let best: Pt | null = null;
    let bestDistance = HIT;
    for (const candidate of points) {
      const d = dist(point, candidate);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    return best;
  };

  const addCircle = (from: Pt, r: number) => {
    const safe = Math.max(14, Math.min(300, r));
    setCircles((current) => [
      ...current,
      { id: `arc${current.length + 1}`, cx: from.x, cy: from.y, r: safe },
    ]);
    setCompassFrom(null);
    setChecked(null);
  };

  const addSegment = (a: Pt, b: Pt) => {
    if (a.key === b.key) return;
    setSegments((current) => {
      if (current.some((segment) => (segment.ak === a.key && segment.bk === b.key) || (segment.ak === b.key && segment.bk === a.key))) {
        return current;
      }
      return [
        ...current,
        { id: `line${current.length + 1}`, ax: a.x, ay: a.y, bx: b.x, by: b.y, ak: a.key, bk: b.key },
      ];
    });
    setChecked(null);
  };

  const handleClick = (point: Pt | null, raw: { x: number; y: number } | null) => {
    if (tool === "compass") {
      if (!compassFrom) {
        if (point) setCompassFrom(point);
        return;
      }
      // Second click sets the radius; a click on a point measures to it, a
      // click on blank plate measures to the cursor.
      const at = point ?? raw;
      if (at) addCircle(compassFrom, dist(compassFrom, at));
      return;
    }
    if (!point) return;
    if (!lineFrom) {
      setLineFrom(point);
      return;
    }
    addSegment(lineFrom, point);
    setLineFrom(null);
  };

  const check = () => {
    setChecked(evaluate(task, points, validSegments, circles));
  };

  const scan = scanTask(task, points, validSegments, circles);

  return (
    <div className="cwork">
      <header className="cwork__head">
        <div className="min-w-0">
          <p className="mathlab-card__kicker">Construction bench</p>
          <h2 className="mathlab-card__title">{task.title}</h2>
          <p className="cwork__prompt">{task.prompt}</p>
        </div>
        <div className="cwork__tasks cbench-tabs" role="tablist" aria-label="Construction task">
          {TASKS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === taskId}
              aria-pressed={entry.id === taskId}
              className="cbench-tab"
              onClick={() => chooseTask(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      <div className="cwork__body">
        <div className="cwork__stagecol">
          <div className="cwork__toolbar" role="toolbar" aria-label="Construction tools">
            <button
              type="button"
              className={"cwork__tool" + (tool === "compass" ? " is-active" : "")}
              aria-pressed={tool === "compass"}
              onClick={() => {
                setTool("compass");
                setLineFrom(null);
              }}
            >
              <CircleDashed className="h-3.5 w-3.5" />
              Compass
            </button>
            <button
              type="button"
              className={"cwork__tool" + (tool === "straightedge" ? " is-active" : "")}
              aria-pressed={tool === "straightedge"}
              onClick={() => {
                setTool("straightedge");
                setCompassFrom(null);
              }}
            >
              <Minus className="h-3.5 w-3.5" />
              Straightedge
            </button>
            <span className="cwork__toolsep" aria-hidden />
            <button
              type="button"
              className="cwork__tool"
              onClick={() => {
                setCircles((current) => current.slice(0, -1));
                setCompassFrom(null);
                setChecked(null);
              }}
              disabled={!circles.length}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo arc
            </button>
            <button type="button" className="cwork__tool" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>

          <div className="cwork__canvas">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="group"
              aria-label={`${task.prompt} ${task.hint}`}
              onPointerMove={(event: PointerEvent<SVGSVGElement>) => {
                const raw = localPoint(event, event.currentTarget);
                setCursor(raw);
              }}
              onClick={(event) => {
                const raw = localPoint(event, event.currentTarget);
                handleClick(nearest(raw), raw);
              }}
            >
              <defs>
                <pattern id="cwork-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke="color-mix(in srgb, var(--text-main) 7%, transparent)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#cwork-grid)" />

              {/* Given figure — dashed, the thing that may not move. */}
              {task.id === "bisector" ? (
                <line
                  x1={task.given[0].x}
                  y1={task.given[0].y}
                  x2={task.given[1].x}
                  y2={task.given[1].y}
                  stroke="color-mix(in srgb, var(--text-main) 42%, transparent)"
                  strokeWidth="1.2"
                  strokeDasharray="5 7"
                />
              ) : null}
              {task.id === "angle" ? (
                <>
                  <line
                    x1={task.given[0].x}
                    y1={task.given[0].y}
                    x2={task.given[1].x}
                    y2={task.given[1].y}
                    stroke="color-mix(in srgb, var(--text-main) 42%, transparent)"
                    strokeWidth="1.2"
                  />
                  <line
                    x1={task.given[0].x}
                    y1={task.given[0].y}
                    x2={task.given[2].x}
                    y2={task.given[2].y}
                    stroke="color-mix(in srgb, var(--text-main) 42%, transparent)"
                    strokeWidth="1.2"
                  />
                </>
              ) : null}
              {task.id === "triangle" ? (
                <line
                  x1={task.given[0].x}
                  y1={task.given[0].y}
                  x2={task.given[1].x}
                  y2={task.given[1].y}
                  stroke="color-mix(in srgb, var(--text-main) 42%, transparent)"
                  strokeWidth="1.2"
                />
              ) : null}

              {/* Compass arcs, with a ghost while the radius is being chosen. */}
              {circles.map((circle) => (
                <circle
                  key={circle.id}
                  cx={circle.cx}
                  cy={circle.cy}
                  r={circle.r}
                  fill="none"
                  stroke="color-mix(in srgb, var(--text-main) 42%, transparent)"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
              ))}
              {compassFrom ? (
                <circle
                  cx={compassFrom.x}
                  cy={compassFrom.y}                    r={
                    cursor ? Math.max(14, Math.min(300, dist(compassFrom, cursor))) : 80
                  }
                  fill="none"
                  stroke="var(--signal)"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
              ) : null}

              {/* Straightedge lines. */}
              {validSegments.map((segment) => (
                <line
                  key={segment.id}
                  x1={segment.ax}
                  y1={segment.ay}
                  x2={segment.bx}
                  y2={segment.by}
                  stroke="var(--text-main)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              ))}

              {/* Crossing points the student may join. */}
              {points
                .filter((point) => point.derived)
                .map((point) => (
                  <circle
                    key={point.key}
                    cx={point.x}
                    cy={point.y}
                    r={3.4}
                    fill="var(--card)"
                    stroke="color-mix(in srgb, var(--text-main) 70%, transparent)"
                    strokeWidth="1.4"
                  />
                ))}

              {/* Given points, and the labels that make them readable. */}
              {points
                .filter((point) => !point.derived)
                .map((point) => (
                  <g key={point.key}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={5}
                      fill="var(--text-main)"
                      stroke="var(--card)"
                      strokeWidth="2"
                    />
                    <text
                      x={point.x + 12}
                      y={point.y - 11}
                      fontSize="12.5"
                      fontWeight="600"
                      fill="var(--text-main)"
                    >
                      {point.label}
                    </text>
                  </g>
                ))}

              {lineFrom ? (
                <circle
                  cx={lineFrom.x}
                  cy={lineFrom.y}
                  r={11}
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth="1.4"
                />
              ) : null}
            </svg>

            <p className="cwork__hint" role="status">
              {tool === "compass"
                ? compassFrom
                  ? "Now click where the arc should pass — the radius is the distance."
                  : "Click a point to place the compass needle."
                : lineFrom
                  ? "Now click the point to join it to."
                  : "Click a point to start the line."}
            </p>
          </div>
        </div>

        <aside className="cwork__panel">
          <div>
            <p className="cbench-label">Construction</p>
            <ol className="cwork__steps">
              {task.steps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <dl className="cbench-measures">
            {scan.rows.map((row) => (
              <div key={row.label} className="cbench-row">
                <dt>{row.label}</dt>
                <dd className="cbench-num">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="cbench-invariant">{task.hint}</p>

          <div className="cwork__checkrow">
            <button
              type="button"
              className="mathlab-chip"
              onClick={check}
              disabled={!circles.length}
            >
              <Check className="h-3.5 w-3.5" />
              Check construction
            </button>
            <span className="cwork__tally">
              {circles.length} arc{circles.length === 1 ? "" : "s"} · {validSegments.length} line
              {validSegments.length === 1 ? "" : "s"}
            </span>
          </div>

          {checked ? (
            <div
              className={"cwork__verdict" + (checked.pass ? " is-pass" : " is-miss")}
              role="status"
              aria-live="polite"
            >
              {checked.pass ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              <p>{checked.message}</p>
            </div>
          ) : null}

          {checked?.pass ? (
            <div className="cwork__reason">
              <p className="cwork__reasonq">{task.reason.question}</p>
              <div className="cwork__options">
                {task.reason.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      "cwork__option" +
                      (reasonPick === index ? " is-picked" : "") +
                      (reasonDone && index === task.reason.correct ? " is-correct" : "")
                    }
                    disabled={reasonDone}
                    onClick={() => {
                      setReasonPick(index);
                      if (index === task.reason.correct) setReasonDone(true);
                    }}
                  >
                    <span aria-hidden>{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                ))}
              </div>
              {reasonDone ? (
                <p className="cwork__reasonnote">
                  <Check className="h-3.5 w-3.5" />
                  {task.reason.note}
                </p>
              ) : reasonPick !== null ? (
                <p className="cwork__reasonnote cwork__reasonnote--miss">
                  Not that one. Which fact makes the two halves equal?
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Measuring the construction                                          */
/* ------------------------------------------------------------------ */

type Scan = { rows: Array<{ label: string; value: string }> };

function scanTask(task: Task, points: Pt[], segments: Segment[], circles: Circle[]): Scan {
  const byKey = new Map(points.map((point) => [point.key, point]));
  const asPt = (segment: Segment, which: "a" | "b"): Pt | null => {
    const key = which === "a" ? segment.ak : segment.bk;
    const found = byKey.get(key);
    return found ?? null;
  };

  if (task.id === "bisector") {
    const [A, B] = task.given;
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, key: "M" };
    let best = { offset: Number.POSITIVE_INFINITY, angle: 0 };
    for (const segment of segments) {
      const a = asPt(segment, "a");
      const b = asPt(segment, "b");
      if (!a || !b) continue;
      const offset = distanceToLine(M, a, b);
      const angle = 90 - angleBetween(b.x - a.x, b.y - a.y, B.x - A.x, B.y - A.y);
      if (offset < best.offset) best = { offset, angle: Math.abs(angle) };
    }
    const hasLine = Number.isFinite(best.offset);
    return {
      rows: [
        { label: "AB", value: `${(dist(A, B) / SCALE).toFixed(1)} cm` },
        { label: "Midpoint offset", value: hasLine ? `${(best.offset / SCALE).toFixed(2)} cm` : "—" },
        { label: "Angle to AB", value: hasLine ? `${(90 - best.angle).toFixed(1)}°` : "—" },
        { label: "Arcs drawn", value: String(circles.length) },
      ],
    };
  }

  if (task.id === "angle") {
    const [O, A, B] = task.given;
    const total = Math.abs(pointAngle(O, B) - pointAngle(O, A));
    let best: { through: number; half: number } | null = null;
    for (const segment of segments) {
      const a = asPt(segment, "a");
      const b = asPt(segment, "b");
      if (!a || !b) continue;
      const through = distanceToLine(O, a, b);
      const dir = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
      const target = (pointAngle(O, A) + pointAngle(O, B)) / 2;
      let delta = Math.abs(dir - target) % 180;
      if (delta > 90) delta = 180 - delta;
      if (!best || through + delta < best.through + best.half) best = { through, half: delta };
    }
    return {
      rows: [
        { label: "∠AOB", value: `${total.toFixed(1)}°` },
        { label: "Line passes O", value: best ? `${(best.through / SCALE).toFixed(2)} cm off` : "—" },
        { label: "Off the bisector", value: best ? `${best.half.toFixed(1)}°` : "—" },
        { label: "Arcs drawn", value: String(circles.length) },
      ],
    };
  }

  const [A, B] = task.given;
  const wantAC = 280; // 7 cm
  const wantBC = 240; // 6 cm
  let best: { ac: number | null; bc: number | null } = { ac: null, bc: null };
  for (const point of points.filter((entry) => entry.derived)) {
    const ac = dist(A, point);
    const bc = dist(B, point);
    const error = Math.abs(ac - wantAC) + Math.abs(bc - wantBC);
    const currentError =
      best.ac !== null && best.bc !== null
        ? Math.abs(best.ac - wantAC) + Math.abs(best.bc - wantBC)
        : Number.POSITIVE_INFINITY;
    if (error < currentError) best = { ac, bc };
  }
  return {
    rows: [
      { label: "AB (given)", value: `${(dist(A, B) / SCALE).toFixed(1)} cm` },
      { label: "AC (target 7.0)", value: best.ac !== null ? `${(best.ac / SCALE).toFixed(1)} cm` : "—" },
      { label: "BC (target 6.0)", value: best.bc !== null ? `${(best.bc / SCALE).toFixed(1)} cm` : "—" },
      { label: "Arcs drawn", value: String(circles.length) },
    ],
  };
}

function evaluate(
  task: Task,
  points: Pt[],
  segments: Segment[],
  circles: Circle[],
): { pass: boolean; message: string } {
  if (circles.length < 2) {
    return { pass: false, message: "A construction needs its arcs: place at least two before checking." };
  }
  const byKey = new Map(points.map((point) => [point.key, point]));
  const ends = (segment: Segment): [Pt, Pt] | null => {
    const a = byKey.get(segment.ak);
    const b = byKey.get(segment.bk);
    return a && b ? [a, b] : null;
  };

  if (task.id === "bisector") {
    const [A, B] = task.given;
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, key: "M" };
    for (const segment of segments) {
      const pair = ends(segment);
      if (!pair) continue;
      const [a, b] = pair;
      const offset = distanceToLine(M, a, b);
      const angle = 90 - angleBetween(b.x - a.x, b.y - a.y, B.x - A.x, B.y - A.y);
      if (offset <= 6 && Math.abs(angle) <= 1.2) {
        return {
          pass: true,
          message: `Exact. The line passes ${(offset / SCALE).toFixed(2)} cm from the midpoint and is ${(90 - Math.abs(angle)).toFixed(1)}° to AB.`,
        };
      }
      if (offset <= 30 && Math.abs(angle) <= 8) {
        return {
          pass: false,
          message: `Close, but not exact: ${(offset / SCALE).toFixed(2)} cm from the midpoint and ${Math.abs(angle).toFixed(1)}° off 90°. Check that both arcs used the same radius.`,
        };
      }
    }
    return { pass: false, message: "No drawn line crosses AB at its midpoint and 90°. Join the two arc crossings." };
  }

  if (task.id === "angle") {
    const [O, A, B] = task.given;
    const target = (pointAngle(O, A) + pointAngle(O, B)) / 2;
    for (const segment of segments) {
      const pair = ends(segment);
      if (!pair) continue;
      const [a, b] = pair;
      if (distanceToLine(O, a, b) > 6) continue;
      let delta = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - target) % 180;
      if (delta > 90) delta = 180 - delta;
      if (delta <= 1.2) {
        const half = Math.abs(pointAngle(O, A) - pointAngle(O, B)) / 2;
        return {
          pass: true,
          message: `Exact. The line splits the angle into two halves of ${half.toFixed(1)}° each, within 0.1°.`,
        };
      }
      if (delta <= 8) {
        return {
          pass: false,
          message: `Close: the line passes through O but is ${delta.toFixed(1)}° away from the bisector. The two arcs from the cuts must use one radius.`,
        };
      }
    }
    return { pass: false, message: "No drawn line passes through O on the bisector. Join O to the crossing of the two small arcs." };
  }

  const [A, B] = task.given;
  const haveAC = new Set(segments.filter((s) => s.ak === "A" || s.bk === "A").map((s) => (s.ak === "A" ? s.bk : s.ak)));
  const haveBC = new Set(segments.filter((s) => s.ak === "B" || s.bk === "B").map((s) => (s.ak === "B" ? s.bk : s.ak)));
  const wantAC = 280;
  const wantBC = 240;
  for (const point of points.filter((entry) => entry.derived)) {
    if (!haveAC.has(point.key) || !haveBC.has(point.key)) continue;
    const ac = dist(A, point);
    const bc = dist(B, point);
    if (Math.abs(ac - wantAC) <= 6 && Math.abs(bc - wantBC) <= 6) {
      return {
        pass: true,
        message: `Exact. AC = ${(ac / SCALE).toFixed(2)} cm, BC = ${(bc / SCALE).toFixed(2)} cm and AB is 7.0 cm — the triangle is fixed by SSS.`,
      };
    }
  }
  return {
    pass: false,
    message: "C is not joined to both A and B yet, or the crossing is not at 7 cm from A and 6 cm from B.",
  };
}

export default ConstructionWorkbench;
