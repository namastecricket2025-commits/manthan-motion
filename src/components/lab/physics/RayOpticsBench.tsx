import {
  BenchStage,
  LiveDot,
  Picker,
  Questions,
  Range,
  StageStat,
  StageToggle,
  ink,
  plate,
  AMBER,
  CYAN,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Ray optics — spherical mirrors, Class 12.
 *
 * The thin-lens practical lives under Optics; this bench is the mirror chapter,
 * where the sign convention is the whole difficulty. It is a *real-is-positive*
 * bench: u is the object distance in front of the mirror, f is positive for a
 * concave mirror (focus in front) and negative for a convex one, and v comes
 * out of 1/v + 1/u = 1/f with its sign intact.
 *
 * The three construction rays are drawn from the same u and f, not sketched:
 * the parallel ray reflects through F, the focal ray reflects parallel, and the
 * centre-of-curvature ray returns along itself. The image is where they meet —
 * and when v is negative it meets *behind* the mirror, so the rays are drawn
 * solid in front and dashed on the extension, exactly the distinction the
 * textbook makes and the diagram usually blurs.
 *
 * "Sweep the object" is the demo a blackboard cannot do: it walks u from far
 * out to inside the focus, so the reader watches the image run away from the
 * mirror, vanish at F, and come back on the other side, upright. That single
 * animation is what turns the sign rule into something seen rather than
 * memorised.
 */

type Mirror = "concave" | "convex";

const W = 880;
const H = 470;
const MIRROR_X = 660;
const AXIS_Y = 244;

/** Seconds the sweep takes to walk u from the far end to the near end. */
const SWEEP_SECONDS = 9;

export function RayOpticsBench() {
  const [mirror, setMirror] = useState<Mirror>("concave");
  const [u, setU] = useState(30);
  const [focal, setFocal] = useState(18);
  const [objH, setObjH] = useState(6);
  const [showRay3, setShowRay3] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const f = mirror === "concave" ? focal : -focal;
  /* Mirror formula. u = f is the parallel-ray limit, handled separately. */
  /* Only a concave mirror has the u = f degeneracy; a convex mirror's focal
     point is behind it and never sends the reflected rays parallel. */
  const atFocus = f > 0 && Math.abs(u - f) < 0.35;
  const v = atFocus ? Infinity : (u * f) / (u - f);
  const m = atFocus ? Infinity : -v / u;
  const imageH = atFocus ? Infinity : m * objH;

  const real = Number.isFinite(v) && v > 0; /* real images form in front */

  /* One scale for the whole plate: the object, the image and the mirror radius
     all have to fit. */
  /* A near-focus object throws its image hundreds of centimetres out. Keep the
     plate readable and say that the image has left it, instead of shrinking the
     whole drawing until the object is a dot. */
  const imageOnPlate = Number.isFinite(v) && Math.abs(v) <= 120;
  const extent = Math.max(u, Math.min(Number.isFinite(v) ? Math.abs(v) : 0, 120), Math.abs(f) * 2, 10);
  /* The plate is wider than it was, so the same construction gets ~40% more
     pixels per centimetre instead of huddling in the middle of the card. */
  const scale = Math.min(6.4, 520 / extent);
  const px = (dist: number, side: "front" | "back") =>
    side === "front" ? MIRROR_X - dist * scale : MIRROR_X + dist * scale;
  const objX = px(u, "front");
  const imgX = Number.isFinite(v) ? (v > 0 ? px(v, "front") : px(-v, "back")) : MIRROR_X - 200;

  const degenerate = atFocus || !Number.isFinite(v);

  const rays = useMemo(() => {
    if (degenerate) return null;
    const objTip = { x: objX, y: AXIS_Y - objH * scale };
    const imgTip = { x: imgX, y: AXIS_Y - (imageH ?? 0) * scale };

    /* Ray 1: parallel to the axis, reflects through F (concave) or away from F
       (convex). The outgoing line runs from the hit point through F. */
    const hit1 = { x: MIRROR_X, y: objTip.y };
    const focus = { x: MIRROR_X - f * scale, y: AXIS_Y };

    /* Ray 2: aimed at F, reflects parallel to the axis at the point it strikes
       the mirror. That height is exactly the image height. */
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
       away from F when it is convex — the direction is the sign of f, not a
       separate rule to remember. */
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

    return { objTip, imgTip, hit1, hit2, focus, centre, out1, back1, out2, back2, ray3 };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [degenerate, objX, imgX, imageH, objH, u, f, scale]);

  const nature = degenerate
    ? "Rays leave parallel — no image forms."
    : `${real ? "Real, inverted" : "Virtual, erect"}${Math.abs(m) > 1.02 ? ", magnified" : Math.abs(m) < 0.98 ? ", diminished" : ""} · ${Math.abs(v).toFixed(1)} cm ${real ? "in front" : "behind"}${imageOnPlate ? "" : " — beyond this plate"}`;

  /* ---- the sweep ----------------------------------------------------- */
  /* u walks a triangle between 90 cm and just inside F, so the image crosses
     the focus and comes back virtual — the one motion the sign convention is
     about. A convex mirror never has that crossing, so it sweeps 90 → 12 and
     back instead, where the virtual image simply grows. */
  const uMin = mirror === "concave" ? Math.max(4, focal - 6) : 12;
  const last = useRef<number | null>(null);
  const sweepPhase = useRef(0);
  useAnimationFrame((now) => {
    if (!sweeping) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current);
    last.current = now;
    sweepPhase.current = (sweepPhase.current + dt / 1000 / SWEEP_SECONDS) % 2;
    const triangle = sweepPhase.current <= 1 ? sweepPhase.current : 2 - sweepPhase.current;
    setU(Math.round((90 - triangle * (90 - uMin)) * 2) / 2);
  });

  const toggleSweep = () => {
    if (!sweeping) {
      last.current = null;
      if (u <= uMin + 0.5 || u >= 89.5) sweepPhase.current = u >= 89.5 ? 0 : 1;
    }
    setSweeping((value) => !value);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 12 · Ray optics — spherical mirrors"
        title="Three construction rays, one image"
        meta={
          <>
            <span className="apple-lab-chip">{mirror} · f = {f.toFixed(0)} cm</span>
            <LiveDot on={sweeping} label={sweeping ? "sweeping u" : degenerate ? "no image" : real ? "real image" : "virtual image"} />
          </>
        }
        toolbar={
          <>
            <Picker
              label="Mirror"
              value={mirror}
              options={[
                { id: "concave", label: "Concave (converging)" },
                { id: "convex", label: "Convex (diverging)" },
              ]}
              onChange={(next) => {
                setMirror(next);
                setSweeping(false);
              }}
            />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageToggle label="Third ray through C" checked={showRay3} onChange={setShowRay3} />
              </div>
            </div>
          </>
        }
        rail={
          <>
            <button
              type="button"
              className={`apple-lab-btn ${sweeping ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
              onClick={toggleSweep}
            >
              {sweeping ? "Hold the object" : "Sweep the object"}
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(((90 - u) / (90 - uMin)) * 100).toFixed(1)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              u = {u.toFixed(1)} cm · {mirror === "concave" ? `F at ${focal.toFixed(0)} cm` : "no crossing for a convex mirror"}
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="Image distance v" value={Number.isFinite(v) ? `${v.toFixed(1)} cm` : "∞"} tone={real ? "cyan" : "violet"} />
            <StageStat label="Magnification m" value={Number.isFinite(m) ? m.toFixed(2) : "—"} tone={real ? undefined : "amber"} />
            <StageStat label="Image height" value={Number.isFinite(imageH) ? `${imageH.toFixed(1)} cm` : "—"} />
            <StageStat label="1/v + 1/u" value={Number.isFinite(v) ? (1 / v + 1 / u).toFixed(4) : "—"} />
          </>
        }
        note={nature}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ray diagram for a ${mirror} mirror`}>
          {/* Principal axis */}
          <line x1={20} y1={AXIS_Y} x2={W - 20} y2={AXIS_Y} stroke={ink(0.35)} strokeWidth={1.3} strokeDasharray="7 6" />

          {/* A centimetre ruler along the axis, so distances are countable. */}
          {(() => {
            const step = scale * 10 >= 40 ? 10 : scale * 20 >= 40 ? 20 : 50;
            const from = Math.ceil((40 - MIRROR_X) / scale / step) * step;
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
                {/* Hatched back — the non-reflecting side. */}
                {Array.from({ length: 14 }, (_, i) => {
                  const y = top + 12 + i * ((bottom - top - 24) / 13);
                  const x = MIRROR_X - bulge + (mirror === "concave" ? 11 : -11);
                  return <line key={i} x1={x} y1={y} x2={x + 10} y2={y + 7} stroke={ink(0.22)} strokeWidth={1.4} />;
                })}
              </>
            );
          })()}

          {/* Focus and centre */}
          <circle cx={MIRROR_X - f * scale} cy={AXIS_Y} r={3.6} fill={AMBER} />
          <text x={MIRROR_X - f * scale} y={AXIS_Y + 19} textAnchor="middle" fontSize={11.5} fill={AMBER}>F</text>
          <circle cx={MIRROR_X - 2 * f * scale} cy={AXIS_Y} r={3.4} fill={ink(0.5)} />
          <text x={MIRROR_X - 2 * f * scale} y={AXIS_Y + 19} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>C</text>

          {/* Object */}
          <line x1={objX} y1={AXIS_Y} x2={objX} y2={AXIS_Y - objH * scale} stroke={CYAN} strokeWidth={3.4} strokeLinecap="round" />
          <circle cx={objX} cy={AXIS_Y - objH * scale} r={3.4} fill={CYAN} />
          <text x={objX} y={AXIS_Y - objH * scale - 9} textAnchor="middle" fontSize={11.5} fill={CYAN}>object</text>

          {/* Construction rays */}
          {rays ? (
            <g>
              {/* Ray 1: incident, the reflected branch, and — only when the image
                  is virtual — the backward extension that the eye completes. */}
              <line x1={rays.objTip.x} y1={rays.objTip.y} x2={rays.hit1.x} y2={rays.hit1.y} stroke={ink(0.6)} strokeWidth={1.6} />
              <line x1={rays.hit1.x} y1={rays.hit1.y} x2={rays.out1.x} y2={rays.out1.y} stroke={ink(0.6)} strokeWidth={1.6} />
              {!real && <line x1={rays.hit1.x} y1={rays.hit1.y} x2={rays.back1.x} y2={rays.back1.y} stroke={ink(0.35)} strokeWidth={1.3} strokeDasharray="6 5" />}
              {/* Ray 2 */}
              <line x1={rays.objTip.x} y1={rays.objTip.y} x2={rays.hit2.x} y2={rays.hit2.y} stroke={ink(0.45)} strokeWidth={1.5} />
              <line x1={rays.hit2.x} y1={rays.hit2.y} x2={rays.out2.x} y2={rays.out2.y} stroke={ink(0.45)} strokeWidth={1.5} />
              {!real && <line x1={rays.hit2.x} y1={rays.hit2.y} x2={rays.back2.x} y2={rays.back2.y} stroke={ink(0.3)} strokeWidth={1.3} strokeDasharray="6 5" />}
              {/* Ray 3, through C */}
              {showRay3 && rays.ray3 && (
                <>
                  <line x1={rays.ray3.from.x} y1={rays.ray3.from.y} x2={rays.ray3.hit.x} y2={rays.ray3.hit.y} stroke={ink(0.28)} strokeWidth={1.3} strokeDasharray="4 5" />
                  {rays.ray3.beyond && <line x1={rays.ray3.hit.x} y1={rays.ray3.hit.y} x2={rays.ray3.beyond.x} y2={rays.ray3.beyond.y} stroke={ink(0.25)} strokeWidth={1.2} strokeDasharray="4 5" />}
                </>
              )}

              {/* Image arrow */}
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
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the object</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">real-is-positive</span>
          </div>
          <Range label="Focal length |f|" value={focal} min={8} max={30} step={0.5} unit="cm" format={(v) => v.toFixed(1)} onChange={(v) => { setFocal(v); setSweeping(false); }} />
          <Range label="Object distance u" value={u} min={5} max={90} step={0.5} unit="cm" format={(v) => v.toFixed(1)} onChange={(v) => { setU(v); setSweeping(false); }} />
          <Range label="Object height" value={objH} min={2} max={10} step={0.5} unit="cm" format={(v) => v.toFixed(1)} onChange={setObjH} />
          <p className="apple-lab-note">
            {mirror === "concave"
              ? "In front of F the image is real and inverted. Between F and the mirror it flips to virtual and erect — that is the shaving-mirror region."
              : "A convex mirror always gives a virtual, erect, diminished image behind it, which is why it is used for rear-view mirrors."}
          </p>
        </div>

        <div className="apple-lab-card px-3.5 py-3">
          <p className="apple-lab-micro">Try this</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            Press <strong>Sweep the object</strong> and watch u fall through F. The image runs off
            to the right of the mirror, disappears when the rays leave parallel, and returns on the
            other side of F — upright instead of inverted. That flip is the whole sign convention.
          </p>
        </div>

        <Questions
          columns={1}
          items={[
            { q: "Why is f negative for a convex mirror?", a: "Its focus is behind the mirror, where the reflected rays only appear to meet. With real-is-positive, distances behind the mirror are negative — so f is negative and v comes out negative too." },
            { q: "What does m = −v/u tell you besides size?", a: "The sign of m. Negative means the image is inverted (and real); positive means erect (and virtual, for a single mirror)." },
            { q: "What happens exactly at the focus?", a: "Rays from the object arrive parallel after reflection, so they never meet: v is infinite and no image forms. Move u a little either side and the image jumps from in front to behind the mirror." },
          ]}
        />
      </div>
    </div>
  );
}

export default RayOpticsBench;
