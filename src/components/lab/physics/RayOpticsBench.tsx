import {
  Picker,
  Questions,
  Range,
  ink,
  plate,
  AMBER,
  CYAN,
} from "@/components/lab/bench-atoms";
import { useMemo, useState } from "react";

/**
 * Ray optics — spherical mirrors, Class 12.
 *
 * The thin-lens practical lives under Optics; this bench is the mirror chapter,
 * where the sign convention is the whole difficulty. It is a *real-is-positive*
 * bench: u is the object distance in front of the mirror, f is positive for a
 * concave mirror (focus in front) and negative for a convex one, and v comes
 * out of 1/v + 1/u = 1/f with its sign intact.
 *
 * There is no sweep animation and no run button here, because there is no
 * process to run: a mirror does not do anything over time. What a student
 * needs is the six textbook positions, so the bench is an optical rail — the
 * object sits on a ruler, the stops at C and F are one click away, and the
 * working underneath is the mirror formula with the numbers put in.
 */

type Mirror = "concave" | "convex";

const W = 880;
const H = 470;
const MIRROR_X = 660;
const AXIS_Y = 244;

export function RayOpticsBench() {
  const [mirror, setMirror] = useState<Mirror>("concave");
  const [u, setU] = useState(36);
  const [focal, setFocal] = useState(18);
  const [objH, setObjH] = useState(6);
  const [showRay3, setShowRay3] = useState(true);

  const f = mirror === "concave" ? focal : -focal;
  /* u = f is the parallel-ray limit, handled separately. Only a concave
     mirror has that degeneracy; a convex mirror's focus is behind it. */
  const atFocus = f > 0 && Math.abs(u - f) < 0.35;
  const v = atFocus ? Infinity : (u * f) / (u - f);
  const m = atFocus ? Infinity : -v / u;
  const imageH = atFocus ? Infinity : m * objH;

  const real = Number.isFinite(v) && v > 0; /* real images form in front */

  /* A near-focus object throws its image hundreds of centimetres out. Keep the
     plate readable and say the image has left it, instead of shrinking the
     whole drawing until the object is a dot. */
  const imageOnPlate = Number.isFinite(v) && Math.abs(v) <= 120;
  const extent = Math.max(u, Math.min(Number.isFinite(v) ? Math.abs(v) : 0, 120), Math.abs(f) * 2, 10);
  const scale = Math.min(6.4, 520 / extent);
  const px = (dist: number, side: "front" | "back") =>
    side === "front" ? MIRROR_X - dist * scale : MIRROR_X + dist * scale;
  const objX = px(u, "front");
  const imgX = Number.isFinite(v) ? (v > 0 ? px(v, "front") : px(-v, "back")) : MIRROR_X - 200;

  const degenerate = atFocus || !Number.isFinite(v);

  const rays = useMemo(() => {
    if (degenerate) return null;
    const objTip = { x: objX, y: AXIS_Y - objH * scale };
    const hit1 = { x: MIRROR_X, y: objTip.y };
    const focus = { x: MIRROR_X - f * scale, y: AXIS_Y };

    /* Ray 2: aimed at F, reflects parallel to the axis. */
    const t = u / (u - f);
    const hit2y = objTip.y + t * (AXIS_Y - objTip.y);
    const hit2 = { x: MIRROR_X, y: hit2y };

    /* Ray 3: through the centre of curvature, returns along itself. */
    const centre = { x: MIRROR_X - 2 * f * scale, y: AXIS_Y };

    const extend = (from: { x: number; y: number }, towards: { x: number; y: number }, len = 320) => {
      const dx = towards.x - from.x;
      const dy = towards.y - from.y;
      const mag = Math.hypot(dx, dy) || 1;
      return { x: from.x + (dx / mag) * len, y: from.y + (dy / mag) * len };
    };

    /* The reflected parallel ray runs through F when the mirror is concave, but
       away from F when it is convex — the direction is the sign of f. */
    const out1 = f > 0 ? extend(hit1, focus, 420) : extend(hit1, { x: 2 * hit1.x - focus.x, y: 2 * hit1.y - focus.y }, 420);
    const back1 = f > 0 ? extend(hit1, { x: 2 * hit1.x - focus.x, y: 2 * hit1.y - focus.y }, 340) : extend(hit1, focus, 340);
    const out2 = { x: MIRROR_X - 420, y: hit2y };
    const back2 = { x: MIRROR_X + 340, y: hit2y };

    /* Ray 3 only exists when the centre lies behind the object relative to the
       mirror; otherwise the line through C heads away from the mirror. */
    const ray3 = centre.x > objTip.x ? (() => {
      const tt = (MIRROR_X - objTip.x) / (centre.x - objTip.x);
      const hit = { x: MIRROR_X, y: objTip.y + tt * (AXIS_Y - objTip.y) };
      return f < 0 ? { from: objTip, hit, beyond: extend(hit, centre, 260) } : { from: objTip, hit, beyond: null };
    })() : null;

    return { objTip, hit1, hit2, focus, out1, back1, out2, back2, ray3 };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [degenerate, objX, imageH, objH, u, f, scale]);

  const nature = degenerate
    ? "The object sits at F: the reflected rays leave parallel, so no image forms."
    : `${real ? "Real, inverted" : "Virtual, erect"}${
        Math.abs(m) > 1.02 ? ", magnified" : Math.abs(m) < 0.98 ? ", diminished" : ", same size"
      } · ${Math.abs(v).toFixed(1)} cm ${real ? "in front of the mirror" : "behind the mirror"}${
        imageOnPlate ? "" : " — beyond this plate"
      }.`;

  /* The six textbook stops, one click each. Clamped to the slider's range and
     snapped to its half-centimetre steps so the control and the label agree. */
  const stop = (value: number) => Math.min(90, Math.max(5, Math.round(value * 2) / 2));
  const stops =
    mirror === "concave"
      ? [
          { label: "Beyond C", value: stop(focal * 2.7) },
          { label: "At C", value: stop(focal * 2) },
          { label: "Between C and F", value: stop(focal * 1.5) },
          { label: "At F", value: stop(focal) },
          { label: "Inside F", value: stop(focal * 0.6) },
        ]
      : [
          { label: "Far object", value: 90 },
          { label: "Mid field", value: 36 },
          { label: "Close object", value: 14 },
        ];

  const formulaCheck = Number.isFinite(v)
    ? `1/${v.toFixed(1)} + 1/${u.toFixed(1)} = ${(1 / v + 1 / u).toFixed(4)} = 1/${f.toFixed(1)}`
    : "1/v + 1/u = 1/f — with u = f the left side cannot be satisfied: v is infinite";

  return (
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 12 · Ray optics · spherical mirrors</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              An optical bench: move the object, watch the image
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              Three construction rays, drawn from the same u and f. Where they
              meet is the image — in front of the mirror when v is positive,
              behind it (dashed) when v is negative.
            </p>
          </div>
          <Picker
            label="Mirror"
            value={mirror}
            options={[
              { id: "concave", label: "Concave" },
              { id: "convex", label: "Convex" },
            ]}
            onChange={setMirror}
          />
        </div>

        <div className="px-2 py-2 sm:px-3 sm:py-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={`Ray diagram for a ${mirror} mirror with the object ${u.toFixed(1)} centimetres in front`}
          >
            {/* Principal axis */}
            <line x1={20} y1={AXIS_Y} x2={W - 20} y2={AXIS_Y} stroke={ink(0.35)} strokeWidth={1.3} strokeDasharray="7 6" />

            {/* A centimetre ruler along the axis, so distances are countable. */}
            {(() => {
              const step = scale * 10 >= 40 ? 10 : scale * 20 >= 40 ? 20 : 50;
              const from = 0;
              const to = Math.floor((MIRROR_X - 30) / scale / step) * step;
              const ticks: number[] = [];
              for (let cm = from; cm <= to; cm += step) ticks.push(cm);
              return ticks.map((cm) => (
                <g key={cm}>
                  <line x1={MIRROR_X - cm * scale} y1={AXIS_Y + 30} x2={MIRROR_X - cm * scale} y2={AXIS_Y + 36} stroke={ink(0.22)} strokeWidth={1} />
                  <text x={MIRROR_X - cm * scale} y={AXIS_Y + 50} textAnchor="middle" fontSize={9.5} fill={ink(0.35)}>
                    {cm}
                  </text>
                </g>
              ));
            })()}

            {/* Spherical mirror: an arc of a circle seen edge-on. */}
            {(() => {
              const top = 60;
              const bottom = H - 60;
              const bulge = mirror === "concave" ? 20 : -20;
              return (
                <>
                  <path
                    d={`M ${MIRROR_X - bulge} ${top} Q ${MIRROR_X + bulge * 1.6} ${AXIS_Y} ${MIRROR_X - bulge} ${bottom}`}
                    fill="none"
                    stroke="var(--lab-diagram-ink)"
                    strokeWidth={3.4}
                    strokeLinecap="round"
                  />
                  {/* Hatched back — always the right-hand side, whichever way
                      the reflecting face bulges. */}
                  {Array.from({ length: 14 }, (_, i) => {
                    const y = top + 12 + i * ((bottom - top - 24) / 13);
                    const x = MIRROR_X + 22;
                    return <line key={i} x1={x} y1={y} x2={x + 10} y2={y + 7} stroke={ink(0.22)} strokeWidth={1.4} />;
                  })}
                </>
              );
            })()}

            {/* Focus and centre */}
            <circle cx={MIRROR_X - f * scale} cy={AXIS_Y} r={3.6} fill={AMBER} />
            <text x={MIRROR_X - f * scale} y={AXIS_Y + 19} textAnchor="middle" fontSize={11.5} fill={AMBER}>F</text>
            {MIRROR_X - 2 * f * scale < W - 26 ? (
              <>
                <circle cx={MIRROR_X - 2 * f * scale} cy={AXIS_Y} r={3.4} fill={ink(0.5)} />
                <text x={MIRROR_X - 2 * f * scale} y={AXIS_Y + 19} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>C</text>
              </>
            ) : null}

            {/* Object */}
            <line x1={objX} y1={AXIS_Y} x2={objX} y2={AXIS_Y - objH * scale} stroke={CYAN} strokeWidth={3.4} strokeLinecap="round" />
            <circle cx={objX} cy={AXIS_Y - objH * scale} r={3.4} fill={CYAN} />
            <text x={objX} y={AXIS_Y - objH * scale - 9} textAnchor="middle" fontSize={11.5} fill={CYAN}>object</text>

            {/* Construction rays */}
            {rays ? (
              <g>
                <line x1={rays.objTip.x} y1={rays.objTip.y} x2={rays.hit1.x} y2={rays.hit1.y} stroke={ink(0.6)} strokeWidth={1.6} />
                <line x1={rays.hit1.x} y1={rays.hit1.y} x2={rays.out1.x} y2={rays.out1.y} stroke={ink(0.6)} strokeWidth={1.6} />
                {!real && <line x1={rays.hit1.x} y1={rays.hit1.y} x2={rays.back1.x} y2={rays.back1.y} stroke={ink(0.35)} strokeWidth={1.3} strokeDasharray="6 5" />}
                <line x1={rays.objTip.x} y1={rays.objTip.y} x2={rays.hit2.x} y2={rays.hit2.y} stroke={ink(0.45)} strokeWidth={1.5} />
                <line x1={rays.hit2.x} y1={rays.hit2.y} x2={rays.out2.x} y2={rays.out2.y} stroke={ink(0.45)} strokeWidth={1.5} />
                {!real && <line x1={rays.hit2.x} y1={rays.hit2.y} x2={rays.back2.x} y2={rays.back2.y} stroke={ink(0.3)} strokeWidth={1.3} strokeDasharray="6 5" />}
                {showRay3 && rays.ray3 && (
                  <>
                    <line x1={rays.ray3.from.x} y1={rays.ray3.from.y} x2={rays.ray3.hit.x} y2={rays.ray3.hit.y} stroke={ink(0.28)} strokeWidth={1.3} strokeDasharray="4 5" />
                    {rays.ray3.beyond && <line x1={rays.ray3.hit.x} y1={rays.ray3.hit.y} x2={rays.ray3.beyond.x} y2={rays.ray3.beyond.y} stroke={ink(0.25)} strokeWidth={1.2} strokeDasharray="4 5" />}
                  </>
                )}

                {imageOnPlate && (
                  <>
                    <line
                      x1={imgX}
                      y1={AXIS_Y}
                      x2={imgX}
                      y2={AXIS_Y - imageH * scale}
                      stroke={real ? "var(--lab-diagram-ink)" : AMBER}
                      strokeWidth={3.4}
                      strokeLinecap="round"
                      strokeDasharray={real ? undefined : "6 4"}
                    />
                    <text
                      x={imgX}
                      y={AXIS_Y - imageH * scale - 9}
                      textAnchor="middle"
                      fontSize={11.5}
                      fill={real ? ink(0.75) : AMBER}
                      paintOrder="stroke"
                      stroke={plate(0.92)}
                      strokeWidth={3.5}
                    >
                      image
                    </text>
                  </>
                )}
              </g>
            ) : (
              <text x={MIRROR_X - 80} y={AXIS_Y - 70} textAnchor="end" fontSize={12.5} fill={AMBER}>
                object at F — reflected rays run parallel, no image
              </text>
            )}

            {/* Distance brackets */}
            <line x1={objX} y1={H - 26} x2={MIRROR_X} y2={H - 26} stroke={CYAN} strokeWidth={1.4} />
            <text x={(objX + MIRROR_X) / 2} y={H - 32} textAnchor="middle" fontSize={11.5} fill={CYAN}>u = {u.toFixed(1)} cm</text>
            <text x={W - 22} y={28} textAnchor="end" fontSize={11} fill={ink(0.45)}>
              {mirror === "concave" ? "concave · f is positive (focus in front)" : "convex · f is negative (focus behind)"}
            </text>
          </svg>
        </div>

        {/* The working, printed the way the chapter prints it. */}
        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          <p className="font-mono text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
            {formulaCheck}
            {Number.isFinite(v) ? (
              <span className="text-[var(--lab-diagram-mint)]"> ✓</span>
            ) : null}
            {Number.isFinite(v) ? (
              <> · m = −v/u = {m.toFixed(2)} · h′ = {imageH.toFixed(1)} cm</>
            ) : null}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--lab-ink)]">
            {nature}
          </p>
        </div>

        {/* The rail: this slider is the bench's only primary control. */}
        <div className="border-t border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-diagram-plate)_55%,transparent)] px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
            <div className="min-w-[240px] flex-1">
              <Range
                label="Object on the bench · u"
                value={u}
                min={5}
                max={90}
                step={0.5}
                unit="cm"
                format={(value) => value.toFixed(1)}
                onChange={setU}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stops.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                  data-active={Math.abs(u - entry.value) < 0.3}
                  onClick={() => setU(entry.value)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
            <Range
              label="Focal length |f|"
              value={focal}
              min={8}
              max={30}
              step={0.5}
              unit="cm"
              format={(value) => value.toFixed(1)}
              onChange={setFocal}
            />
            <Range
              label="Object height"
              value={objH}
              min={2}
              max={10}
              step={0.5}
              unit="cm"
              format={(value) => value.toFixed(1)}
              onChange={setObjH}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              data-active={showRay3}
              role="switch"
              aria-checked={showRay3}
              onClick={() => setShowRay3((value) => !value)}
            >
              Third ray through C
            </button>
            <span className="text-[11px] text-[var(--lab-ink-micro)]">
              {mirror === "concave"
                ? "Between F and the mirror the image turns virtual and erect — the shaving-mirror region."
                : "A convex mirror always gives a virtual, erect, diminished image behind it — the rear-view mirror."}
            </span>
          </div>
        </div>
      </section>

      <Questions
        items={[
          {
            q: "Why is f negative for a convex mirror?",
            a: "Its focus is behind the mirror, where the reflected rays only appear to meet. With real-is-positive, distances behind the mirror are negative — so f is negative and v comes out negative too.",
          },
          {
            q: "What does m = −v/u tell you besides size?",
            a: "The sign of m. Negative means the image is inverted (and real); positive means erect (and virtual, for a single mirror).",
          },
          {
            q: "What happens exactly at the focus?",
            a: "Rays from the object arrive parallel after reflection, so they never meet: v is infinite and no image forms. Move u a little either side and the image jumps from in front to behind the mirror.",
          },
          {
            q: "Which ray do you actually need to draw?",
            a: "Any two of the three meet at the image. The parallel ray and the ray through C are the easiest on paper; the third one is drawn here so the meeting point is over-determined and you can see all three agree.",
          },
        ]}
      />
    </div>
  );
}

export default RayOpticsBench;
