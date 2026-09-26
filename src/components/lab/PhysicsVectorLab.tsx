import { SPRING, useSpringTransition, useStillMotion, viewVariants } from "@/lib/motion";
import { AnimatePresence, animate, motion, useAnimationFrame } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Physics — interactive vector engines.
 *
 * Three benches, all drawn as ultra-clean vector geometry on the lab's glass
 * (no textured frames, no bitmap art):
 *
 *   Circuits  a closed loop wire with a continuous dotted current flow that
 *             tracks the wire while the switch is closed. Current is real —
 *             I = V / R — so the dot speed, the bulb glow and the readouts all
 *             move together when the voltage or the resistance changes.
 *   Motion    a projectile whose trajectory morphs on a spring when speed or
 *             angle changes, with live velocity and gravity vectors riding the
 *             ball. The flight plays in real seconds, from the same kinematics.
 *   Waves     infinitely looping, mathematically driven sine streams. The
 *             controls tween the amplitude and the frequency on a spring while
 *             the phase advances every frame, so a change *scales and
 *             accelerates* the wave instead of re-drawing it in steps.
 */

const VIOLET = "#a78bfa";
const CYAN = "#7dd3fc";
const INK = "rgba(255,255,255,0.9)";
const GRID = "rgba(255,255,255,0.05)";

type Bench = "circuits" | "motion" | "waves";

const BENCHES: { id: Bench; label: string }[] = [
  { id: "circuits", label: "Circuits" },
  { id: "motion", label: "Motion" },
  { id: "waves", label: "Waves" },
];

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="apple-lab-micro">{label}</span>
        <span className="apple-lab-value text-[12.5px] font-semibold">
          {format ? format(value) : value.toFixed(step < 1 ? 2 : 0)}
          <span className="ml-1 text-[11px] text-[var(--lab-ink-dim)]">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        className="apple-lab-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-lab-card px-3 py-2.5">
      <p className="apple-lab-micro">{label}</p>
      <p className="apple-lab-value mt-1 text-[15px] font-semibold">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Circuits                                                            */
/* ------------------------------------------------------------------ */

/** One closed wire loop: the resistors, the switch and the lamp all sit on it. */
const WIRE_D =
  "M 108 92 H 532 A 44 44 0 0 1 576 136 V 244 A 44 44 0 0 1 532 288 H 108 A 44 44 0 0 1 64 244 V 136 A 44 44 0 0 1 108 92 Z";

const VOLTAGES = [1.5, 3, 4.5, 6, 9, 12];
const RESISTANCES = [10, 20, 40];

function CircuitsBench() {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const [closed, setClosed] = useState(true);
  const [voltage, setVoltage] = useState(6);
  const [resistance, setResistance] = useState(20);

  const current = closed ? voltage / resistance : 0;
  const power = voltage * current;

  const flowRef = useRef<SVGPathElement>(null);
  const offset = useRef(0);
  const speed = useRef(0);

  /* The displayed current follows its target on the shared spring, and the
     dots read that value every frame — so opening the switch, upping the
     voltage or changing the resistor eases the flow instead of cutting it. */
  useEffect(() => {
    if (still) {
      speed.current = current;
      return;
    }
    const controls = animate(speed.current, current, {
      ...SPRING,
      onUpdate: (latest) => {
        speed.current = latest;
      },
    });
    return () => controls.stop();
  }, [current, still]);

  useAnimationFrame((_, delta) => {
    if (!still) offset.current -= (delta / 1000) * 210 * speed.current;
    flowRef.current?.setAttribute("stroke-dashoffset", String(offset.current));
  });

  const glow = Math.min(1, power / 3.6);
  const readouts = [
    ["Voltage", `${voltage.toFixed(1)} V`],
    ["Resistance", `${resistance} Ω`],
    ["Current", `${current.toFixed(2)} A`],
    ["Power", `${power.toFixed(2)} W`],
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Series loop</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {closed ? "Circuit closed — current flowing" : "Circuit open — no current"}
            </h3>
          </div>
          <span className="apple-lab-chip">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: closed ? CYAN : "rgba(255,255,255,0.35)" }}
            />
            {current.toFixed(2)} A
          </span>
        </div>

        <svg
          viewBox="0 0 640 380"
          className="mt-4 h-[320px] w-full"
          role="img"
          aria-label="A closed circuit loop with a battery, a switch, a resistor and a lamp"
        >
          <defs>
            <linearGradient id="lab-flow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={CYAN} />
              <stop offset="55%" stopColor={VIOLET} />
              <stop offset="100%" stopColor={CYAN} />
            </linearGradient>
            <filter id="lab-flow-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="lab-lamp">
              <stop offset="0%" stopColor="rgba(255,236,180,0.95)" />
              <stop offset="60%" stopColor="rgba(255,196,120,0.35)" />
              <stop offset="100%" stopColor="rgba(255,196,120,0)" />
            </radialGradient>
          </defs>

          {/* structural grid */}
          {Array.from({ length: 15 }, (_, i) => (
            <line key={`v${i}`} x1={40 + i * 40} y1={30} x2={40 + i * 40} y2={350} stroke={GRID} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1={30} y1={40 + i * 40} x2={610} y2={40 + i * 40} stroke={GRID} />
          ))}

          {/* the wire itself */}
          <path d={WIRE_D} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={5} strokeLinecap="round" />
          <path d={WIRE_D} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.25} strokeLinecap="round" />

          {/* dotted current flow */}
          <motion.path
            ref={flowRef}
            d={WIRE_D}
            fill="none"
            stroke="url(#lab-flow)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1.5 13"
            filter="url(#lab-flow-glow)"
            initial={false}
            animate={{ opacity: closed ? 1 : 0 }}
            transition={transition}
          />

          {/* lamp on the left edge — brightness is the dissipated power */}
          <motion.circle
            cx={64}
            cy={190}
            fill="url(#lab-lamp)"
            initial={false}
            animate={{ r: 26 + glow * 22, opacity: 0.25 + glow * 0.75 }}
            transition={transition}
          />
          <circle cx={64} cy={190} r={22} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <path d={`M 50 176 L 78 204 M 78 176 L 50 204`} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

          {/* battery on the bottom edge */}
          <line x1={272} y1={270} x2={272} y2={306} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={296} y1={280} x2={296} y2={296} stroke="rgba(255,255,255,0.6)" strokeWidth={2.5} strokeLinecap="round" />
          <text x={258} y={264} fontSize={11} fill={INK} fontWeight={600}>
            +
          </text>
          <text x={292} y={268} fontSize={13} fill="rgba(255,255,255,0.6)" fontWeight={600}>
            -
          </text>
          <text x={284} y={330} fontSize={11} fill="rgba(255,255,255,0.7)" textAnchor="middle">
            {voltage.toFixed(1)} V source
          </text>

          {/* switch on the top edge — the lever swings on the shared spring */}
          <line x1={268} y1={92} x2={330} y2={92} stroke="rgba(15,15,22,0.9)" strokeWidth={7} strokeLinecap="round" />
          <circle cx={268} cy={92} r={4} fill={INK} />
          <circle cx={330} cy={92} r={4} fill="rgba(255,255,255,0.55)" />
          <motion.line
            x1={268}
            y1={92}
            x2={330}
            y2={92}
            stroke={closed ? VIOLET : "rgba(255,255,255,0.75)"}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={false}
            animate={{ rotate: closed ? 0 : -32 }}
            transition={transition}
            style={{ transformBox: "view-box", transformOrigin: "268px 92px" }}
          />
          <text x={299} y={72} fontSize={11} fill="rgba(255,255,255,0.7)" textAnchor="middle">
            {closed ? "closed" : "open"}
          </text>

          {/* resistor on the right edge */}
          <rect x={558} y={158} width={36} height={64} rx={10} fill="rgba(15,15,22,0.85)" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={566} y1={172 + i * 16} x2={586} y2={172 + i * 16} stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" />
          ))}
          <text x={576} y={244} fontSize={11} fill="rgba(255,255,255,0.7)" textAnchor="middle">
            {resistance} Ω
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Source</p>
          <div className="mt-3">
            <Range
              label="Voltage"
              value={voltage}
              min={1.5}
              max={12}
              step={1.5}
              unit="V"
              format={(v) => v.toFixed(1)}
              onChange={setVoltage}
            />
          </div>
          <p className="apple-lab-note mt-3">
            Ohm's law is the whole model: I = V / R. The dots travel the wire at
            the current that comes out of it, and nothing here is faked.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {readouts.map(([label, value]) => (
            <Readout key={label} label={label} value={value} />
          ))}
        </div>

        {/* Arranging logic cards: every card leans in at 1.02 on the spring. */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            onClick={() => setClosed((open) => !open)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={transition}
            className="apple-lab-card flex flex-col items-start gap-1 px-3 py-3 text-left"
            data-active={closed}
          >
            <span className="apple-lab-micro">Switch</span>
            <span className="apple-lab-value text-[13px] font-semibold">
              {closed ? "Closed — tap to open" : "Open — tap to close"}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() =>
              setResistance(
                RESISTANCES[(RESISTANCES.indexOf(resistance) + 1) % RESISTANCES.length],
              )
            }
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={transition}
            className="apple-lab-card flex flex-col items-start gap-1 px-3 py-3 text-left"
          >
            <span className="apple-lab-micro">Resistor</span>
            <span className="apple-lab-value text-[13px] font-semibold">
              {resistance} Ω — tap to swap
            </span>
          </motion.button>
        </div>

        <div className="apple-lab-card flex items-center gap-3 px-3 py-3">
          <span className="apple-lab-micro">Voltage steps</span>
          <div className="flex flex-wrap gap-1.5">
            {VOLTAGES.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setVoltage(step)}
                data-active={step === voltage}
                className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              >
                {step} V
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Motion — projectile, velocity and gravity vectors                   */
/* ------------------------------------------------------------------ */

const G = 9.81;
const X_MAX = 60; // metres shown on the ground
const Y_MAX = 30; // metres shown on the height axis
const PLOT = { left: 52, right: 872, top: 34, bottom: 330 };

const toScreen = (x: number, y: number) => ({
  x: PLOT.left + (x / X_MAX) * (PLOT.right - PLOT.left),
  y: PLOT.bottom - (y / Y_MAX) * (PLOT.bottom - PLOT.top),
});

/** The whole arc, sampled at a fixed resolution so it can morph smoothly. */
function trajectoryPath(speed: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  const flight = (2 * speed * Math.sin(angle)) / G;
  const steps = 72;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * flight;
    const point = toScreen(speed * Math.cos(angle) * t, speed * Math.sin(angle) * t - 0.5 * G * t * t);
    parts.push(`${i === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  }
  return parts.join(" ");
}

function MotionBench() {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const [speed, setSpeed] = useState(16);
  const [angle, setAngle] = useState(45);

  const angleRad = (angle * Math.PI) / 180;
  const range = (speed * speed * Math.sin(2 * angleRad)) / G;
  const apex = (speed * speed * Math.sin(angleRad) ** 2) / (2 * G);
  const flight = (2 * speed * Math.sin(angleRad)) / G;

  /* The live parameters are spring-animated copies, so a mid-flight change
     bends the trajectory instead of teleporting the ball. */
  const ballRef = useRef<SVGGElement>(null);
  const velRef = useRef<SVGLineElement>(null);
  const gravRef = useRef<SVGLineElement>(null);
  const live = useRef({ speed, angle: angleRad });
  const time = useRef(0);
  const pause = useRef(0);

  useEffect(() => {
    if (still) {
      live.current = { speed, angle: angleRad };
      return;
    }
    const stopSpeed = animate(live.current.speed, speed, {
      ...SPRING,
      onUpdate: (v) => {
        live.current.speed = v;
      },
    });
    const stopAngle = animate(live.current.angle, angleRad, {
      ...SPRING,
      onUpdate: (v) => {
        live.current.angle = v;
      },
    });
    return () => {
      stopSpeed.stop();
      stopAngle.stop();
    };
  }, [angle, angleRad, speed, still]);

  useAnimationFrame((_, delta) => {
    const { speed: v, angle: a } = live.current;
    const seconds = delta / 1000;
    const flying = (t: number) => v * Math.sin(a) * t - 0.5 * G * t * t;

    if (pause.current > 0) {
      pause.current -= seconds;
    } else if (!still) {
      time.current += seconds;
      if (flying(time.current) < 0) {
        time.current = 0;
        pause.current = 0.5;
      }
    }

    const t = time.current;
    const x = v * Math.cos(a) * t;
    const y = Math.max(0, flying(t));
    const point = toScreen(x, y);
    ballRef.current?.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);

    // velocity vector: (v cosθ, v sinθ − gt), drawn to scale
    const vx = v * Math.cos(a);
    const vy = v * Math.sin(a) - G * t;
    const scale = 4.2;
    velRef.current?.setAttribute("x2", (vx * scale).toFixed(2));
    velRef.current?.setAttribute("y2", (-vy * scale).toFixed(2));
    gravRef.current?.setAttribute("y2", String(G * 2.4));
  });

  const groundTicks = Array.from({ length: 7 }, (_, i) => i * 10);
  const heightTicks = Array.from({ length: 4 }, (_, i) => (i + 1) * 10);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Projectile</p>
            <h3 className="apple-lab-title mt-1 text-lg">Vector kinematics</h3>
          </div>
          <span className="apple-lab-chip">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
            v {speed.toFixed(0)} m/s · {angle.toFixed(0)}°
          </span>
        </div>

        <svg viewBox="0 0 900 360" className="mt-4 h-[300px] w-full" role="img" aria-label="A projectile trajectory with velocity and gravity vectors">
          <defs>
            <linearGradient id="lab-arc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* structural grid */}
          {groundTicks.map((x) => {
            const point = toScreen(x, 0);
            return (
              <g key={x}>
                <line x1={point.x} y1={PLOT.top} x2={point.x} y2={PLOT.bottom} stroke={GRID} />
                <text x={point.x} y={PLOT.bottom + 16} fontSize={10} fill="rgba(255,255,255,0.62)" textAnchor="middle">
                  {x} m
                </text>
              </g>
            );
          })}
          {heightTicks.map((y) => {
            const point = toScreen(0, y);
            return (
              <g key={y}>
                <line x1={PLOT.left} y1={point.y} x2={PLOT.right} y2={point.y} stroke={GRID} />
                <text x={PLOT.left - 12} y={point.y + 3.5} fontSize={10} fill="rgba(255,255,255,0.62)" textAnchor="end">
                  {y} m
                </text>
              </g>
            );
          })}
          <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right} y2={PLOT.bottom} stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} />

          {/* the arc morphs on the spring when speed or angle changes */}
          <motion.path
            initial={false}
            animate={{ d: trajectoryPath(speed, angle) }}
            transition={transition}
            fill="url(#lab-arc)"
            stroke={VIOLET}
            strokeWidth={2.25}
            strokeLinecap="round"
          />

          {/* the ball, riding the real kinematics */}
          <g ref={ballRef} transform="translate(52 330)">
            <line ref={velRef} x1={0} y1={0} x2={0} y2={0} stroke={VIOLET} strokeWidth={2} strokeLinecap="round" />
            <line ref={gravRef} x1={0} y1={0} x2={0} y2={0} stroke={CYAN} strokeWidth={2} strokeLinecap="round" />
            <circle r={6.5} fill="#ffffff" />
            <circle r={11} fill="none" stroke="rgba(255,255,255,0.25)" />
            <text x={10} y={-12} fontSize={10.5} fill={VIOLET} fontWeight={600}>
              v
            </text>
            <text x={4} y={30} fontSize={10.5} fill={CYAN} fontWeight={600}>
              g
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Launch</p>
          <div className="mt-3 flex flex-col gap-4">
            <Range
              label="Speed"
              value={speed}
              min={6}
              max={22}
              step={0.5}
              unit="m/s"
              format={(v) => v.toFixed(1)}
              onChange={setSpeed}
            />
            <Range
              label="Angle"
              value={angle}
              min={15}
              max={75}
              step={1}
              unit="degrees"
              format={(v) => v.toFixed(0)}
              onChange={setAngle}
            />
          </div>
          <p className="apple-lab-note mt-4">
            The arc is the closed-form solution — the ball, the violet velocity
            vector and the cyan gravity vector all read from it every frame, so
            the picture and the numbers never disagree.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Readout label="Range" value={`${range.toFixed(1)} m`} />
          <Readout label="Apex" value={`${apex.toFixed(1)} m`} />
          <Readout label="Flight" value={`${flight.toFixed(2)} s`} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waves — looping mathematical vector streams                          */
/* ------------------------------------------------------------------ */

const WAVE_WIDTH = 900;
const WAVE_MID = 112;

function wavePath(phase: number, amplitude: number, wavelength: number) {
  const steps = 150;
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * WAVE_WIDTH;
    const y = WAVE_MID - amplitude * Math.sin((x / wavelength) * Math.PI * 2 + phase);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

function WaveBench() {
  const still = useStillMotion();
  const [amplitude, setAmplitude] = useState(48);
  const [cycles, setCycles] = useState(2.4);

  const mainRef = useRef<SVGPathElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
  const thinRef = useRef<SVGPathElement>(null);
  const phase = useRef(0);
  const live = useRef({ amplitude, cycles });

  /* Controls tween on the spring; the phase keeps advancing, so raising the
     frequency accelerates the stream rather than snapping a new shape in. */
  useEffect(() => {
    if (still) {
      live.current = { amplitude, cycles };
      return;
    }
    const stopAmp = animate(live.current.amplitude, amplitude, {
      ...SPRING,
      onUpdate: (v) => {
        live.current.amplitude = v;
      },
    });
    const stopCycles = animate(live.current.cycles, cycles, {
      ...SPRING,
      onUpdate: (v) => {
        live.current.cycles = v;
      },
    });
    return () => {
      stopAmp.stop();
      stopCycles.stop();
    };
  }, [amplitude, cycles, still]);

  useAnimationFrame((_, delta) => {
    const { amplitude: a, cycles: c } = live.current;
    if (!still) phase.current += (delta / 1000) * c * 2.2 * Math.PI;
    const layers: [SVGPathElement | null, number, number][] = [
      [mainRef.current, c, a],
      [ghostRef.current, c * 0.5, a * 0.6],
      [thinRef.current, c * 1.5, a * 0.34],
    ];
    layers.forEach(([node, layerCycles, layerAmp], index) => {
      if (!node) return;
      const wavelength = WAVE_WIDTH / Math.max(layerCycles, 0.15);
      node.setAttribute("d", wavePath(phase.current + index * 1.7, layerAmp, wavelength));
    });
  });

  const wavelength = WAVE_WIDTH / Math.max(cycles, 0.15);
  const angular = 2.2 * cycles;

  return (
    <div className="flex flex-col gap-5">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Wave stream</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              y = A sin(2π x/λ − ωt)
            </h3>
          </div>
          <span className="apple-lab-chip">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} />
            λ = {wavelength.toFixed(0)} u · ω = {angular.toFixed(2)} rad/s
          </span>
        </div>

        <svg
          viewBox={`0 0 ${WAVE_WIDTH} 224`}
          preserveAspectRatio="none"
          className="mt-4 h-[240px] w-full"
          role="img"
          aria-label="Continuously travelling sine wave streams"
        >
          <defs>
            <linearGradient id="lab-wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CYAN} />
              <stop offset="50%" stopColor={VIOLET} />
              <stop offset="100%" stopColor={CYAN} />
            </linearGradient>
            <filter id="lab-wave-glow" x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={i * 75} y1={0} x2={i * 75} y2={224} stroke={GRID} />
          ))}
          <line x1={0} y1={WAVE_MID} x2={WAVE_WIDTH} y2={WAVE_MID} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 8" />

          <path ref={thinRef} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <path ref={ghostRef} fill="none" stroke={CYAN} strokeOpacity={0.4} strokeWidth={1.4} />
          <path
            ref={mainRef}
            fill="none"
            stroke="url(#lab-wave)"
            strokeWidth={2.5}
            strokeLinecap="round"
            filter="url(#lab-wave-glow)"
          />
        </svg>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="apple-lab-panel apple-lab-glass md:col-span-2">
          <p className="apple-lab-micro">Oscillator</p>
          <div className="mt-3 flex flex-col gap-4">
            <Range
              label="Amplitude"
              value={amplitude}
              min={12}
              max={86}
              step={1}
              unit="units"
              format={(v) => v.toFixed(0)}
              onChange={setAmplitude}
            />
            <Range
              label="Frequency"
              value={cycles}
              min={0.6}
              max={4.5}
              step={0.1}
              unit="cycles / window"
              format={(v) => v.toFixed(1)}
              onChange={setCycles}
            />
          </div>
        </div>
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Interference layers</p>
          <p className="apple-lab-note mt-2">
            Three streams share one phase accumulator — the fundamental, a
            half-frequency ghost and a 1.5× thin trace. Because they advance in
            the same loop, the stack never drifts apart when you turn the dial.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export function PhysicsVectorLab() {
  const [bench, setBench] = useState<Bench>("circuits");
  const transition = useSpringTransition();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="apple-lab-tabrail" role="tablist" aria-label="Physics benches">
          {BENCHES.map((entry) => {
            const active = bench === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                className="apple-lab-tab"
                onClick={() => setBench(entry.id)}
              >
                {active && (
                  <motion.span layoutId="physics-bench-pill" className="apple-lab-pill" transition={transition} />
                )}
                <span className="relative z-10">{entry.label}</span>
              </button>
            );
          })}
        </div>
        <p className="apple-lab-note hidden max-w-sm text-right md:block">
          Ultra-clean vector engines: real equations, drawn as lines.
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={bench}
          variants={viewVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={transition}
        >
          {bench === "circuits" && <CircuitsBench />}
          {bench === "motion" && <MotionBench />}
          {bench === "waves" && <WaveBench />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PhysicsVectorLab;
