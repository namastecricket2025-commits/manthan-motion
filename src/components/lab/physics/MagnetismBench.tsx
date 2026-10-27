import { Picker, Range, Readout, ink, plate, AMBER, MINT } from "@/components/lab/bench-atoms";
import { useMemo, useState } from "react";

/**
 * Magnetism — the chapter that is always taught with a drawing and never with
 * something a student can walk around: iron filings on a bar magnet, or a
 * compass taken closer to a wire.
 *
 *   Bar magnet     the field of two poles, summed as a 1/r² vector field and
 *                  then traced: dr/ds = B/|B| integrated with RK4, so the lines
 *                  leaving the north pole are the real solutions — they curve,
 *                  they crowd at the poles, and they never cross.
 *   Straight wire  the long-wire result B = μ₀I/2πr in real microtesla, with the
 *                  field circles and a needle that is tangential to them.
 *
 * The compass is the experiment, not decoration: on both plates its needle is
 * rotated to the field computed at its own position, which is exactly what
 * walking a compass around the source proves.
 */

type Source = "magnet" | "wire";

const PLATE_W = 760;
const PLATE_H = 330;
const CX = PLATE_W / 2;
const CY = 165;
const PX_PER_CM = 18;
/** Pole-to-pole separation of the two-pole model, in plate pixels. */
const POLE_HALF = 44;
const MAGNET_HALF_X = 78;
const MAGNET_HALF_Y = 15;

type Vec = { x: number; y: number };
type Pole = { x: number; y: number; q: number };

const POLES: Pole[] = [
  { x: -POLE_HALF, y: 0, q: -1 },
  { x: POLE_HALF, y: 0, q: 1 },
];

/** Sum of the two poles: 1/r² in magnitude, pointing away from N and into S. */
function fieldAt(x: number, y: number): Vec {
  let bx = 0;
  let by = 0;
  for (const pole of POLES) {
    const dx = x - pole.x;
    const dy = y - pole.y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2) || 1e-4;
    const k = pole.q / (r2 * r);
    bx += k * dx;
    by += k * dy;
  }
  return { x: bx, y: by };
}

const unit = (v: Vec): Vec => {
  const m = Math.hypot(v.x, v.y) || 1e-9;
  return { x: v.x / m, y: v.y / m };
};

/** One field line from a seed, in plate-local coordinates (magnet centre at 0,0). */
function traceFieldLine(seed: Vec, step = 3.4, maxSteps = 800): Vec[] {
  const pts: Vec[] = [];
  let p: Vec = { ...seed };
  for (let i = 0; i < maxSteps; i += 1) {
    pts.push({ ...p });
    const k1 = unit(fieldAt(p.x, p.y));
    const k2 = unit(fieldAt(p.x + (step / 2) * k1.x, p.y + (step / 2) * k1.y));
    const k3 = unit(fieldAt(p.x + (step / 2) * k2.x, p.y + (step / 2) * k2.y));
    const k4 = unit(fieldAt(p.x + step * k3.x, p.y + step * k3.y));
    p = {
      x: p.x + (step / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: p.y + (step / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    };
    if (Math.abs(p.x) > PLATE_W / 2 + 60 || Math.abs(p.y) > PLATE_H / 2 + 60) break;
    /* Arriving back at the magnet is the end of the line: it has entered S. */
    if (Math.abs(p.x) < MAGNET_HALF_X && Math.abs(p.y) < MAGNET_HALF_Y) break;
  }
  return pts;
}

/* Traced once: the seeds are fixed angles around the north pole, so the drawing
   is the same construction every time the bench is opened. */
const FIELD_LINES: Vec[][] = (() => {
  const lines: Vec[][] = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = ((22 + i * 23) * Math.PI) / 180;
    for (const sign of [1, -1]) {
      lines.push(
        traceFieldLine({
          x: POLE_HALF + 7 * Math.cos(angle),
          y: sign * 7 * Math.sin(angle),
        }),
      );
    }
  }
  return lines;
})();

const pathOf = (points: Vec[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(CX + p.x).toFixed(1)} ${(CY + p.y).toFixed(1)}`)
    .join(" ");

/** A compass whose red half points along the field at its own position. */
function Compass({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={14} fill={plate(0.55)} stroke={ink(0.45)} strokeWidth={1.2} />
      <g transform={`rotate(${angle})`}>
        <path d="M 11 0 L 0 -3.4 L 0 3.4 Z" fill="#e05b45" />
        <path d="M -11 0 L 0 -3.4 L 0 3.4 Z" fill={ink(0.5)} />
      </g>
      <circle r={1.6} fill={ink(0.75)} />
    </g>
  );
}

export default function MagnetismBench() {
  const [source, setSource] = useState<Source>("magnet");
  /* Compass position on the magnet plate, in centimetres from the magnet centre. */
  const [compassX, setCompassX] = useState(9);
  const [compassY, setCompassY] = useState(3);
  /* Wire plate. */
  const [current, setCurrent] = useState(5);
  const [radius, setRadius] = useState(4);

  const compass = { x: compassX * PX_PER_CM, y: -compassY * PX_PER_CM };

  const magnet = useMemo(() => {
    const b = fieldAt(compass.x, compass.y);
    const ref = Math.hypot(...Object.values(fieldAt(POLE_HALF + 10, 0)) as [number, number]);
    return {
      field: b,
      relative: Math.hypot(b.x, b.y) / ref,
      /* Screen rotation for the needle, and the honest maths angle for the
         read-out: anticlockwise from the magnet's axis, y up. */
      screenAngle: (Math.atan2(b.y, b.x) * 180) / Math.PI,
      mathsAngle: (Math.atan2(-b.y, b.x) * 180) / Math.PI,
      distance: Math.hypot(compass.x - POLE_HALF, compass.y) / PX_PER_CM,
      /* The line the compass is standing on, drawn brighter than the rest. */
      nearest: FIELD_LINES.reduce((best, line, index) => {
        const d = line.reduce(
          (min, p) => Math.min(min, Math.hypot(p.x - compass.x, p.y - compass.y)),
          Infinity,
        );
        return d < best.d ? { index, d } : best;
      }, { index: -1, d: Infinity }).index,
    };
  }, [compass.x, compass.y]);

  /* B = μ₀I / 2πr = 2 × 10⁻⁷ · I/r. In microtesla that is 20·I/r(cm). */
  const microTesla = (20 * current) / radius;

  const readouts: Array<[string, string]> =
    source === "magnet"
      ? [
          ["Field at the compass", `${magnet.relative.toFixed(2)}× pole value`],
          ["Field direction", `${Math.round(magnet.mathsAngle)}° from the axis`],
          ["Distance from the N pole", `${magnet.distance.toFixed(1)} cm`],
          ["Lines through a point", "one — field lines never cross"],
        ]
      : [
          ["Field B at r", `${microTesla.toFixed(1)} µT`],
          ["Distance r", `${radius.toFixed(0)} cm`],
          ["Direction", "anticlockwise, tangent to the circle"],
          ["Earth's field for scale", "≈ 40 µT"],
        ];

  return (
    <div className="flex flex-col gap-4">
      <div className="apple-lab-panel apple-lab-glass min-w-0 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Field and compass</p>
            <h3 className="apple-lab-title mt-1 text-base">
              {source === "magnet" ? "Bar magnet · field lines" : "Long straight wire · field circles"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {source === "magnet" ? (
              <>
                <span className="apple-lab-chip">N → S outside, S → N inside</span>
                <span className="apple-lab-chip">compass at ({compassX}, {compassY}) cm</span>
              </>
            ) : (
              <>
                <span className="apple-lab-chip">I = {current.toFixed(0)} A</span>
                <span className="apple-lab-chip">r = {radius.toFixed(0)} cm</span>
                <span className="apple-lab-chip">B = {microTesla.toFixed(1)} µT</span>
              </>
            )}
          </div>
        </div>

        <div className="lab-scroll mt-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
            className="h-auto w-full min-w-[560px]"
            role="img"
            aria-label={
              source === "magnet"
                ? "Field lines of a bar magnet, with a compass showing the field direction at its position"
                : `Concentric field circles around a straight wire carrying ${current} amperes, with a compass at ${radius} centimetres`
            }
          >
            <rect
              x={10}
              y={12}
              width={PLATE_W - 20}
              height={PLATE_H - 24}
              rx={12}
              fill={plate(0.35)}
              stroke={ink(0.08)}
            />

            {source === "magnet" ? (
              <>
                {/* the field, traced from the north pole */}
                {FIELD_LINES.map((line, index) => (
                  <path
                    key={index}
                    d={pathOf(line)}
                    fill="none"
                    stroke={index === magnet.nearest ? MINT : ink(0.3)}
                    strokeWidth={index === magnet.nearest ? 1.8 : 1.1}
                  />
                ))}
                {/* an arrow on each line, showing the direction N → S */}
                {FIELD_LINES.map((line, index) => {
                  const at = Math.floor(line.length * 0.42);
                  const p = line[at];
                  const next = line[Math.min(line.length - 1, at + 4)];
                  if (!p || !next) return null;
                  const angle = (Math.atan2(next.y - p.y, next.x - p.x) * 180) / Math.PI;
                  return (
                    <path
                      key={`head-${index}`}
                      d="M -4.6 -3.4 L 3 0 L -4.6 3.4 Z"
                      fill={index === magnet.nearest ? MINT : ink(0.42)}
                      transform={`translate(${CX + p.x} ${CY + p.y}) rotate(${angle})`}
                    />
                  );
                })}

                {/* the magnet */}
                <rect
                  x={CX - MAGNET_HALF_X}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X * 2}
                  height={MAGNET_HALF_Y * 2}
                  rx={5}
                  fill={ink(0.14)}
                  stroke={ink(0.45)}
                  strokeWidth={1.2}
                />
                <rect
                  x={CX - MAGNET_HALF_X}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X}
                  height={MAGNET_HALF_Y * 2}
                  rx={5}
                  fill="#3f6fb5"
                  opacity={0.55}
                />
                <rect
                  x={CX}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X}
                  height={MAGNET_HALF_Y * 2}
                  rx={5}
                  fill="#c94a3f"
                  opacity={0.55}
                />
                <text x={CX - MAGNET_HALF_X / 2} y={CY + 5} fontSize={13} fontWeight={700} fill="#ffffff" textAnchor="middle">
                  S
                </text>
                <text x={CX + MAGNET_HALF_X / 2} y={CY + 5} fontSize={13} fontWeight={700} fill="#ffffff" textAnchor="middle">
                  N
                </text>

                <Compass x={CX + compass.x} y={CY + compass.y} angle={magnet.screenAngle} />
                <text
                  x={CX + compass.x + 19}
                  y={CY + compass.y + 4}
                  fontSize={10}
                  fill={ink(0.5)}
                >
                  compass
                </text>
              </>
            ) : (
              <>
                {/* field circles: anticlockwise for current out of the page */}
                {[3, 6, 9].map((cm) => {
                  const r = cm * PX_PER_CM;
                  return (
                    <g key={cm}>
                      <circle cx={CX} cy={CY} r={r} fill="none" stroke={ink(0.22)} strokeWidth={1.1} />
                      <path
                        d="M -4.6 -3.4 L 3 0 L -4.6 3.4 Z"
                        fill={ink(0.42)}
                        transform={`translate(${CX} ${CY - r}) rotate(-90)`}
                      />
                      <text x={CX + 6} y={CY - r - 5} fontSize={9.5} fill={ink(0.4)}>
                        {cm} cm
                      </text>
                    </g>
                  );
                })}

                {/* the compass on its own circle */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={radius * PX_PER_CM}
                  fill="none"
                  stroke={MINT}
                  strokeWidth={1.6}
                />
                <line
                  x1={CX + 16}
                  y1={CY}
                  x2={CX + radius * PX_PER_CM - 16}
                  y2={CY}
                  stroke={AMBER}
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                />
                <text x={CX + 26} y={CY - 8} fontSize={10} fill={ink(0.55)}>
                  r = {radius.toFixed(0)} cm
                </text>
                {/* tangent at (r, 0) points up the screen: anticlockwise */}
                <Compass x={CX + radius * PX_PER_CM} y={CY} angle={-90} />

                {/* the wire, current out of the page */}
                <circle cx={CX} cy={CY} r={10} fill={plate(0.75)} stroke={ink(0.5)} strokeWidth={1.2} />
                <circle cx={CX} cy={CY} r={2.6} fill={ink(0.7)} />
                <text x={CX + 15} y={CY + 22} fontSize={10.5} fill={ink(0.6)}>
                  current out of the page
                </text>
                <text x={CX - 14} y={CY - 14} fontSize={10} fill={ink(0.45)} textAnchor="end">
                  fingers curl anticlockwise
                </text>
              </>
            )}
          </svg>
        </div>

        <p className="apple-lab-note mt-1">
          {source === "magnet"
            ? "Field lines leave the north pole, curve through space and enter the south pole; inside the magnet they run S → N. The compass needle always lies along the line it is standing on, and two lines never cross."
            : "Right-hand thumb rule: point the thumb along the current, and the fingers curl the way the field goes. B = μ₀I/2πr — doubling the distance halves the field, doubling the current doubles it."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <Picker
            label="Source"
            value={source}
            options={[
              { id: "magnet", label: "Bar magnet" },
              { id: "wire", label: "Straight wire" },
            ]}
            onChange={(next) => setSource(next)}
          />
          {source === "magnet" ? (
            <>
              <Range
                label="Compass · along the axis"
                value={compassX}
                min={-18}
                max={18}
                step={1}
                unit="cm"
                format={(v) => v.toFixed(0)}
                onChange={setCompassX}
              />
              <Range
                label="Compass · across the axis"
                value={compassY}
                min={-7}
                max={7}
                step={1}
                unit="cm"
                format={(v) => v.toFixed(0)}
                onChange={setCompassY}
              />
              <p className="apple-lab-note">
                Walk the compass around the magnet: on the axis it points straight out of N, and on the
                perpendicular bisector it points back parallel to the axis.
              </p>
            </>
          ) : (
            <>
              <Range
                label="Current I"
                value={current}
                min={1}
                max={10}
                step={0.5}
                unit="A"
                format={(v) => v.toFixed(1)}
                onChange={setCurrent}
              />
              <Range
                label="Distance r"
                value={radius}
                min={1}
                max={8}
                step={0.5}
                unit="cm"
                format={(v) => v.toFixed(1)}
                onChange={setRadius}
              />
              <p className="apple-lab-note">
                This is the field of a long straight wire, so the number is real: at 5 A and 4 cm it is
                25 µT, about half of Earth's field.
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {readouts.map(([label, value]) => (
            <Readout key={label} label={label} value={value} />
          ))}
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">
              {source === "magnet" ? "The two-pole model" : "Long straight wire"}
            </p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              {source === "magnet"
                ? "A real bar magnet has no separate poles — the field is that of a dipole. Two poles of equal and opposite strength reproduce it exactly outside the magnet, which is why the lines bend the way iron filings show."
                : `B = μ₀I/2πr = (4π × 10⁻⁷ × ${current.toFixed(1)}) / (2π × ${(radius / 100).toFixed(2)}) = ${(microTesla / 1e6).toExponential(2)} T = ${microTesla.toFixed(1)} µT`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
