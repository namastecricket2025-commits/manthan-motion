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
 *     1/v − 1/u = 1/f      m = v / u
 *
 * with the real-is-positive convention used in Indian school textbooks: u is
 * negative for a real object in front of the lens, f is positive for a convex
 * lens and negative for a concave one. That single sign rule is what makes the
 * virtual image appear on the same side as the object for a magnifying glass,
 * and why a concave lens always produces a diminished, upright image.
 *
 * The drawing is to scale (both axes share one px-per-cm factor), so the ray
 * angles are the real angles rather than a sketch. When the image falls beyond
 * the bench it is reported as a number and the rays keep their true direction,
 * instead of pretending the paper is longer than it is.
 */

type LensKind = "convex" | "concave";

const BENCH_W = 760;
const BENCH_H = 360;
const AXIS_Y = BENCH_H * 0.52;
const PX_PER_CM = 5.4;
const MAX_DRAW_CM = 68;

function lensFormula(kind: LensKind, f: number, u: number) {
  const focal = kind === "convex" ? f : -f;
  const v = (u * focal) / (u - focal);
  const m = v / u;
  return { focal, v, m };
}

export default function OpticsPractical() {
  const [kind, setKind] = useState<LensKind>("convex");
  const [focal, setFocal] = useState(12);
  const [distance, setDistance] = useState(30);
  const [height, setHeight] = useState(4);
  const transition = useSpringTransition();

  const optics = useMemo(() => lensFormula(kind, focal, distance), [kind, focal, distance]);
  const { focal: f, v, m } = optics;

  const originX = 200;
  const x = (cm: number) => originX + cm * PX_PER_CM;
  const y = (cm: number) => AXIS_Y - cm * PX_PER_CM;

  /* Keep the object and the lens on the bench; a 60 cm object distance with a
     70 cm bench would push the lens off the paper. */
  const objectX = x(-distance);
  const lensX = x(0);
  const focalX = x(f);
  const imageX = x(v);
  const objectTipY = y(height);
  /* Signed image height: negative magnification is an inverted image, which
     must be drawn below the axis, not above it. */
  const imageHeight = m * height;
  const imageTipY = y(imageHeight);

  const drawable = Number.isFinite(v) && Math.abs(v) <= MAX_DRAW_CM;
  const imageOnBench = drawable && imageX > 8 && imageX < BENCH_W - 8;
  const imageShift = imageTipY - AXIS_Y;

  /* Tall images would leave the frame; clamp the drawn arrow, say so in the
     read-out. The rays still leave in the right direction. */
  const clampedTipY = Math.max(18, Math.min(BENCH_H - 18, imageTipY));

  /* A ray that starts at the object tip and leaves along a direction. Returns
     the two points where it meets the lens plane and the bench edge. */
  const project = (slope: number) => {
    const lensHit = objectTipY + slope * (lensX - objectX);
    const farY = objectTipY + slope * (BENCH_W - 8 - objectX);
    return { lensHit, farY };
  };

  /* 1 — parallel to the axis, then through F′ (convex) or away from the
     virtual focus on the object side (concave). The concave line is drawn
     through the lens point and the near focus, so going right it diverges. */
  const ray1SlopeAfter =
    kind === "convex"
      ? (AXIS_Y - objectTipY) / (focalX - lensX)
      : (objectTipY - AXIS_Y) / (lensX - focalX);
  const ray1FarY = objectTipY + ray1SlopeAfter * (BENCH_W - 8 - lensX);

  /* 2 — straight through the optical centre. */
  const centreSlope = (AXIS_Y - objectTipY) / (lensX - objectX);
  const ray2FarY = objectTipY + centreSlope * (BENCH_W - 8 - objectX);

  /* 3 — through the near focus (convex) or aimed at the far focus (concave),
     leaving the lens parallel to the axis. */
  const nearFocusX = x(-f);
  const ray3Slope = (AXIS_Y - objectTipY) / (nearFocusX - objectX);
  const ray3LensY = objectTipY + ray3Slope * (lensX - objectX);

  const nature = [
    v > 0 ? "real" : "virtual",
    Math.abs(m) > 1.02 ? "enlarged" : Math.abs(m) < 0.98 ? "diminished" : "same size",
    m < 0 ? "inverted" : "upright",
  ].join(" · ");

  const equation = `${v >= 0 ? "+" : ""}${v.toFixed(1)} cm image at m = ${m.toFixed(2)}`;
  const objectOutsideFocus = distance > focal;
  const hint =
    kind === "concave"
      ? "A concave lens diverges: the image is always virtual, upright and smaller, and it sits between the lens and F."
      : objectOutsideFocus
        ? "Object beyond F → a real, inverted image on the other side, the way a camera or the eye uses it."
        : "Object inside F → a virtual, upright, enlarged image on the same side: the magnifying glass.";

  return (
    <div className="flex flex-col gap-4">
      <div className="apple-lab-panel apple-lab-glass min-w-0 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Ray construction</p>
            <h3 className="apple-lab-title mt-1 text-base">Thin lens · image formation</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="apple-lab-chip">f = {kind === "convex" ? "+" : "−"}
              {focal.toFixed(0)} cm</span>
            <span className="apple-lab-chip">u = −{distance.toFixed(0)} cm</span>
            <span className="apple-lab-chip">{nature}</span>
          </div>
        </div>

        <div className="lab-scroll mt-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${BENCH_W} ${BENCH_H}`}
            className="h-auto w-full min-w-[560px]"
            role="img"
            aria-label={`Ray diagram for a ${kind} lens with focal length ${focal} cm and object at ${distance} cm: ${nature} image`}
          >
            {/* the optical bench: a rail under the principal axis */}
            <line x1={16} y1={AXIS_Y + 92} x2={BENCH_W - 16} y2={AXIS_Y + 92} stroke={ink(0.1)} strokeWidth={1} />
            {Array.from({ length: 15 }, (_, i) => (
              <line
                key={i}
                x1={16 + i * ((BENCH_W - 32) / 14)}
                y1={AXIS_Y + 88}
                x2={16 + i * ((BENCH_W - 32) / 14)}
                y2={AXIS_Y + 96}
                stroke={ink(0.16)}
                strokeWidth={1}
              />
            ))}

            {/* principal axis */}
            <line
              x1={16}
              y1={AXIS_Y}
              x2={BENCH_W - 16}
              y2={AXIS_Y}
              stroke={ink(0.28)}
              strokeDasharray="5 5"
              strokeWidth={1}
            />

            {/* focal points, on both sides of the lens */}
            {[focalX, x(-f)].map((px, index) => (
              <g key={index}>
                <circle cx={px} cy={AXIS_Y} r={3} fill={AMBER} />
                <text x={px} y={AXIS_Y + 18} fontSize={10} fill={ink(0.55)} textAnchor="middle">
                  {/* Convex: F is on the object side (left), F′ on the image
                      side. Concave: the virtual focus is the near one (left). */}
                  {kind === "convex" ? (index === 0 ? "F′" : "F") : index === 0 ? "F" : "F′"}
                </text>
              </g>
            ))}

            {/* the lens: a lens shape, with the arrow direction telling convex
                from concave at a glance */}
            <motion.path
              d={
                kind === "convex"
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
            <text x={lensX + 16} y={AXIS_Y - 84} fontSize={10} fill={ink(0.55)}>
              {kind === "convex" ? "convex" : "concave"}
            </text>

            {/* object */}
            <line x1={objectX} y1={AXIS_Y} x2={objectX} y2={objectTipY} stroke={CYAN} strokeWidth={2.2} />
            <path
              d={`M ${objectX - 4} ${objectTipY + 7} L ${objectX} ${objectTipY} L ${objectX + 4} ${objectTipY + 7}`}
              fill="none"
              stroke={CYAN}
              strokeWidth={2}
            />
            <text x={objectX} y={AXIS_Y + 16} fontSize={10} fill={ink(0.6)} textAnchor="middle">
              object
            </text>

            {/* ray 1 — parallel in, through F′ */}
            <line x1={objectX} y1={objectTipY} x2={lensX} y2={objectTipY} stroke={VIOLET} strokeWidth={1.2} />
            <line
              x1={lensX}
              y1={objectTipY}
              x2={BENCH_W - 8}
              y2={ray1FarY}
              stroke={VIOLET}
              strokeWidth={1.2}
            />

            {/* ray 2 — through the centre, undeviated */}
            <line x1={objectX} y1={objectTipY} x2={BENCH_W - 8} y2={ray2FarY} stroke={MINT} strokeWidth={1.2} />

            {/* ray 3 — focus ray, leaving parallel */}
            <line x1={objectX} y1={objectTipY} x2={lensX} y2={ray3LensY} stroke={AMBER} strokeWidth={1.2} />
            <line x1={lensX} y1={ray3LensY} x2={BENCH_W - 8} y2={ray3LensY} stroke={AMBER} strokeWidth={1.2} />

            {/* image */}
            {imageOnBench ? (
              <g>
                <line
                  x1={imageX}
                  y1={AXIS_Y}
                  x2={imageX}
                  y2={clampedTipY}
                  stroke={imageShift < 0 ? VIOLET : CYAN}
                  strokeWidth={2.2}
                  strokeDasharray={v < 0 ? "5 4" : undefined}
                />
                <path
                  d={`M ${imageX - 4} ${clampedTipY + (imageShift < 0 ? 7 : -7)} L ${imageX} ${clampedTipY} L ${imageX + 4} ${clampedTipY + (imageShift < 0 ? 7 : -7)}`}
                  fill="none"
                  stroke={imageShift < 0 ? VIOLET : CYAN}
                  strokeWidth={2}
                />
                <text x={imageX} y={AXIS_Y + 16} fontSize={10} fill={ink(0.6)} textAnchor="middle">
                  {v < 0 ? "virtual image" : "real image"}
                </text>
              </g>
            ) : (
              <text x={BENCH_W - 20} y={AXIS_Y - 12} fontSize={11} fill={ink(0.55)} textAnchor="end">
                image forms {Number.isFinite(v) ? `${Math.abs(v).toFixed(0)} cm` : "at infinity"} away — beyond the bench
              </text>
            )}
          </svg>
        </div>

        <p className="apple-lab-note mt-1">{hint}</p>
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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Readout label="Image distance v" value={Number.isFinite(v) ? `${v.toFixed(1)} cm` : "∞"} />
          <Readout label="Magnification m" value={`${m.toFixed(2)}×`} />
          <Readout label="Image height" value={`${Math.abs(imageHeight).toFixed(1)} cm`} />
          <Readout label="Image" value={nature} />
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">Thin-lens relation</p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              1/v − 1/u = 1/f → 1/{v.toFixed(1)} − 1/(−{distance.toFixed(0)}) = 1/{f.toFixed(0)} · {equation}
            </p>
            <p className="apple-lab-note mt-1">
              Sign rule: distances measured against the incoming light are negative. A virtual image has v &lt; 0 and
              appears on the object side.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
