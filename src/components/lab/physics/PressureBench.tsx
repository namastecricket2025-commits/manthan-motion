import {
  BenchStage,
  LiveDot,
  Picker,
  Questions,
  Range,
  StageStat,
  ink,
  plate,
  AMBER,
  MINT,
  CYAN,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useRef, useState } from "react";

/**
 * Pressure & friction — Class 8.
 *
 * Two everyday chapters that are always drawn as arrows and never as *conse-
 * quences*. Here both are consequences, and both can be run:
 *
 *   Pressure  the same block is stood on each of its three faces in turn. The
 *             force never changes; the contact area does. The sand under the
 *             block sinks in proportion to P = F/A, so "same weight, smaller
 *             area, deeper dent" is a picture you can compare across the three
 *             orientations instead of a sentence. Pressing the block drops it
 *             onto the sand and lets the dent form at the depth the pressure
 *             earns.
 *   Friction  a block on a ramp. Gravity down the slope is mg sinθ, the grip
 *             holding it back is at most µ mg cosθ. The model says which one
 *             wins at this angle, prints both, and draws the ramp angle at
 *             which they are exactly equal — tanθ = µ. Below it the block sits
 *             still; above it the block accelerates, and Release sends it down
 *             the slope at that acceleration, so the run is the arithmetic.
 */

type Mode = "pressure" | "friction";
type Face = "largest" | "edge" | "smallest";

const PLATE_W = 840;
const PLATE_H = 440;

/* A classroom block, 20 × 10 × 5 cm. Areas in cm², pressure in kPa. */
const BLOCK = { l: 20, b: 10, h: 5, kg: 4 };
const AREA_CM2: Record<Face, number> = {
  largest: BLOCK.l * BLOCK.b,
  edge: BLOCK.l * BLOCK.h,
  smallest: BLOCK.b * BLOCK.h,
};
const FACE_LABEL: Record<Face, string> = {
  largest: "20 × 10 face",
  edge: "20 × 5 face",
  smallest: "10 × 5 face",
};

const g = 9.8;
/** The ramp is drawn 3.4 m long, so metres per plate pixel is fixed. */
const RAMP_M = 3.4;
/** Seconds the press animation takes to bring the block down. */
const PRESS_SECONDS = 1.4;

export function PressureBench() {
  const [mode, setMode] = useState<Mode>("pressure");

  /* Pressure */
  const [face, setFace] = useState<Face>("largest");
  const [extraMass, setExtraMass] = useState(0); /* books stacked on the block */
  const [press, setPress] = useState(1); /* 1 = resting on the sand */
  const [pressing, setPressing] = useState(false);

  /* Friction */
  const [mass, setMass] = useState(4);
  const [mu, setMu] = useState(0.35);
  const [angle, setAngle] = useState(18);
  const [slideT, setSlideT] = useState(0); /* seconds since release */
  const [released, setReleased] = useState(false);

  /* ---- Pressure numbers ---- */
  const force = (BLOCK.kg + extraMass) * g;
  const areaM2 = AREA_CM2[face] * 1e-4;
  const pressure = force / areaM2;
  const depth = Math.min(26, pressure / 140); /* millimetres of sink, capped on the plate */
  const criticalAngle = (Math.atan(mu) * 180) / Math.PI;

  /* ---- Friction numbers ---- */
  const weight = mass * g;
  const along = weight * Math.sin((angle * Math.PI) / 180);
  const normal = weight * Math.cos((angle * Math.PI) / 180);
  const maxGrip = mu * normal;
  const slides = along > maxGrip + 1e-9;
  const accel = slides ? (along - maxGrip) / mass : 0;

  /* How far the block has travelled down the ramp since release, and how long
     the run takes in full. Both come from s = ½at², so the run *is* the
     arithmetic printed beside it. */
  const runSeconds = accel > 0.05 ? Math.sqrt((2 * RAMP_M) / accel) : Infinity;
  const travelled = slides ? Math.min(RAMP_M, 0.5 * accel * slideT * slideT) : 0;
  const arrived = travelled >= RAMP_M - 1e-6;

  const blockW = face === "largest" ? 168 : face === "edge" ? 126 : 86;
  const blockH = face === "largest" ? 62 : face === "edge" ? 66 : 70;

  /* ---- the clocks ------------------------------------------------------ */
  const last = useRef<number | null>(null);
  useAnimationFrame((now) => {
    if (!pressing && !released) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current) / 1000;
    last.current = now;
    if (pressing) {
      const next = Math.min(1, press + dt / PRESS_SECONDS);
      setPress(next);
      if (next >= 1) setPressing(false);
    }
    if (released) {
      const next = slideT + dt;
      setSlideT(next);
      if (accel > 0.05 && 0.5 * accel * next * next >= RAMP_M) setReleased(false);
    }
  });

  const pressDown = () => {
    if (press >= 1) setPress(0);
    last.current = null;
    setPressing(true);
  };
  const release = () => {
    if (!slides) return;
    setSlideT(0);
    last.current = null;
    setReleased(true);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 8 · Force, pressure and friction"
        title={mode === "pressure" ? "Same block, three faces, three dents" : "Will it slide, and how fast?"}
        meta={
          <>
            <span className="apple-lab-chip">
              {mode === "pressure" ? `P = F/A · ${(pressure / 1000).toFixed(2)} kPa` : `tan θ = ${(Math.tan((angle * Math.PI) / 180)).toFixed(2)} vs µ = ${mu.toFixed(2)}`}
            </span>
            <LiveDot
              on={pressing || released}
              label={pressing ? "pressing" : released ? "sliding" : mode === "friction" ? (slides ? "would slide" : "at rest") : "resting"}
            />
          </>
        }
        toolbar={
          <Picker
            label="Bench"
            value={mode}
            options={[
              { id: "pressure", label: "Pressure on sand" },
              { id: "friction", label: "Friction on a ramp" },
            ]}
            onChange={(next) => {
              setPressing(false);
              setReleased(false);
              setMode(next);
            }}
          />
        }
        rail={
          mode === "pressure" ? (
            <>
              <button
                type="button"
                className={`apple-lab-btn ${pressing ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
                onClick={() => (pressing ? setPressing(false) : pressDown())}
              >
                {pressing ? "Halt" : press >= 1 ? "Press it again" : "Press into the sand"}
              </button>
              <button type="button" className="apple-lab-btn" onClick={() => { setPressing(false); setPress(0); }} disabled={press === 0}>
                Lift
              </button>
              <span className="lab-stage-track" aria-hidden="true">
                <i style={{ width: `${(press * 100).toFixed(0)}%` }} />
              </span>
              <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
                sink ∝ P = {(pressure / 1000).toFixed(2)} kPa
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`apple-lab-btn ${released ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
                onClick={() => (released ? setReleased(false) : release())}
                disabled={!slides && !released}
              >
                {released ? "Catch it" : slides ? "Release the block" : "It will not slide"}
              </button>
              <button type="button" className="apple-lab-btn" onClick={() => { setReleased(false); setSlideT(0); }} disabled={slideT === 0}>
                Rewind
              </button>
              <span className="lab-stage-track" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (travelled / RAMP_M) * 100).toFixed(1)}%` }} />
              </span>
              <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
                {travelled > 0
                  ? `${travelled.toFixed(2)} m in ${slideT.toFixed(2)} s${arrived ? ` · bottom in ${Number.isFinite(runSeconds) ? runSeconds.toFixed(2) : "—"} s` : ""}`
                  : slides
                    ? `a = ${accel.toFixed(2)} m/s² — bottom in ${Number.isFinite(runSeconds) ? runSeconds.toFixed(2) : "—"} s`
                    : `held: µ mg cos θ = ${maxGrip.toFixed(1)} N ≥ mg sin θ = ${along.toFixed(1)} N`}
              </span>
            </>
          )
        }
        stats={
          mode === "pressure" ? (
            <>
              <StageStat label="Force on the sand" value={`${force.toFixed(0)} N`} tone="amber" />
              <StageStat label="Contact area" value={`${AREA_CM2[face]} cm²`} tone="mint" />
              <StageStat label="Pressure" value={`${(pressure / 1000).toFixed(2)} kPa`} />
              <StageStat label="Face down" value={FACE_LABEL[face]} />
            </>
          ) : (
            <>
              <StageStat label="mg sin θ (down slope)" value={`${along.toFixed(1)} N`} tone="amber" />
              <StageStat label="µ mg cos θ (grip)" value={`${maxGrip.toFixed(1)} N`} tone="mint" />
              <StageStat label="Normal force" value={`${normal.toFixed(1)} N`} tone="cyan" />
              <StageStat label="Acceleration" value={slides ? `${accel.toFixed(2)} m/s²` : "0 — at rest"} />
            </>
          )
        }
        note={
          mode === "pressure"
            ? `The block's own weight is fixed at ${(BLOCK.kg * g).toFixed(0)} N. Turning it onto a smaller face does not change that force — it changes how many square centimetres carry it, so the sand under the narrow face sinks furthest.`
            : `Maximum grip is µ mg cos θ; the pull down the slope is mg sin θ. They meet exactly at tan θ = µ — here ${criticalAngle.toFixed(1)}° — which is why a rougher ramp needs a steeper angle before anything slips.`
        }
      >
        <svg viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} role="img" aria-label={mode === "pressure" ? "A block resting on sand, sinking in proportion to the pressure" : "A block on a ramp with the forces on it drawn"}>
          <defs>
            <linearGradient id="pb-sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.22} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0.05} />
            </linearGradient>
            <marker id="pb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill={ink(0.55)} />
            </marker>
          </defs>

          {mode === "pressure" ? (
            <>
              {/* Reference weight and the area it is spread over. */}
              <text x={26} y={30} fontSize={12} fill={ink(0.55)}>
                same block · {face === "largest" ? "widest" : face === "edge" ? "middle" : "narrowest"} face down
              </text>

              {/* Sand bed */}
              <rect x={50} y={300} width={PLATE_W - 100} height={96} fill="url(#pb-sand)" />
              <line x1={50} y1={300} x2={PLATE_W - 50} y2={300} stroke={AMBER} strokeWidth={1.4} opacity={0.5} />

              {/* The dent: a smooth depression whose depth is the pressure, and
                  which forms as the block presses in. */}
              {(() => {
                const shown = depth * press;
                return (
                  <path
                    d={`M ${PLATE_W / 2 - 150} 300 Q ${PLATE_W / 2 - 70} ${300 + shown * 2} ${PLATE_W / 2 - blockW / 2} 300 L ${PLATE_W / 2 + blockW / 2} 300 Q ${PLATE_W / 2 + 70} ${300 + shown * 2} ${PLATE_W / 2 + 150} 300`}
                    fill={plate(0.55)}
                    stroke={ink(0.18)}
                    strokeWidth={1}
                  />
                );
              })()}

              {/* Books stacked on top, if any. */}
              {extraMass > 0 &&
                Array.from({ length: extraMass }, (_, i) => (
                  <rect
                    key={i}
                    x={PLATE_W / 2 - blockW / 2 + 10 + i * 3}
                    y={300 - blockH - 96 * (1 - press) - 14 - i * 11}
                    width={blockW - 20 - i * 6}
                    height={10}
                    rx={1.5}
                    fill={CYAN}
                    opacity={0.5}
                  />
                ))}

              {/* Block */}
              <rect
                x={PLATE_W / 2 - blockW / 2}
                y={300 - blockH - 96 * (1 - press)}
                width={blockW}
                height={blockH}
                rx={3}
                fill={plate(0.9)}
                stroke={ink(0.5)}
                strokeWidth={1.6}
              />
              <text x={PLATE_W / 2} y={300 - blockH / 2 - 96 * (1 - press) + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={ink(0.75)}>
                {(BLOCK.kg + extraMass).toFixed(0)} kg
              </text>

              {/* Force arrow down, length fixed: the load. */}
              <line
                x1={PLATE_W / 2}
                y1={60}
                x2={PLATE_W / 2}
                y2={300 - blockH - 96 * (1 - press) - 14 - extraMass * 11 - 6}
                stroke={ink(0.55)}
                strokeWidth={2}
                markerEnd="url(#pb-arrow)"
              />
              <text x={PLATE_W / 2 + 10} y={76} fontSize={12.5} fill={ink(0.65)}>
                F = {(force / 1).toFixed(0)} N
              </text>

              {/* Contact area bracket. */}
              <line x1={PLATE_W / 2 - blockW / 2} y1={346} x2={PLATE_W / 2 + blockW / 2} y2={346} stroke={MINT} strokeWidth={2} />
              <line x1={PLATE_W / 2 - blockW / 2} y1={340} x2={PLATE_W / 2 - blockW / 2} y2={352} stroke={MINT} strokeWidth={1.4} />
              <line x1={PLATE_W / 2 + blockW / 2} y1={340} x2={PLATE_W / 2 + blockW / 2} y2={352} stroke={MINT} strokeWidth={1.4} />
              <text x={PLATE_W / 2} y={370} textAnchor="middle" fontSize={12.5} fill={MINT}>
                contact area A = {AREA_CM2[face]} cm²
              </text>
              <text x={PLATE_W - 40} y={30} textAnchor="end" fontSize={12} fill={AMBER}>
                P = F / A = {(pressure / 1000).toFixed(1)} kPa
              </text>
            </>
          ) : (
            <>
              {/* Ramp: fixed geometry, angle slider. */}
              {(() => {
                const groundY = 330;
                const baseX = 150;
                const run = 430;
                const rad = (angle * Math.PI) / 180;
                const topX = baseX + run * Math.cos(rad);
                const topY = groundY - run * Math.sin(rad);
                const size = 58;
                /* Block sits on the slope at 0.42, and slides toward the foot. */
                const frac = 0.42 + (travelled / RAMP_M) * 0.55;
                const px = baseX + run * (1 - frac) * Math.cos(rad);
                const py = groundY - run * (1 - frac) * Math.sin(rad);
                /* The block's centre sits half a block along the outward normal
                   of the slope: (−sinθ, −cosθ) in screen coordinates. */
                const nx = -Math.sin(rad);
                const ny = -Math.cos(rad);
                const bx = px + nx * size * 0.5;
                const by = py + ny * size * 0.5;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                return (
                  <>
                    {/* The solid wedge under the slope, so 45° reads as a ramp
                        rather than a line floating in the plate. */}
                    <path
                      d={`M ${baseX} ${groundY} L ${topX} ${topY} L ${topX} ${groundY} Z`}
                      fill={plate(0.28)}
                      stroke="none"
                    />
                    <line x1={baseX} y1={groundY} x2={topX} y2={topY} stroke={ink(0.6)} strokeWidth={2.6} strokeLinecap="round" />
                    <line x1={baseX} y1={groundY} x2={PLATE_W - 40} y2={groundY} stroke={ink(0.2)} strokeWidth={1.4} />

                    {/* Angle arc, radius 66, labelled outside it. */}
                    <path d={`M ${baseX + 66} ${groundY} A 66 66 0 0 0 ${baseX + 66 * cos} ${groundY - 66 * sin}`} fill="none" stroke={AMBER} strokeWidth={1.5} />
                    <text x={baseX + 78} y={groundY - 22} fontSize={13} fill={AMBER} fontWeight={700}>
                      θ = {angle}°
                    </text>

                    {/* Free-body vectors, all from the block's centre. */}
                    <line x1={bx} y1={by} x2={bx} y2={by + 58} stroke={ink(0.55)} strokeWidth={2} />
                    <line x1={bx} y1={by} x2={bx + 64 * nx} y2={by + 64 * ny} stroke={CYAN} strokeWidth={2.2} />
                    <line x1={bx} y1={by} x2={bx + 62 * cos} y2={by - 62 * sin} stroke={MINT} strokeWidth={2.2} strokeDasharray={slides ? "5 4" : undefined} />
                    <line x1={bx} y1={by} x2={bx - 72 * cos} y2={by + 72 * sin} stroke={AMBER} strokeWidth={2.2} />

                    {/* The block itself, drawn after the lines so its face is
                        clean; the vectors read as if pinned to it. */}
                    <g transform={`translate(${bx} ${by}) rotate(${-angle})`}>
                      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={3} fill={plate(0.94)} stroke={ink(0.55)} strokeWidth={1.6} />
                    </g>

                    <ForceLabel x={bx + 8} y={by + 70} text="mg" color={ink(0.62)} />
                    <ForceLabel
                      x={bx + 74 * nx}
                      y={by + 74 * ny + 4}
                      text="N"
                      color={CYAN}
                      anchor={nx < 0 ? "end" : "start"}
                    />
                    <ForceLabel
                      x={bx + 72 * cos}
                      y={by - 72 * sin + 4}
                      text={slides ? `f = ${maxGrip.toFixed(1)} N` : `f ≤ ${maxGrip.toFixed(1)} N`}
                      color={MINT}
                    />
                    <ForceLabel
                      x={bx - 82 * cos}
                      y={by + 82 * sin + 4}
                      text="mg sin θ"
                      color={AMBER}
                      anchor="end"
                    />
                  </>
                );
              })()}
              <text x={24} y={28} fontSize={12} fill={ink(0.55)}>
                Free-body diagram · θ = {angle}° · µ = {mu.toFixed(2)}
              </text>
              <text x={PLATE_W - 24} y={28} textAnchor="end" fontSize={12.5} fill={slides ? AMBER : MINT}>
                {slides ? `sliding · a = ${accel.toFixed(2)} m/s²` : "holding still"}
              </text>
            </>
          )}
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the bench</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">the plate redraws live</span>
          </div>

          {mode === "pressure" ? (
            <>
              <Picker
                label="Which face is down"
                value={face}
                options={[
                  { id: "largest", label: "Widest" },
                  { id: "edge", label: "Edge" },
                  { id: "smallest", label: "Narrowest" },
                ]}
                onChange={(next) => {
                  setFace(next);
                  setPressing(false);
                }}
              />
              <Range label="Books piled on top" value={extraMass} min={0} max={6} step={1} unit="books" onChange={(v) => { setExtraMass(v); setPressing(false); }} />
            </>
          ) : (
            <>
              <Range label="Angle θ" value={angle} min={0} max={45} step={1} unit="°" onChange={(v) => { setAngle(v); setReleased(false); setSlideT(0); }} />
              <Range label="Friction coefficient µ" value={mu} min={0.05} max={1} step={0.05} unit="" onChange={(v) => { setMu(v); setReleased(false); setSlideT(0); }} />
              <Range label="Mass" value={mass} min={1} max={12} step={0.5} unit="kg" onChange={setMass} />
            </>
          )}
        </div>

        <div className="apple-lab-card px-3.5 py-3">
          <p className="apple-lab-micro">Try this</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            {mode === "pressure"
              ? `Stand the block on each face in turn and press it again. The weight never changes — ${(BLOCK.kg * g).toFixed(0)} N — but the dent does. Then pile books on top and watch the dent deepen without the area changing at all.`
              : `The block slips when tan θ passes µ — here ${criticalAngle.toFixed(1)}°. Nudge θ just under that and Release: nothing happens. One degree over, Release and the run takes ${(Number.isFinite(runSeconds) ? runSeconds.toFixed(2) : "—")} s to the foot of the ramp.`}
          </p>
        </div>

        <Questions
          columns={1}
          items={
            mode === "pressure"
              ? [
                  { q: "Why does the block sink deeper on its narrow face?", a: "Weight is unchanged, but the same force acts on fewer square centimetres, so every square centimetre carries more of it. Pressure is force per unit area, not force." },
                  { q: "What if the block were twice as heavy on the same face?", a: "The pressure would double. Pressure scales with force at fixed area, and with 1/area at fixed force — both are visible on the plate." },
                  { q: "Why do snowshoes work?", a: "They make the contact area large, so your weight produces a pressure below what snow can support. The same trick is a camel's wide feet and a knife's narrow edge." },
                ]
              : [
                  { q: "Why doesn't the block slide at 10°?", a: "At 10° gravity down the slope is small, and static friction can match it — up to a limit. Below tan θ = µ the grip is always enough." },
                  { q: "Why doesn't mass change the slipping angle?", a: "Both mg terms carry the mass, so it cancels. The angle where they meet depends only on µ — which is why the same ramp slips the same for any block." },
                  { q: "What is the friction force once it slides?", a: "It sits at its maximum, µN, pointing up the slope. The leftover mg sin θ − µ mg cos θ drives the acceleration you see." },
                ]
          }
        />
      </div>
    </div>
  );
}

function ForceLabel({
  x,
  y,
  text,
  color,
  anchor = "start",
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={11}
      fill={color}
      textAnchor={anchor}
      paintOrder="stroke"
      stroke={plate(0.92)}
      strokeWidth={3.5}
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

export default PressureBench;
