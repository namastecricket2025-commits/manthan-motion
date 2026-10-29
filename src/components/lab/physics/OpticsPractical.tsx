import { Picker, Questions, Range, Readout, ink, plate, VIOLET, CYAN, AMBER, MINT } from "@/components/lab/bench-atoms";
import { useSpringTransition } from "@/lib/motion";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

/**
 * Optics — the lens practical, drawn as the construction a student is taught.
 *
 * A thin lens sits on the principal axis; the object is dragged along it with a
 * slider; the focal length is the lens's own property. Every ray, the image
 * position, its height and its nature come out of the thin-lens relation
 *
 *     1/v − 1/u = 1/f        m = v / u
 *
 * with the sign convention used in Indian school textbooks: u is negative for a
 * real object in front of the lens, f is positive for a convex lens and negative
 * for a concave one. Rearranged that is v = u·f/(u + f).
 *
 * The slider reports the *distance* d, which is a positive number, and the one
 * place that turns it into u = −d is `lensFormula` below. That conversion is not
 * cosmetic: feeding +d into the u = −d form flips the answer for every case on
 * the bench — convex f = 12 with d = 30 printed 8.6 cm where the image is at
 * 20.0 cm. The cases this file is checked against:
 *
 *     convex f = +12, d = 30  →  v = +20.0, m = −0.67   real, inverted, small
 *     convex f = +12, d = 24  →  v = +24.0, m = −1.00   real, same size (2F)
 *     convex f = +12, d = 6   →  v = −12.0, m = +2.00   virtual, upright, big
 *     convex f = +12, d = 12  →  v = ∞                  at F, no image
 *     concave f = −12, d = 30 →  v = −8.6,  m = +0.29   virtual, upright, small
 *
 * The drawing keeps one px-per-cm factor on both axes, so the ray angles are the
 * real angles rather than a sketch. That factor is *computed* from what has to
 * be on the plate — the object, both focal points and 2F — so no arrow can be
 * pushed off the paper when the object is slung out to 62 cm. The image is not
 * part of that sum on purpose: an object one centimetre outside F puts its image
 * at 930 cm, and forcing that onto the plate would shrink the whole construction
 * to a smudge. Past the frame the plate says so and the read-out carries v.
 */

type LensKind = "convex" | "concave";

/**
 * The five object positions every textbook draws, as multiples of f. They are
 * buttons rather than another slider because a student is not shopping for a
 * distance here — they are trying to see the case they were told to remember
 * (beyond 2F, at 2F, between F and 2F, at F, inside F).
 */
const OBJECT_CASES = [
  { id: "beyond", label: "Beyond 2F", factor: 2.6 },
  { id: "at-2f", label: "At 2F", factor: 2 },
  { id: "between", label: "F → 2F", factor: 1.5 },
  { id: "at-f", label: "At F", factor: 1 },
  { id: "inside", label: "Inside F", factor: 0.6 },
];

const OPTICS_QUESTIONS = [
  {
    q: "Why is the virtual image drawn dashed?",
    a: "No light actually passes through it. The refracted rays are still diverging when they leave the lens; only their backward extensions meet there. A screen placed at I would catch nothing, which is exactly why the arrow is dotted.",
  },
  {
    q: "Why does the image turn upside down?",
    a: "Beyond F the lens bends every ray across the axis: the ray from the object's tip that passes the optical centre continues straight but downward, and the other two cross it below the axis. The crossing point is below, so the arrow points the other way.",
  },
  {
    q: "Why is there no image when the object is at F?",
    a: "The rays leave the lens parallel. Parallel rays never meet on either side, so v is infinite — not merely far away. A camera focused at infinity is the practical version of this case.",
  },
  {
    q: "What is special about 2F?",
    a: "At 2F the image lands at 2F on the other side with the same size (m = −1). It is the boundary between a diminished real image (object beyond 2F) and a magnified one (object between F and 2F).",
  },
];

const BENCH_W = 780;
const BENCH_H = 344;
const AXIS_Y = 152;
const PAD_L = 46;
const PAD_R = 60;
/** A 6 cm object needs no more room than this; past it the plate just empties. */
const MAX_PX_PER_CM = 10;
/** Everything is clipped to this frame, so no ray bleeds out of the plate. */
const FRAME = { x: 14, y: 14, w: BENCH_W - 28, h: BENCH_H - 28 };
/** Half-height of the lens shape, in plate pixels. */
const LENS_HALF = 86;

/*
 * The annotations live on fixed rows, which is the whole reason they cannot
 * collide: focal letters just above the axis, 2F just below it, then the two
 * dimension chains (u then v, so a virtual image on the object side has its own
 * row instead of fighting the object's), then the ruler. Ray arrows may reach
 * into the dimension rows, but a dimension ends exactly at the arrow it
 * measures, and its label is anchored at the lens end of the chain — the middle,
 * where an arrow could stand, is left empty.
 */
const F_LABEL_Y = AXIS_Y - 13;
const MARK_2F_Y = AXIS_Y + 17;
const DIM_U_Y = AXIS_Y + 62;
const DIM_V_Y = AXIS_Y + 88;
const RULER_Y = AXIS_Y + 130;

/**
 * The thin-lens relation in the textbook sign convention. `distance` is the
 * slider's positive centimetres; u = −distance is applied here and nowhere else.
 */
function lensFormula(kind: LensKind, f: number, distance: number) {
  const focal = kind === "convex" ? f : -f;
  const u = -distance;
  const v = (u * focal) / (u + focal);
  return { focal, v, m: v / u };
}

export default function OpticsPractical() {
  const [kind, setKind] = useState<LensKind>("convex");
  const [focal, setFocal] = useState(12);
  const [distance, setDistance] = useState(30);
  const [height, setHeight] = useState(4);
  const transition = useSpringTransition();

  const { focal: f, v, m } = useMemo(
    () => lensFormula(kind, focal, distance),
    [kind, focal, distance],
  );

  const convex = kind === "convex";
  const finite = Number.isFinite(v);
  const objectCaseAt = (factor: number) =>
    Math.min(62, Math.max(2, Math.round(factor * focal)));
  const activeCase = convex
    ? OBJECT_CASES.find(
        (entry) => Math.abs(distance - objectCaseAt(entry.factor)) < 0.5,
      )?.id
    : undefined;
  /* u = −f puts the image at infinity: the two refracted rays leave parallel. */
  const atFocus = Math.abs(distance - focal) < 0.5;

  /* ---- the scale, and every point on the plate, in one place ---------- */
  const leftCm = Math.max(distance, f, convex ? 2 * f : f) + 8;
  const rightCm = Math.max(f, convex ? 2 * f : f, 10) + 8;
  const s = Math.min(MAX_PX_PER_CM, (BENCH_W - PAD_L - PAD_R) / (leftCm + rightCm));
  const lensX = PAD_L + leftCm * s;
  const x = (cm: number) => lensX + cm * s;
  const y = (cm: number) => AXIS_Y - cm * s;

  const objectX = x(-distance);
  const objectTipY = y(height);
  const imageX = x(v);
  const imageTipY = y(m * height);
  /* The point the parallel ray passes through after the lens: the image-side
     focus for a convex lens, the object-side one its divergence appears to come
     from for a concave lens. */
  const axialFocusX = x(f);
  /* The focus the third ray is aimed through, on the far side of the object. */
  const ray3FocusX = x(-f);

  /* A real image can land beyond the frame once the object creeps up on F. The
     rays still meet there — off the paper — so the plate reports it instead of
     rescaling itself into illegibility. */
  const imageOnPlate = finite && imageX > FRAME.x + 10 && imageX < FRAME.x + FRAME.w - 10;
  const imageOffPlate = finite && !imageOnPlate;
  const imageDown = imageTipY > AXIS_Y;
  const imageColor = v < 0 ? VIOLET : CYAN;
  /* Tall images would leave the plate; the arrow stops at the frame and the
     read-out still carries the true height. */
  const imageTipClamped = Math.max(FRAME.y + 10, Math.min(FRAME.y + FRAME.h - 10, imageTipY));

  /* A ray that leaves the object tip along a slope, in plate coordinates. */
  const ray1AfterLens = convex
    ? (AXIS_Y - objectTipY) / (axialFocusX - lensX)
    : (objectTipY - AXIS_Y) / (lensX - axialFocusX);
  const ray1FarY = objectTipY + ray1AfterLens * (FRAME.x + FRAME.w - lensX);
  const centreSlope = (AXIS_Y - objectTipY) / (lensX - objectX);
  const ray2FarY = objectTipY + centreSlope * (FRAME.x + FRAME.w - objectX);
  const ray3Slope = (AXIS_Y - objectTipY) / (ray3FocusX - objectX);
  const ray3LensY = objectTipY + ray3Slope * (lensX - objectX);
  /* Through the focus is undefined when the object *is* on the focus, and that
     is exactly the u = f case: two rays are the whole construction there. */
  const drawRay3 = Math.abs(ray3FocusX - objectX) > 6;

  /* u = f is neither real nor virtual: the beam leaves parallel and no image
     forms, so saying "virtual · enlarged · upright" would be a lie. */
  const nature = !finite
    ? "image at infinity"
    : [
        v > 0 ? "real" : "virtual",
        Math.abs(m) > 1.02 ? "enlarged" : Math.abs(m) < 0.98 ? "diminished" : "same size",
        m < 0 ? "inverted" : "upright",
      ].join(" · ");

  const solved = finite
    ? `v = ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} cm, m = ${m.toFixed(2)}`
    : "v = ∞ — the refracted rays leave parallel";
  const hint = !convex
    ? "A concave lens diverges: the image is always virtual, upright and smaller, and it sits between the lens and F."
    : atFocus
      ? "Object at F → every ray leaves parallel, so no image forms: the image is at infinity."
      : distance > focal
        ? "Object beyond F → a real, inverted image on the other side, the way a camera or the eye uses it."
        : "Object inside F → a virtual, upright, enlarged image on the same side: the magnifying glass.";

  /* ---- annotation set ------------------------------------------------- */
  const foci = [
    { px: axialFocusX, label: convex ? "F′" : "F" },
    { px: ray3FocusX, label: convex ? "F" : "F′" },
  ];
  const marks2F = convex
    ? [
        { px: x(2 * f), label: "2F′" },
        { px: x(-2 * f), label: "2F" },
      ]
    : [];
  const rulerStep = s * 10 >= 44 ? 10 : s * 20 >= 44 ? 20 : 50;
  /* The ruler spans the frame, and each tick carries the reading measured from
     the lens, whichever way the construction is scaled. */
  const rulerFrom = Math.floor((FRAME.x + 6 - lensX) / s / rulerStep) * rulerStep;
  const rulerTo = Math.ceil((FRAME.x + FRAME.w - 6 - lensX) / s / rulerStep) * rulerStep;
  const ticks: number[] = [];
  for (let cm = rulerFrom; cm <= rulerTo; cm += rulerStep / 2) {
    ticks.push(Math.round(cm * 10) / 10);
  }

  /* A solid arrow head: readable even when the image is only a centimetre tall. */
  const head = (px: number, tipY: number, dir: 1 | -1) =>
    `M ${px - 4.5} ${tipY + 8 * dir} L ${px} ${tipY} L ${px + 4.5} ${tipY + 8 * dir} Z`;

  /* A dimension chain: the line, its end ticks and one arrow head pointing at
     each end, from x1 to x2 on the row `rowY`. */
  const dimensions = [
    {
      key: "u",
      x1: objectX,
      x2: lensX,
      label: `u = ${distance.toFixed(0)} cm`,
      sub: "object → lens",
      color: ink(0.5),
    },
    ...(finite && imageOnPlate
      ? [
          {
            key: "v",
            x1: lensX,
            x2: imageX,
            label: `v = ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} cm`,
            sub: v > 0 ? "lens → image" : "image → lens",
            color: v > 0 ? CYAN : VIOLET,
          },
        ]
      : []),
  ].map((entry, index) => ({ ...entry, rowY: index === 0 ? DIM_U_Y : DIM_V_Y }));

  return (
    <div className="flex flex-col gap-4">
      <div className="apple-lab-panel apple-lab-glass min-w-0 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Ray construction</p>
            <h3 className="apple-lab-title mt-1 text-base">Thin lens · image formation</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="apple-lab-chip">
              f = {convex ? "+" : "−"}
              {focal.toFixed(0)} cm
            </span>
            <span className="apple-lab-chip">u = −{distance.toFixed(0)} cm</span>
            <span className="apple-lab-chip">{nature}</span>
          </div>
        </div>

        <div className="lab-scroll mt-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${BENCH_W} ${BENCH_H}`}
            className="h-auto w-full min-w-[560px]"
            role="img"
            aria-label={`Ray diagram for a ${kind} lens of focal length ${focal} centimetres with the object ${distance} centimetres away: ${nature} image`}
          >
            <defs>
              <clipPath id="lab-optics-frame">
                <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} rx={12} />
              </clipPath>
              <linearGradient id="lab-optics-glass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: "rgba(255,255,255,0.16)" }} />
                <stop offset="52%" style={{ stopColor: "rgba(255,255,255,0.03)" }} />
                <stop offset="100%" style={{ stopColor: "rgba(255,255,255,0.13)" }} />
              </linearGradient>
            </defs>

            {/* the plate the construction is drawn on */}
            <rect
              x={FRAME.x}
              y={FRAME.y}
              width={FRAME.w}
              height={FRAME.h}
              rx={12}
              fill={plate(0.35)}
              stroke={ink(0.08)}
            />

            {/* a centimetre grid, faint: the plate reads as ruled paper rather
                than as an empty rectangle */}
            <g clipPath="url(#lab-optics-frame)">
              {Array.from({ length: Math.ceil((FRAME.w + 40) / (5 * s)) + 2 }, (_, i) => {
                const cm = Math.ceil(leftCm / 5) * -5 + i * 5;
                return (
                  <line
                    key={`grid-${cm}`}
                    x1={x(cm)}
                    y1={FRAME.y}
                    x2={x(cm)}
                    y2={FRAME.y + FRAME.h}
                    stroke={ink(Math.abs(cm % 10) < 0.01 ? 0.05 : 0.03)}
                  />
                );
              })}
            </g>

            {/* principal axis */}
            <line
              x1={FRAME.x + 4}
              y1={AXIS_Y}
              x2={FRAME.x + FRAME.w - 4}
              y2={AXIS_Y}
              stroke={ink(0.26)}
              strokeDasharray="5 5"
              strokeWidth={1}
            />

            {/* ruler — every distance on the plate is read from the lens */}
            <line
              x1={FRAME.x + 6}
              y1={RULER_Y}
              x2={FRAME.x + FRAME.w - 6}
              y2={RULER_Y}
              stroke={ink(0.12)}
            />
            {ticks.map((cm) => {
              const major = Math.abs(cm % rulerStep) < 0.01;
              return (
                <line
                  key={`tick-${cm}`}
                  x1={x(cm)}
                  y1={RULER_Y - (major ? 6 : 3)}
                  x2={x(cm)}
                  y2={RULER_Y + (major ? 6 : 3)}
                  stroke={ink(major ? 0.28 : 0.14)}
                />
              );
            })}
            {ticks
              .filter((cm) => Math.abs(cm % rulerStep) < 0.01)
              .map((cm) => (
                <text
                  key={`ticklabel-${cm}`}
                  x={x(cm)}
                  y={RULER_Y + 19}
                  fontSize={9.5}
                  fill={ink(cm === 0 ? 0.55 : 0.38)}
                  textAnchor="middle"
                >
                  {cm === 0 ? "lens" : Math.abs(cm)}
                </text>
              ))}
            {/* The caption sits on the row above the scale, not on it: the ruler
                runs the full width, so its leftmost tick label lands exactly
                where a caption set on the same row would sit. */}
            <text x={FRAME.x + 6} y={RULER_Y - 11} fontSize={9} fill={ink(0.3)}>
              cm from the lens
            </text>

            {/* the two measured chains: what the sliders say, drawn on the plate */}
            {dimensions.map((dimension) => {
              const left = Math.min(dimension.x1, dimension.x2);
              const right = Math.max(dimension.x1, dimension.x2);
              if (right - left < 26) return null;
              return (
                <g key={dimension.key}>
                  <line
                    x1={left}
                    y1={dimension.rowY}
                    x2={right}
                    y2={dimension.rowY}
                    stroke={dimension.color}
                    strokeWidth={1}
                  />
                  <line x1={left} y1={dimension.rowY - 5} x2={left} y2={dimension.rowY + 5} stroke={dimension.color} />
                  <line x1={right} y1={dimension.rowY - 5} x2={right} y2={dimension.rowY + 5} stroke={dimension.color} />
                  <path
                    d={`M ${left + 8} ${dimension.rowY - 3.4} L ${left} ${dimension.rowY} L ${left + 8} ${dimension.rowY + 3.4} Z`}
                    fill={dimension.color}
                  />
                  <path
                    d={`M ${right - 8} ${dimension.rowY - 3.4} L ${right} ${dimension.rowY} L ${right - 8} ${dimension.rowY + 3.4} Z`}
                    fill={dimension.color}
                  />
                  <text
                    x={left + 14}
                    y={dimension.rowY - 7}
                    fontSize={10.5}
                    fill={ink(0.72)}
                    textAnchor="start"
                  >
                    {dimension.label}
                  </text>
                  <text x={left + 14} y={dimension.rowY + 14} fontSize={8.5} fill={ink(0.32)} textAnchor="start">
                    {dimension.sub}
                  </text>
                </g>
              );
            })}

            {/* focal points, and 2F on the convex lens where the standard cases
                are counted from */}
            {marks2F.map((mark) => (
              <g key={mark.label}>
                <line
                  x1={mark.px}
                  y1={AXIS_Y - 6}
                  x2={mark.px}
                  y2={AXIS_Y + 6}
                  stroke={ink(0.3)}
                  strokeWidth={1}
                />
                <text x={mark.px} y={MARK_2F_Y} fontSize={9} fill={ink(0.42)} textAnchor="middle">
                  {mark.label}
                </text>
              </g>
            ))}
            {foci.map((mark) => (
              <g key={mark.label}>
                <circle cx={mark.px} cy={AXIS_Y} r={3} fill={AMBER} />
                <circle cx={mark.px} cy={AXIS_Y} r={6} fill="none" stroke={AMBER} strokeOpacity={0.28} />
                <text
                  x={mark.px}
                  y={F_LABEL_Y}
                  fontSize={10}
                  fill={ink(0.6)}
                  textAnchor="middle"
                >
                  {mark.label}
                </text>
              </g>
            ))}

            {/* the rays, clipped to the plate */}
            <g clipPath="url(#lab-optics-frame)">
              {/* 1 — parallel in, then through F′ (convex) or away from F (concave) */}
              <line
                x1={objectX}
                y1={objectTipY}
                x2={lensX}
                y2={objectTipY}
                stroke={VIOLET}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <line
                x1={lensX}
                y1={objectTipY}
                x2={FRAME.x + FRAME.w}
                y2={ray1FarY}
                stroke={VIOLET}
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              {/* 2 — straight through the optical centre */}
              <line
                x1={objectX}
                y1={objectTipY}
                x2={FRAME.x + FRAME.w}
                y2={ray2FarY}
                stroke={MINT}
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              {/* 3 — aimed through the focus, leaving parallel to the axis */}
              {drawRay3 ? (
                <>
                  <line
                    x1={objectX}
                    y1={objectTipY}
                    x2={lensX}
                    y2={ray3LensY}
                    stroke={AMBER}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={lensX}
                    y1={ray3LensY}
                    x2={FRAME.x + FRAME.w}
                    y2={ray3LensY}
                    stroke={AMBER}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {/* A virtual image is where the refracted rays only *appear* to
                  meet, so the construction that puts it there is drawn: the two
                  backward extensions, dashed, from the image tip to the lens. */}
              {imageOnPlate && v < 0 ? (
                <>
                  <line
                    x1={imageX}
                    y1={imageTipClamped}
                    x2={lensX}
                    y2={objectTipY}
                    stroke={VIOLET}
                    strokeWidth={1.1}
                    strokeDasharray="4 5"
                    strokeOpacity={0.7}
                  />
                  <line
                    x1={imageX}
                    y1={imageTipClamped}
                    x2={lensX}
                    y2={AXIS_Y}
                    stroke={MINT}
                    strokeWidth={1.1}
                    strokeDasharray="4 5"
                    strokeOpacity={0.7}
                  />
                  {drawRay3 ? (
                    <line
                      x1={imageX}
                      y1={imageTipClamped}
                      x2={lensX}
                      y2={imageTipClamped}
                      stroke={AMBER}
                      strokeWidth={1.1}
                      strokeDasharray="4 5"
                      strokeOpacity={0.7}
                    />
                  ) : null}
                </>
              ) : null}
            </g>

            {/* the lens itself */}
            <motion.path
              d={
                convex
                  ? `M ${lensX} ${AXIS_Y - LENS_HALF} Q ${lensX + 22} ${AXIS_Y} ${lensX} ${AXIS_Y + LENS_HALF} Q ${lensX - 22} ${AXIS_Y} ${lensX} ${AXIS_Y - LENS_HALF} Z`
                  : `M ${lensX} ${AXIS_Y - LENS_HALF} Q ${lensX - 16} ${AXIS_Y} ${lensX} ${AXIS_Y + LENS_HALF} L ${lensX} ${AXIS_Y + LENS_HALF} Q ${lensX + 16} ${AXIS_Y} ${lensX} ${AXIS_Y - LENS_HALF} Z`
              }
              fill="url(#lab-optics-glass)"
              stroke={ink(0.52)}
              strokeWidth={1.4}
              key={kind}
              initial={{ opacity: 0, scaleY: 0.6 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={transition}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <text x={lensX + 18} y={AXIS_Y - LENS_HALF + 2} fontSize={10} fill={ink(0.55)}>
              {convex ? "convex" : "concave"}
            </text>

            {/* the object */}
            <line x1={objectX} y1={AXIS_Y} x2={objectX} y2={objectTipY} stroke={CYAN} strokeWidth={2.6} />
            <path d={head(objectX, objectTipY, 1)} fill={CYAN} />
            <circle cx={objectX} cy={AXIS_Y} r={2.2} fill={CYAN} />
            <text
              x={objectX - 7}
              y={objectTipY - 5}
              fontSize={10}
              fontWeight={600}
              fill={CYAN}
              textAnchor="end"
            >
              O
            </text>

            {/* the image: solid for a real one, dashed for a virtual one */}
            {imageOnPlate ? (
              <g>
                <line
                  x1={imageX}
                  y1={AXIS_Y}
                  x2={imageX}
                  y2={imageTipClamped}
                  stroke={imageColor}
                  strokeWidth={2.6}
                  strokeDasharray={v < 0 ? "5 4" : undefined}
                />
                <path d={head(imageX, imageTipClamped, imageDown ? -1 : 1)} fill={imageColor} />
                <circle cx={imageX} cy={AXIS_Y} r={2.2} fill={imageColor} />
                <text
                  x={imageX + 7}
                  y={imageTipClamped + (imageDown ? 13 : -6)}
                  fontSize={10}
                  fontWeight={600}
                  fill={imageColor}
                  textAnchor="start"
                >
                  I
                </text>
              </g>
            ) : (
              <g>
                <rect
                  x={FRAME.x + FRAME.w - 296}
                  y={FRAME.y + 10}
                  width={286}
                  height={22}
                  rx={11}
                  fill={plate(0.72)}
                  stroke={ink(0.12)}
                />
                <text x={FRAME.x + FRAME.w - 24} y={FRAME.y + 25} fontSize={10.5} fill={ink(0.6)} textAnchor="end">
                  {imageOffPlate
                    ? `v = ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)} cm — the image is off this plate`
                    : "the image forms at infinity — the rays leave parallel"}
                </text>
              </g>
            )}
          </svg>
        </div>

        <p className="apple-lab-note mt-1">{hint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {[
            ["Parallel ray → through F′", VIOLET],
            ["Through the optical centre", MINT],
            ["Through F → leaves parallel", AMBER],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-2 text-[11px] text-[var(--lab-ink-dim)]">
              <span className="h-[2px] w-4 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-2 text-[11px] text-[var(--lab-ink-dim)]">
            <span className="h-[2px] w-4 rounded-full border-t-2 border-dashed" style={{ borderColor: ink(0.5) }} />
            Virtual image · dashed, on the object side
          </span>
        </div>

        <Questions items={OPTICS_QUESTIONS} className="mt-4" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <Picker
            label="Lens"
            value={kind}
            options={[
              { id: "convex", label: "Convex" },
              { id: "concave", label: "Concave" },
            ]}
            onChange={(next) => setKind(next)}
          />
          {convex ? (
            <div>
              <p className="apple-lab-micro">Standard position</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {OBJECT_CASES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setDistance(objectCaseAt(entry.factor))}
                    data-active={activeCase === entry.id}
                    className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Range
            label="Focal length f"
            value={focal}
            min={6}
            max={30}
            step={1}
            unit="cm"
            onChange={setFocal}
          />
          <Range
            label="Object distance u"
            value={distance}
            min={2}
            max={62}
            step={1}
            unit="cm"
            onChange={setDistance}
          />
          <Range
            label="Object height"
            value={height}
            min={1}
            max={6}
            step={0.5}
            unit="cm"
            onChange={setHeight}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Readout label="Image distance v" value={finite ? `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} cm` : "∞"} />
          <Readout label="Magnification m" value={`${m.toFixed(2)}×`} />
          <Readout label="Image height" value={`${Math.abs(m * height).toFixed(1)} cm`} />
          <Readout label="Image" value={nature} />
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">Thin-lens relation</p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              1/v − 1/u = 1/f → 1/({finite ? (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) : "∞"}) − 1/(−{distance.toFixed(0)}) = 1/
              {f.toFixed(0)} · {solved}
            </p>
            <p className="apple-lab-note mt-1">
              Sign rule: distances measured against the incoming light are negative. A virtual image has v &lt; 0 and
              appears on the object side, so the rays only appear to meet there.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
