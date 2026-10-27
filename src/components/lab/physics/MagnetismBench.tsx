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
 *                  they crowd at the poles, and they never cross. The filings
 *                  are the same field sampled on a lattice: short dashes whose
 *                  direction and darkness are the local B, which is what the
 *                  iron actually does.
 *   Straight wire  the long-wire result B = μ₀I/2πr in real microtesla, with the
 *                  field circles, a needle tangential to them, and the 1/r law
 *                  plotted beside it so "doubling r halves B" is visible.
 *
 * The compass is the experiment, not decoration: on both plates its needle is
 * rotated to the field computed at its own position, which is exactly what
 * walking a compass around the source proves.
 */

type Source = "magnet" | "wire";

const PLATE_W = 760;
const PLATE_H = 352;
const CX = PLATE_W / 2;
const CY = 176;
const PX_PER_CM = 18;
const FRAME = { x: 12, y: 12, w: PLATE_W - 24, h: PLATE_H - 24 };
/** Pole-to-pole separation of the two-pole model, in plate pixels. */
const POLE_HALF = 56;
const MAGNET_HALF_X = 104;
const MAGNET_HALF_Y = 17;

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

const inMagnet = (p: Vec) => Math.abs(p.x) < MAGNET_HALF_X && Math.abs(p.y) < MAGNET_HALF_Y;

/** The field 1 cm out from the north face, on the axis: the yardstick every
 *  relative reading on this bench is quoted against. */
const REFERENCE = Math.hypot(
  fieldAt(MAGNET_HALF_X + PX_PER_CM, 0).x,
  fieldAt(MAGNET_HALF_X + PX_PER_CM, 0).y,
);

/**
 * Walks one field line from a seed, in plate-local coordinates (the magnet is
 * centred on 0,0), until it reaches the magnet body.
 *
 * `direction` −1 walks against B, which is how the half of the loop that
 * arrives from the north pole is drawn; the line ends when it enters the body,
 * because that is the pole it terminates on. Seeding the *pole face* instead is
 * what broke the first version of this bench: lines through points close to the
 * axis belong to enormous flux surfaces, so every one of them ran off the plate
 * as a near-straight ray instead of closing. Seeding on the perpendicular
 * bisector at distance h gives a closed loop of radius h, because on the
 * equatorial line the field is perpendicular to the radius: the size of the
 * drawing is chosen, not left to chance.
 */
function walk(seed: Vec, direction: 1 | -1, step = 3, maxSteps = 900): Vec[] {
  const pull = (x: number, y: number) => {
    const v = unit(fieldAt(x, y));
    return { x: direction * v.x, y: direction * v.y };
  };
  const pts: Vec[] = [];
  let p: Vec = { ...seed };
  let outside = !inMagnet(seed);
  for (let i = 0; i < maxSteps; i += 1) {
    pts.push({ ...p });
    const k1 = pull(p.x, p.y);
    const k2 = pull(p.x + (step / 2) * k1.x, p.y + (step / 2) * k1.y);
    const k3 = pull(p.x + (step / 2) * k2.x, p.y + (step / 2) * k2.y);
    const k4 = pull(p.x + step * k3.x, p.y + step * k3.y);
    p = {
      x: p.x + (step / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: p.y + (step / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    };
    if (inMagnet(p)) {
      if (outside) break;
    } else {
      outside = true;
    }
  }
  return pts;
}

/* Traced once: the loop sizes are a fixed ladder, so the drawing is the same
   construction every time the bench is opened. Five rungs either side, which is
   the density the textbook figure has — three left the plate looking empty. */
const LOOP_RADII = [30, 54, 82, 114, 150];
const FIELD_LINES: Vec[][] = (() => {
  const lines: Vec[][] = [];
  for (const h of LOOP_RADII) {
    for (const sign of [1, -1]) {
      const seed = { x: 0, y: sign * h };
      const outward = walk(seed, -1).reverse();
      const inward = walk(seed, 1).slice(1);
      lines.push([...outward, ...inward]);
    }
  }
  return lines;
})();

/* Iron filings: the same field sampled on a lattice, drawn as short dashes that
   point along B and darken where B is strong. Sampled once — it does not depend
   on the sliders. */
const FILINGS: { x: number; y: number; angle: number; opacity: number }[] = (() => {
  const out: { x: number; y: number; angle: number; opacity: number }[] = [];
  for (let px = FRAME.x + 14; px <= FRAME.x + FRAME.w - 14; px += 22) {
    for (let py = FRAME.y + 14; py <= FRAME.y + FRAME.h - 14; py += 22) {
      const local = { x: px - CX, y: py - CY };
      if (inMagnet(local)) continue;
      const b = fieldAt(local.x, local.y);
      const rel = Math.hypot(b.x, b.y) / REFERENCE;
      out.push({
        x: px,
        y: py,
        angle: (Math.atan2(b.y, b.x) * 180) / Math.PI,
        opacity: Math.min(0.03 + 0.17 * Math.pow(rel, 0.42), 0.2),
      });
    }
  }
  return out;
})();

const pathOf = (points: Vec[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(CX + p.x).toFixed(1)} ${(CY + p.y).toFixed(1)}`)
    .join(" ");

/** Colour of a field line: the one under the compass is the one being taught. */
const lineColor = (index: number, nearest: number) => (index === nearest ? MINT : ink(0.32));

/**
 * A compass standing on the field: the local direction is drawn through it as a
 * dashed line, and the needle lies along that same direction, red half to N.
 */
function Compass({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line
        x1={-42}
        y1={0}
        x2={42}
        y2={0}
        stroke={MINT}
        strokeWidth={1.2}
        strokeOpacity={0.55}
        strokeDasharray="3 4"
        transform={`rotate(${angle})`}
      />
      <circle r={18} fill={plate(0.82)} stroke={ink(0.4)} strokeWidth={1.2} />
      <circle r={13} fill="none" stroke={ink(0.1)} strokeWidth={1} />
      <g transform={`rotate(${angle})`}>
        <path d="M 13 0 L 0 -4.6 L 0 4.6 Z" fill="#e05b45" />
        <path d="M -13 0 L 0 -4.6 L 0 4.6 Z" fill={ink(0.45)} />
      </g>
      <circle r={2.1} fill={ink(0.8)} />
    </g>
  );
}

/** The 1/r law drawn beside the wire plate: the marker rides the curve. */
function WireLawInset({
  current,
  radius,
  microTesla,
}: {
  current: number;
  radius: number;
  microTesla: number;
}) {
  const box = { x: 552, y: 28, w: 184, h: 122 };
  const rMax = 8;
  const bMax = 200;
  const gx = (r: number) => box.x + 34 + (r / rMax) * (box.w - 48);
  const gy = (b: number) => box.y + box.h - 28 - (Math.min(b, bMax) / bMax) * (box.h - 40);
  const curve = Array.from({ length: 60 }, (_, i) => {
    const r = 0.6 + (i * (rMax - 0.6)) / 59;
    return `${i === 0 ? "M" : "L"}${gx(r).toFixed(1)} ${gy((20 * current) / r).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={12}
        fill={plate(0.6)}
        stroke={ink(0.1)}
      />
      {/* axes */}
      <line x1={gx(0)} y1={gy(0)} x2={gx(rMax)} y2={gy(0)} stroke={ink(0.24)} strokeWidth={1} />
      <line x1={gx(0)} y1={gy(bMax)} x2={gx(0)} y2={gy(0)} stroke={ink(0.24)} strokeWidth={1} />
      <text x={gx(0) + 4} y={gy(bMax) + 12} fontSize={8.5} fill={ink(0.4)}>
        B (µT)
      </text>
      <text x={gx(rMax)} y={gy(0) + 13} fontSize={8.5} fill={ink(0.4)} textAnchor="end">
        r (cm)
      </text>
      <text x={gx(0) - 4} y={gy(bMax) + 4} fontSize={8.5} fill={ink(0.34)} textAnchor="end">
        {bMax}
      </text>
      <text x={gx(0) - 4} y={gy(0) + 3} fontSize={8.5} fill={ink(0.34)} textAnchor="end">
        0
      </text>
      {/* the law itself */}
      <path d={curve} fill="none" stroke={MINT} strokeWidth={1.8} strokeLinecap="round" />
      {/* where the compass is standing */}
      <line
        x1={gx(radius)}
        y1={gy(microTesla)}
        x2={gx(radius)}
        y2={gy(0)}
        stroke={AMBER}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <line
        x1={gx(0)}
        y1={gy(microTesla)}
        x2={gx(radius)}
        y2={gy(microTesla)}
        stroke={AMBER}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <circle cx={gx(radius)} cy={gy(microTesla)} r={4} fill={AMBER} />
      <text x={box.x + 12} y={box.y + 15} fontSize={9} fill={ink(0.45)}>
        B ∝ 1/r
      </text>
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
    return {
      relative: Math.hypot(b.x, b.y) / REFERENCE,
      /* Screen rotation for the needle, and the honest maths angle for the
         read-out: anticlockwise from the magnet's axis, y up. */
      screenAngle: (Math.atan2(b.y, b.x) * 180) / Math.PI,
      mathsAngle: (Math.atan2(-b.y, b.x) * 180) / Math.PI,
      distance: Math.hypot(compass.x - POLE_HALF, compass.y) / PX_PER_CM,
      /* The line the compass is standing on. Five rungs of loops only reach
         about ±4 cm either side of the magnet, and the sliders walk out to
         18 cm, so a compass well clear of the bundle is honestly *on no drawn
         line* — nothing lights up rather than the wrong loop being claimed. */
      nearest: (() => {
        const best = FIELD_LINES.reduce((closest, line, index) => {
          const d = line.reduce(
            (min, p) => Math.min(min, Math.hypot(p.x - compass.x, p.y - compass.y)),
            Infinity,
          );
          return d < closest.d ? { index, d } : closest;
        }, { index: -1, d: Infinity });
        return best.d < 14 ? best.index : -1;
      })(),
    };
  }, [compass.x, compass.y]);

  /* B = μ₀I / 2πr = 2 × 10⁻⁷ · I/r. In microtesla that is 20·I/r(cm). */
  const microTesla = (20 * current) / radius;

  /* What the colours on the plate mean, in the same order the plate is built. */
  const legend: Array<[string, string]> =
    source === "magnet"
      ? [
          ["Ten field lines, traced from B — they never cross", MINT],
          ["Iron filings: a dash along B, darker where B is strong", ink(0.5)],
          ["Compass: needle along the field where it stands", "#e05b45"],
        ]
      : [
          ["Field circles, anticlockwise for current out of the page", MINT],
          ["B ∝ 1/r plotted — the dot is where this compass stands", AMBER],
          ["Compass: tangent to the circle it stands on", "#e05b45"],
        ];

  const readouts: Array<[string, string]> =
    source === "magnet"
      ? [
          ["Field at the compass", `${magnet.relative.toFixed(3)}× pole face`],
          ["Field direction", `${Math.round(magnet.mathsAngle)}° from the axis`],
          ["Distance from the N pole", `${magnet.distance.toFixed(1)} cm`],
          ["Far from the magnet", "B falls as 1/r³"],
        ]
      : [
          ["Field B at r", `${microTesla.toFixed(1)} µT`],
          ["Distance r", `${radius.toFixed(1)} cm`],
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
                <span className="apple-lab-chip">I = {current.toFixed(1)} A</span>
                <span className="apple-lab-chip">r = {radius.toFixed(1)} cm</span>
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
                ? "Field lines and iron filings of a bar magnet, with a compass showing the field direction at its position"
                : `Concentric field circles around a straight wire carrying ${current} amperes, with a compass at ${radius} centimetres and the 1 over r law plotted`
            }
          >
            <defs>
              <clipPath id="lab-magnet-frame">
                <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} rx={12} />
              </clipPath>
              <radialGradient id="lab-magnet-pool" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: MINT, stopOpacity: 0.1 }} />
                <stop offset="100%" style={{ stopColor: MINT, stopOpacity: 0 }} />
              </radialGradient>
              <linearGradient id="lab-magnet-bar-s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "#5b8fd6" }} />
                <stop offset="52%" style={{ stopColor: "#3f6fb5" }} />
                <stop offset="100%" style={{ stopColor: "#2f5690" }} />
              </linearGradient>
              <linearGradient id="lab-magnet-bar-n" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "#e0695a" }} />
                <stop offset="52%" style={{ stopColor: "#c94a3f" }} />
                <stop offset="100%" style={{ stopColor: "#9d362e" }} />
              </linearGradient>
              <filter id="lab-magnet-glow" x="-14%" y="-40%" width="128%" height="180%">
                <feGaussianBlur stdDeviation="3.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect
              x={FRAME.x}
              y={FRAME.y}
              width={FRAME.w}
              height={FRAME.h}
              rx={12}
              fill={plate(0.35)}
              stroke={ink(0.08)}
            />

            {source === "magnet" ? (
              <>
                <ellipse cx={CX} cy={CY} rx={250} ry={170} fill="url(#lab-magnet-pool)" />

                {/* The two lines every statement about this figure is measured
                    from: the magnet's axis, and the bisector of it that the
                    compass is walked across. */}
                <line
                  x1={CX}
                  y1={FRAME.y + 14}
                  x2={CX}
                  y2={FRAME.y + FRAME.h - 14}
                  stroke={ink(0.1)}
                  strokeWidth={1}
                  strokeDasharray="2 6"
                />

                <g clipPath="url(#lab-magnet-frame)">
                  {/* Iron filings: the texture the field actually makes. */}
                  {FILINGS.map((filing) => (
                    <line
                      key={`${filing.x}-${filing.y}`}
                      x1={filing.x - 4}
                      y1={filing.y}
                      x2={filing.x + 4}
                      y2={filing.y}
                      stroke={ink(1)}
                      strokeOpacity={filing.opacity}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      transform={`rotate(${filing.angle.toFixed(1)} ${filing.x} ${filing.y})`}
                    />
                  ))}
                </g>

                {/* the axial line: straight out of N to infinity, and back from
                    infinity into S — the magnet body covers the middle */}
                <line x1={FRAME.x + 6} y1={CY} x2={FRAME.x + FRAME.w - 6} y2={CY} stroke={ink(0.22)} strokeWidth={1} />
                {[MAGNET_HALF_X + 58, -(MAGNET_HALF_X + 58)].map((dx) => (
                  <path
                    key={`axis-${dx}`}
                    d="M -4.6 -3.4 L 3 0 L -4.6 3.4 Z"
                    fill={ink(0.4)}
                    transform={`translate(${CX + dx} ${CY})`}
                  />
                ))}

                {/* the field, traced out of the north face and back into S */}
                {FIELD_LINES.map((line, index) => (
                  <path
                    key={index}
                    d={pathOf(line)}
                    fill="none"
                    stroke={lineColor(index, magnet.nearest)}
                    strokeWidth={index === magnet.nearest ? 2 : 1.25}
                    strokeLinecap="round"
                    filter={index === magnet.nearest ? "url(#lab-magnet-glow)" : undefined}
                  />
                ))}
                {/* two arrows per line, evenly spread along it, showing N → S */}
                {FIELD_LINES.map((line, index) => {
                  const color = lineColor(index, magnet.nearest);
                  return [0.3, 0.72].map((fraction) => {
                    const at = Math.floor(line.length * fraction);
                    const p = line[at];
                    const next = line[Math.min(line.length - 1, at + 4)];
                    if (!p || !next) return null;
                    const angle = (Math.atan2(next.y - p.y, next.x - p.x) * 180) / Math.PI;
                    return (
                      <path
                        key={`head-${index}-${fraction}`}
                        d="M -4.4 -3.2 L 3 0 L -4.4 3.2 Z"
                        fill={color}
                        transform={`translate(${CX + p.x} ${CY + p.y}) rotate(${angle})`}
                      />
                    );
                  });
                })}

                {/* the magnet — opaque, so the traced segment that runs through
                    the body is covered rather than shown as a wrong arrow */}
                <rect
                  x={CX - MAGNET_HALF_X}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X * 2}
                  height={MAGNET_HALF_Y * 2}
                  rx={6}
                  fill={plate(0.96)}
                />
                <rect
                  x={CX - MAGNET_HALF_X}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X}
                  height={MAGNET_HALF_Y * 2}
                  fill="url(#lab-magnet-bar-s)"
                />
                <rect
                  x={CX}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X}
                  height={MAGNET_HALF_Y * 2}
                  fill="url(#lab-magnet-bar-n)"
                />
                <rect
                  x={CX - MAGNET_HALF_X}
                  y={CY - MAGNET_HALF_Y}
                  width={MAGNET_HALF_X * 2}
                  height={MAGNET_HALF_Y * 2}
                  rx={6}
                  fill="none"
                  stroke={ink(0.42)}
                  strokeWidth={1.2}
                />
                <text
                  x={CX - MAGNET_HALF_X / 2}
                  y={CY + 5.5}
                  fontSize={13}
                  fontWeight={700}
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  S
                </text>
                <text
                  x={CX + MAGNET_HALF_X / 2}
                  y={CY + 5.5}
                  fontSize={13}
                  fontWeight={700}
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  N
                </text>

                {/* the measured distance the read-out quotes, drawn */}
                <line
                  x1={CX + POLE_HALF}
                  y1={CY}
                  x2={CX + compass.x}
                  y2={CY + compass.y}
                  stroke={AMBER}
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                />
                <circle cx={CX + POLE_HALF} cy={CY} r={2.4} fill={AMBER} />
                <text
                  x={(CX + POLE_HALF + CX + compass.x) / 2 + 8}
                  y={(CY + CY + compass.y) / 2 - 4}
                  fontSize={10}
                  fill={ink(0.62)}
                >
                  {magnet.distance.toFixed(1)} cm
                </text>

                <Compass x={CX + compass.x} y={CY + compass.y} angle={magnet.screenAngle} />
                <text x={CX + compass.x + 24} y={CY + compass.y + 12} fontSize={9.5} fill={ink(0.45)}>
                  compass
                </text>
                <text
                  x={CX + 7}
                  y={FRAME.y + FRAME.h - 7}
                  fontSize={9}
                  fill={ink(0.34)}
                >
                  perpendicular bisector
                </text>

                {/* the scale, so "9 cm" on the slider means something on the paper */}
                <g transform={`translate(${FRAME.x + 14} ${FRAME.y + 20})`}>
                  <line x1={0} y1={0} x2={PX_PER_CM * 6} y2={0} stroke={ink(0.4)} strokeWidth={1.2} />
                  {[0, 1, 2, 3, 4, 5, 6].map((cm) => (
                    <line
                      key={cm}
                      x1={cm * PX_PER_CM}
                      y1={-4}
                      x2={cm * PX_PER_CM}
                      y2={4}
                      stroke={ink(cm % 2 === 0 ? 0.42 : 0.24)}
                    />
                  ))}
                  <text x={0} y={-8} fontSize={9.5} fill={ink(0.42)}>
                    6 cm
                  </text>
                </g>
              </>
            ) : (
              <>
                {/* field circles: anticlockwise for current out of the page */}
                {[2, 4, 6, 8].map((cm) => {
                  const r = cm * PX_PER_CM;
                  return (
                    <g key={cm}>
                      <circle cx={CX} cy={CY} r={r} fill="none" stroke={ink(0.22)} strokeWidth={1.1} />
                      {/* at the top of a circle the anticlockwise tangent points
                          left — that is the right-hand rule, drawn */}
                      <path
                        d="M -4.6 -3.4 L 3 0 L -4.6 3.4 Z"
                        fill={ink(0.4)}
                        transform={`translate(${CX} ${CY - r}) rotate(180)`}
                      />
                      <text x={CX + 6} y={CY - r - 5} fontSize={9.5} fill={ink(0.4)}>
                        {cm} cm
                      </text>
                    </g>
                  );
                })}

                {/* the circle the compass is standing on */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={radius * PX_PER_CM}
                  fill="none"
                  stroke={MINT}
                  strokeWidth={1.8}
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
                <text x={CX + 26} y={CY - 8} fontSize={10} fill={ink(0.6)}>
                  r = {radius.toFixed(1)} cm
                </text>
                {/* tangent at (r, 0) points up the screen: anticlockwise */}
                <Compass x={CX + radius * PX_PER_CM} y={CY} angle={-90} />

                {/* the wire, current out of the page */}
                <circle cx={CX} cy={CY} r={11} fill={plate(0.85)} stroke={ink(0.5)} strokeWidth={1.3} />
                <circle cx={CX} cy={CY} r={7} fill="none" stroke={ink(0.25)} strokeWidth={1} />
                <circle cx={CX} cy={CY} r={2.8} fill={ink(0.75)} />
                <text x={CX + 16} y={CY + 26} fontSize={10.5} fill={ink(0.55)}>
                  current out of the page
                </text>
                <text x={CX - 18} y={CY - 18} fontSize={10} fill={ink(0.42)} textAnchor="end">
                  fingers curl anticlockwise
                </text>

                <WireLawInset current={current} radius={radius} microTesla={microTesla} />
              </>
            )}
          </svg>
        </div>

        <p className="apple-lab-note mt-1">
          {source === "magnet"
            ? "Field lines leave the north pole, curve through space and enter the south pole; inside the magnet they run S → N. The compass needle always lies along the line it is standing on, and two lines never cross."
            : "Right-hand thumb rule: point the thumb along the current, and the fingers curl the way the field goes. B = μ₀I/2πr — doubling the distance halves the field, doubling the current doubles it."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map(([text, color]) => (
            <span
              key={text}
              className="flex items-center gap-2 text-[11px] text-[var(--lab-ink-dim)]"
            >
              <span className="h-[2px] w-4 shrink-0 rounded-full" style={{ background: color }} />
              {text}
            </span>
          ))}
        </div>
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
                perpendicular bisector it points back parallel to the axis. The dashed mark from the
                north pole is the distance the read-out quotes, and a traced line lights up whenever the
                compass is standing on one.
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
                25 µT, about half of Earth's field. The inset plots B against r, with the dot where this
                compass is standing.
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
