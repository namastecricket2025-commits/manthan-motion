import {
  Picker,
  Questions,
  Range,
  ink,
  plate,
  AMBER,
  MINT,
  CYAN,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useRef, useState } from "react";

/**
 * Pressure and friction — Class 8 "Force and Pressure", Class 9 "Gravitation".
 *
 * Two everyday chapters that are usually drawn as arrows and never as
 * *consequences*. Here both are consequences:
 *
 *   Pressure  the same block is stood on each of its three faces in turn. The
 *             force never changes; the contact area does. The pit sinks in
 *             proportion to P = F/A, and the gauge on the right keeps all three
 *             pressures on screen at once, so "same weight, smaller area,
 *             deeper dent" is a comparison rather than a sentence.
 *   Friction  a block on a ramp. Gravity down the slope is mg sinθ, the grip
 *             holding it back is at most µ mg cosθ. Below tanθ = µ the block
 *             sits still; above it the block accelerates, and Release sends it
 *             down at that acceleration, so the run is the arithmetic.
 *
 * The press and the release are the only two "run" actions here, because both
 * are physical events with a duration: a block sinking and a block sliding.
 */

type Mode = "pressure" | "friction";
type Face = "largest" | "edge" | "smallest";

const PLATE_W = 860;
const PLATE_H = 440;

/* A classroom block, 20 × 10 × 5 cm. Areas in cm², pressure in kPa. */
const BLOCK = { l: 20, b: 10, h: 5, kg: 4 };
const AREA_CM2: Record<Face, number> = {
  largest: BLOCK.l * BLOCK.b,
  edge: BLOCK.l * BLOCK.h,
  smallest: BLOCK.b * BLOCK.h,
};
const FACES: Array<{ id: Face; label: string; dims: string; w: number; h: number }> = [
  { id: "largest", label: "Widest face", dims: "20 × 10", w: 34, h: 17 },
  { id: "edge", label: "Edge face", dims: "20 × 5", w: 34, h: 9 },
  { id: "smallest", label: "Narrowest face", dims: "10 × 5", w: 17, h: 9 },
];

const g = 9.8;
/** The ramp is drawn 3.4 m long, so metres per plate pixel is fixed. */
const RAMP_M = 3.4;
/** Seconds the press animation takes to bring the block down. */
const PRESS_SECONDS = 1.4;
/** Full-scale reading of the gauge, in kPa. */
const GAUGE_MAX = 20;

export function PressureBench() {
  const [mode, setMode] = useState<Mode>("pressure");

  /* Pressure */
  const [face, setFace] = useState<Face>("largest");
  const [extraMass, setExtraMass] = useState(0); /* kg loaded on the block */
  const [press, setPress] = useState(1); /* 1 = resting on the sand */
  const [pressing, setPressing] = useState(false);

  /* Friction */
  const [mass, setMass] = useState(4);
  const [mu, setMu] = useState(0.35);
  const [angle, setAngle] = useState(18);
  const [slideT, setSlideT] = useState(0); /* seconds since release */
  const [released, setReleased] = useState(false);

  /* ---- Pressure numbers ---- */
  const totalMass = BLOCK.kg + extraMass;
  const force = totalMass * g;
  const areaM2 = AREA_CM2[face] * 1e-4;
  const pressure = force / areaM2;
  const pressureKpa = pressure / 1000;
  /* Millimetres of sink drawn on the plate, capped so the pit stays a pit. */
  const depth = Math.min(38, pressureKpa * 2.4);
  const pressureOf = (which: Face) => (totalMass * g) / (AREA_CM2[which] * 1e-4) / 1000;

  const criticalAngle = (Math.atan(mu) * 180) / Math.PI;

  /* ---- Friction numbers ---- */
  const weight = mass * g;
  const along = weight * Math.sin((angle * Math.PI) / 180);
  const normal = weight * Math.cos((angle * Math.PI) / 180);
  const maxGrip = mu * normal;
  const slides = along > maxGrip + 1e-9;
  const accel = slides ? (along - maxGrip) / mass : 0;

  /* s = ½at², so the run *is* the arithmetic printed beside it. */
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
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 8–9 · Force, pressure and friction</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              {mode === "pressure"
                ? "Same block, three faces, three depths"
                : "Will it slide, and how fast?"}
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              {mode === "pressure"
                ? "The weight never changes. Only the area carrying it does — and the pit shows the difference."
                : "Two forces argue on the slope: mg sin θ pulls it down, friction up to µ mg cos θ holds it back."}
            </p>
          </div>
          <Picker
            label="Bench"
            value={mode}
            options={[
              { id: "pressure", label: "Sand pit" },
              { id: "friction", label: "Ramp" },
            ]}
            onChange={(next) => {
              setPressing(false);
              setReleased(false);
              setMode(next);
            }}
          />
        </div>

        <div className="px-2 py-2 sm:px-3 sm:py-3">
          <svg
            viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
            className="block w-full"
            role="img"
            aria-label={
              mode === "pressure"
                ? `A ${totalMass.toFixed(0)} kilogram block on its ${face} face, pressing into sand at ${pressureKpa.toFixed(2)} kilopascals`
                : `A block on a ramp at ${angle} degrees with the forces on it drawn`
            }
          >
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
              <PressureScene
                centerX={352}
                blockW={blockW}
                blockH={blockH}
                depth={depth}
                press={press}
                extraMass={extraMass}
                totalMass={totalMass}
                force={force}
                area={AREA_CM2[face]}
                pressureKpa={pressureKpa}
                face={FACES.find((entry) => entry.id === face)?.label ?? ""}
                pressureOf={pressureOf}
              />
            ) : (
              <FrictionScene
                angle={angle}
                mu={mu}
                slides={slides}
                accel={accel}
                maxGrip={maxGrip}
                travelled={travelled}
              />
            )}
          </svg>
        </div>

        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          {mode === "pressure" ? (
            <>
              <div className="grid gap-3 lg:grid-cols-[1fr_270px] lg:items-end">
                <div>
                  <p className="apple-lab-micro">Stand it on</p>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
                    {FACES.map((entry) => {
                      const active = entry.id === face;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setFace(entry.id);
                            setPressing(false);
                          }}
                          data-active={active}
                          className="apple-lab-btn !h-auto !justify-start !rounded-lg !px-2.5 !py-2 !text-left"
                        >
                          <svg width={38} height={22} viewBox="0 0 38 22" aria-hidden="true">
                            <rect
                              x={19 - entry.w / 2}
                              y={11 - entry.h / 2}
                              width={entry.w}
                              height={entry.h}
                              rx={1.5}
                              fill={active ? "var(--lab-diagram-amber)" : "none"}
                              fillOpacity={0.35}
                              stroke="currentColor"
                              strokeWidth={1.4}
                            />
                          </svg>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold leading-tight">{entry.label}</span>
                            <span className="block text-[10px] leading-tight text-[var(--lab-ink-micro)]">
                              {entry.dims} cm · {AREA_CM2[entry.id]} cm² · {pressureOf(entry.id).toFixed(1)} kPa
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Range
                  label="Load piled on top"
                  value={extraMass}
                  min={0}
                  max={6}
                  step={1}
                  unit="kg"
                  format={(value) => value.toFixed(0)}
                  onChange={(value) => {
                    setExtraMass(value);
                    setPressing(false);
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--lab-line-soft)] pt-3">
                <button
                  type="button"
                  className={`apple-lab-btn ${pressing ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
                  onClick={() => (pressing ? setPressing(false) : pressDown())}
                >
                  {pressing ? "Halt" : press >= 1 ? "Press it again" : "Press into the sand"}
                </button>
                <button
                  type="button"
                  className="apple-lab-btn"
                  onClick={() => {
                    setPressing(false);
                    setPress(0);
                  }}
                  disabled={press === 0}
                >
                  Lift
                </button>
                <p className="text-[11.5px] leading-snug text-[var(--lab-ink-dim)]">
                  <strong className="text-[var(--lab-ink)]">P = {(pressure / 1000).toFixed(2)} kPa</strong>{" "}
                  — {force.toFixed(0)} N spread over {AREA_CM2[face]} cm². The other two faces
                  would read {pressureOf(face === "largest" ? "edge" : "largest").toFixed(1)} and{" "}
                  {pressureOf(face === "smallest" ? "edge" : "smallest").toFixed(1)} kPa with the
                  same load.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
                <Range
                  label="Ramp angle θ"
                  value={angle}
                  min={0}
                  max={45}
                  step={1}
                  unit="°"
                  onChange={(value) => {
                    setAngle(value);
                    setReleased(false);
                    setSlideT(0);
                  }}
                />
                <Range
                  label="Friction coefficient µ"
                  value={mu}
                  min={0.05}
                  max={1}
                  step={0.05}
                  unit=""
                  format={(value) => value.toFixed(2)}
                  onChange={(value) => {
                    setMu(value);
                    setReleased(false);
                    setSlideT(0);
                  }}
                />
                <Range label="Mass" value={mass} min={1} max={12} step={0.5} unit="kg" onChange={setMass} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--lab-line-soft)] pt-3">
                <button
                  type="button"
                  className={`apple-lab-btn ${released ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
                  onClick={() => (released ? setReleased(false) : release())}
                  disabled={!slides && !released}
                >
                  {released ? "Catch it" : slides ? "Release the block" : "It will not slide"}
                </button>
                <button
                  type="button"
                  className="apple-lab-btn"
                  onClick={() => {
                    setReleased(false);
                    setSlideT(0);
                  }}
                  disabled={slideT === 0}
                >
                  Rewind
                </button>
                <p className="text-[11.5px] leading-snug text-[var(--lab-ink-dim)]">
                  {travelled > 0
                    ? `${travelled.toFixed(2)} m in ${slideT.toFixed(2)} s${arrived ? ` · bottom in ${Number.isFinite(runSeconds) ? runSeconds.toFixed(2) : "—"} s` : ""}`
                    : slides
                      ? `Slips: ${along.toFixed(1)} N down the slope beats ${maxGrip.toFixed(1)} N of grip, so a = ${accel.toFixed(2)} m/s² and the foot arrives in ${Number.isFinite(runSeconds) ? runSeconds.toFixed(2) : "—"} s.`
                      : `Held: grip can reach ${maxGrip.toFixed(1)} N, and the slope only pulls ${along.toFixed(1)} N. The limit is tan θ = µ, at ${criticalAngle.toFixed(1)}°.`}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <Questions
        items={
          mode === "pressure"
            ? [
                {
                  q: "Why does the block sink deeper on its narrow face?",
                  a: "Weight is unchanged, but the same force acts on fewer square centimetres, so every square centimetre carries more of it. Pressure is force per unit area, not force.",
                },
                {
                  q: "What if the block were twice as heavy on the same face?",
                  a: "The pressure would double. Pressure scales with force at fixed area, and with 1/area at fixed force — both are visible on the plate.",
                },
                {
                  q: "Why do snowshoes work?",
                  a: "They make the contact area large, so your weight produces a pressure below what snow can support. The same trick is a camel's wide feet and a knife's narrow edge.",
                },
              ]
            : [
                {
                  q: "Why doesn't the block slide at 10°?",
                  a: "At 10° gravity down the slope is small, and static friction can match it — up to a limit. Below tan θ = µ the grip is always enough.",
                },
                {
                  q: "Why doesn't mass change the slipping angle?",
                  a: "Both mg terms carry the mass, so it cancels. The angle where they meet depends only on µ — which is why the same ramp slips the same for any block.",
                },
                {
                  q: "What is the friction force once it slides?",
                  a: "It sits at its maximum, µN, pointing up the slope. The leftover mg sin θ − µ mg cos θ drives the acceleration you see.",
                },
              ]
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pressure: the pit, the block, and a gauge that keeps three faces    */
/* ------------------------------------------------------------------ */

function PressureScene({
  centerX,
  blockW,
  blockH,
  depth,
  press,
  extraMass,
  totalMass,
  force,
  area,
  pressureKpa,
  face,
  pressureOf,
}: {
  centerX: number;
  blockW: number;
  blockH: number;
  depth: number;
  press: number;
  extraMass: number;
  totalMass: number;
  force: number;
  area: number;
  pressureKpa: number;
  face: string;
  pressureOf: (which: Face) => number;
}) {
  const sandTop = 300;
  const shown = depth * press;
  const gaugeX = 742;
  const gaugeW = 62;
  const gaugeTop = 82;
  const gaugeBottom = 300;
  const gaugeH = gaugeBottom - gaugeTop;
  const yOf = (kpa: number) => gaugeBottom - (Math.min(kpa, GAUGE_MAX) / GAUGE_MAX) * gaugeH;
  const blockTop = sandTop - blockH - 60 * (1 - press);

  return (
    <>
      <text x={24} y={30} fontSize={12} fill={ink(0.55)}>
        {face} down · {totalMass.toFixed(0)} kg
      </text>
      <text x={24} y={50} fontSize={11.5} fill={ink(0.4)}>
        the pit depth is the pressure, drawn to scale
      </text>

      {/* Sand bed */}
      <rect x={34} y={sandTop} width={680} height={104} fill="url(#pb-sand)" />
      <line x1={34} y1={sandTop} x2={714} y2={sandTop} stroke={AMBER} strokeWidth={1.4} opacity={0.5} />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={70 + i * 40} cy={sandTop + 30 + (i % 3) * 11} r={1.6} fill={AMBER} opacity={0.3} />
      ))}

      {/* The dent: a smooth depression whose depth is the pressure. */}
      <path
        d={`M ${centerX - 156} ${sandTop} Q ${centerX - 74} ${sandTop + shown * 2} ${centerX - blockW / 2} ${sandTop} L ${centerX + blockW / 2} ${sandTop} Q ${centerX + 74} ${sandTop + shown * 2} ${centerX + 156} ${sandTop}`}
        fill={plate(0.55)}
        stroke={ink(0.18)}
        strokeWidth={1}
      />

      {/* Depth gauge beside the dent. */}
      <line x1={centerX + 176} y1={sandTop} x2={centerX + 176} y2={sandTop + Math.max(6, shown)} stroke={AMBER} strokeWidth={1.2} />
      <line x1={centerX + 170} y1={sandTop} x2={centerX + 182} y2={sandTop} stroke={AMBER} strokeWidth={1.2} />
      <line x1={centerX + 170} y1={sandTop + shown} x2={centerX + 182} y2={sandTop + shown} stroke={AMBER} strokeWidth={1.2} />
      <text x={centerX + 188} y={sandTop + shown + 4} fontSize={10.5} fill={AMBER}>
        {(depth * 0.8).toFixed(1)} mm dent
      </text>

      {/* Load stacked on top. */}
      {extraMass > 0 &&
        Array.from({ length: extraMass }, (_, i) => (
          <rect
            key={i}
            x={centerX - blockW / 2 + 14 + i * 2}
            y={blockTop - 16 - i * 11}
            width={blockW - 28 - i * 4}
            height={9}
            rx={1.5}
            fill={CYAN}
            opacity={0.55}
          />
        ))}

      {/* Block */}
      <rect
        x={centerX - blockW / 2}
        y={blockTop}
        width={blockW}
        height={blockH}
        rx={3}
        fill={plate(0.9)}
        stroke={ink(0.5)}
        strokeWidth={1.6}
      />
      <text x={centerX} y={blockTop + blockH / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={ink(0.75)}>
        {totalMass.toFixed(0)} kg
      </text>

      {/* The load: one arrow, fixed length, because the force is fixed. */}
      <line
        x1={centerX}
        y1={58}
        x2={centerX}
        y2={blockTop - 18 - extraMass * 11}
        stroke={ink(0.55)}
        strokeWidth={2}
        markerEnd="url(#pb-arrow)"
      />
      <text x={centerX + 10} y={76} fontSize={12.5} fill={ink(0.65)}>
        F = {force.toFixed(0)} N
      </text>

      {/* Contact bracket */}
      <line x1={centerX - blockW / 2} y1={344} x2={centerX + blockW / 2} y2={344} stroke={MINT} strokeWidth={2} />
      <line x1={centerX - blockW / 2} y1={338} x2={centerX - blockW / 2} y2={350} stroke={MINT} strokeWidth={1.4} />
      <line x1={centerX + blockW / 2} y1={338} x2={centerX + blockW / 2} y2={350} stroke={MINT} strokeWidth={1.4} />
      <text x={centerX} y={366} textAnchor="middle" fontSize={12} fill={MINT}>
        A = {area} cm²
      </text>

      {/* Pressure gauge: a vertical scale with all three faces marked, so the
          current face is read against the other two. */}
      <g>
        <rect x={gaugeX} y={gaugeTop} width={gaugeW} height={gaugeH} rx={9} fill={plate(0.35)} stroke={ink(0.16)} />
        <rect
          x={gaugeX}
          y={yOf(pressureKpa)}
          width={gaugeW}
          height={gaugeBottom - yOf(pressureKpa)}
          rx={9}
          fill={AMBER}
          opacity={0.22}
        />
        {[0, 5, 10, 15, 20].map((kpa) => (
          <g key={kpa}>
            <line x1={gaugeX - 4} y1={yOf(kpa)} x2={gaugeX + 6} y2={yOf(kpa)} stroke={ink(0.3)} strokeWidth={1} />
            <text x={gaugeX - 9} y={yOf(kpa) + 3.5} textAnchor="end" fontSize={9.5} fill={ink(0.4)}>
              {kpa}
            </text>
          </g>
        ))}

        {FACES.map((entry) => {
          const value = pressureOf(entry.id);
          const active = entry.label === face;
          return (
            <g key={entry.id} opacity={active ? 1 : 0.55}>
              <line
                x1={gaugeX - 2}
                y1={yOf(value)}
                x2={gaugeX + gaugeW + 2}
                y2={yOf(value)}
                stroke={active ? MINT : ink(0.4)}
                strokeWidth={active ? 1.8 : 1}
                strokeDasharray={active ? undefined : "3 4"}
              />
              <text
                x={gaugeX + gaugeW + 7}
                y={yOf(value) + 3.5}
                fontSize={9.5}
                fill={active ? MINT : ink(0.4)}
              >
                {entry.dims}
              </text>
            </g>
          );
        })}

        <text x={gaugeX + gaugeW / 2} y={gaugeTop - 14} textAnchor="middle" fontSize={10} fill={ink(0.5)}>
          pressure kPa
        </text>
        <text x={gaugeX + gaugeW / 2} y={gaugeBottom + 20} textAnchor="middle" fontSize={13} fontWeight={700} fill={AMBER}>
          {pressureKpa.toFixed(1)}
        </text>
      </g>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Friction: the ramp and its free-body diagram                        */
/* ------------------------------------------------------------------ */

function FrictionScene({
  angle,
  mu,
  slides,
  accel,
  maxGrip,
  travelled,
}: {
  angle: number;
  mu: number;
  slides: boolean;
  accel: number;
  maxGrip: number;
  travelled: number;
}) {
  const groundY = 330;
  const baseX = 150;
  const run = 430;
  const rad = (angle * Math.PI) / 180;
  const topX = baseX + run * Math.cos(rad);
  const topY = groundY - run * Math.sin(rad);
  const size = 58;
  const frac = 0.42 + (travelled / RAMP_M) * 0.55;
  const px = baseX + run * (1 - frac) * Math.cos(rad);
  const py = groundY - run * (1 - frac) * Math.sin(rad);
  const nx = -Math.sin(rad);
  const ny = -Math.cos(rad);
  const bx = px + nx * size * 0.5;
  const by = py + ny * size * 0.5;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return (
    <>
      <path d={`M ${baseX} ${groundY} L ${topX} ${topY} L ${topX} ${groundY} Z`} fill={plate(0.28)} stroke="none" />
      <line x1={baseX} y1={groundY} x2={topX} y2={topY} stroke={ink(0.6)} strokeWidth={2.6} strokeLinecap="round" />
      <line x1={baseX} y1={groundY} x2={PLATE_W - 40} y2={groundY} stroke={ink(0.2)} strokeWidth={1.4} />

      <path d={`M ${baseX + 66} ${groundY} A 66 66 0 0 0 ${baseX + 66 * cos} ${groundY - 66 * sin}`} fill="none" stroke={AMBER} strokeWidth={1.5} />
      <text x={baseX + 78} y={groundY - 22} fontSize={13} fill={AMBER} fontWeight={700}>
        θ = {angle}°
      </text>

      <line x1={bx} y1={by} x2={bx} y2={by + 58} stroke={ink(0.55)} strokeWidth={2} />
      <line x1={bx} y1={by} x2={bx + 64 * nx} y2={by + 64 * ny} stroke={CYAN} strokeWidth={2.2} />
      <line x1={bx} y1={by} x2={bx + 62 * cos} y2={by - 62 * sin} stroke={MINT} strokeWidth={2.2} strokeDasharray={slides ? "5 4" : undefined} />
      <line x1={bx} y1={by} x2={bx - 72 * cos} y2={by + 72 * sin} stroke={AMBER} strokeWidth={2.2} />

      <g transform={`translate(${bx} ${by}) rotate(${-angle})`}>
        <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={3} fill={plate(0.94)} stroke={ink(0.55)} strokeWidth={1.6} />
      </g>

      <ForceLabel x={bx + 8} y={by + 70} text="mg" color={ink(0.62)} />
      <ForceLabel x={bx + 74 * nx} y={by + 74 * ny + 4} text="N" color={CYAN} anchor={nx < 0 ? "end" : "start"} />
      <ForceLabel x={bx + 72 * cos} y={by - 72 * sin + 4} text={slides ? `f = ${maxGrip.toFixed(1)} N` : `f ≤ ${maxGrip.toFixed(1)} N`} color={MINT} />
      <ForceLabel x={bx - 82 * cos} y={by + 82 * sin + 4} text="mg sin θ" color={AMBER} anchor="end" />

      <text x={24} y={28} fontSize={12} fill={ink(0.55)}>
        Free-body diagram · θ = {angle}° · µ = {mu.toFixed(2)}
      </text>
      <text x={PLATE_W - 24} y={28} textAnchor="end" fontSize={12.5} fill={slides ? AMBER : MINT}>
        {slides ? `sliding · a = ${accel.toFixed(2)} m/s²` : "holding still"}
      </text>
    </>
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
