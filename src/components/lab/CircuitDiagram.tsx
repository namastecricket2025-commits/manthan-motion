import { AMBER, CYAN, Picker, Range, Readout, VIOLET, ink, plate } from "@/components/lab/bench-atoms";
import { motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { Power, RotateCcw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/**
 * The Circuits bench.
 *
 * A real circuit diagram, not a picture of one. Every component is drawn with
 * the symbol a textbook uses, at a size where the label can be read, and the
 * student chooses between the two conventions they will meet in an exam:
 *
 *   Textbook (India)  the resistor is a zigzag; cells are long/short plates.
 *   IEC               the resistor is a rectangle.
 *
 * The meters are part of the diagram, not floating chips: the ammeter sits in
 * series on the top wire and the voltmeter bridges the load, each showing its
 * live reading inside the symbol. Topology, sliders and the switch all feed the
 * same I = EMF / R model as before.
 */

type Topology = "single" | "series" | "parallel";
type SymbolStyle = "textbook" | "iec";
type ResistorKind = "fixed" | "rheostat";

const TOPOLOGIES: Array<{ id: Topology; label: string }> = [
  { id: "single", label: "1 resistor" },
  { id: "series", label: "2 in series" },
  { id: "parallel", label: "2 in parallel" },
];

const POLARITY: Array<{ id: "add" | "oppose"; label: string }> = [
  { id: "add", label: "Adds" },
  { id: "oppose", label: "Opposes" },
];

const SYMBOL_STYLES: Array<{ id: SymbolStyle; label: string }> = [
  { id: "textbook", label: "Textbook (India)" },
  { id: "iec", label: "IEC" },
];

const RESISTOR_KINDS: Array<{ id: ResistorKind; label: string }> = [
  { id: "fixed", label: "Fixed" },
  { id: "rheostat", label: "Rheostat" },
];

const VOLTAGE_STEPS = [1.5, 3, 4.5, 6, 9, 12];

/* Geometry: one rectangular loop, read left to right. */
const LEFT = 120;
const RIGHT = 640;
const TOP = 110;
const BOTTOM = 330;
const TAP_TOP = 150;
const TAP_BOTTOM = 290;
const LOOP_D = `M ${LEFT} ${TOP} H ${RIGHT} V ${BOTTOM} H ${LEFT} Z`;

/**
 * A zigzag resistor, the textbook (India) symbol.
 *
 * `vertical` is the orientation used in the loop; the legend draws it
 * horizontally. The zigzag starts and ends on the wire axis so the leads meet
 * the peaks cleanly instead of jumping at the join.
 */
function zigzagPath(cx: number, cy: number, length: number, vertical: boolean, amplitude = 8) {
  const peaks = 6;
  const span = length;
  const step = span / peaks;
  const points: Array<[number, number]> = [];
  for (let index = 0; index <= peaks; index += 1) {
    const along = -span / 2 + index * step;
    const across = index === 0 || index === peaks ? 0 : index % 2 === 0 ? amplitude : -amplitude;
    points.push(vertical ? [cx + across, cy + along] : [cx + along, cy + across]);
  }
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function FixedResistor({
  cx,
  cy,
  length,
  style,
  vertical = true,
  breakWire = true,
}: {
  cx: number;
  cy: number;
  length: number;
  style: SymbolStyle;
  vertical?: boolean;
  breakWire?: boolean;
}) {
  if (style === "iec") {
    // The rectangle runs ALONG the wire: a vertical resistor is tall and thin,
    // a horizontal one is wide and flat. A fixed 26×30 box was the "tall box"
    // the old legend drew in both orientations.
    const across = 22;
    const along = Math.max(24, length * 0.55);
    const width = vertical ? across : along;
    const height = vertical ? along : across;
    return (
      <rect
        x={cx - width / 2}
        y={cy - height / 2}
        width={width}
        height={height}
        rx={1}
        strokeWidth={2}
        style={{ fill: breakWire ? plate(0.98) : "none", stroke: ink(0.85) }}
      />
    );
  }
  return (
    <g>
      {/* Break the wire underneath, or the zigzag reads as a decoration on a
          short circuit instead of a component in the path. The legend has no
          wire to break, so it opts out. */}
      {breakWire ? (
        <rect
          x={vertical ? cx - 10 : cx - length / 2}
          y={vertical ? cy - length / 2 : cy - 10}
          width={vertical ? 20 : length}
          height={vertical ? length : 20}
          style={{ fill: plate(0.98) }}
        />
      ) : null}
      <path
        d={zigzagPath(cx, cy, length, vertical)}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: ink(0.85) }}
      />
    </g>
  );
}

/** Fixed resistor plus the diagonal arrow that marks a rheostat. */
function SectionResistor({
  cx,
  cy,
  length,
  style,
  kind,
  vertical = true,
  breakWire = true,
}: {
  cx: number;
  cy: number;
  length: number;
  style: SymbolStyle;
  kind: ResistorKind;
  vertical?: boolean;
  breakWire?: boolean;
}) {
  return (
    <g>
      <FixedResistor cx={cx} cy={cy} length={length} style={style} vertical={vertical} breakWire={breakWire} />
      {kind === "rheostat" ? (
        <g>
          <line
            x1={cx - 24}
            y1={cy + (vertical ? 26 : -10)}
            x2={cx + 20}
            y2={cy + (vertical ? -24 : 10)}
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ stroke: ink(0.9) }}
          />
          <path
            d={`M ${cx + 20} ${cy + (vertical ? -24 : 10)} l -9 1 l 6 6`}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: ink(0.9) }}
          />
        </g>
      ) : null}
    </g>
  );
}

/**
 * A cell (one plate pair) or a battery (several), drawn on a horizontal wire.
 * The long thin plate is positive, the short thick one negative, exactly as a
 * textbook prints it. Reversing the stack swaps the plates.
 */
function Cells({
  x,
  y,
  value,
  label,
  reversed,
  pairs = 1,
}: {
  x: number;
  y: number;
  value: number;
  label: string;
  reversed: boolean;
  pairs?: number;
}) {
  const gap = 22;
  const total = gap * (pairs - 1);
  const first = x - total / 2;
  return (
    <g>
      {/* The wire stops at the plates; it never runs straight through a cell. */}
      <rect x={first - 13} y={y - 4} width={total + 26} height={8} style={{ fill: plate(0.98) }} />
      {Array.from({ length: pairs }, (_, index) => {
        const plateX = first + index * gap;
        const longX = reversed ? plateX + 6 : plateX - 6;
        const shortX = reversed ? plateX - 6 : plateX + 6;
        return (
          <g key={index}>
            <line x1={longX} y1={y - 20} x2={longX} y2={y + 20} strokeWidth={2} style={{ stroke: ink(0.9) }} />
            <line x1={shortX} y1={y - 11} x2={shortX} y2={y + 11} strokeWidth={5} style={{ stroke: ink(0.9) }} />
          </g>
        );
      })}
      <text x={reversed ? first + 6 : first - 6} y={y - 30} fontSize={13} fontWeight={700} textAnchor="middle" style={{ fill: ink(0.85) }}>
        +
      </text>
      <text x={reversed ? first - 6 : first + 6} y={y - 30} fontSize={15} fontWeight={700} textAnchor="middle" style={{ fill: ink(0.7) }}>
        −
      </text>
      <text x={x} y={y + 44} fontSize={14} textAnchor="middle" style={{ fill: ink(0.8) }}>
        {label}
      </text>
      <text x={x} y={y + 62} fontSize={13} textAnchor="middle" style={{ fill: ink(0.55) }}>
        {`${value.toFixed(1)} V`}
      </text>
    </g>
  );
}

/** Circle-and-cross lamp, with a soft glow proportional to the power. */
function Lamp({ cx, cy, glow }: { cx: number; cy: number; glow: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={30 + glow * 16} style={{ fill: glow > 0.02 ? "url(#lab-lamp)" : "none" }} opacity={glow} />
      <circle cx={cx} cy={cy} r={20} strokeWidth={2} style={{ fill: plate(0.98), stroke: ink(0.85) }} />
      <path d={`M ${cx - 10} ${cy - 10} L ${cx + 10} ${cy + 10} M ${cx + 10} ${cy - 10} L ${cx - 10} ${cy + 10}`} strokeWidth={2} strokeLinecap="round" style={{ stroke: ink(0.9) }} />
      <text x={cx + 30} y={cy + 5} fontSize={14} style={{ fill: ink(0.7) }}>
        lamp
      </text>
    </g>
  );
}

/** A plug key: two terminals and a lever that lifts to open the circuit. */
function Switch({
  x1,
  x2,
  y,
  closed,
}: {
  x1: number;
  x2: number;
  y: number;
  closed: boolean;
}) {
  return (
    <g>
      {/* The lever is the only connection between the terminals. */}
      <rect x={x1 + 4} y={y - 4} width={x2 - x1 - 8} height={8} style={{ fill: plate(0.98) }} />
      <circle cx={x1} cy={y} r={5} style={{ fill: plate(0.98), stroke: ink(0.85) }} strokeWidth={1.6} />
      <circle cx={x2} cy={y} r={5} style={{ fill: plate(0.98), stroke: ink(0.85) }} strokeWidth={1.6} />
      <motion.line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        strokeWidth={2.4}
        strokeLinecap="round"
        initial={false}
        animate={{ rotate: closed ? 0 : -34 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        style={{
          transformBox: "view-box",
          transformOrigin: `${x1}px ${y}px`,
          stroke: closed ? VIOLET : ink(0.75),
        }}
      />
      <text x={(x1 + x2) / 2} y={y - 26} fontSize={14} textAnchor="middle" style={{ fill: ink(0.72) }}>
        {closed ? "key closed" : "key open"}
      </text>
    </g>
  );
}

/** A meter: a circle with its letter and its live reading inside. */
function Meter({
  cx,
  cy,
  letter,
  reading,
}: {
  cx: number;
  cy: number;
  letter: "A" | "V";
  reading: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={26} strokeWidth={2} style={{ fill: plate(0.99), stroke: ink(0.88) }} />
      <text x={cx} y={cy - 2} fontSize={16} fontWeight={700} textAnchor="middle" style={{ fill: ink(0.92) }}>
        {letter}
      </text>
      <text x={cx} y={cy + 15} fontSize={11} textAnchor="middle" style={{ fill: ink(0.7) }}>
        {reading}
      </text>
    </g>
  );
}

/** Text on top of the wire, with a plate-coloured halo so it stays readable. */
function Label({
  x,
  y,
  children,
  anchor = "middle",
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={14}
      textAnchor={anchor}
      paintOrder="stroke"
      strokeWidth={4}
      style={{ fill: ink(0.82), stroke: plate(0.98) }}
    >
      {children}
    </text>
  );
}

/** One entry in the symbol key beneath the diagram. */
function SymbolKey({
  kind,
  style,
  label,
}: {
  kind:
    | "cell"
    | "battery"
    | "lamp"
    | "fixed"
    | "rheostat"
    | "switchClosed"
    | "switchOpen"
    | "ammeter"
    | "voltmeter"
    | "junction"
    | "crossing";
  style: SymbolStyle;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 66 32" className="h-8 w-[66px] shrink-0" aria-hidden>
        {kind === "cell" && (
          <g>
            <line x1="6" y1="16" x2="26" y2="16" style={{ stroke: ink(0.55) }} />
            <line x1="26" y1="6" x2="26" y2="26" strokeWidth={2} style={{ stroke: ink(0.9) }} />
            <line x1="32" y1="10" x2="32" y2="22" strokeWidth={4.5} style={{ stroke: ink(0.9) }} />
            <line x1="32" y1="16" x2="60" y2="16" style={{ stroke: ink(0.55) }} />
            <text x="26" y="5" fontSize="9" textAnchor="middle" style={{ fill: ink(0.8) }}>+</text>
            <text x="34" y="29" fontSize="9" textAnchor="middle" style={{ fill: ink(0.6) }}>−</text>
          </g>
        )}
        {kind === "battery" && (
          <g>
            <line x1="2" y1="16" x2="14" y2="16" style={{ stroke: ink(0.55) }} />
            {[14, 25, 36].map((x) => (
              <g key={x}>
                <line x1={x} y1="7" x2={x} y2="25" strokeWidth={1.8} style={{ stroke: ink(0.9) }} />
                <line x1={x + 6} y1="11" x2={x + 6} y2="21" strokeWidth={4} style={{ stroke: ink(0.9) }} />
              </g>
            ))}
            <line x1="42" y1="16" x2="64" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "lamp" && (
          <g>
            <line x1="4" y1="16" x2="20" y2="16" style={{ stroke: ink(0.55) }} />
            <circle cx="33" cy="16" r="11" strokeWidth={1.8} style={{ fill: "none", stroke: ink(0.9) }} />
            <path d="M 25 8 L 41 24 M 41 8 L 25 24" strokeWidth={1.6} style={{ stroke: ink(0.9) }} />
            <line x1="44" y1="16" x2="62" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "fixed" && (
          <g>
            <line x1="3" y1="16" x2="12" y2="16" style={{ stroke: ink(0.55) }} />
            <FixedResistor cx={36} cy={16} length={30} style={style} vertical={false} breakWire={false} />
            <line x1="60" y1="16" x2="63" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "rheostat" && (
          <g>
            <line x1="3" y1="16" x2="12" y2="16" style={{ stroke: ink(0.55) }} />
            <SectionResistor cx={36} cy={16} length={30} style={style} kind="rheostat" vertical={false} breakWire={false} />
            <line x1="60" y1="16" x2="63" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "switchClosed" && (
          <g>
            <line x1="4" y1="18" x2="16" y2="18" style={{ stroke: ink(0.55) }} />
            <circle cx="16" cy="18" r="2.6" style={{ fill: ink(0.85) }} />
            <line x1="16" y1="18" x2="48" y2="18" strokeWidth={2} style={{ stroke: ink(0.9) }} />
            <circle cx="48" cy="18" r="2.6" style={{ fill: ink(0.85) }} />
            <line x1="48" y1="18" x2="62" y2="18" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "switchOpen" && (
          <g>
            <line x1="4" y1="18" x2="16" y2="18" style={{ stroke: ink(0.55) }} />
            <circle cx="16" cy="18" r="2.6" style={{ fill: ink(0.85) }} />
            <line x1="16" y1="18" x2="42" y2="7" strokeWidth={2} style={{ stroke: ink(0.9) }} />
            <circle cx="48" cy="18" r="2.6" style={{ fill: ink(0.55) }} />
            <line x1="48" y1="18" x2="62" y2="18" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "ammeter" && (
          <g>
            <line x1="2" y1="16" x2="13" y2="16" style={{ stroke: ink(0.55) }} />
            <circle cx="33" cy="16" r="12" strokeWidth={1.8} style={{ fill: "none", stroke: ink(0.9) }} />
            <text x="33" y="20" fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: ink(0.9) }}>A</text>
            <line x1="45" y1="16" x2="62" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "voltmeter" && (
          <g>
            <line x1="2" y1="16" x2="13" y2="16" style={{ stroke: ink(0.55) }} />
            <circle cx="33" cy="16" r="12" strokeWidth={1.8} style={{ fill: "none", stroke: ink(0.9) }} />
            <text x="33" y="20" fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: ink(0.9) }}>V</text>
            <line x1="45" y1="16" x2="62" y2="16" style={{ stroke: ink(0.55) }} />
          </g>
        )}
        {kind === "junction" && (
          <g>
            <line x1="6" y1="16" x2="60" y2="16" style={{ stroke: ink(0.6) }} />
            <line x1="33" y1="2" x2="33" y2="30" style={{ stroke: ink(0.6) }} />
            <circle cx="33" cy="16" r="4.5" style={{ fill: ink(0.9) }} />
          </g>
        )}
        {kind === "crossing" && (
          <g>
            <line x1="6" y1="16" x2="60" y2="16" style={{ stroke: ink(0.6) }} />
            <path d="M 33 30 L 33 21 A 5 5 0 0 1 43 21 L 43 2" fill="none" style={{ stroke: ink(0.6) }} />
          </g>
        )}
      </svg>
      <span className="apple-lab-note text-[12px] leading-tight">{label}</span>
    </span>
  );
}

export function CircuitsBench() {
  const reduceMotion = useReducedMotion();
  const [closed, setClosed] = useState(true);
  const [cell1, setCell1] = useState(6);
  const [cell2, setCell2] = useState(1.5);
  const [polarity, setPolarity] = useState<"add" | "oppose">("add");
  const [r1, setR1] = useState(22);
  const [r2, setR2] = useState(33);
  const [topology, setTopology] = useState<Topology>("series");
  const [symbolStyle, setSymbolStyle] = useState<SymbolStyle>("textbook");
  const [resistorKind, setResistorKind] = useState<ResistorKind>("fixed");
  const [meters, setMeters] = useState(true);

  const emf = cell1 + (polarity === "oppose" ? -cell2 : cell2);
  const resistance =
    topology === "single" ? r1 : topology === "series" ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const current = closed ? emf / resistance : 0;
  const power = emf * current;
  const branchA = closed ? emf / r1 : 0;
  const branchB = closed ? emf / r2 : 0;
  const voltmeterReading = closed ? emf : 0;

  const flowRef = useRef<SVGPathElement>(null);
  const railARef = useRef<SVGPathElement>(null);
  const railBRef = useRef<SVGPathElement>(null);
  const offset = useRef(0);

  useAnimationFrame((_, delta) => {
    const step = delta / 1000;
    if (!reduceMotion) {
      const speed = Math.min(2.4, Math.abs(current)) * Math.sign(current || 1);
      offset.current -= step * 200 * speed;
    }
    flowRef.current?.setAttribute("stroke-dashoffset", String(offset.current));
    railARef.current?.setAttribute("stroke-dashoffset", String(offset.current));
    railBRef.current?.setAttribute("stroke-dashoffset", String(offset.current));
  });

  const glow = Math.min(1, Math.abs(power) / 3.6);

  const resetCircuit = () => {
    setClosed(true);
    setCell1(6);
    setCell2(1.5);
    setPolarity("add");
    setR1(22);
    setR2(33);
    setTopology("series");
    setSymbolStyle("textbook");
    setResistorKind("fixed");
    setMeters(true);
  };

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

  const showSecond = topology !== "single";

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: closed ? (current < 0 ? AMBER : CYAN) : ink(0.35) }}
              />
              {current.toFixed(2)} A
            </span>
            <button
              type="button"
              onClick={() => setClosed((value) => !value)}
              data-active={!closed}
              className="apple-lab-btn apple-lab-btn--solid !px-3 !py-2"
            >
              <Power className="h-3.5 w-3.5" />
              <span>{closed ? "Open switch" : "Close switch"}</span>
            </button>
            <button type="button" onClick={resetCircuit} className="apple-lab-btn !px-3 !py-2">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="apple-lab-micro mr-1">Symbols</span>
            {SYMBOL_STYLES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSymbolStyle(option.id)}
                data-active={symbolStyle === option.id}
                className="apple-lab-btn !px-2.5 !py-1 !text-[11.5px]"
                aria-pressed={symbolStyle === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMeters((value) => !value)}
            data-active={meters}
            className="apple-lab-btn !px-2.5 !py-1 !text-[11.5px]"
            aria-pressed={meters}
          >
            {meters ? "Meters on" : "Meters off"}
          </button>
        </div>

        <div className="mt-2 overflow-x-auto pb-1">
          <svg
            viewBox="0 0 900 440"
            className="h-auto w-full min-w-[680px]"
            role="img"
            aria-label="A circuit diagram with a battery, two cells, a plug key, a lamp, an ammeter in series, one or two resistors, and a voltmeter across the load"
          >
            <defs>
              <linearGradient id="lab-flow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: CYAN }} />
                <stop offset="55%" style={{ stopColor: VIOLET }} />
                <stop offset="100%" style={{ stopColor: CYAN }} />
              </linearGradient>
              <radialGradient id="lab-lamp">
                <stop offset="0%" stopColor="rgba(255,236,180,0.95)" />
                <stop offset="55%" stopColor="rgba(255,196,120,0.4)" />
                <stop offset="100%" stopColor="rgba(255,196,120,0)" />
              </radialGradient>
            </defs>

            {/* The loop, as wire: a wide soft stroke under a crisp one. */}
            <path d={LOOP_D} fill="none" strokeLinecap="square" strokeWidth={6} style={{ stroke: ink(0.14) }} />
            <path d={LOOP_D} fill="none" strokeLinecap="square" strokeWidth={1.8} style={{ stroke: ink(0.55) }} />

            <motion.path
              ref={flowRef}
              d={LOOP_D}
              fill="none"
              stroke="url(#lab-flow)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="2 14"
              initial={false}
              animate={{ opacity: closed ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Parallel pair: the right-hand wire between the nodes is masked,
                and the two branches carry the split instead. */}
            {topology === "parallel" ? (
              <>
                <line x1={RIGHT} y1={TAP_TOP} x2={RIGHT} y2={TAP_BOTTOM} strokeWidth={10} style={{ stroke: plate(0.98) }} />
                <path d={`M ${RIGHT} ${TAP_TOP} H 820 V ${TAP_BOTTOM} H ${RIGHT}`} fill="none" strokeWidth={1.8} style={{ stroke: ink(0.55) }} />
                <path d={`M ${RIGHT} ${TAP_TOP} H 786 V ${TAP_BOTTOM} H ${RIGHT}`} fill="none" strokeWidth={1.8} style={{ stroke: ink(0.55) }} />
                <motion.path
                  ref={railARef}
                  d={`M ${RIGHT} ${TAP_TOP} H 820 V ${TAP_BOTTOM} H ${RIGHT}`}
                  fill="none"
                  stroke="url(#lab-flow)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="2 14"
                  initial={false}
                  animate={{ opacity: closed ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.path
                  ref={railBRef}
                  d={`M ${RIGHT} ${TAP_TOP} H 786 V ${TAP_BOTTOM} H ${RIGHT}`}
                  fill="none"
                  stroke="url(#lab-flow)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="2 14"
                  initial={false}
                  animate={{ opacity: closed ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                />
                <SectionResistor cx={820} cy={220} length={64} style={symbolStyle} kind="fixed" />
                <SectionResistor cx={786} cy={220} length={64} style={symbolStyle} kind={resistorKind} />
                <Label x={840} y={190} anchor="start">R₁ {r1} Ω</Label>
                <Label x={766} y={190} anchor="end">R₂ {r2} Ω</Label>
                <Label x={820} y={318} anchor="middle">{(branchA + branchB).toFixed(2)} A total</Label>
                <circle cx={RIGHT} cy={TAP_TOP} r={4.5} style={{ fill: ink(0.9) }} />
                <circle cx={RIGHT} cy={TAP_BOTTOM} r={4.5} style={{ fill: ink(0.9) }} />
              </>
            ) : (
              <>
                {topology === "single" ? (
                  <SectionResistor cx={RIGHT} cy={220} length={78} style={symbolStyle} kind={resistorKind} />
                ) : (
                  <>
                    <SectionResistor cx={RIGHT} cy={180} length={58} style={symbolStyle} kind="fixed" />
                    <SectionResistor cx={RIGHT} cy={266} length={58} style={symbolStyle} kind={resistorKind} />
                  </>
                )}
                <Label x={RIGHT + 28} y={topology === "single" ? 226 : 184} anchor="start">
                  {`R₁ ${r1} Ω`}
                </Label>
                {showSecond ? (
                  <Label x={RIGHT + 28} y={272} anchor="start">{`R₂ ${r2} Ω`}</Label>
                ) : null}
              </>
            )}

            {/* Voltmeter, in parallel with the load: two thin taps from the
                load nodes to a circle inside the loop. */}
            {meters ? (
              <g>
                <path
                  d={`M ${RIGHT} ${TAP_TOP} H 552 V 189`}
                  fill="none"
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  style={{ stroke: ink(0.5) }}
                />
                <path
                  d={`M ${RIGHT} ${TAP_BOTTOM} H 552 V 241`}
                  fill="none"
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  style={{ stroke: ink(0.5) }}
                />
                <Meter cx={552} cy={215} letter="V" reading={`${voltmeterReading.toFixed(1)} V`} />
                <circle cx={RIGHT} cy={TAP_TOP} r={4.5} style={{ fill: ink(0.9) }} />
                <circle cx={RIGHT} cy={TAP_BOTTOM} r={4.5} style={{ fill: ink(0.9) }} />
              </g>
            ) : null}

            {/* Lamp on the left edge. */}
            <Lamp cx={LEFT} cy={220} glow={glow} />

            {/* Switch and ammeter on the top edge. */}
            <Switch x1={250} x2={330} y={TOP} closed={closed} />
            {meters ? (
              <Meter cx={470} cy={TOP} letter="A" reading={`${current.toFixed(2)} A`} />
            ) : null}

            {/* Two sources on the bottom edge: a battery and a single cell. */}
            <Cells x={300} y={BOTTOM} value={cell1} label="battery" reversed={false} pairs={2} />
            <Cells
              x={470}
              y={BOTTOM}
              value={cell2}
              label={polarity === "oppose" ? "cell 2 (reversed)" : "cell 2"}
              reversed={polarity === "oppose"}
            />

            {closed ? null : (
              <text x={RIGHT + 28} y={360} fontSize={13} style={{ fill: ink(0.55) }}>
                open circuit — no current
              </text>
            )}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3" style={{ borderColor: "var(--lab-line)" }}>
          <span className="apple-lab-micro">Circuit symbols</span>
          <SymbolKey kind="battery" style={symbolStyle} label="battery" />
          <SymbolKey kind="cell" style={symbolStyle} label="cell" />
          <SymbolKey kind="fixed" style={symbolStyle} label="resistor" />
          {showSecond && resistorKind === "rheostat" ? (
            <SymbolKey kind="rheostat" style={symbolStyle} label="rheostat" />
          ) : null}
          <SymbolKey kind="switchClosed" style={symbolStyle} label="key (closed)" />
          <SymbolKey kind="switchOpen" style={symbolStyle} label="key (open)" />
          <SymbolKey kind="lamp" style={symbolStyle} label="lamp" />
          {meters ? <SymbolKey kind="ammeter" style={symbolStyle} label="ammeter (series)" /> : null}
          {meters ? <SymbolKey kind="voltmeter" style={symbolStyle} label="voltmeter (parallel)" /> : null}
          <SymbolKey kind="junction" style={symbolStyle} label="junction" />
          <SymbolKey kind="crossing" style={symbolStyle} label="crossing (no join)" />
        </div>

        <p className="apple-lab-note mt-4">{note}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Circuit</p>
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
            {showSecond ? (
              <Range label="R₂" value={r2} min={5} max={60} step={1} unit="Ω" format={(v) => v.toFixed(0)} onChange={setR2} />
            ) : null}
          </div>
          {showSecond ? (
            <div className="mt-3">
              <Picker label="R₂ type" value={resistorKind} options={RESISTOR_KINDS} onChange={setResistorKind} />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="apple-lab-micro mr-1">Switch</span>
            <button type="button" onClick={() => setClosed(true)} data-active={closed} className="apple-lab-btn !px-2.5 !py-1 !text-[11px]">
              Closed
            </button>
            <button type="button" onClick={() => setClosed(false)} data-active={!closed} className="apple-lab-btn !px-2.5 !py-1 !text-[11px]">
              Open
            </button>
          </div>
        </div>

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
            dots run backwards and the ammeter reads negative.
          </p>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Measurements</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {readouts.map(([label, value]) => (
              <Readout key={label} label={label} value={value} />
            ))}
          </div>
          <p className="apple-lab-note mt-3">
            Ohm's law for the whole loop: I = EMF / R. The ammeter is in series,
            so it reads the total current; the voltmeter is in parallel with the
            load, so it reads the voltage across it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CircuitsBench;
