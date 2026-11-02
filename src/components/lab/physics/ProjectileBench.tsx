import {
  LiveDot,
  Picker,
  Questions,
  Range,
  AMBER,
  CYAN,
  MINT,
  ink,
  plate,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Projectile motion — Class 11, "Motion in a Plane".
 *
 * The bench is a shot you are trying to land, not a diagram you read: a flag
 * stands at a fixed distance, and the two controls are the two numbers the
 * chapter actually gives a student — launch speed u and angle θ. Changing
 * either redraws the arc; launching flies the ball along that very path in
 * real time, so the equal-time marks become a measurement rather than a
 * claim. Hit the flag and the bar says so.
 *
 * The dashed second arc is the complementary angle 90° − θ. On level ground
 * it lands in the same place, which is the standard result; raise the
 * launcher and the symmetry breaks, honestly, on screen.
 */

type World = "earth" | "moon" | "mars";
const G: Record<World, number> = { earth: 9.81, moon: 1.62, mars: 3.72 };
const WORLD_LABEL: Record<World, string> = { earth: "Earth", moon: "Moon", mars: "Mars" };

const W = 860;
const H = 400;
const PAD = 54;
const GROUND_Y = H - 54;

/** One second of flight takes this many seconds of wall clock at 1×. */
const FLIGHT_SECONDS = 2.8;

/** Fixed flag distances, in metres. A pass round the set, then it repeats. */
const FLAGS = [28, 36, 44, 52, 60];
/** How close to the flag counts as a landing. */
const HIT_RADIUS = 1.5;

export function ProjectileBench() {
  const [u, setU] = useState(24);
  const [theta, setAngle] = useState(45);
  const [height, setHeight] = useState(0);
  const [world, setWorld] = useState<World>("earth");
  const [inspect, setInspect] = useState(0);
  const [running, setRunning] = useState(false);
  const [showDots, setShowDots] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [flagIndex, setFlagIndex] = useState(1);
  const [result, setResult] = useState<{ hit: boolean; gap: number } | null>(null);

  const target = FLAGS[flagIndex];
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
  const otherFlight =
    (otherVy + Math.sqrt(otherVy * otherVy + 2 * g * height)) / g;
  const otherRange = otherVx * otherFlight;
  const otherPeak = height + (otherVy * otherVy) / (2 * g);

  const t = inspect * flight;
  const px = vx * t;
  const py = height + vy0 * t - 0.5 * g * t * t;
  const vxNow = vx;
  const vyNow = vy0 - g * t;
  const speedNow = Math.hypot(vxNow, vyNow);
  const directionNow = (Math.atan2(vyNow, vxNow) * 180) / Math.PI;
  /* One drawing scale for every velocity arrow: the launch vector is 86 px at
     the top speed, so the components keep their true proportion to it. */
  const arrowScale = 86 / 45;

  /* The 45° shot at this speed is the furthest reach, so the frame is held
     still against it: every angle is read against the same envelope instead
     of the plate rescaling under the sliders. */
  const envVx = u * Math.cos(Math.PI / 4);
  const envVy = u * Math.sin(Math.PI / 4);
  const envFlight = (envVy + Math.sqrt(envVy * envVy + 2 * g * height)) / g;
  const envRange = envVx * envFlight;
  const envPeak = height + (envVy * envVy) / (2 * g);

  /* One scale for both axes, so the path keeps its true shape. The flag is
     always inside the frame, even when the shot falls short of it. */
  const xMax = Math.max(range, showGhost ? otherRange : 0, envRange, target + 3, 1);
  const yMax = Math.max(peak, showGhost ? otherPeak : 0, envPeak, 1);
  const scale = Math.min(
    (W - PAD - 56) / xMax,
    (GROUND_Y - 54) / Math.max(yMax, height + 1),
  );
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
    [u, theta, height, g, flight, scale, target],
  );

  const ghost = useMemo(
    () => buildPath(90, otherVx, otherVy, otherFlight),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [u, theta, height, g, otherFlight, scale, target],
  );

  const envelope = useMemo(
    () => (Math.abs(theta - 45) < 0.6 ? "" : buildPath(70, envVx, envVy, envFlight)),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [u, theta, height, g, envFlight, scale, target],
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
  }, [inspect, u, theta, height, g, scale, t, target]);

  /* Equal-time dots: they crowd at the top and stretch at the ends. */
  const dots = Array.from({ length: 9 }, (_, i) => {
    const tt = (i / 8) * flight;
    return { x: X(vx * tt), y: Y(height + vy0 * tt - 0.5 * g * tt * tt) };
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
    const next = inspect + dt / 1000 / FLIGHT_SECONDS;
    if (next >= 1) {
      setInspect(1);
      setRunning(false);
      const gap = range - target;
      setResult({ hit: Math.abs(gap) <= HIT_RADIUS, gap });
    } else {
      setInspect(next);
    }
  });

  const launch = () => {
    if (inspect >= 0.999) setInspect(0);
    setResult(null);
    last.current = null;
    setRunning(true);
  };
  const resetShot = () => {
    setRunning(false);
    setInspect(0);
    setResult(null);
  };
  const skipEdit = () => {
    setRunning(false);
    setResult(null);
  };

  const status = running
    ? "in flight"
    : result
      ? result.hit
        ? "on the flag"
        : "landed"
      : inspect > 0
        ? "paused"
        : "ready";

  return (
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        {/* Header: what this is for, in one line, above the instrument. */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 11 · Motion in a plane · projectile</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              Land the shot on the flag
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              A launch is two motions at once: steady sideways, accelerating
              downwards. Pick θ and u so the arc finishes on the flag.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LiveDot on={running} label={status} />
            <Picker
              label="Gravity"
              value={world}
              options={[
                { id: "earth", label: "Earth" },
                { id: "moon", label: "Moon" },
                { id: "mars", label: "Mars" },
              ]}
              onChange={(next) => {
                setWorld(next);
                skipEdit();
              }}
            />
          </div>
        </div>

        {/* The sky. Everything drawn here is the experiment, edge to edge. */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={`Projectile launched at ${theta} degrees, ${u} metres per second, aiming at a flag ${target} metres away`}
          >
            <defs>
              <linearGradient id="projectile-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AMBER} stopOpacity="0.16" />
                <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* A faint measuring grid, so the arc's height and span read as
                countable distances rather than decoration. */}
            {Array.from({ length: 7 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={26}
                y1={Y((i * yMax) / 5)}
                x2={W - 22}
                y2={Y((i * yMax) / 5)}
                stroke={ink(0.045)}
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={X((i * xMax) / 10)}
                y1={40}
                x2={X((i * xMax) / 10)}
                y2={originY}
                stroke={ink(0.045)}
                strokeWidth={1}
              />
            ))}

            {/* Ground with metre ticks. */}
            <line x1={20} y1={originY} x2={W - 16} y2={originY} stroke={ink(0.34)} strokeWidth={1.6} />

            {/* The flag: the target of the whole bench. */}
            <g>
              <circle cx={X(target)} cy={originY} r={17} fill="none" stroke={MINT} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.7} />
              <line x1={X(target)} y1={originY} x2={X(target)} y2={originY - 52} stroke={ink(0.6)} strokeWidth={1.6} />
              <path d={`M${X(target)} ${originY - 52} l30 9 l-30 9 z`} fill={MINT} opacity={0.9} />
              <text
                x={X(target) + 37}
                y={originY - 42}
                fontSize={11.5}
                fill={MINT}
                paintOrder="stroke"
                stroke={plate(0.9)}
                strokeWidth={3}
              >
                {target} m
              </text>
            </g>

            {/* The 45° envelope: the furthest this speed can reach. */}
            {envelope ? (
              <>
                <path d={envelope} fill="none" stroke={ink(0.18)} strokeWidth={1.3} strokeDasharray="2 7" />
                <text
                  x={X(envVx * (envVy / g))}
                  y={Y(envPeak) - 8}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={ink(0.38)}
                >
                  45° reaches furthest
                </text>
              </>
            ) : null}

            {/* Complementary shot. */}
            {showGhost && (
              <path d={ghost} fill="none" stroke={MINT} strokeWidth={1.6} strokeDasharray="5 5" opacity={0.65} />
            )}

            {/* Area under the live arc, then the full path faint, then the
                flown part solid. */}
            <path d={`${path} L${X(range)} ${originY} L${originX} ${originY} Z`} fill="url(#projectile-fill)" stroke="none" />
            <path d={path} fill="none" stroke={ink(0.26)} strokeWidth={1.6} strokeLinejoin="round" />
            {flown ? (
              <path d={flown} fill="none" stroke="var(--lab-diagram-ink)" strokeWidth={2.8} strokeLinejoin="round" />
            ) : null}

            {showDots &&
              dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={2.6} fill={ink(0.38)} />
              ))}

            {/* Apex marker: the top of the path, at the x where vy = 0. */}
            <line x1={X(vx * (vy0 / g))} y1={Y(peak)} x2={X(vx * (vy0 / g))} y2={originY} stroke={ink(0.18)} strokeWidth={1} strokeDasharray="3 5" />
            <text x={X(vx * (vy0 / g)) + 7} y={Y(peak) - 9} fontSize={10.5} fill={ink(0.5)}>
              apex {peak.toFixed(1)} m
            </text>

            {/* The cannon and the launch wedge, with θ written on the plate. */}
            <circle cx={originX} cy={Y(height)} r={4.5} fill="var(--lab-diagram-ink)" />
            <path
              d={`M${originX + 30} ${Y(height)} A30 30 0 0 0 ${originX + 30 * Math.cos(rad)} ${Y(height) - 30 * Math.sin(rad)}`}
              fill="none"
              stroke={AMBER}
              strokeWidth={1.4}
              opacity={0.8}
            />
            <line
              x1={originX}
              y1={Y(height)}
              x2={originX + u * Math.cos(rad) * arrowScale}
              y2={Y(height) - u * Math.sin(rad) * arrowScale}
              stroke={AMBER}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <text
              x={originX + 34 * Math.cos(rad / 2) + 2}
              y={Y(height) - 34 * Math.sin(rad / 2) + 4}
              fontSize={11}
              fill={AMBER}
              paintOrder="stroke"
              stroke={plate(0.92)}
              strokeWidth={3}
            >
              {theta}°
            </text>

            {/* The ball, and its two velocity components at this instant. */}
            <circle cx={X(px)} cy={Y(py)} r={9} fill={plate(0.9)} stroke={ink(0.65)} strokeWidth={1.6} />
            <circle cx={X(px)} cy={Y(py)} r={3.6} fill={running ? "var(--lab-diagram-mint)" : ink(0.8)} />
            <line x1={X(px)} y1={Y(py)} x2={X(px) + vxNow * arrowScale} y2={Y(py)} stroke={CYAN} strokeWidth={2} />
            <line x1={X(px)} y1={Y(py)} x2={X(px)} y2={Y(py) - vyNow * arrowScale} stroke={AMBER} strokeWidth={2} />
            <line
              x1={X(px)}
              y1={Y(py)}
              x2={X(px) + vxNow * arrowScale}
              y2={Y(py) - vyNow * arrowScale}
              stroke={ink(0.5)}
              strokeWidth={1.4}
              strokeDasharray="4 4"
            />
            <text
              x={X(px) + vxNow * arrowScale + 6}
              y={Y(py) + 4}
              fontSize={11}
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
              fontSize={11}
              fill={AMBER}
              textAnchor="end"
              paintOrder="stroke"
              stroke={plate(0.92)}
              strokeWidth={3.5}
            >
              vy
            </text>

            {/* Range bracket along the ground. */}
            <line x1={originX} y1={originY + 18} x2={X(range)} y2={originY + 18} stroke={ink(0.32)} strokeWidth={1.2} />
            <line x1={originX} y1={originY + 12} x2={originX} y2={originY + 24} stroke={ink(0.32)} strokeWidth={1.2} />
            <line x1={X(range)} y1={originY + 12} x2={X(range)} y2={originY + 24} stroke={ink(0.32)} strokeWidth={1.2} />
            <text x={(originX + X(range)) / 2} y={originY + 38} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>
              R = {range.toFixed(1)} m
            </text>


          </svg>

          {/* HUD: the three numbers a gunner would watch, fixed size over
              the plate so they stay legible at any width. */}
          <div className="pointer-events-none absolute right-3 top-9 flex gap-3 sm:right-5 sm:gap-6">
            {[
              ["range", `${range.toFixed(1)} m`],
              ["flight", `${flight.toFixed(2)} s`],
              ["apex", `${peak.toFixed(1)} m`],
            ].map(([label, value]) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--lab-ink-micro)]">
                  {label}
                </p>
                <p className="apple-lab-value text-[14px] font-semibold tabular-nums sm:text-[16px]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {result ? (
            <div
              className="pointer-events-none absolute left-4 top-9 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur-sm sm:left-5"
              style={{
                borderColor: result.hit ? "color-mix(in srgb, var(--lab-diagram-mint) 55%, transparent)" : "color-mix(in srgb, #ff5a66 50%, transparent)",
                background: result.hit ? "color-mix(in srgb, var(--lab-diagram-mint) 14%, var(--lab-diagram-plate))" : "color-mix(in srgb, #ff5a66 12%, var(--lab-diagram-plate))",
                color: result.hit ? "var(--lab-diagram-mint)" : "#ff7b84",
              }}
            >
              {result.hit
                ? `On the flag — ${range.toFixed(1)} m`
                : `${Math.abs(result.gap).toFixed(1)} m ${result.gap < 0 ? "short" : "over"} — adjust and launch again`}
            </div>
          ) : null}
        </div>

        {/* The firing console: two sliders that matter, one trigger. */}
        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_0.9fr_auto] lg:items-end">
            <Range
              label="Launch angle θ"
              value={theta}
              min={5}
              max={85}
              step={1}
              unit="°"
              onChange={(v) => {
                setAngle(v);
                skipEdit();
              }}
            />
            <Range
              label="Launch speed u"
              value={u}
              min={8}
              max={45}
              step={1}
              unit="m/s"
              onChange={(v) => {
                setU(v);
                skipEdit();
              }}
            />
            <Range
              label="Launch height"
              value={height}
              min={0}
              max={10}
              step={0.5}
              unit="m"
              format={(v) => v.toFixed(1)}
              onChange={(v) => {
                setHeight(v);
                skipEdit();
              }}
            />

            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
              {running ? (
                <button type="button" className="apple-lab-btn apple-lab-btn--stop" onClick={() => setRunning(false)}>
                  Pause
                </button>
              ) : (
                <button type="button" className="apple-lab-btn apple-lab-btn--run" onClick={launch}>
                  {inspect >= 0.999 ? "Launch again" : inspect > 0 ? "Resume" : "Launch"}
                </button>
              )}
              <button
                type="button"
                className="apple-lab-btn"
                onClick={resetShot}
                disabled={inspect === 0 && !result}
              >
                Reset
              </button>
              <button
                type="button"
                className="apple-lab-btn"
                onClick={() => {
                  setFlagIndex((i) => (i + 1) % FLAGS.length);
                  resetShot();
                }}
              >
                New flag
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--lab-line-soft)] pt-3">
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              data-active={showDots}
              role="switch"
              aria-checked={showDots}
              onClick={() => setShowDots((v) => !v)}
            >
              Equal-time dots
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              data-active={showGhost}
              role="switch"
              aria-checked={showGhost}
              onClick={() => setShowGhost((v) => !v)}
            >
              Complementary shot
            </button>
            <span className="text-[11px] text-[var(--lab-ink-micro)]">
              {WORLD_LABEL[world]} pulls at {g} m/s² · speed now{" "}
              <strong className="text-[var(--lab-ink)]">{speedNow.toFixed(1)} m/s</strong> at{" "}
              {directionNow.toFixed(0)}° · vx stays{" "}
              <strong style={{ color: CYAN }}>{vxNow.toFixed(1)} m/s</strong> ·{" "}
              {sameRange
                ? "the two angles land together"
                : "the pair splits: the launcher is off the ground"}
            </span>
          </div>
        </div>
      </section>

      <Questions
        items={[
          {
            q: "Why does the ball fall faster at the end?",
            a: "Only the vertical component changes: vy = u sin θ − gt. The horizontal component is untouched because no horizontal force acts once the ball has left the launcher (ignoring air).",
          },
          {
            q: "Why do 30° and 60° land together on flat ground?",
            a: "Range = 2 vx vy / g = u² sin 2θ / g, and sin 2θ = sin(180° − 2θ). Same product, same range — every pair θ and 90° − θ does this when the launch and landing heights are equal.",
          },
          {
            q: "Why is 45° not quite the best angle here?",
            a: "With a launch height the extra fall time rewards a flatter shot, so the best angle drops just below 45°; at zero height it is exactly 45°. Air resistance would pull the optimum lower again, for a different reason.",
          },
          {
            q: "What is the apex of the path?",
            a: "vy passes through zero there, so the speed at the top is just vx. From a level launch the path is symmetric and the top is exactly half the flight time.",
          },
        ]}
      />
    </div>
  );
}

export default ProjectileBench;
