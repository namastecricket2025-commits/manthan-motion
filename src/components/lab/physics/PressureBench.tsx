import { Picker, Questions, Range, Readout, ink, plate, AMBER, MINT, CYAN } from "@/components/lab/bench-atoms";
import { useState } from "react";

/**
 * Pressure & friction — Class 8.
 *
 * Two everyday chapters that are always drawn as arrows and never as *conse-
 * quences*. Here both are consequences:
 *
 *   Pressure  the same block is stood on each of its three faces in turn. The
 *             force never changes; the contact area does. The sand under the
 *             block sinks in proportion to P = F/A, so "same weight, smaller
 *             area, deeper dent" is a picture you can compare across the three
 *             orientations instead of a sentence.
 *   Friction  a block on a ramp. Gravity down the slope is mg sinθ, the grip
 *             holding it back is at most µ mg cosθ. The model says which one
 *             wins at this angle, prints both, and draws the ramp angle at
 *             which they are exactly equal — tanθ = µ. Below it the block sits
 *             still, above it the block accelerates, and the acceleration is
 *             computed from the leftover force.
 */

type Mode = "pressure" | "friction";
type Face = "largest" | "edge" | "smallest";

const PLATE_W = 760;
const PLATE_H = 340;

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

export function PressureBench() {
  const [mode, setMode] = useState<Mode>("pressure");

  /* Pressure */
  const [face, setFace] = useState<Face>("largest");
  const [extraMass, setExtraMass] = useState(0); /* books stacked on the block */

  /* Friction */
  const [mass, setMass] = useState(4);
  const [mu, setMu] = useState(0.35);
  const [angle, setAngle] = useState(18);

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

  const blockW = face === "largest" ? 150 : face === "edge" ? 112 : 76;
  const blockH = face === "largest" ? 54 : face === "edge" ? 58 : 62;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
        <svg viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} className="w-full" role="img" aria-label={mode === "pressure" ? "A block resting on sand, sinking in proportion to the pressure" : "A block on a ramp with the forces on it drawn"}>
          <defs>
            <linearGradient id="pb-sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.22} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {mode === "pressure" ? (
            <>
              {/* Reference weight and the area it is spread over. */}
              <text x={26} y={30} fontSize={11} fill={ink(0.55)}>
                same block · {face === "largest" ? "widest" : face === "edge" ? "middle" : "narrowest"} face down
              </text>

              {/* Sand bed */}
              <rect x={40} y={232} width={PLATE_W - 80} height={72} fill="url(#pb-sand)" />
              <line x1={40} y1={232} x2={PLATE_W - 40} y2={232} stroke={AMBER} strokeWidth={1.4} opacity={0.5} />

              {/* The dent: a smooth depression whose depth is the pressure. */}
              <path
                d={`M ${PLATE_W / 2 - 130} 232 Q ${PLATE_W / 2 - 62} ${232 + depth * 1.8} ${PLATE_W / 2 - blockW / 2} 232 L ${PLATE_W / 2 + blockW / 2} 232 Q ${PLATE_W / 2 + 62} ${232 + depth * 1.8} ${PLATE_W / 2 + 130} 232`}
                fill={plate(0.55)}
                stroke={ink(0.18)}
                strokeWidth={1}
              />

              {/* Block */}
              <rect x={PLATE_W / 2 - blockW / 2} y={232 - blockH} width={blockW} height={blockH} rx={3} fill={plate(0.9)} stroke={ink(0.5)} strokeWidth={1.6} />
              <text x={PLATE_W / 2} y={232 - blockH / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={ink(0.75)}>
                {(BLOCK.kg + extraMass).toFixed(0)} kg
              </text>

              {/* Books stacked on top, if any. */}
              {extraMass > 0 &&
                Array.from({ length: extraMass }, (_, i) => (
                  <rect key={i} x={PLATE_W / 2 - blockW / 2 + 10 + i * 3} y={232 - blockH - 12 - i * 9} width={blockW - 20 - i * 6} height={8} rx={1.5} fill={CYAN} opacity={0.5} />
                ))}

              {/* Force arrow down, length fixed: the load. */}
              <line x1={PLATE_W / 2} y1={70} x2={PLATE_W / 2} y2={232 - blockH - 12 - extraMass * 9 - 6} stroke={ink(0.55)} strokeWidth={2} markerEnd="url(#pb-arrow)" />
              <text x={PLATE_W / 2 + 10} y={86} fontSize={11.5} fill={ink(0.65)}>
                F = {(force / 1).toFixed(0)} N
              </text>

              {/* Contact area bracket. */}
              <line x1={PLATE_W / 2 - blockW / 2} y1={270} x2={PLATE_W / 2 + blockW / 2} y2={270} stroke={MINT} strokeWidth={2} />
              <line x1={PLATE_W / 2 - blockW / 2} y1={264} x2={PLATE_W / 2 - blockW / 2} y2={276} stroke={MINT} strokeWidth={1.4} />
              <line x1={PLATE_W / 2 + blockW / 2} y1={264} x2={PLATE_W / 2 + blockW / 2} y2={276} stroke={MINT} strokeWidth={1.4} />
              <text x={PLATE_W / 2} y={292} textAnchor="middle" fontSize={11.5} fill={MINT}>
                contact area A = {AREA_CM2[face]} cm²
              </text>
              <text x={PLATE_W - 40} y={30} textAnchor="end" fontSize={11} fill={AMBER}>
                P = F / A = {(pressure / 1000).toFixed(1)} kPa
              </text>
            </>
          ) : (
            <>
              {/* Ramp: fixed geometry, angle slider. */}
              {(() => {
                const groundY = 270;
                const baseX = 120;
                /* 340 px of run keeps the ramp inside the plate at 45°, and
                   lifts the block far enough that the weight label never
                   falls below the plate at 0°. */
                const run = 340;
                const rad = (angle * Math.PI) / 180;
                const topX = baseX + run * Math.cos(rad);
                const topY = groundY - run * Math.sin(rad);
                const size = 54;
                /* Block sits on the slope, a little above the middle. */
                const frac = 0.42;
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

                    {/* Angle arc, radius 62, labelled outside it. */}
                    <path d={`M ${baseX + 62} ${groundY} A 62 62 0 0 0 ${baseX + 62 * cos} ${groundY - 62 * sin}`} fill="none" stroke={AMBER} strokeWidth={1.5} />
                    <text x={baseX + 74} y={groundY - 20} fontSize={12} fill={AMBER} fontWeight={700}>
                      θ = {angle}°
                    </text>

                    {/* Free-body vectors, all from the block's centre. */}
                    <line x1={bx} y1={by} x2={bx} y2={by + 56} stroke={ink(0.55)} strokeWidth={2} />
                    <line x1={bx} y1={by} x2={bx + 62 * nx} y2={by + 62 * ny} stroke={CYAN} strokeWidth={2.2} />
                    <line x1={bx} y1={by} x2={bx + 60 * cos} y2={by - 60 * sin} stroke={MINT} strokeWidth={2.2} strokeDasharray={slides ? "5 4" : undefined} />
                    <line x1={bx} y1={by} x2={bx - 70 * cos} y2={by + 70 * sin} stroke={AMBER} strokeWidth={2.2} />

                    {/* The block itself, drawn after the lines so its face is
                        clean; the vectors read as if pinned to it. */}
                    <g transform={`translate(${bx} ${by}) rotate(${-angle})`}>
                      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={3} fill={plate(0.94)} stroke={ink(0.55)} strokeWidth={1.6} />
                    </g>

                    <ForceLabel x={bx + 8} y={by + 68} text="mg" color={ink(0.62)} />
                    <ForceLabel
                      x={bx + 72 * nx}
                      y={by + 72 * ny + 4}
                      text="N"
                      color={CYAN}
                      anchor={nx < 0 ? "end" : "start"}
                    />
                    <ForceLabel
                      x={bx + 70 * cos}
                      y={by - 70 * sin + 4}
                      text={slides ? `f = ${maxGrip.toFixed(1)} N` : `f ≤ ${maxGrip.toFixed(1)} N`}
                      color={MINT}
                    />
                    <ForceLabel
                      x={bx - 80 * cos}
                      y={by + 80 * sin + 4}
                      text="mg sin θ"
                      color={AMBER}
                      anchor="end"
                    />
                  </>
                );
              })()}
              <text x={24} y={28} fontSize={11} fill={ink(0.55)}>
                Free-body diagram · θ = {angle}° · µ = {mu.toFixed(2)}
              </text>
              <text x={PLATE_W - 24} y={28} textAnchor="end" fontSize={11.5} fill={slides ? AMBER : MINT}>
                {slides ? `sliding · a = ${accel.toFixed(2)} m/s²` : "holding still"}
              </text>
            </>
          )}

          <defs>
            <marker id="pb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill={ink(0.55)} />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <p className="apple-lab-micro">Class 8 · Force, pressure and friction</p>
          <Picker
            label="Bench"
            value={mode}
            options={[
              { id: "pressure", label: "Pressure on sand" },
              { id: "friction", label: "Friction on a ramp" },
            ]}
            onChange={(next) => setMode(next)}
          />

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
                onChange={(next) => setFace(next)}
              />
              <Range label="Books piled on top" value={extraMass} min={0} max={6} step={1} unit="books" onChange={setExtraMass} />
              <p className="apple-lab-note">
                The block's own weight is fixed at {(BLOCK.kg * g).toFixed(0)} N. Turning it onto a
                smaller face does not change that force — it changes how many square centimetres carry
                it, so the sand under the narrow face sinks furthest.
              </p>
            </>
          ) : (
            <>
              <Range label="Angle θ" value={angle} min={0} max={45} step={1} unit="°" onChange={setAngle} />
              <Range label="Friction coefficient µ" value={mu} min={0.05} max={1} step={0.05} unit="" onChange={setMu} />
              <Range label="Mass" value={mass} min={1} max={12} step={0.5} unit="kg" onChange={setMass} />
              <p className="apple-lab-note">
                Maximum grip is µ mg cos θ; the pull down the slope is mg sin θ. They meet exactly at
                tan θ = µ — here {criticalAngle.toFixed(1)}° — which is why a rougher ramp needs a
                steeper angle before anything slips.
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {mode === "pressure" ? (
            <>
              <Readout label="Force on the sand" value={`${force.toFixed(0)} N`} />
              <Readout label="Contact area" value={`${AREA_CM2[face]} cm²`} />
              <Readout label="Pressure" value={`${(pressure / 1000).toFixed(2)} kPa`} />
              <Readout label="Face down" value={FACE_LABEL[face]} />
            </>
          ) : (
            <>
              <Readout label="mg sin θ (down slope)" value={`${along.toFixed(1)} N`} />
              <Readout label="µ mg cos θ (grip)" value={`${maxGrip.toFixed(1)} N`} />
              <Readout label="Normal force" value={`${normal.toFixed(1)} N`} />
              <Readout label="Acceleration" value={slides ? `${accel.toFixed(2)} m/s²` : "0 — at rest"} />
            </>
          )}
        </div>

        <Questions
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
      fontSize={10.5}
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
