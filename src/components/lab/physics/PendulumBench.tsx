import { Picker, Readout, Range, ink, AMBER, CYAN, VIOLET } from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

/**
 * The simple pendulum — a practical, not a looping animation.
 *
 * The bob is not drawn from `θ = θ₀ cos(2πt/T)`. It is integrated from the real
 * equation of motion
 *
 *     θ̈ = −(g / L) sin θ
 *
 * at a fixed sub-step, and the period on screen is *measured* from the bob's
 * own zero crossings. That distinction is the experiment: the small-angle
 * result T = 2π√(L/g) is only an approximation, and at 25° the measured period
 * is visibly longer than the formula predicts. A student can pull the amplitude
 * up, watch the two numbers separate, and see why the practical asks for small
 * swings. Gravity is switchable, so the same pendulum swung on the Moon and on
 * Jupiter gives the 1/√g ratio the textbook claims.
 */

const GRAVITIES: Array<{ id: string; label: string; g: number }> = [
  { id: "earth", label: "Earth", g: 9.81 },
  { id: "moon", label: "Moon", g: 1.62 },
  { id: "mars", label: "Mars", g: 3.72 },
  { id: "jupiter", label: "Jupiter", g: 24.79 },
];

const PIVOT_X = 230;
const PIVOT_Y = 34;
const BOB_R = 13;

export default function PendulumBench() {
  const [lengthCm, setLengthCm] = useState(60);
  const [amplitude, setAmplitude] = useState(14);
  const [planet, setPlanet] = useState("earth");
  const [running, setRunning] = useState(true);
  const [measured, setMeasured] = useState<number | null>(null);
  /* The swing is drawn by rotating one group, not by re-rendering the scene
     60 times a second: the bob is a DOM node the frame loop moves directly. */
  const swingRef = useRef<SVGGElement | null>(null);
  const thetaRef = useRef<SVGTSpanElement | null>(null);

  const g = GRAVITIES.find((entry) => entry.id === planet)?.g ?? 9.81;
  const lengthM = lengthCm / 100;
  const amplitudeRad = (amplitude * Math.PI) / 180;
  const predicted = 2 * Math.PI * Math.sqrt(lengthM / g);

  const state = useRef({ theta: amplitudeRad, omega: 0, lastCross: 0, elapsed: 0, measured: null as number | null });

  const paint = (theta: number) => {
    const degrees = (theta * 180) / Math.PI;
    swingRef.current?.setAttribute("transform", `rotate(${degrees} ${PIVOT_X} ${PIVOT_Y})`);
    if (thetaRef.current) thetaRef.current.textContent = `θ = ${Math.abs(degrees).toFixed(0)}°`;
  };

  /* Every change of a physical parameter starts a fresh run: a period measured
     across a length change is not a measurement of anything. */
  useEffect(() => {
    state.current = { theta: amplitudeRad, omega: 0, lastCross: 0, elapsed: 0, measured: null };
    setMeasured(null);
    paint(amplitudeRad);
  }, [amplitudeRad, lengthM, g]);

  useAnimationFrame((_t, delta) => {
    if (!running) return;
    const s = state.current;
    const dt = Math.min(0.05, delta / 1000);
    const steps = 8;
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      const previous = s.theta;
      // semi-implicit Euler is stable at this step size and keeps energy bounded
      s.omega += -(g / lengthM) * Math.sin(s.theta) * h;
      s.theta += s.omega * h;
      s.elapsed += h;
      if (previous < 0 && s.theta >= 0) {
        if (s.lastCross > 0) s.measured = s.elapsed - s.lastCross;
        s.lastCross = s.elapsed;
      }
    }
    paint(s.theta);
    if (s.measured !== null) setMeasured(s.measured);
  });

  const lengthPx = 120 + (lengthCm - 10) * 1.55;
  const bobX = PIVOT_X;
  const bobY = PIVOT_Y + lengthPx;
  const maxSpeed = Math.sqrt(2 * g * lengthM * (1 - Math.cos(amplitudeRad)));
  const arcR = lengthPx;

  const reset = () => {
    state.current = { theta: amplitudeRad, omega: 0, lastCross: 0, elapsed: 0, measured: null };
    setMeasured(null);
    paint(amplitudeRad);
  };

  const gap = measured === null ? null : measured - predicted;

  return (
    <div className="flex flex-col gap-4">
      <div className="apple-lab-panel apple-lab-glass min-w-0 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Swing</p>
            <h3 className="apple-lab-title mt-1 text-base">
              Simple pendulum · {GRAVITIES.find((entry) => entry.id === planet)?.label}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="apple-lab-btn"
              onClick={() => setRunning((value) => !value)}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : "Swing"}
            </button>
            <button type="button" className="apple-lab-btn" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <svg
            viewBox="0 0 460 420"
            className="h-auto w-full max-w-[420px]"
            role="img"
            aria-label={`Simple pendulum of length ${lengthCm} centimetres swinging through ${amplitude} degrees`}
          >
            {/* the amplitude arc the bob travels */}
            <path
              d={`M ${PIVOT_X + Math.sin(-amplitudeRad) * arcR} ${PIVOT_Y + Math.cos(amplitudeRad) * arcR} A ${arcR} ${arcR} 0 0 1 ${PIVOT_X + Math.sin(amplitudeRad) * arcR} ${PIVOT_Y + Math.cos(amplitudeRad) * arcR}`}
              fill="none"
              stroke={ink(0.12)}
              strokeDasharray="3 6"
            />

            {/* support */}
            <line x1={PIVOT_X - 54} y1={PIVOT_Y - 8} x2={PIVOT_X + 54} y2={PIVOT_Y - 8} stroke={ink(0.5)} strokeWidth={2.5} />
            <rect x={PIVOT_X - 8} y={PIVOT_Y - 8} width={16} height={7} rx={2} fill={ink(0.35)} />

            {/* The swinging assembly. It is drawn hanging straight down and
                rotated as one group, so the string always meets the bob. */}
            <g
              ref={swingRef}
              transform={`rotate(${amplitude} ${PIVOT_X} ${PIVOT_Y})`}
            >
              <line x1={PIVOT_X} y1={PIVOT_Y} x2={bobX} y2={bobY} stroke={ink(0.4)} strokeWidth={1.3} />
              <circle cx={bobX} cy={bobY} r={BOB_R + 7} fill={CYAN} opacity={0.12} />
              <circle cx={bobX} cy={bobY} r={BOB_R} fill={CYAN} />
              <circle cx={bobX - 4} cy={bobY - 4} r={3.4} fill="#ffffff" opacity={0.55} />
            </g>

            {/* length and angle labels */}
            <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + lengthPx} stroke={VIOLET} strokeWidth={1} strokeDasharray="4 5" />
            <text x={PIVOT_X + 7} y={PIVOT_Y + lengthPx * 0.55} fontSize={11} fill={ink(0.55)}>
              L = {lengthCm} cm
            </text>
            <text x={PIVOT_X + 14} y={PIVOT_Y + 74} fontSize={10.5} fill={AMBER}>
              <tspan ref={thetaRef}>θ = {amplitude}°</tspan>
            </text>
            <text x={PIVOT_X + 14} y={PIVOT_Y + 90} fontSize={10} fill={ink(0.45)}>
              θ₀ = {amplitude}°
            </text>

            {/* the mean position */}
            <line x1={PIVOT_X} y1={PIVOT_Y + lengthPx + 16} x2={PIVOT_X} y2={PIVOT_Y + lengthPx - 26} stroke={ink(0.2)} strokeDasharray="2 4" />
            <text x={PIVOT_X} y={PIVOT_Y + lengthPx + 32} fontSize={10} fill={ink(0.45)} textAnchor="middle">
              mean position
            </text>
          </svg>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <Picker
            label="Where"
            value={planet}
            options={GRAVITIES.map((entry) => ({ id: entry.id, label: entry.label }))}
            onChange={(next) => setPlanet(next)}
          />
          <Range label="Length L" value={lengthCm} min={10} max={100} step={1} unit="cm" onChange={setLengthCm} />
          <Range
            label="Amplitude θ₀"
            value={amplitude}
            min={3}
            max={28}
            step={1}
            unit="°"
            onChange={setAmplitude}
          />
          <p className="apple-lab-note">
            Keep θ₀ under about 10° to make the small-angle formula honest; above that the measured swing is
            measurably slower than 2π√(L/g).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Readout label="Predicted T (small angle)" value={`${predicted.toFixed(3)} s`} />
          <Readout label="Measured T" value={measured === null ? "measuring…" : `${measured.toFixed(3)} s`} />
          <Readout label="Frequency f" value={`${(1 / (measured ?? predicted)).toFixed(2)} Hz`} />
          <Readout label="Max speed at mean" value={`${maxSpeed.toFixed(2)} m/s`} />
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">Measured against the formula</p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              T = 2π√(L/g) = 2π√({lengthM.toFixed(2)}/{g}) = {predicted.toFixed(3)} s
              {gap === null ? "" : ` · measured is ${gap >= 0 ? "+" : ""}${gap.toFixed(3)} s`}
            </p>
            <p className="apple-lab-note mt-1">
              g = {g} m/s². The measured period is timed from the bob's own passes through the mean position, so it
              includes the large-amplitude correction the formula leaves out.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
