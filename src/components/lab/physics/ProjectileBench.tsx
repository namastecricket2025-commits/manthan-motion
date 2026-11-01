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
  MINT,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Projectile motion — Class 11.
 *
 * One launch, decomposed. The ball leaves at u and θ; from that moment the
 * horizontal motion is untouched by gravity and the vertical one is pure free
 * fall. So the bench draws both at once: the curved path with equal time marks
 * along it, and at the inspection point the velocity arrow split into its two
 * components, one of which never changes.
 *
 * The launch button is the point of the bench, not decoration: pressing it
 * flies the ball along the very path the sliders describe, in real time, so
 * the dot marks stop being a claim and become a measurement. The trail it
 * leaves is the path; the ball slows its climb, hangs at the top where vy
 * crosses zero, and speeds up on the way down.
 *
 * The ghost trajectory is the complementary angle 90° − θ. With no launch
 * height it lands at exactly the same range, which is the fact the textbook
 * states and a blackboard cannot show happening. Raise the launcher and the
 * symmetry breaks — honestly, on screen.
 */

type World = "earth" | "moon" | "mars";
const G: Record<World, number> = { earth: 9.81, moon: 1.62, mars: 3.72 };
const WORLD_LABEL: Record<World, string> = { earth: "Earth", moon: "Moon", mars: "Mars" };

/* The plate is taller than it was: the drawing now owns the panel's width and
   the empty band under the arc is gone. */
const W = 760;
const H = 470;
const PAD = 62;
const GROUND_Y = H - 62;

/** One second of flight takes `seconds` of wall clock at 1×. */
const FLIGHT_SECONDS = 2.8;

export function ProjectileBench() {
  const [u, setU] = useState(24);
  const [theta, setAngle] = useState(45);
  const [height, setHeight] = useState(0);
  const [world, setWorld] = useState<World>("earth");
  const [inspect, setInspect] = useState(0.55);
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(1);
  const [showDots, setShowDots] = useState(true);
  const [showGhost, setShowGhost] = useState(true);

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
  const directionNow = (Math.atan2(vyNow, vxNow) * 180) / Math.PI;
  /* The arrow lengths are a fixed drawing scale: the launch vector is 86 px,
     so the components stay in proportion to it at every speed. */
  const arrowScale = 86 / Math.max(u, 1);

  /* One scale for both axes, so the path keeps its true shape. */
  const xMax = Math.max(range, showGhost ? otherRange : 0, 1);
  const yMax = Math.max(peak, 1);
  const scale = Math.min((W - PAD - 64) / xMax, (H - PAD - 56) / Math.max(yMax, height + 1));
  const originX = PAD;
  const originY = GROUND_Y;
  const X = (x: number) => originX + x * scale;
  const Y = (y: number) => originY - y * scale;

  const buildPath = (count: number, sx: number, sy0: number, totalTime: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= count; i += 1) {
      const tt = (i / count) * totalTime;
      pts.push(`${X(sx * tt).toFixed(1)} ${Y(height + sy0 * tt - 0.5 * g * tt * tt).toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
  };

  const path = useMemo(
    () => buildPath(90, vx, vy0, flight),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [u, theta, height, g, flight, scale],
  );

  const ghost = useMemo(
    () => buildPath(90, otherVx, otherVy, otherFlight),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [u, theta, height, g, otherFlight, scale],
  );

  /* The part of the path already flown, drawn solid and bright behind the
     ball; the rest stays as the faint full path. */
  const flown = useMemo(() => {
    if (inspect <= 0.001) return "";
    const steps = Math.max(2, Math.round(inspect * 60));
    const pts: string[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const tt = (i / steps) * t;
      pts.push(`${X(vx * tt).toFixed(1)} ${Y(height + vy0 * tt - 0.5 * g * tt * tt).toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [inspect, u, theta, height, g, scale, t]);

  /* Equal-time dots: they crowd at the top and stretch at the ends. */
  const dots = Array.from({ length: 9 }, (_, i) => {
    const tt = (i / 8) * flight;
    return { x: X(vx * tt), y: Y(height + vy0 * tt - 0.5 * g * tt * tt), t: tt };
  });

  const sameRange = Math.abs(range - otherRange) < 0.01;

  /* ---- the flight clock ---------------------------------------------- */
  const last = useRef<number | null>(null);
  useAnimationFrame((now) => {
    if (!running) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current);
    last.current = now;
    const next = inspect + (dt / 1000 / FLIGHT_SECONDS) * rate;
    if (next >= 1) {
      setInspect(1);
      setRunning(false);
    } else {
      setInspect(next);
    }
  });

  const launch = () => {
    if (inspect >= 0.999) setInspect(0);
    last.current = null;
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setInspect(0);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 11 · Motion in a plane"
        title="Launch it, watch it, read the two motions apart"
        meta={
          <>
            <span className="apple-lab-chip">{WORLD_LABEL[world]} · g = {g} m/s²</span>
            <LiveDot on={running} label={running ? "in flight" : inspect >= 1 ? "landed" : "ready"} />
          </>
        }
        toolbar={
          <>
            <Picker
              label="World"
              value={world}
              options={[
                { id: "earth", label: "Earth" },
                { id: "moon", label: "Moon" },
                { id: "mars", label: "Mars" },
              ]}
              onChange={(next) => {
                setWorld(next);
                setRunning(false);
              }}
            />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageToggle label="Equal-time dots" checked={showDots} onChange={setShowDots} />
                <StageToggle label="Complementary shot" checked={showGhost} onChange={setShowGhost} />
              </div>
            </div>
          </>
        }
        rail={
          <>
            {running ? (
              <button type="button" className="apple-lab-btn apple-lab-btn--stop" onClick={pause}>
                Pause
              </button>
            ) : (
              <button
                type="button"
                className="apple-lab-btn apple-lab-btn--run"
                onClick={launch}
              >
                {inspect >= 1 ? "Launch again" : inspect > 0 ? "Resume" : "Launch"}
              </button>
            )}
            <button type="button" className="apple-lab-btn" onClick={reset} disabled={inspect === 0 && !running}>
              Reset
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(inspect * 100).toFixed(1)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              t = {t.toFixed(2)} s / {flight.toFixed(2)} s
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="Time of flight" value={`${flight.toFixed(2)} s`} />
            <StageStat label="Range" value={`${range.toFixed(1)} m`} tone="mint" />
            <StageStat label="Max height" value={`${peak.toFixed(1)} m`} />
            <StageStat label="Speed now" value={`${speedNow.toFixed(1)} m/s`} tone="amber" />
            <StageStat label="Time at point" value={`${t.toFixed(2)} s`} />
            <StageStat label="Direction" value={`${directionNow.toFixed(0)}°`} />
            <StageStat label="vx (never changes)" value={`${vxNow.toFixed(1)} m/s`} tone="cyan" />
            <StageStat label="vy (gravity acts)" value={`${vyNow.toFixed(1)} m/s`} tone="amber" />
          </>
        }
        note={
          <>
            The dots are equally spaced in <em>time</em>, not distance. They bunch near the top
            because the vertical motion is slowing down, and the horizontal gaps are all the same
            because vx never changes.
          </>
        }
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projectile trajectory with velocity components">
          {/* A faint measuring grid: the plate reads as graph paper, so the
              arc's height and span are countable rather than decorative. */}
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={28}
              y1={Y((i * yMax) / 5)}
              x2={W - 26}
              y2={Y((i * yMax) / 5)}
              stroke={ink(0.05)}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={X((i * xMax) / 7)}
              y1={40}
              x2={X((i * xMax) / 7)}
              y2={originY}
              stroke={ink(0.05)}
              strokeWidth={1}
            />
          ))}

          {/* Ground */}
          <line x1={24} y1={originY} x2={W - 18} y2={originY} stroke={ink(0.3)} strokeWidth={1.6} />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={originX + i * 48} y1={originY} x2={originX + i * 48} y2={originY + 5} stroke={ink(0.15)} strokeWidth={1} />
          ))}

          {/* Complementary ghost */}
          {showGhost && (
            <path d={ghost} fill="none" stroke={MINT} strokeWidth={1.6} strokeDasharray="5 5" opacity={0.75} />
          )}
          {/* Full path, faint */}
          <path d={path} fill="none" stroke={ink(0.28)} strokeWidth={1.6} strokeLinejoin="round" />
          {/* The part already flown */}
          {flown ? (
            <path d={flown} fill="none" stroke="var(--lab-diagram-ink)" strokeWidth={2.8} strokeLinejoin="round" />
          ) : null}

          {/* Equal-time markers */}
          {showDots &&
            dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={2.6} fill={ink(0.4)} />
            ))}

          {/* Launch arrow. The speed and angle are printed in the panel;
              putting them here too was what collided with the components. */}
          <line
            x1={originX}
            y1={Y(height)}
            x2={originX + u * Math.cos(rad) * arrowScale}
            y2={Y(height) - u * Math.sin(rad) * arrowScale}
            stroke={AMBER}
            strokeWidth={2.4}
            strokeLinecap="round"
          />

          {/* Inspection point and its two components */}
          <circle cx={X(px)} cy={Y(py)} r={9} fill={plate(0.9)} stroke={ink(0.7)} strokeWidth={2} />
          <circle cx={X(px)} cy={Y(py)} r={3.4} fill={running ? "var(--lab-diagram-mint)" : ink(0.75)} />
          <line x1={X(px)} y1={Y(py)} x2={X(px) + vxNow * arrowScale} y2={Y(py)} stroke={CYAN} strokeWidth={2} />
          <line x1={X(px)} y1={Y(py)} x2={X(px)} y2={Y(py) - vyNow * arrowScale} stroke={AMBER} strokeWidth={2} />
          <line
            x1={X(px)}
            y1={Y(py)}
            x2={X(px) + vxNow * arrowScale}
            y2={Y(py) - vyNow * arrowScale}
            stroke={ink(0.55)}
            strokeWidth={1.6}
            strokeDasharray="4 4"
          />
          <text
            x={X(px) + vxNow * arrowScale + 6}
            y={Y(py) + 4}
            fontSize={11.5}
            fill={CYAN}
            paintOrder="stroke"
            stroke={plate(0.92)}
            strokeWidth={3.5}
          >
            vx
          </text>
          <text
            x={X(px) - 8}
            y={Y(py) - vyNow * arrowScale - 6}
            fontSize={11.5}
            fill={AMBER}
            textAnchor="end"
            paintOrder="stroke"
            stroke={plate(0.92)}
            strokeWidth={3.5}
          >
            vy
          </text>

          {/* Range bracket, measured from the launch point to the landing. */}
          <line x1={originX} y1={originY + 18} x2={X(range)} y2={originY + 18} stroke={ink(0.35)} strokeWidth={1.2} />
          <line x1={originX} y1={originY + 12} x2={originX} y2={originY + 24} stroke={ink(0.35)} strokeWidth={1.2} />
          <line x1={X(range)} y1={originY + 12} x2={X(range)} y2={originY + 24} stroke={ink(0.35)} strokeWidth={1.2} />
          <text x={(originX + X(range)) / 2} y={originY + 40} textAnchor="middle" fontSize={12} fill={ink(0.6)}>
            R = {range.toFixed(1)} m
          </text>

          <text x={26} y={28} fontSize={11.5} fill={ink(0.5)}>
            solid = {theta}°{showGhost ? ` · dashed = complementary ${90 - theta}°` : ""}
          </text>
          <text x={W - 24} y={28} textAnchor="end" fontSize={11.5} fill={ink(0.5)}>
            {sameRange ? "same range — the pair is exact" : "different range: the launcher is not on the ground"}
          </text>
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the launch</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">the plate redraws live</span>
          </div>
          <Range label="Launch speed u" value={u} min={5} max={45} step={1} unit="m/s" onChange={(v) => { setU(v); setRunning(false); }} />
          <Range label="Launch angle θ" value={theta} min={5} max={85} step={1} unit="°" onChange={(v) => { setAngle(v); setRunning(false); }} />
          <Range label="Launch height" value={height} min={0} max={10} step={0.5} unit="m" format={(v) => v.toFixed(1)} onChange={(v) => { setHeight(v); setRunning(false); }} />
          <Range
            label="Inspect at"
            value={inspect}
            min={0}
            max={1}
            step={0.01}
            unit="of flight"
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => { setRunning(false); setInspect(v); }}
          />
          <Picker
            label="Playback speed"
            value={String(rate)}
            options={[
              { id: "0.5", label: "½×" },
              { id: "1", label: "1×" },
              { id: "2", label: "2×" },
            ]}
            onChange={(next) => setRate(Number(next))}
          />
        </div>

        <div className="apple-lab-card px-3.5 py-3">
          <p className="apple-lab-micro">What the run shows</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            {WORLD_LABEL[world]} pulls at {g} m/s². Range is largest at 45° only when the ground is
            flat; with a launch height the best angle is slightly below it, which is why the
            equal-range pair drifts apart as soon as you raise the platform.
          </p>
        </div>

        <Questions
          columns={1}
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
