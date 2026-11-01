import { Picker, Questions, Range, Readout, ink, plate, AMBER, CYAN, MINT } from "@/components/lab/bench-atoms";
import { useMemo, useState } from "react";

/**
 * Projectile motion — Class 11.
 *
 * One launch, decomposed. The ball leaves at u and θ; from that moment the
 * horizontal motion is untouched by gravity and the vertical one is pure free
 * fall. So the bench draws both at once: the curved path with equal time marks
 * along it, and at the inspection point the velocity arrow split into its two
 * components, one of which never changes.
 *
 * The ghost trajectory is the complementary angle 90° − θ. With no launch
 * height it lands at exactly the same range, which is the fact the textbook
 * states and a blackboard cannot show happening. Raise the launcher and the
 * symmetry breaks — honestly, on screen.
 */

type World = "earth" | "moon" | "mars";
const G: Record<World, number> = { earth: 9.81, moon: 1.62, mars: 3.72 };
const WORLD_LABEL: Record<World, string> = { earth: "Earth", moon: "Moon", mars: "Mars" };

const W = 720;
const H = 360;
const PAD = 54;

export function ProjectileBench() {
  const [u, setU] = useState(24);
  const [theta, setAngle] = useState(45);
  const [height, setHeight] = useState(0);
  const [world, setWorld] = useState<World>("earth");
  const [inspect, setInspect] = useState(0.55);

  const g = G[world];
  const rad = (theta * Math.PI) / 180;
  const vx = u * Math.cos(rad);
  const vy0 = u * Math.sin(rad);

  const flight = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * height)) / g;
  const range = vx * flight;
  const peak = height + (vy0 * vy0) / (2 * g);

  /* The complementary shot, for the equal-range comparison. */
  const otherRad = ((90 - theta) * Math.PI) / 180;
  const otherVx = u * Math.cos(otherRad);
  const otherVy = u * Math.sin(otherRad);
  const otherFlight = (otherVy + Math.sqrt(otherVy * otherVy + 2 * g * height)) / g;
  const otherRange = otherVx * otherFlight;

  const t = inspect * flight;
  const px = vx * t;
  const py = height + vy0 * t - 0.5 * g * t * t;
  const vxNow = vx;
  const vyNow = vy0 - g * t;
  const speedNow = Math.hypot(vxNow, vyNow);

  /* One scale for both axes, so the path keeps its true shape. */
  const xMax = Math.max(range, otherRange, 1);
  const yMax = Math.max(peak, 1);
  const scale = Math.min((W - PAD - 60) / xMax, (H - PAD - 40) / Math.max(yMax, height + 1));
  const originX = PAD;
  const originY = H - 54;
  const X = (x: number) => originX + x * scale;
  const Y = (y: number) => originY - y * scale;

  const path = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 90; i += 1) {
      const tt = (i / 90) * flight;
      pts.push(`${X(vx * tt).toFixed(1)} ${Y(height + vy0 * tt - 0.5 * g * tt * tt).toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [u, theta, height, g, flight, scale]);

  const ghost = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 90; i += 1) {
      const tt = (i / 90) * otherFlight;
      pts.push(`${X(otherVx * tt).toFixed(1)} ${Y(height + otherVy * tt - 0.5 * g * tt * tt).toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [u, theta, height, g, otherFlight, scale]);

  /* Equal-time dots: they crowd at the top and stretch at the ends. */
  const dots = Array.from({ length: 9 }, (_, i) => {
    const tt = (i / 8) * flight;
    return { x: X(vx * tt), y: Y(height + vy0 * tt - 0.5 * g * tt * tt), t: tt };
  });

  const sameRange = Math.abs(range - otherRange) < 0.01;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Projectile trajectory with velocity components">
          {/* Ground */}
          <line x1={24} y1={originY} x2={W - 18} y2={originY} stroke={ink(0.3)} strokeWidth={1.6} />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={originX + i * 44} y1={originY} x2={originX + i * 44} y2={originY + 5} stroke={ink(0.15)} strokeWidth={1} />
          ))}

          {/* Complementary ghost */}
          <path d={ghost} fill="none" stroke={MINT} strokeWidth={1.6} strokeDasharray="5 5" opacity={0.75} />
          {/* Main path */}
          <path d={path} fill="none" stroke="var(--lab-diagram-ink)" strokeWidth={2.6} strokeLinejoin="round" />

          {/* Equal-time markers */}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={2.2} fill={ink(0.4)} />
          ))}

          {/* Launch arrow */}
          <line x1={originX} y1={Y(height)} x2={originX + u * Math.cos(rad) * 2.2} y2={Y(height) - u * Math.sin(rad) * 2.2} stroke={AMBER} strokeWidth={2.4} strokeLinecap="round" />
          <text x={originX + 8} y={Y(height) - 12} fontSize={11.5} fill={AMBER} fontWeight={700}>
            u = {u} m/s at {theta}°
          </text>

          {/* Inspection point and its two components */}
          <circle cx={X(px)} cy={Y(py)} r={6} fill={plate(1)} stroke={ink(0.7)} strokeWidth={2} />
          <line x1={X(px)} y1={Y(py)} x2={X(px) + vxNow * 2.2} y2={Y(py)} stroke={CYAN} strokeWidth={2} />
          <line x1={X(px)} y1={Y(py)} x2={X(px)} y2={Y(py) - vyNow * 2.2} stroke={AMBER} strokeWidth={2} />
          <line x1={X(px)} y1={Y(py)} x2={X(px) + vxNow * 2.2} y2={Y(py) - vyNow * 2.2} stroke={ink(0.55)} strokeWidth={1.6} strokeDasharray="4 4" />
          <text x={X(px) + vxNow * 2.2 + 4} y={Y(py) + 4} fontSize={10.5} fill={CYAN}>vx {vxNow.toFixed(1)}</text>
          <text x={X(px) - 8} y={Y(py) - vyNow * 2.2 - 6} fontSize={10.5} fill={AMBER} textAnchor="end">vy {vyNow.toFixed(1)}</text>

          {/* Range bracket */}
          <line x1={X(range)} y1={originY + 14} x2={X(range)} y2={originY + 30} stroke={ink(0.4)} strokeWidth={1.4} />
          <text x={X(range)} y={originY + 44} textAnchor="middle" fontSize={11} fill={ink(0.6)}>
            R = {range.toFixed(1)} m
          </text>
          <text x={X(px)} y={originY + 44} textAnchor="middle" fontSize={10.5} fill={ink(0.45)}>
            t = {t.toFixed(2)} s
          </text>

          <text x={24} y={24} fontSize={11} fill={ink(0.5)}>
            solid = {theta}° · dashed = complementary {90 - theta}°
          </text>
          <text x={W - 20} y={24} textAnchor="end" fontSize={11} fill={ink(0.5)}>
            {sameRange ? "same range — the pair is exact" : "different range: the launcher is not on the ground"}
          </text>
        </svg>

        <p className="apple-lab-note">
          The dots are equally spaced in <em>time</em>, not distance. They bunch near the top because
          the vertical motion is slowing down, and the horizontal gaps are all the same because vx
          never changes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <p className="apple-lab-micro">Class 11 · Motion in a plane</p>
          <Range label="Launch speed u" value={u} min={5} max={45} step={1} unit="m/s" onChange={setU} />
          <Range label="Launch angle θ" value={theta} min={5} max={85} step={1} unit="°" onChange={setAngle} />
          <Range label="Launch height" value={height} min={0} max={10} step={0.5} unit="m" format={(v) => v.toFixed(1)} onChange={setHeight} />
          <Range label="Inspect at" value={inspect} min={0} max={1} step={0.01} unit="of flight" format={(v) => `${(v * 100).toFixed(0)}%`} onChange={setInspect} />
          <Picker
            label="World"
            value={world}
            options={[
              { id: "earth", label: "Earth" },
              { id: "moon", label: "Moon" },
              { id: "mars", label: "Mars" },
            ]}
            onChange={(next) => setWorld(next)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Readout label="Time of flight" value={`${flight.toFixed(2)} s`} />
          <Readout label="Range" value={`${range.toFixed(1)} m`} />
          <Readout label="Maximum height" value={`${peak.toFixed(1)} m`} />
          <Readout label="Speed at the point" value={`${speedNow.toFixed(1)} m/s`} />
          <Readout label="Horizontal vx" value={`${vxNow.toFixed(1)} m/s`} />
          <Readout label="Vertical vy" value={`${vyNow.toFixed(1)} m/s`} />
        </div>

        <p className="apple-lab-note">
          {WORLD_LABEL[world]} pulls at {g} m/s². Range is largest at 45° only when the ground is flat;
          with a launch height the best angle is slightly below it, which is why the equal-range pair
          drifts apart as soon as you raise the platform.
        </p>

        <Questions
          items={[
            { q: "Why is the horizontal velocity constant?", a: "No horizontal force acts after launch (ignoring air). Gravity is vertical, so vx keeps its value while vy changes by g every second." },
            { q: "Why do 30° and 60° land at the same place?", a: "They share the same vx·vy product, and range = 2 vx vy / g. Same product, same range — the pair 90° − θ always does this on level ground." },
            { q: "What happens at the top of the path?", a: "vy passes through zero and the speed is just vx. If you launch from the ground, the path is symmetric and the top is half the flight time." },
          ]}
        />
      </div>
    </div>
  );
}

export default ProjectileBench;
