import { Picker, Range, Readout, ink, plate, VIOLET, CYAN, AMBER, MINT } from "@/components/lab/bench-atoms";
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
 * for a concave one. Rearranged that is v = u·f/(u + f). Getting this wrong is
 * not a rounding error — `u·f/(u − f)` is the *other* convention (u positive,
 * m = −v/u), and mixing the two printed a wrong image distance for every focal
 * length. The cases this file is checked against, computed by hand:
 *
 *     convex f = +12, u = −30  →  v = +20.0, m = −0.67   real, inverted, small
 *     convex f = +12, u = −24  →  v = +24.0, m = −1.00   real, same size (2F)
 *     convex f = +12, u = −6   →  v = −12.0, m = +2.00   virtual, upright, big
 *     concave f = −12, u = −30 →  v = −8.6,  m = +0.29   virtual, upright, small
 *
 * The drawing keeps one px-per-cm factor on both axes, so the ray angles are the
 * real angles rather than a sketch. That factor is *computed* from what has to
 * be on the plate — the object, both focal points, 2F and the image — so no
 * arrow can be pushed off the paper when u is slung out to 62 cm.
 */

type LensKind = "convex" | "concave";

const BENCH_W = 760;
const BENCH_H = 330;
const AXIS_Y = 172;
const PAD_L = 48;
const PAD_R = 58;
/** A 6 cm object needs no more room than this; past it the plate just empties. */
const MAX_PX_PER_CM = 9;
/** Everything is clipped to this frame, so no ray bleeds out of the plate. */
const FRAME = { x: 12, y: 14, w: BENCH_W - 24, h: BENCH_H - 28 };
/** Vertical bands for the annotations. Fixed rows cannot collide with each other. */
const F_LABEL_Y = AXIS_Y - 11;
const MARK_2F_Y = AXIS_Y + 16;
const CAPTION_Y = AXIS_Y + 34;
const VIRTUAL_CAPTION_Y = AXIS_Y + 52;
const RULER_Y = AXIS_Y + 86;

function lensFormula(kind: LensKind, f: number, u: number) {
  const focal = kind === "convex" ? f : -f;
  const v = (u * focal) / (u + focal);
  const m = v / u;
  return { focal, v, m };
}

export default function OpticsPractical() {
  const [kind, setKind] = useState<LensKind>("convex");
  const [focal, setFocal] = useState(12);
  const [distance, setDistance] = useState(30);
  const [height, setHeight] = useState(4);
  const transition = useSpringTransition();

  const { focal: f, v, m } = useMemo(() => lensFormula(kind, focal, distance), [kind, focal, distance]);

  const convex = kind === "convex";
  const finite = Number.isFinite(v);
  /* u = −f puts the image at infinity: the two refracted rays leave parallel. */
  const atFocus = Math.abs(distance - focal) < 0.5;

  /* ---- the scale, and every point on the plate, in one place ---------- */
  const leftCm = Math.max(distance, f, convex ? 2 * f : f, finite && v < 0 ? -v : 0) + 8;
  const rightCm = Math.max(finite && v > 0 ? v : 0, f, convex ? 2 * f : f, 10) + 8;
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

  const imageOnPlate = finite && imageX > FRAME.x + 8 && imageX < FRAME.x + FRAME.w - 8;
  const imageDown = imageTipY > AXIS_Y;
  const imageColor = v < 0 ? VIOLET : CYAN;
  /* Tall images would leave the plate; the arrow stops at the frame and the
     read-out still carries the true height. */
  const imageTipClamped = Math.max(FRAME.y + 8, Math.min(FRAME.y + FRAME.h - 8, imageTipY));

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

  const nature = [
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
  const rulerStep = s * 10 >= 34 ? 10 : 20;
  const ticks: number[] = [];
  for (let cm = -Math.floor(leftCm / rulerStep) * rulerStep; cm <= rightCm; cm += rulerStep / 2) {
    ticks.push(Math.round(cm * 10) / 10);
  }

  /* A solid arrow head: readable even when the image is only a centimetre tall. */
  const head = (px: number, tipY: number, dir: 1 | -1) =>
    `M ${px - 4.5} ${tipY + 8 * dir} L ${px} ${tipY} L ${px + 4.5} ${tipY + 8 * dir} Z`;

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
              stroke={ink(0.14)}
            />
            {ticks.map((cm) => {
              const major = Math.abs(cm % 10) < 0.01;
              return (
                <line
                  key={`tick-${cm}`}
                  x1={x(cm)}
                  y1={RULER_Y - (major ? 6 : 3)}
                  x2={x(cm)}
                  y2={RULER_Y + (major ? 6 : 3)}
                  stroke={ink(major ? 0.3 : 0.16)}
                />
              );
            })}
            {ticks
              .filter((cm) => Math.abs(cm % 10) < 0.01)
              .map((cm) => (
                <text
                  key={`ticklabel-${cm}`}
                  x={x(cm)}
                  y={RULER_Y + 19}
                  fontSize={9.5}
                  fill={ink(cm === 0 ? 0.55 : 0.4)}
                  textAnchor="middle"
                >
                  {cm === 0 ? "lens" : Math.abs(cm)}
                </text>
              ))}
            <text x={FRAME.x + 6} y={RULER_Y + 19} fontSize={9} fill={ink(0.3)}>
              cm from the lens
            </text>

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
                <text
                  x={mark.px}
                  y={F_LABEL_Y}
                  fontSize={10}
                  fill={ink(0.55)}
                  textAnchor="middle"
                >
                  {mark.label}
                </text>
              </g>
            ))}

            {/* the rays, clipped to the plate */}
            <g clipPath="url(#lab-optics-frame)">
              {/* 1 — parallel in, then through F′ (convex) or away from F (concave) */}
              <line x1={objectX} y1={objectTipY} x2={lensX} y2={objectTipY} stroke={VIOLET} strokeWidth={1.2} />
              <line x1={lensX} y1={objectTipY} x2={FRAME.x + FRAME.w} y2={ray1FarY} stroke={VIOLET} strokeWidth={1.2} />

              {/* 2 — straight through the optical centre */}
              <line x1={objectX} y1={objectTipY} x2={FRAME.x + FRAME.w} y2={ray2FarY} stroke={MINT} strokeWidth={1.2} />

              {/* 3 — aimed through the focus, leaving parallel to the axis */}
              {drawRay3 ? (
                <>
                  <line x1={objectX} y1={objectTipY} x2={lensX} y2={ray3LensY} stroke={AMBER} strokeWidth={1.2} />
                  <line
                    x1={lensX}
                    y1={ray3LensY}
                    x2={FRAME.x + FRAME.w}
                    y2={ray3LensY}
                    stroke={AMBER}
                    strokeWidth={1.2}
                  />
                </>
              ) : null}
            </g>

            {/* the lens itself */}
            <motion.path
              d={
                convex
                  ? `M ${lensX} ${AXIS_Y - 78} Q ${lensX + 22} ${AXIS_Y} ${lensX} ${AXIS_Y + 78} Q ${lensX - 22} ${AXIS_Y} ${lensX} ${AXIS_Y - 78} Z`
                  : `M ${lensX} ${AXIS_Y - 72} Q ${lensX - 16} ${AXIS_Y} ${lensX} ${AXIS_Y + 72} L ${lensX} ${AXIS_Y + 72} Q ${lensX + 16} ${AXIS_Y} ${lensX} ${AXIS_Y - 72} Z`
              }
              fill={plate(0.06)}
              stroke={ink(0.5)}
              strokeWidth={1.4}
              key={kind}
              initial={{ opacity: 0, scaleY: 0.6 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={transition}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <text x={lensX + 16} y={AXIS_Y - 86} fontSize={10} fill={ink(0.55)}>
              {convex ? "convex" : "concave"}
            </text>

            {/* the object */}
            <line x1={objectX} y1={AXIS_Y} x2={objectX} y2={objectTipY} stroke={CYAN} strokeWidth={2.4} />
            <path d={head(objectX, objectTipY, 1)} fill={CYAN} />
            <text x={objectX} y={CAPTION_Y} fontSize={10} fill={ink(0.6)} textAnchor="middle">
              object
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
                  strokeWidth={2.4}
                  strokeDasharray={v < 0 ? "5 4" : undefined}
                />
                <path d={head(imageX, imageTipClamped, imageDown ? -1 : 1)} fill={imageColor} />
                <text
                  x={imageX}
                  y={v < 0 ? VIRTUAL_CAPTION_Y : CAPTION_Y}
                  fontSize={10}
                  fill={ink(0.62)}
                  textAnchor="middle"
                >
                  {v < 0 ? "virtual image" : "real image"}
                </text>
              </g>
            ) : (
              <text x={FRAME.x + FRAME.w - 14} y={FRAME.y + 20} fontSize={11} fill={ink(0.55)} textAnchor="end">
                the image forms at infinity — the rays leave parallel
              </text>
            )}
          </svg>
        </div>

        <p className="apple-lab-note mt-1">
          {hint} Cyan is the object, its image is drawn in cyan when it is real and dashed violet when it is
          virtual.
        </p>
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
            min={6}
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
          <Readout label="Image distance v" value={finite ? `${v.toFixed(1)} cm` : "∞"} />
          <Readout label="Magnification m" value={`${m.toFixed(2)}×`} />
          <Readout label="Image height" value={`${Math.abs(m * height).toFixed(1)} cm`} />
          <Readout label="Image" value={nature} />
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">Thin-lens relation</p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              1/v − 1/u = 1/f → 1/({finite ? v.toFixed(1) : "∞"}) − 1/(−{distance.toFixed(0)}) = 1/
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
