import { AMBER, CYAN, MINT, Picker, Range, Readout, VIOLET, ink, plate } from "@/components/lab/bench-atoms";
import DynamicsBench from "@/components/lab/DynamicsBench";
import { LabThemeToggle, useLabTheme } from "@/components/lab/lab-theme";
import { SPRING, useSpringTransition, useStillMotion, viewVariants } from "@/lib/motion";
import { AnimatePresence, animate, motion, useAnimationFrame } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Physics — four vector instruments on the lab's glass.
 *
 *   Circuits  a closed loop whose *topology* is the experiment: one resistor,
 *             two in series, or two in parallel bridging the loop's right edge.
 *             Two cells drive it, the second one reversible, so the current can
 *             even run backwards. I = EMF / R is still the whole model.
 *   Motion    a sandbox: pick the body (ball, crate, pendulum bob, cart on a
 *             ramp), pick the world (Earth, Moon, Mars or any gravity you dial
 *             in), pick the tool the body offers, then press Run. Every run
 *             starts from rest, Pause and Reset are always there, and the
 *             readouts are live while the vectors ride the real equations.
 *   Dynamics  a drop tower: one specimen released from 80 m, read as free
 *             fall, as an energy ledger, or with quadratic drag. Its own file
 *             (`DynamicsBench`) so the tower, the oracle and the velocity
 *             graph stay together; it shares the same atoms and light bench.
 *   Waves     two streams with their own shape, amplitude, frequency and phase,
 *             plus the sum they make. Where they agree the sum doubles, where
 *             they disagree it flattens — the envelope beats at 1/|f₂ − f₁|.
 *
 * Every drawing is vector geometry and every number on screen comes out of the
 * same equations the drawing uses. The bench carries the same light/dark switch
 * as Chemistry (`data-lab-theme` on the root): on a light bench the diagram ink
 * and accents come from the `--lab-diagram-*` tokens, so the geometry turns
 * into ink on paper instead of disappearing into the page.
 */

/* Accents, ink and the shared bench atoms come from `bench-atoms` so the
   Dynamics bench (its own file) draws with exactly the same vocabulary. */

type Bench = "circuits" | "motion" | "dynamics" | "waves";

const BENCHES: { id: Bench; label: string }[] = [
  { id: "circuits", label: "Circuits" },
  { id: "motion", label: "Motion" },
  { id: "dynamics", label: "Dynamics" },
  { id: "waves", label: "Waves" },
];

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** A number that eases to its target on the shared spring. Frame loops read the
 *  ref, so the readouts can stay exact while the drawing stays smooth. */
function useEased(target: number, still: boolean) {
  const value = useRef(target);
  useEffect(() => {
    if (still) {
      value.current = target;
      return;
    }
    const controls = animate(value.current, target, {
      ...SPRING,
      onUpdate: (latest) => {
        value.current = latest;
      },
    });
    return () => controls.stop();
  }, [still, target]);
  return value;
}

/* ------------------------------------------------------------------ */
/* Circuits — one loop, and whatever topology you hang on it            */
/* ------------------------------------------------------------------ */

/** One closed wire loop: the cells, the switch and the lamp all sit on it. */
const WIRE_D =
  "M 108 92 H 532 A 44 44 0 0 1 576 136 V 244 A 44 44 0 0 1 532 288 H 108 A 44 44 0 0 1 64 244 V 136 A 44 44 0 0 1 108 92 Z";

/* The parallel pair bridges the loop's right edge between these two nodes, and
   the edge under the bridge is masked out — so the current has to take the
   rails, exactly the way a real pair of branches hangs off two shared nodes. */
const NODE_TOP = 150;
const NODE_BOTTOM = 230;
const RAIL_A = `M 576 ${NODE_TOP} H 600 V ${NODE_BOTTOM} H 576`;
const RAIL_B = `M 600 ${NODE_TOP} H 640 V ${NODE_BOTTOM} H 600`;

type Topology = "single" | "series" | "parallel";

const TOPOLOGIES: Array<{ id: Topology; label: string }> = [
  { id: "single", label: "1 resistor" },
  { id: "series", label: "2 in series" },
  { id: "parallel", label: "2 in parallel" },
];

const POLARITY: Array<{ id: "add" | "oppose"; label: string }> = [
  { id: "add", label: "Adds" },
  { id: "oppose", label: "Opposes" },
];

const VOLTAGE_STEPS = [1.5, 3, 4.5, 6, 9, 12];

/** A cell: one long plate, one short one, its signs and its caption. */
function Cell({
  x,
  value,
  label,
  reversed,
}: {
  x: number;
  value: number;
  label: string;
  reversed: boolean;
}) {
  const longX = reversed ? x + 24 : x;
  const shortX = reversed ? x : x + 24;
  return (
    <g>
      <line x1={longX} y1={270} x2={longX} y2={306} strokeWidth={2.5} strokeLinecap="round" style={{ stroke: ink(0.9) }} />
      <line x1={shortX} y1={280} x2={shortX} y2={296} strokeWidth={2.5} strokeLinecap="round" style={{ stroke: ink(0.6) }} />
      <text x={reversed ? x + 34 : x - 14} y={264} fontSize={11} fontWeight={600} style={{ fill: ink(0.9) }}>
        +
      </text>
      <text x={reversed ? x - 4 : x + 20} y={268} fontSize={13} fontWeight={600} style={{ fill: ink(0.6) }}>
        −
      </text>
      <text x={x + 12} y={330} fontSize={11} textAnchor="middle" style={{ fill: ink(0.7) }}>
        {`${value.toFixed(1)} V ${label}`}
      </text>
    </g>
  );
}

/** A resistor on the wire: a plate-coloured box, hatched, carrying its value. */
function Resistor({
  cx,
  cy,
  height = 64,
  label,
  labelAt,
  hatch = true,
}: {
  cx: number;
  cy: number;
  height?: number;
  label?: string;
  labelAt?: { x: number; y: number };
  hatch?: boolean;
}) {
  const half = height / 2;
  return (
    <g>
      <rect x={cx - 18} y={cy - half} width={36} height={height} rx={10} strokeWidth={1.5} style={{ fill: plate(0.85), stroke: ink(0.45) }} />
      {hatch
        ? [0, 1, 2].map((i) => {
            const y = cy - half + 14 + i * ((height - 28) / 2);
            return (
              <line key={i} x1={cx - 10} y1={y} x2={cx + 10} y2={y} strokeWidth={1.5} strokeLinecap="round" style={{ stroke: VIOLET }} />
            );
          })
        : null}
      {label ? (
        <text x={labelAt?.x ?? cx} y={labelAt?.y ?? cy + half + 22} fontSize={11} textAnchor="middle" style={{ fill: ink(0.7) }}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function CircuitsBench() {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const [closed, setClosed] = useState(true);
  const [cell1, setCell1] = useState(6);
  const [cell2, setCell2] = useState(1.5);
  const [polarity, setPolarity] = useState<"add" | "oppose">("add");
  const [r1, setR1] = useState(22);
  const [r2, setR2] = useState(33);
  const [topology, setTopology] = useState<Topology>("series");

  /* The supply, the load and the branch currents, all out of the one law. */
  const emf = cell1 + (polarity === "oppose" ? -cell2 : cell2);
  const resistance =
    topology === "single" ? r1 : topology === "series" ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const current = closed ? emf / resistance : 0;
  const power = emf * current;
  const branchA = closed ? emf / r1 : 0;
  const branchB = closed ? emf / r2 : 0;

  const mainSpeed = useEased(closed ? current : 0, still);
  const speedA = useEased(topology === "parallel" && closed ? branchA : 0, still);
  const speedB = useEased(topology === "parallel" && closed ? branchB : 0, still);

  const flowRef = useRef<SVGPathElement>(null);
  const railARef = useRef<SVGPathElement>(null);
  const railBRef = useRef<SVGPathElement>(null);
  const offset = useRef(0);
  const offsetA = useRef(0);
  const offsetB = useRef(0);

  /* Every dotted stream carries its own current: the loop carries the total,
     and in parallel each rail carries just its branch, so the split is
     visible. Reversing the second cell sends the offset the other way. */
  useAnimationFrame((_, delta) => {
    const step = delta / 1000;
    if (!still) {
      offset.current -= step * 210 * mainSpeed.current;
      offsetA.current -= step * 210 * speedA.current;
      offsetB.current -= step * 210 * speedB.current;
    }
    flowRef.current?.setAttribute("stroke-dashoffset", String(offset.current));
    railARef.current?.setAttribute("stroke-dashoffset", String(offsetA.current));
    railBRef.current?.setAttribute("stroke-dashoffset", String(offsetB.current));
  });

  const glow = Math.min(1, Math.abs(power) / 3.6);

  const readouts = [
    ["Supply", `${emf.toFixed(1)} V`],
    ["Load", `${resistance.toFixed(1)} Ω`],
    ["Current", `${current.toFixed(2)} A`],
    ["Power", `${power.toFixed(2)} W`],
  ] as const;

  const headline =
    topology === "single"
      ? "One resistor, one path"
      : topology === "series"
        ? "Two resistors in series"
        : "Two resistors in parallel";

  const note =
    topology === "single"
      ? "One resistor carries the whole current: I = EMF / R, and every joule it burns comes back as heat and light."
      : topology === "series"
        ? `The same current runs through both, so R = R₁ + R₂ = ${resistance.toFixed(1)} Ω and each resistor takes a share of the supply in proportion to its resistance.`
        : `Both rails hang off the same two nodes: R = R₁R₂/(R₁+R₂) = ${resistance.toFixed(1)} Ω. Each branch takes what it needs — I₁ = ${branchA.toFixed(2)} A, I₂ = ${branchB.toFixed(2)} A — and the loop carries the sum, ${(branchA + branchB).toFixed(2)} A.`;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">{headline}</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {closed
                ? Math.abs(emf) < 0.01
                  ? "Circuit closed — the supplies cancel"
                  : "Circuit closed — current flowing"
                : "Circuit open — no current"}
            </h3>
          </div>
          <span className="apple-lab-chip">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: closed ? (current < 0 ? AMBER : CYAN) : ink(0.35) }}
            />
            {current.toFixed(2)} A
          </span>
        </div>

        <svg
          viewBox="0 0 760 380"
          className="mt-4 h-[320px] w-full"
          role="img"
          aria-label="A circuit loop with two cells, a switch, a lamp and one or two resistors"
        >
          <defs>
            <linearGradient id="lab-flow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: CYAN }} />
              <stop offset="55%" style={{ stopColor: VIOLET }} />
              <stop offset="100%" style={{ stopColor: CYAN }} />
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

          {/* The loop keeps its own frame and sits centred in the wider box, so
              adding the parallel pair widens the picture without moving it. */}
          <g transform="translate(56 0)">
            {/* structural grid */}
            {Array.from({ length: 16 }, (_, i) => (
              <line key={`v${i}`} x1={40 + i * 40} y1={30} x2={40 + i * 40} y2={350} style={{ stroke: ink(0.05) }} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`h${i}`} x1={30} y1={40 + i * 40} x2={640} y2={40 + i * 40} style={{ stroke: ink(0.05) }} />
            ))}

            {/* the wire itself */}
            <path d={WIRE_D} fill="none" strokeLinecap="round" strokeWidth={5} style={{ stroke: ink(0.16) }} />
            <path d={WIRE_D} fill="none" strokeLinecap="round" strokeWidth={1.25} style={{ stroke: ink(0.28) }} />

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

            {/* parallel pair: mask the right edge between the nodes, bridge it */}
            {topology === "parallel" && (
              <>
                <line x1={576} y1={NODE_TOP} x2={576} y2={NODE_BOTTOM} strokeWidth={7} strokeLinecap="round" style={{ stroke: plate(0.95) }} />
                <path d={RAIL_A} fill="none" strokeLinecap="round" strokeWidth={5} style={{ stroke: ink(0.16) }} />
                <path d={RAIL_B} fill="none" strokeLinecap="round" strokeWidth={5} style={{ stroke: ink(0.16) }} />
                <motion.path
                  ref={railARef}
                  d={RAIL_A}
                  fill="none"
                  stroke="url(#lab-flow)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="1.5 13"
                  initial={false}
                  animate={{ opacity: closed ? 1 : 0 }}
                  transition={transition}
                />
                <motion.path
                  ref={railBRef}
                  d={RAIL_B}
                  fill="none"
                  stroke="url(#lab-flow)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="1.5 13"
                  initial={false}
                  animate={{ opacity: closed ? 1 : 0 }}
                  transition={transition}
                />
                <Resistor cx={600} cy={190} height={48} hatch={false} label={`R₁ ${r1} Ω`} labelAt={{ x: 600, y: 194 }} />
                <Resistor cx={640} cy={190} height={48} hatch={false} label={`R₂ ${r2} Ω`} labelAt={{ x: 640, y: 194 }} />
                <text x={620} y={266} fontSize={10.5} textAnchor="middle" style={{ fill: ink(0.7) }}>
                  {`I₁ ${branchA.toFixed(2)} A · I₂ ${branchB.toFixed(2)} A`}
                </text>
              </>
            )}

            {/* lamp on the left edge — brightness is the dissipated power */}
            <motion.circle
              cx={64}
              cy={190}
              fill="url(#lab-lamp)"
              initial={false}
              animate={{ r: 26 + glow * 22, opacity: 0.25 + glow * 0.75 }}
              transition={transition}
            />
            <circle cx={64} cy={190} r={22} fill="none" strokeWidth={1.5} style={{ stroke: ink(0.5) }} />
            <path d="M 50 176 L 78 204 M 78 176 L 50 204" strokeWidth={1.5} strokeLinecap="round" style={{ stroke: ink(0.9) }} />

            {/* two cells on the bottom edge — the second one can turn around */}
            <Cell x={272} value={cell1} label="cell 1" reversed={false} />
            <Cell
              x={396}
              value={cell2}
              label={polarity === "oppose" ? "cell 2 (reversed)" : "cell 2"}
              reversed={polarity === "oppose"}
            />

            {/* switch on the top edge — the lever swings on the shared spring */}
            <line x1={268} y1={92} x2={330} y2={92} strokeWidth={7} strokeLinecap="round" style={{ stroke: plate(0.9) }} />
            <circle cx={268} cy={92} r={4} style={{ fill: ink(0.9) }} />
            <circle cx={330} cy={92} r={4} style={{ fill: ink(0.55) }} />
            <motion.line
              x1={268}
              y1={92}
              x2={330}
              y2={92}
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={false}
              animate={{ rotate: closed ? 0 : -32 }}
              transition={transition}
              style={{
                transformBox: "view-box",
                transformOrigin: "268px 92px",
                stroke: closed ? VIOLET : ink(0.75),
              }}
            />
            <text x={299} y={72} fontSize={11} textAnchor="middle" style={{ fill: ink(0.7) }}>
              {closed ? "closed" : "open"}
            </text>

            {/* the load on the right edge */}
            {topology === "single" && <Resistor cx={576} cy={190} height={64} label={`${r1} Ω`} />}
            {topology === "series" && (
              <>
                <Resistor cx={576} cy={160} height={48} label={`R₁ ${r1} Ω`} labelAt={{ x: 576, y: 128 }} />
                <Resistor cx={576} cy={220} height={48} label={`R₂ ${r2} Ω`} labelAt={{ x: 576, y: 256 }} />
              </>
            )}
          </g>
        </svg>

        <p className="apple-lab-note mt-4">{note}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Supply</p>
          <div className="mt-3 flex flex-col gap-4">
            <Range label="Cell 1" value={cell1} min={0} max={12} step={0.5} unit="V" format={(v) => v.toFixed(1)} onChange={setCell1} />
            <Range label="Cell 2" value={cell2} min={0} max={12} step={0.5} unit="V" format={(v) => v.toFixed(1)} onChange={setCell2} />
          </div>
          <div className="mt-4">
            <Picker label="Cell 2 polarity" value={polarity} options={POLARITY} onChange={setPolarity} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="apple-lab-micro mr-1">Cell 1 steps</span>
            {VOLTAGE_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setCell1(step)}
                data-active={step === cell1}
                className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              >
                {step} V
              </button>
            ))}
          </div>
          <p className="apple-lab-note mt-3">
            Two cells add when they agree and subtract when the second one is
            turned around. Push it past cell 1 and the current reverses — the
            dots run backwards and the meter reads negative.
          </p>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Load</p>
          <div className="mt-3">
            <Picker label="Topology" value={topology} options={TOPOLOGIES} onChange={setTopology} />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Range
              label={topology === "single" ? "R₁" : "R₁ (main path)"}
              value={r1}
              min={5}
              max={60}
              step={1}
              unit="Ω"
              format={(v) => v.toFixed(0)}
              onChange={setR1}
            />
            {topology !== "single" && (
              <Range label="R₂" value={r2} min={5} max={60} step={1} unit="Ω" format={(v) => v.toFixed(0)} onChange={setR2} />
            )}
          </div>
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
          >
            <span className="apple-lab-micro">Switch</span>
            <span className="apple-lab-value text-[13px] font-semibold">
              {closed ? "Closed — tap to open" : "Open — tap to close"}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => {
              const index = TOPOLOGIES.findIndex((entry) => entry.id === topology);
              const next = TOPOLOGIES[(index + 1) % TOPOLOGIES.length];
              if (next) setTopology(next.id);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={transition}
            className="apple-lab-card flex flex-col items-start gap-1 px-3 py-3 text-left"
          >
            <span className="apple-lab-micro">Topology</span>
            <span className="apple-lab-value text-[13px] font-semibold">
              {headline} — tap to cycle
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Motion — a sandbox: pick the body, the world and the tool           */
/* ------------------------------------------------------------------ */

type Body = "ball" | "crate" | "bob" | "cart";

const BODIES: Array<{ id: Body; label: string; blurb: string }> = [
  {
    id: "ball",
    label: "Ball",
    blurb: "A dense sphere, nothing in its way: the textbook parabola, and the readouts are its own integrals.",
  },
  {
    id: "crate",
    label: "Crate",
    blurb: "A box that tumbles as it flies. Quadratic air drag bites, and the crate's mass decides how hard.",
  },
  {
    id: "bob",
    label: "Pendulum bob",
    blurb: "A bob on a string, released from rest at the release angle and left to swing.",
  },
  {
    id: "cart",
    label: "Cart on a ramp",
    blurb: "A cart released from the top of the ramp, with friction along the slope.",
  },
];

const WORLDS: Array<{ id: "earth" | "moon" | "mars"; label: string; g: number }> = [
  { id: "earth", label: "Earth", g: 9.8 },
  { id: "moon", label: "Moon", g: 1.6 },
  { id: "mars", label: "Mars", g: 3.7 },
];

type WorldId = (typeof WORLDS)[number]["id"] | "custom";

type ParamId =
  | "speed"
  | "angle"
  | "height"
  | "mass"
  | "amplitude"
  | "length"
  | "damping"
  | "incline"
  | "friction";

const PARAMS: Record<
  ParamId,
  { label: string; min: number; max: number; step: number; unit: string; precision: number }
> = {
  speed: { label: "Launch speed", min: 6, max: 44, step: 0.5, unit: "m/s", precision: 1 },
  angle: { label: "Launch angle", min: 5, max: 85, step: 1, unit: "degrees", precision: 0 },
  height: { label: "Release height", min: 0, max: 24, step: 1, unit: "m", precision: 0 },
  mass: { label: "Crate mass", min: 0.4, max: 20, step: 0.2, unit: "kg", precision: 1 },
  amplitude: { label: "Release angle", min: 5, max: 80, step: 1, unit: "degrees", precision: 0 },
  length: { label: "String length", min: 0.6, max: 2.6, step: 0.1, unit: "m", precision: 1 },
  damping: { label: "Pivot damping", min: 0, max: 0.5, step: 0.01, unit: "1/s", precision: 2 },
  incline: { label: "Incline", min: 5, max: 45, step: 1, unit: "degrees", precision: 0 },
  friction: { label: "Friction", min: 0, max: 0.5, step: 0.01, unit: "µ", precision: 2 },
};

type ToolId = "launch" | "drag" | "swing" | "settling" | "slope" | "grip";

/* A tool is a set of sliders, and each body offers the tools it actually has:
   that is why the panel below the pickers changes shape with the body. */
const TOOLS: Array<{ id: ToolId; label: string; bodies: Body[]; params: ParamId[]; blurb: string }> = [
  {
    id: "launch",
    label: "Launch",
    bodies: ["ball", "crate"],
    params: ["speed", "angle", "height"],
    blurb: "Where it leaves the hand, how fast and at what angle.",
  },
  {
    id: "drag",
    label: "Air drag",
    bodies: ["crate"],
    params: ["mass"],
    blurb: "Drag is a = −(c/m)·v·|v|: lighten the crate and the air holds it back harder.",
  },
  {
    id: "swing",
    label: "Swing",
    bodies: ["bob"],
    params: ["amplitude", "length"],
    blurb: "The release angle sets how far it swings; the string length sets the period.",
  },
  {
    id: "settling",
    label: "Damping",
    bodies: ["bob"],
    params: ["damping"],
    blurb: "Friction at the pivot bleeds energy out, so every swing comes back a little shorter.",
  },
  {
    id: "slope",
    label: "Ramp",
    bodies: ["cart"],
    params: ["incline"],
    blurb: "A steeper ramp means a bigger along-slope share of gravity.",
  },
  {
    id: "grip",
    label: "Grip",
    bodies: ["cart"],
    params: ["friction"],
    blurb: "Friction takes µ·g·cosθ off the acceleration — enough of it holds the cart still.",
  },
];

type MotionState = {
  t: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  apex: number;
  theta: number;
  omega: number;
  d: number;
  v: number;
  speed: number;
  settled: boolean;
};

const ZERO_STATE: MotionState = {
  t: 0,
  vx: 0,
  vy: 0,
  x: 0,
  y: 0,
  apex: 0,
  theta: 0,
  omega: 0,
  d: 0,
  v: 0,
  speed: 0,
  settled: false,
};

const DRAG = 0.006; // the quadratic drag constant the crate flies against
const RAMP_LENGTH = 8; // metres of ramp the cart runs down
const RAMP_SCALE = 44; // px per metre on the ramp plate
const RAMP_BASE = { x: 760, y: 330 };
const BOB_PIVOT = { x: 450, y: 36 };
const BOB_SCALE = 100; // px per metre of string
const PLOT = { left: 52, right: 872, top: 34, bottom: 330 };
const VECTOR_SCALE = 2.4; // px per m/s on the velocity arrow
const ACCEL_SCALE = 7; // px per m/s² on the gravity and slope arrows

/** The pose every run starts from: the state the controls describe. */
function restState(body: Body, params: Record<ParamId, number>): MotionState {
  if (body === "ball" || body === "crate") {
    const rad = (params.angle * Math.PI) / 180;
    return {
      ...ZERO_STATE,
      y: params.height,
      apex: params.height,
      vx: params.speed * Math.cos(rad),
      vy: params.speed * Math.sin(rad),
      speed: params.speed,
    };
  }
  if (body === "bob") return { ...ZERO_STATE, theta: (params.amplitude * Math.PI) / 180 };
  return { ...ZERO_STATE };
}

/** One semi-implicit Euler step of a projectile, drag included when asked. */
function stepFlight(s: MotionState, dt: number, g: number, drag: number) {
  const v = Math.hypot(s.vx, s.vy);
  s.vx += -drag * s.vx * v * dt;
  s.vy += (-g - drag * s.vy * v) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.t += dt;
  s.apex = Math.max(s.apex, s.y);
  s.speed = Math.hypot(s.vx, s.vy);
}

/** One step of a simple pendulum released from rest: θ'' = −(g/L)sinθ − cθ'. */
function stepPendulum(s: MotionState, dt: number, g: number, length: number, damping: number) {
  const alpha = -(g / length) * Math.sin(s.theta) - damping * s.omega;
  s.omega += alpha * dt;
  s.theta += s.omega * dt;
  s.t += dt;
  s.speed = Math.abs(s.omega) * length;
}

/** Along-slope acceleration g(sinθ − µcosθ). Negative means static friction wins. */
function rampAccel(g: number, incline: number, friction: number) {
  const rad = (incline * Math.PI) / 180;
  return g * (Math.sin(rad) - friction * Math.cos(rad));
}

function stepRamp(s: MotionState, dt: number, accel: number, length: number) {
  s.v += accel * dt;
  s.d += s.v * dt;
  s.t += dt;
  s.speed = s.v;
  if (s.d >= length) {
    s.d = length;
    s.settled = true;
  }
}

/** The flight the controls describe, integrated once — so the dotted preview
 *  and the readouts can never disagree with what Run is about to play. */
function predictFlight(g: number, angleDeg: number, speed: number, height: number, drag: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const s: MotionState = {
    ...ZERO_STATE,
    y: height,
    apex: height,
    vx: speed * Math.cos(rad),
    vy: speed * Math.sin(rad),
    speed,
  };
  const dt = 1 / 240;
  const points: Array<[number, number]> = [[0, height]];
  let steps = 0;
  while (s.y >= 0 && steps < 240 * 24) {
    stepFlight(s, dt, g, drag);
    if (steps % 8 === 0) points.push([s.x, s.y]);
    steps += 1;
  }
  points.push([s.x, 0]);
  return { points, range: s.x, apex: s.apex, flight: s.t, impact: s.speed };
}

/** A 1-2-5 step, so the axes stay readable at any range. */
function niceStep(span: number, target: number) {
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * power;
}

const rampTop = (incline: number) => {
  const rad = (incline * Math.PI) / 180;
  return {
    x: RAMP_BASE.x - Math.cos(rad) * RAMP_LENGTH * RAMP_SCALE,
    y: RAMP_BASE.y - Math.sin(rad) * RAMP_LENGTH * RAMP_SCALE,
  };
};

const cartPoint = (incline: number, d: number) => {
  const rad = (incline * Math.PI) / 180;
  const top = rampTop(incline);
  return {
    x: top.x + d * RAMP_SCALE * Math.cos(rad),
    y: top.y + d * RAMP_SCALE * Math.sin(rad),
  };
};

const bobPoint = (theta: number, length: number) => ({
  x: BOB_PIVOT.x + length * BOB_SCALE * Math.sin(theta),
  y: BOB_PIVOT.y + length * BOB_SCALE * Math.cos(theta),
});

/** The bodies are plain vector silhouettes: a sphere and a tumbling crate. */
function BallShape() {
  return (
    <>
      <circle r={7} style={{ fill: ink(1) }} />
      <circle r={12} fill="none" style={{ stroke: ink(0.25) }} />
    </>
  );
}

function CrateShape() {
  return (
    <>
      <rect x={-11} y={-11} width={22} height={22} rx={3} strokeWidth={2} style={{ fill: plate(0.95), stroke: VIOLET }} />
      <line x1={-7} y1={-7} x2={7} y2={7} strokeWidth={1.2} style={{ stroke: VIOLET }} />
      <line x1={-7} y1={7} x2={7} y2={-7} strokeWidth={1.2} style={{ stroke: VIOLET }} />
    </>
  );
}

const INITIAL_PARAMS: Record<ParamId, number> = {
  speed: 26,
  angle: 42,
  height: 0,
  mass: 3,
  amplitude: 35,
  length: 1.8,
  damping: 0.05,
  incline: 28,
  friction: 0.12,
};

function MotionSandbox() {
  /* The sandbox owns no passive motion: nothing here moves until Run is pressed,
     so it needs no spring of its own. */
  const [body, setBody] = useState<Body>("ball");
  const [toolId, setToolId] = useState<ToolId>("launch");
  const [g, setG] = useState(WORLDS[0].g);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [params, setParams] = useState<Record<ParamId, number>>(INITIAL_PARAMS);

  const worldId: WorldId = WORLDS.find((entry) => Math.abs(entry.g - g) < 0.06)?.id ?? "custom";
  const tool = TOOLS.find((entry) => entry.id === toolId) ?? TOOLS[0];
  const toolSpots = TOOLS.filter((entry) => entry.bodies.includes(body)).map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));

  const drag = body === "crate" ? DRAG / params.mass : 0;

  /* The preview is integrated once for the current controls: the dotted arc,
     the axes and the readouts all come from the same numbers Run will play. */
  const flight = useMemo(
    () => predictFlight(g, params.angle, params.speed, params.height, drag),
    [drag, g, params.angle, params.height, params.speed],
  );

  const xMax = Math.max(20, flight.range * 1.06);
  const yMax = Math.max(10, Math.max(flight.apex, params.height) * 1.25);
  const frame = {
    sx: (PLOT.right - PLOT.left) / xMax,
    sy: (PLOT.bottom - PLOT.top) / yMax,
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const plot = (x: number, y: number, f: { sx: number; sy: number }) => ({
    x: PLOT.left + x * f.sx,
    y: PLOT.bottom - y * f.sy,
  });

  const plannedD = flight.points
    .map(([x, y], index) => {
      const point = plot(x, y, frame);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");

  const xStep = niceStep(xMax, 6);
  const yStep = niceStep(yMax, 4);
  const xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) }, (_, i) => (i + 1) * yStep);

  const bobPeriod = 2 * Math.PI * Math.sqrt(params.length / g);
  const slopeAccel = rampAccel(g, params.incline, params.friction);
  const holds = slopeAccel <= 0;
  const rampTime = holds ? Infinity : Math.sqrt((2 * RAMP_LENGTH) / slopeAccel);

  const [snapshot, setSnapshot] = useState<MotionState>(() => restState("ball", INITIAL_PARAMS));
  const sim = useRef<MotionState>(restState("ball", INITIAL_PARAMS));
  const acc = useRef(0);
  const spin = useRef(0);
  const published = useRef(0);

  const trailRef = useRef<SVGPathElement>(null);
  const trailD = useRef("");
  const lastTrail = useRef<{ x: number; y: number } | null>(null);
  const projectileRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const velRef = useRef<SVGLineElement>(null);
  const gravRef = useRef<SVGLineElement>(null);
  const rodRef = useRef<SVGLineElement>(null);
  const bobRef = useRef<SVGCircleElement>(null);
  const bobVelRef = useRef<SVGLineElement>(null);
  const cartRef = useRef<SVGGElement>(null);
  const vectorsRef = useRef<SVGGElement>(null);
  const travelRef = useRef<SVGLineElement>(null);

  /** Record the flown path, one point every 1.5 px so the string stays small. */
  const pushTrail = (x: number, y: number) => {
    const last = lastTrail.current;
    if (last && Math.hypot(x - last.x, y - last.y) < 1.5) return;
    if (trailD.current.length > 20000) return;
    lastTrail.current = { x, y };
    trailD.current += `${trailD.current ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    trailRef.current?.setAttribute("d", trailD.current);
  };

  /** Write the current state into the stage — the one place the DOM is driven. */
  const paint = () => {
    const s = sim.current;
    const f = frameRef.current;
    if (body === "ball" || body === "crate") {
      const point = plot(s.x, s.y, f);
      projectileRef.current?.setAttribute(
        "transform",
        `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
      );
      spinRef.current?.setAttribute("transform", `rotate(${spin.current.toFixed(1)} 0 0)`);
      const length = Math.min(120, Math.max(10, s.speed * VECTOR_SCALE));
      const heading = Math.atan2(s.vy, s.vx);
      velRef.current?.setAttribute("x2", (Math.cos(heading) * length).toFixed(2));
      velRef.current?.setAttribute("y2", (-Math.sin(heading) * length).toFixed(2));
      gravRef.current?.setAttribute("y2", Math.min(110, g * ACCEL_SCALE).toFixed(2));
      if (!s.settled) pushTrail(point.x, point.y);
      return;
    }
    if (body === "bob") {
      const point = bobPoint(s.theta, params.length);
      rodRef.current?.setAttribute("x2", point.x.toFixed(2));
      rodRef.current?.setAttribute("y2", point.y.toFixed(2));
      bobRef.current?.setAttribute("cx", point.x.toFixed(2));
      bobRef.current?.setAttribute("cy", point.y.toFixed(2));
      const tail = Math.min(90, Math.max(6, s.speed * VECTOR_SCALE)) * Math.sign(s.omega || 1);
      bobVelRef.current?.setAttribute("x1", point.x.toFixed(2));
      bobVelRef.current?.setAttribute("y1", point.y.toFixed(2));
      bobVelRef.current?.setAttribute("x2", (point.x + Math.cos(s.theta) * tail).toFixed(2));
      bobVelRef.current?.setAttribute("y2", (point.y - Math.sin(s.theta) * tail).toFixed(2));
      pushTrail(point.x, point.y);
      return;
    }
    const point = cartPoint(params.incline, s.d);
    const top = rampTop(params.incline);
    cartRef.current?.setAttribute(
      "transform",
      `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${params.incline})`,
    );
    vectorsRef.current?.setAttribute(
      "transform",
      `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
    );
    travelRef.current?.setAttribute("x1", top.x.toFixed(2));
    travelRef.current?.setAttribute("y1", top.y.toFixed(2));
    travelRef.current?.setAttribute("x2", point.x.toFixed(2));
    travelRef.current?.setAttribute("y2", point.y.toFixed(2));
  };

  const clearTrail = () => {
    trailD.current = "";
    lastTrail.current = null;
    trailRef.current?.setAttribute("d", "");
  };

  const reset = () => {
    spin.current = 0;
    acc.current = 0;
    clearTrail();
    setPhase("idle");
  };

  /* Every control change parks the bench at its resting pose, so nothing is
     ever half-flown — the picture always describes what Run would do next. */
  useEffect(() => {
    if (phase !== "idle") return;
    const state = restState(body, params);
    sim.current = state;
    setSnapshot({ ...state });
    spin.current = 0;
    acc.current = 0;
    trailD.current = "";
    lastTrail.current = null;
    trailRef.current?.setAttribute("d", "");
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, g, params, phase]);

  const selectBody = (next: Body) => {
    const first = TOOLS.find((entry) => entry.bodies.includes(next));
    setBody(next);
    if (first) setToolId(first.id);
    setPhase("idle");
  };

  const setParam = (id: ParamId, value: number) => {
    setParams((current) => ({ ...current, [id]: value }));
    setPhase("idle");
  };

  const run = () => {
    if (phase === "running") {
      setPhase("paused");
      return;
    }
    if (phase === "paused") {
      setPhase("running");
      return;
    }
    // Idle or finished: a fresh run, and always from rest.
    const state = restState(body, params);
    sim.current = state;
    setSnapshot({ ...state });
    spin.current = 0;
    acc.current = 0;
    clearTrail();
    setPhase("running");
  };

  /* The sandbox only moves when Run is pressed, so it is never a passive loop.
     That also means it keeps working under Motionless Mode: the press *is* the
     request for motion, and the numbers are the point of the bench. */
  useAnimationFrame((_, delta) => {
    if (phase !== "running") return;
    const dt = 1 / 240;
    acc.current += Math.min(delta / 1000, 0.05);
    let guard = 0;
    while (acc.current >= dt && guard < 600) {
      const s = sim.current;
      if (body === "ball" || body === "crate") {
        stepFlight(s, dt, g, drag);
        if (body === "crate") spin.current += dt * 150;
        if (s.y <= 0 && !s.settled) {
          s.y = 0;
          s.settled = true;
        }
      } else if (body === "bob") {
        stepPendulum(s, dt, g, params.length, params.damping);
        if (params.damping > 0 && Math.abs(s.theta) < 0.01 && Math.abs(s.omega) < 0.03) {
          s.settled = true;
        }
      } else {
        stepRamp(s, dt, slopeAccel, RAMP_LENGTH);
      }
      acc.current -= dt;
      guard += 1;
      if (s.settled) break;
    }
    paint();
    const now = performance.now();
    if (sim.current.settled) {
      setSnapshot({ ...sim.current });
      setPhase("done");
      return;
    }
    if (now - published.current > 90) {
      published.current = now;
      setSnapshot({ ...sim.current });
    }
  });

  const stats: Array<[string, string]> =
    body === "ball" || body === "crate"
      ? [
          ["Time", `${snapshot.t.toFixed(2)} s`],
          ["Range", `${snapshot.x.toFixed(1)} m`],
          ["Apex", `${snapshot.apex.toFixed(1)} m`],
          ["Speed", `${snapshot.speed.toFixed(1)} m/s`],
        ]
      : body === "bob"
        ? [
            ["Time", `${snapshot.t.toFixed(2)} s`],
            ["Angle", `${((snapshot.theta * 180) / Math.PI).toFixed(0)}°`],
            ["Speed", `${snapshot.speed.toFixed(2)} m/s`],
            ["Period", `${bobPeriod.toFixed(2)} s`],
          ]
        : [
            ["Time", `${snapshot.t.toFixed(2)} s`],
            ["Speed", `${snapshot.speed.toFixed(2)} m/s`],
            ["Distance", `${snapshot.d.toFixed(2)} m`],
            ["Accel", holds ? "0 — held" : `${slopeAccel.toFixed(2)} m/s²`],
          ];

  const status =
    phase === "running"
      ? body === "bob"
        ? "Swinging"
        : body === "cart"
          ? "Sliding"
          : "In flight"
      : phase === "paused"
        ? "Paused"
        : phase === "done"
          ? body === "bob"
            ? "Settled"
            : body === "cart"
              ? "At the bottom"
              : "Landed"
          : "Press Run";

  const footer =
    body === "ball" || body === "crate"
      ? `Planned: ${flight.range.toFixed(1)} m of range, apex ${flight.apex.toFixed(1)} m, ${flight.flight.toFixed(2)} s in the air, landing at ${flight.impact.toFixed(1)} m/s.`
      : body === "bob"
        ? `T = 2π√(L/g) = ${bobPeriod.toFixed(2)} s at small angles, and the bob's mass never enters it. Released from ${params.amplitude}° on a ${params.length.toFixed(1)} m string.`
        : holds
          ? "Static friction wins: µcosθ ≥ sinθ, so the cart stays put. Raise the incline or drop the friction."
          : `a = g(sinθ − µcosθ) = ${slopeAccel.toFixed(2)} m/s², so the ${RAMP_LENGTH} m ramp takes ${rampTime.toFixed(2)} s and the cart arrives at ${Math.sqrt(2 * slopeAccel * RAMP_LENGTH).toFixed(2)} m/s.`;

  const guideD = Array.from({ length: 41 }, (_, i) => {
    const angle = ((-params.amplitude + (2 * params.amplitude * i) / 40) * Math.PI) / 180;
    const point = bobPoint(angle, params.length);
    return `${i === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ");
  const tickAngles = [-80, -60, -40, -20, 0, 20, 40, 60, 80];
  const rampStart = rampTop(params.incline);
  const angleArcD = Array.from({ length: 13 }, (_, i) => {
    const a = ((180 + (params.incline * i) / 12) * Math.PI) / 180;
    const point = { x: RAMP_BASE.x + 70 * Math.cos(a), y: RAMP_BASE.y + 70 * Math.sin(a) };
    return `${i === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ");
  const slopeRad = (params.incline * Math.PI) / 180;
  const gravityArrow = Math.min(104, g * ACCEL_SCALE);
  const slopeArrow = Math.max(0, Math.min(104, slopeAccel * ACCEL_SCALE));
  const restingBob = bobPoint((params.amplitude * Math.PI) / 180, params.length);

  const bodyOptions: Array<{ id: Body; label: string }> = BODIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));
  const worldOptions: Array<{ id: WorldId; label: string }> = WORLDS.map((entry) => ({
    id: entry.id,
    label: `${entry.label} · ${entry.g} m/s²`,
  }));
  const selectWorld = (id: WorldId) => {
    const preset = WORLDS.find((entry) => entry.id === id);
    if (preset) setG(preset.g);
  };
  const blurb = BODIES.find((entry) => entry.id === body)?.blurb ?? "";
  const restingShot = plot(0, params.height, frame);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">
              {body === "cart" ? "Ramp" : body === "bob" ? "Pendulum" : "Projectile"}
            </p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {body === "cart" ? "Cart released from the top" : body === "bob" ? "Released from the swing angle" : "Launched from the start line"}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: phase === "running" ? CYAN : ink(0.35) }}
              />
              {status}
            </span>
            <button
              type="button"
              onClick={run}
              data-active={phase === "running"}
              className="apple-lab-btn apple-lab-btn--solid !px-3.5 !py-2"
            >
              {phase === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{phase === "running" ? "Pause" : phase === "paused" ? "Resume" : "Run"}</span>
            </button>
            <button type="button" onClick={reset} className="apple-lab-btn !px-3 !py-2">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        <svg
          viewBox="0 0 900 360"
          className="mt-4 h-[320px] w-full"
          role="img"
          aria-label={`A ${body} simulation with live vectors and readouts`}
        >
          <defs>
            <linearGradient id="lab-arc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: ink(0.15) }} />
              <stop offset="100%" style={{ stopColor: ink(0) }} />
            </linearGradient>
          </defs>

          {body === "ball" || body === "crate" ? (
            <>
              {xTicks.map((x) => {
                const point = plot(x, 0, frame);
                return (
                  <g key={`x${x}`}>
                    <line x1={point.x} y1={PLOT.top} x2={point.x} y2={PLOT.bottom} style={{ stroke: ink(0.05) }} />
                    <text x={point.x} y={PLOT.bottom + 16} fontSize={10} textAnchor="middle" style={{ fill: ink(0.62) }}>
                      {`${x.toFixed(xStep < 1 ? 1 : 0)} m`}
                    </text>
                  </g>
                );
              })}
              {yTicks.map((y) => {
                const point = plot(0, y, frame);
                return (
                  <g key={`y${y}`}>
                    <line x1={PLOT.left} y1={point.y} x2={PLOT.right} y2={point.y} style={{ stroke: ink(0.05) }} />
                    <text x={PLOT.left - 12} y={point.y + 3.5} fontSize={10} textAnchor="end" style={{ fill: ink(0.62) }}>
                      {`${y.toFixed(yStep < 1 ? 1 : 0)} m`}
                    </text>
                  </g>
                );
              })}
              <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right} y2={PLOT.bottom} strokeWidth={1.5} style={{ stroke: ink(0.22) }} />
              <path d={plannedD} fill="url(#lab-arc)" strokeWidth={1.6} strokeDasharray="3 7" style={{ stroke: ink(0.5) }} />
              <path ref={trailRef} fill="none" strokeWidth={2.4} strokeLinecap="round" style={{ stroke: VIOLET }} />
              <g
                ref={projectileRef}
                transform={`translate(${restingShot.x.toFixed(2)} ${restingShot.y.toFixed(2)})`}
              >
                <line ref={velRef} x1={0} y1={0} x2={0} y2={0} strokeWidth={2} strokeLinecap="round" style={{ stroke: VIOLET }} />
                <line ref={gravRef} x1={0} y1={0} x2={0} y2={0} strokeWidth={2} strokeLinecap="round" style={{ stroke: CYAN }} />
                <text x={10} y={-14} fontSize={10.5} fontWeight={600} style={{ fill: VIOLET }}>
                  v
                </text>
                <text x={7} y={32} fontSize={10.5} fontWeight={600} style={{ fill: CYAN }}>
                  g
                </text>
                {body === "crate" ? (
                  <g ref={spinRef}>
                    <CrateShape />
                  </g>
                ) : (
                  <BallShape />
                )}
              </g>
            </>
          ) : null}

          {body === "bob" ? (
            <>
              <rect x={BOB_PIVOT.x - 24} y={BOB_PIVOT.y - 28} width={48} height={12} rx={4} style={{ fill: plate(0.9), stroke: ink(0.4) }} />
              <line x1={BOB_PIVOT.x} y1={BOB_PIVOT.y - 16} x2={BOB_PIVOT.x} y2={BOB_PIVOT.y + 2} strokeWidth={2} style={{ stroke: ink(0.5) }} />
              <line
                x1={BOB_PIVOT.x}
                y1={BOB_PIVOT.y}
                x2={BOB_PIVOT.x}
                y2={BOB_PIVOT.y + params.length * BOB_SCALE + 30}
                strokeDasharray="4 8"
                style={{ stroke: ink(0.12) }}
              />
              {tickAngles.map((angle) => {
                const inner = bobPoint((angle * Math.PI) / 180, params.length - 0.09);
                const outer = bobPoint((angle * Math.PI) / 180, params.length + 0.09);
                return (
                  <line key={angle} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} strokeWidth={1.5} style={{ stroke: ink(0.3) }} />
                );
              })}
              {[-80, -40, 0, 40, 80].map((angle) => {
                const point = bobPoint((angle * Math.PI) / 180, params.length + 0.34);
                return (
                  <text key={angle} x={point.x} y={point.y + 4} fontSize={10} textAnchor="middle" style={{ fill: ink(0.5) }}>
                    {`${angle}°`}
                  </text>
                );
              })}
              <path d={guideD} fill="none" strokeDasharray="3 6" style={{ stroke: ink(0.22) }} />
              <path ref={trailRef} fill="none" strokeWidth={2.4} strokeLinecap="round" style={{ stroke: VIOLET }} />
              <line ref={rodRef} x1={BOB_PIVOT.x} y1={BOB_PIVOT.y} x2={restingBob.x} y2={restingBob.y} strokeWidth={2} style={{ stroke: ink(0.6) }} />
              <line ref={bobVelRef} x1={0} y1={0} x2={0} y2={0} strokeWidth={2} strokeLinecap="round" style={{ stroke: MINT }} />
              <circle ref={bobRef} cx={restingBob.x} cy={restingBob.y} r={10} strokeWidth={2} style={{ fill: plate(0.95), stroke: VIOLET }} />
            </>
          ) : null}

          {body === "cart" ? (
            <>
              {Array.from({ length: 10 }, (_, i) => (
                <line key={i} x1={30 + i * 90} y1={0} x2={30 + i * 90} y2={360} style={{ stroke: ink(0.04) }} />
              ))}
              <line x1={30} y1={RAMP_BASE.y} x2={860} y2={RAMP_BASE.y} strokeWidth={1.5} style={{ stroke: ink(0.22) }} />
              <line x1={rampStart.x} y1={rampStart.y} x2={RAMP_BASE.x} y2={RAMP_BASE.y} strokeWidth={7} strokeLinecap="round" style={{ stroke: ink(0.22) }} />
              <line
                ref={travelRef}
                x1={rampStart.x}
                y1={rampStart.y}
                x2={rampStart.x}
                y2={rampStart.y}
                strokeWidth={4}
                strokeLinecap="round"
                style={{ stroke: VIOLET }}
              />
              <path d={angleArcD} fill="none" strokeWidth={1.2} style={{ stroke: ink(0.35) }} />
              <text x={RAMP_BASE.x - 100} y={RAMP_BASE.y - 20} fontSize={11} style={{ fill: ink(0.6) }}>
                {`${params.incline}°`}
              </text>
              <g ref={cartRef} transform={`translate(${rampStart.x.toFixed(2)} ${rampStart.y.toFixed(2)}) rotate(${params.incline})`}>
                <rect x={-20} y={-26} width={40} height={22} rx={4} strokeWidth={2} style={{ fill: plate(0.95), stroke: MINT }} />
                <circle cx={-12} cy={-4} r={5} style={{ fill: ink(0.85) }} />
                <circle cx={12} cy={-4} r={5} style={{ fill: ink(0.85) }} />
              </g>
              <g ref={vectorsRef} transform={`translate(${rampStart.x.toFixed(2)} ${rampStart.y.toFixed(2)})`}>
                <line x1={0} y1={-14} x2={0} y2={-14 + gravityArrow} strokeWidth={2} strokeLinecap="round" style={{ stroke: CYAN }} />
                <text x={7} y={gravityArrow} fontSize={10.5} fontWeight={600} style={{ fill: CYAN }}>
                  g
                </text>
                {slopeArrow > 1 ? (
                  <>
                    <line
                      x1={0}
                      y1={-14}
                      x2={Math.cos(slopeRad) * slopeArrow}
                      y2={-14 + Math.sin(slopeRad) * slopeArrow}
                      strokeWidth={2}
                      strokeLinecap="round"
                      style={{ stroke: VIOLET }}
                    />
                    <text
                      x={Math.cos(slopeRad) * slopeArrow + 8}
                      y={-14 + Math.sin(slopeRad) * slopeArrow + 4}
                      fontSize={10.5}
                      fontWeight={600}
                      style={{ fill: VIOLET }}
                    >
                      a
                    </text>
                  </>
                ) : null}
              </g>
            </>
          ) : null}
        </svg>

        <p className="apple-lab-note mt-4">
          {blurb} {footer}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Simulate</p>
          <div className="mt-3">
            <Picker label="Body" value={body} options={bodyOptions} onChange={selectBody} />
          </div>
          <div className="mt-4">
            <Picker label="World" value={worldId} options={worldOptions} onChange={selectWorld} />
          </div>
          <div className="mt-4">
            <Range label="Gravity" value={g} min={0.5} max={20} step={0.1} unit="m/s²" format={(v) => v.toFixed(1)} onChange={setG} />
          </div>
          <p className="apple-lab-note mt-3">
            Run always starts the bench from rest, Pause holds it and Reset puts
            it back on the start line. Changing anything re-parks the run, so the
            picture never shows a half-flown flight.
          </p>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Tools for the {body}</p>
          <div className="mt-3">
            <Picker label="What you are adjusting" value={tool.id} options={toolSpots} onChange={setToolId} />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {tool.params.map((id) => {
              const spec = PARAMS[id];
              return (
                <Range
                  key={id}
                  label={spec.label}
                  value={params[id]}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  unit={spec.unit}
                  format={(v) => v.toFixed(spec.precision)}
                  onChange={(value) => setParam(id, value)}
                />
              );
            })}
          </div>
          <p className="apple-lab-note mt-3">{tool.blurb}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <Readout key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waves — two streams, the sum they make, and the beat between them    */
/* ------------------------------------------------------------------ */

const WAVE_WIDTH = 900;
const WAVE_MID = 112;
const WAVE_WINDOW = 2; // seconds across the window: cycles / 2 is real Hz

/** The oscillator's own frequency is π·cycles rad/s, which makes the beat
 *  period on the readout exactly WAVE_WINDOW / |cyclesA − cyclesB|. */

type WaveType = "sine" | "square" | "triangle";

const WAVE_TYPES: Array<{ id: WaveType; label: string }> = [
  { id: "sine", label: "Sine" },
  { id: "square", label: "Square" },
  { id: "triangle", label: "Triangle" },
];

/** One shape function covers the whole picker — no branch per drawing call. */
function waveShape(type: WaveType, angle: number) {
  if (type === "square") return Math.sin(angle) >= 0 ? 1 : -1;
  if (type === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(angle));
  return Math.sin(angle);
}

/* Sampled, with the square's edges drawn exactly: consecutive samples are
   joined, so a sign flip would otherwise lean by one sample. */
function wavePoints(type: WaveType, phase: number, amplitude: number, wavelength: number) {
  const steps = 200;
  const angleAt = (x: number) => (x / wavelength) * Math.PI * 2 + phase;
  const points: Array<[number, number]> = [];
  let previous = waveShape(type, angleAt(0));
  points.push([0, WAVE_MID - amplitude * previous]);
  for (let i = 1; i <= steps; i += 1) {
    const x = (i / steps) * WAVE_WIDTH;
    const value = waveShape(type, angleAt(x));
    if (type === "square" && Math.sign(value) !== Math.sign(previous)) {
      points.push([x, WAVE_MID - amplitude * previous]);
      points.push([x, WAVE_MID - amplitude * value]);
    } else {
      points.push([x, WAVE_MID - amplitude * value]);
    }
    previous = value;
  }
  return points;
}

/** The sum has no closed form for mixed shapes, so it is sampled every frame. */
function sumPoints(
  typeA: WaveType,
  phaseA: number,
  amplitudeA: number,
  wavelengthA: number,
  typeB: WaveType,
  phaseB: number,
  amplitudeB: number,
  wavelengthB: number,
) {
  const steps = 200;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * WAVE_WIDTH;
    const a = amplitudeA * waveShape(typeA, (x / wavelengthA) * Math.PI * 2 + phaseA);
    const b = amplitudeB * waveShape(typeB, (x / wavelengthB) * Math.PI * 2 + phaseB);
    points.push([x, WAVE_MID - (a + b)]);
  }
  return points;
}

const pathText = (points: Array<[number, number]>) =>
  points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

function WaveBench() {
  const still = useStillMotion();
  const [typeA, setTypeA] = useState<WaveType>("sine");
  const [typeB, setTypeB] = useState<WaveType>("sine");
  const [amplitudeA, setAmplitudeA] = useState(48);
  const [cyclesA, setCyclesA] = useState(2.4);
  const [amplitudeB, setAmplitudeB] = useState(22);
  const [cyclesB, setCyclesB] = useState(2.9);
  const [phaseDeg, setPhaseDeg] = useState(0);
  const [showB, setShowB] = useState(true);
  const [showSum, setShowSum] = useState(true);

  const ampA = useEased(amplitudeA, still);
  const ampB = useEased(showB ? amplitudeB : 0, still);
  const freqA = useEased(cyclesA, still);
  const freqB = useEased(cyclesB, still);

  const mainRef = useRef<SVGPathElement>(null);
  const overlayRef = useRef<SVGPathElement>(null);
  const sumRef = useRef<SVGPathElement>(null);
  const clockA = useRef(0);
  const clockB = useRef(0);

  /* One clock, two streams. Each advances at its own frequency, so the pair
     drifts in and out of step — which is exactly what the sum trace shows. */
  useAnimationFrame((_, delta) => {
    const step = delta / 1000;
    if (!still) {
      clockA.current += step * Math.PI * freqA.current;
      clockB.current += step * Math.PI * freqB.current;
    }
    const wavelengthA = WAVE_WIDTH / Math.max(freqA.current, 0.15);
    const wavelengthB = WAVE_WIDTH / Math.max(freqB.current, 0.15);
    const phaseA = clockA.current;
    const phaseB = clockB.current + (phaseDeg * Math.PI) / 180;
    mainRef.current?.setAttribute("d", pathText(wavePoints(typeA, phaseA, ampA.current, wavelengthA)));
    overlayRef.current?.setAttribute("d", pathText(wavePoints(typeB, phaseB, ampB.current, wavelengthB)));
    sumRef.current?.setAttribute(
      "d",
      pathText(
        sumPoints(typeA, phaseA, ampA.current, wavelengthA, typeB, phaseB, ampB.current, wavelengthB),
      ),
    );
  });

  const wavelengthA = WAVE_WIDTH / Math.max(cyclesA, 0.15);
  const wavelengthB = WAVE_WIDTH / Math.max(cyclesB, 0.15);
  const difference = Math.abs(cyclesA - cyclesB);
  const beat = difference < 0.05 ? null : WAVE_WINDOW / difference;

  const readouts = [
    ["Wavelength A", `${wavelengthA.toFixed(0)} u`],
    ["Wavelength B", `${wavelengthB.toFixed(0)} u`],
    ["Stream A", `${(cyclesA / WAVE_WINDOW).toFixed(2)} Hz`],
    ["Beat period", beat ? `${beat.toFixed(2)} s` : "none"],
  ] as const;

  const note = !showB
    ? "Stream A alone: pick its shape, raise the amplitude, and reach for the frequency. Turn the overlay on to see it interfere with itself."
    : beat
      ? `A and B run at their own frequencies, so the pair drifts in and out of step. The envelope on the sum trace beats every ${beat.toFixed(2)} s — that is 1/|f₂ − f₁| across a two-second window.`
      : "A and B sit at the same frequency, so their phase difference holds still: the sum keeps the shape and only changes size. Nudge B's frequency and the sum starts to breathe.";

  return (
    <div className="flex flex-col gap-5">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Two streams, one clock</p>
            <h3 className="apple-lab-title mt-1 text-lg">y = A · f(2π x/λ − ωt), summed</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-lab-chip">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} />
              λ = {wavelengthA.toFixed(0)} u · ω = {(Math.PI * cyclesA).toFixed(2)} rad/s
            </span>
            <button
              type="button"
              onClick={() => setShowSum((on) => !on)}
              data-active={showSum}
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
            >
              A + B
            </button>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${WAVE_WIDTH} 224`}
          preserveAspectRatio="none"
          className="mt-4 h-[240px] w-full"
          role="img"
          aria-label="Two travelling wave streams and the sum they make"
        >
          <defs>
            <linearGradient id="lab-wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: CYAN }} />
              <stop offset="50%" style={{ stopColor: VIOLET }} />
              <stop offset="100%" style={{ stopColor: CYAN }} />
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
            <line key={i} x1={i * 75} y1={0} x2={i * 75} y2={224} style={{ stroke: ink(0.05) }} />
          ))}
          <line x1={0} y1={WAVE_MID} x2={WAVE_WIDTH} y2={WAVE_MID} strokeDasharray="4 8" style={{ stroke: ink(0.12) }} />

          <path ref={sumRef} fill="none" strokeWidth={2} style={{ stroke: ink(0.8), opacity: showSum ? 1 : 0 }} />
          <path ref={overlayRef} fill="none" strokeWidth={1.8} strokeLinecap="round" style={{ stroke: MINT, opacity: showB ? 0.9 : 0 }} />
          <path
            ref={mainRef}
            fill="none"
            stroke="url(#lab-wave)"
            strokeWidth={2.5}
            strokeLinecap="round"
            filter="url(#lab-wave-glow)"
          />
        </svg>

        <p className="apple-lab-note mt-4">{note}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Stream A — the carrier</p>
          <div className="mt-3">
            <Picker label="Shape" value={typeA} options={WAVE_TYPES} onChange={setTypeA} />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Range label="Amplitude" value={amplitudeA} min={6} max={60} step={1} unit="units" format={(v) => v.toFixed(0)} onChange={setAmplitudeA} />
            <Range label="Frequency" value={cyclesA} min={0.6} max={4.5} step={0.1} unit="cycles / window" format={(v) => v.toFixed(1)} onChange={setCyclesA} />
          </div>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="apple-lab-micro">Stream B — the overlay</p>
            <button
              type="button"
              onClick={() => setShowB((on) => !on)}
              data-active={showB}
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
            >
              {showB ? "Showing" : "Hidden"}
            </button>
          </div>
          <div className="mt-3">
            <Picker label="Shape" value={typeB} options={WAVE_TYPES} onChange={setTypeB} />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Range label="Amplitude" value={amplitudeB} min={0} max={48} step={1} unit="units" format={(v) => v.toFixed(0)} onChange={setAmplitudeB} />
            <Range label="Frequency" value={cyclesB} min={0.6} max={4.5} step={0.1} unit="cycles / window" format={(v) => v.toFixed(1)} onChange={setCyclesB} />
            <Range label="Phase" value={phaseDeg} min={0} max={360} step={5} unit="degrees" format={(v) => v.toFixed(0)} onChange={setPhaseDeg} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {readouts.map(([label, value]) => (
          <Readout key={label} label={label} value={value} />
        ))}
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
  const { theme, toggle } = useLabTheme();

  return (
    <div data-lab-theme={theme} className="flex flex-col gap-5">
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
        <div className="flex flex-wrap items-center gap-3">
          <p className="apple-lab-note hidden max-w-sm text-right md:block">
            Ultra-clean vector engines: real equations, drawn as lines.
          </p>
          <LabThemeToggle theme={theme} subject="physics" onToggle={toggle} />
        </div>
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
          {bench === "motion" && <MotionSandbox />}
          {bench === "dynamics" && <DynamicsBench />}
          {bench === "waves" && <WaveBench />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PhysicsVectorLab;

