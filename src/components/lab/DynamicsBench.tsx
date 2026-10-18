import { AMBER, CYAN, Picker, Range, Readout, VIOLET, ink, plate } from "@/components/lab/bench-atoms";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useAnimationFrame } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Dynamics — the drop tower.
 *
 * One specimen, released from the same 80 m clamp, read three ways:
 *
 *   Free fall   constant g, no air. The closed forms are the whole model, and
 *               the bench is the baseline the other two are measured against.
 *   Energy      the same drop as a ledger — PE, KE and the total. It is the
 *               one view where the numbers add up to something visible.
 *   With drag   quadratic air resistance, an optional release speed and a
 *               specimen whose frontal area and mass decide how hard the air
 *               bites. It uses the same integrator as the preview, so the
 *               oracle and the animation cannot disagree.
 *
 * The tower is the shared reference point: the same geometry, the same floor
 * and the same release clamp on every world, because a drop bench is only
 * useful if the thing being varied is the physics. Everything is drawn with
 * the bench's vector vocabulary (`bench-atoms`) and follows `data-lab-theme`,
 * so the light bench turns the geometry into ink on paper.
 *
 * The loop only runs on Release/Pause/Reset or with Auto-run, never as idle
 * decoration, which is why it keeps working under Motionless Mode: the press
 * is the request for motion.
 */

type DropMode = "fall" | "energy" | "drag";
type DropWorldId = "earth" | "moon" | "mars" | "space";
type DropWorld = DropWorldId | "custom";
type DropBody = "sphere" | "cube" | "capsule";
type DropMaterial = "lead" | "rubber" | "wood";
type DropPhase = "idle" | "running" | "paused" | "done";
type Playback = "0.5" | "1" | "2" | "4";

const DROP_HEIGHT = 80; // metres of tower
const DROP_TOP = 46; // svg y of the release clamp
const DROP_GROUND = 328; // svg y of the floor
const DROP_X = 604; // the fall line
const DROP_PX = (DROP_GROUND - DROP_TOP) / DROP_HEIGHT;
const GRAPH_POINTS = 260;

const DROP_MODES: Array<{ id: DropMode; label: string; formula: string; blurb: string }> = [
  {
    id: "fall",
    label: "Free fall",
    formula: "v² = u² + 2gh",
    blurb:
      "Constant gravity and no air. The closed form is the entire model here, which makes this the reading every other mode is compared against.",
  },
  {
    id: "energy",
    label: "Energy",
    formula: "E = mgh + ½mv²",
    blurb:
      "The same drop kept as a ledger: potential energy becomes kinetic energy, and whatever leaves the ledger went to the air or into the floor.",
  },
  {
    id: "drag",
    label: "With drag",
    formula: "ma = mg − ½ρC_dAv²",
    blurb:
      "Air resists with the square of speed, so acceleration fades and the specimen approaches a terminal speed instead of gaining forever.",
  },
];

const DROP_WORLDS: Array<{ id: DropWorldId; label: string; g: number; rho: number }> = [
  { id: "earth", label: "Earth", g: 9.81, rho: 1.225 },
  { id: "moon", label: "Moon", g: 1.62, rho: 0 },
  { id: "mars", label: "Mars", g: 3.71, rho: 0.02 },
  { id: "space", label: "Deep space", g: 0, rho: 0 },
];

const DROP_BODIES: Array<{ id: DropBody; label: string; area: (r: number) => number }> = [
  { id: "sphere", label: "Sphere", area: (r) => Math.PI * r * r },
  { id: "cube", label: "Cube", area: (r) => 4 * r * r },
  { id: "capsule", label: "Capsule", area: (r) => 6.2 * r * r },
];

const DROP_MATERIALS: Record<
  DropMaterial,
  { label: string; bounce: number; cd: number; density: number; blurb: string }
> = {
  lead: {
    label: "Lead",
    bounce: 0.08,
    cd: 0.42,
    density: 11340,
    blurb:
      "Dense and unforgiving: it takes the floor almost dead, and its smooth skin sheds air better than anything else on the shelf.",
  },
  rubber: {
    label: "Rubber",
    bounce: 0.78,
    cd: 0.55,
    density: 1100,
    blurb:
      "Stores the hit and gives most of it back — the bounce you expect, at the cost of a blunter profile through the air.",
  },
  wood: {
    label: "Wood",
    bounce: 0.36,
    cd: 0.62,
    density: 780,
    blurb:
      "Takes the hit, keeps some of it and sheds the rest as a dull knock. The draggiest of the three.",
  },
};

const PLAYBACKS: Array<{ id: Playback; label: string }> = [
  { id: "0.5", label: "0.5×" },
  { id: "1", label: "1×" },
  { id: "2", label: "2×" },
  { id: "4", label: "4×" },
];

type DropState = {
  t: number;
  /** height above the floor, metres */
  y: number;
  /** vertical speed, positive upwards */
  vy: number;
  impact: number;
  bounces: number;
  settled: boolean;
};

const dropState = (u: number): DropState => ({
  t: 0,
  y: DROP_HEIGHT,
  vy: -u,
  impact: u,
  bounces: 0,
  settled: false,
});

/** One step. `k` is ½ρC_dA/m, i.e. all the air in one term.
 *
 *  Position is advanced with the second-order term (½at²), not with the
 *  just-updated velocity: at 240 Hz that turns a 0.1% energy drift into exact
 *  conservation on a dragless fall, which matters because the energy audit is
 *  a reading, not decoration — a free fall that "lost" 10 J to nothing would
 *  be a bug on screen. */
function stepDrop(s: DropState, dt: number, g: number, k: number, bounce: number) {
  const a = -g - k * s.vy * Math.abs(s.vy);
  s.y += s.vy * dt + 0.5 * a * dt * dt;
  s.vy += a * dt;
  s.t += dt;
  if (s.y <= 0) {
    s.y = 0;
    s.impact = Math.max(s.impact, Math.abs(s.vy));
    if (Math.abs(s.vy) > 0.7 && s.bounces < 12) {
      s.vy = -s.vy * bounce;
      s.bounces += 1;
    } else {
      s.vy = 0;
      s.settled = true;
    }
  }
}

/** The same integrator, flown headless once — the oracle and the animation
 *  therefore quote the same landing, drag included. */
function predictDrop(g: number, k: number, u: number) {
  if (g === 0 && u === 0) return { impact: 0, time: Number.POSITIVE_INFINITY };
  let y = DROP_HEIGHT;
  let vy = -u;
  let t = 0;
  const dt = 1 / 240;
  while (y > 0 && t < 120) {
    const a = -g - k * vy * Math.abs(vy);
    y += vy * dt + 0.5 * a * dt * dt;
    vy += a * dt;
    t += dt;
  }
  return { impact: Math.abs(vy), time: t };
}

export default function DynamicsBench() {
  const [mode, setMode] = useState<DropMode>("fall");
  const [gravity, setGravity] = useState(9.81);
  const [body, setBody] = useState<DropBody>("sphere");
  const [material, setMaterial] = useState<DropMaterial>("rubber");
  const [mass, setMass] = useState(12);
  const [size, setSize] = useState(0.6);
  const [release, setRelease] = useState(0);
  const [playback, setPlayback] = useState<Playback>("1");
  const [autoRun, setAutoRun] = useState(true);
  const [phase, setPhase] = useState<DropPhase>("idle");
  const [snapshot, setSnapshot] = useState<DropState>(() => dropState(0));

  const spec = DROP_MODES.find((entry) => entry.id === mode) ?? DROP_MODES[0];
  const specBody = DROP_BODIES.find((entry) => entry.id === body) ?? DROP_BODIES[0];
  const specMaterial = DROP_MATERIALS[material];

  const u = mode === "drag" ? release : 0;
  const radius = size / 2;
  const area = specBody.area(radius);
  const preset = DROP_WORLDS.find((entry) => Math.abs(entry.g - gravity) < 0.02);
  const world: DropWorld = preset?.id ?? "custom";
  const rho = preset ? preset.rho : 1.225;
  const k = mode === "drag" ? (0.5 * rho * specMaterial.cd * area) / mass : 0;
  const rate = Number(playback);

  const predicted = useMemo(() => predictDrop(gravity, k, u), [gravity, k, u]);
  const analytic = Math.sqrt(u * u + 2 * gravity * DROP_HEIGHT);

  const total = mass * gravity * DROP_HEIGHT + 0.5 * mass * u * u;
  const pe = mass * gravity * snapshot.y;
  const ke = 0.5 * mass * snapshot.vy * snapshot.vy;
  const lost = Math.max(0, total - pe - ke);
  const pct = (value: number) =>
    total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;

  const floating = gravity === 0 && u === 0;
  const bodyR = 6 + size * 4;
  const netAccel = -gravity - k * snapshot.vy * Math.abs(snapshot.vy);
  const dragForce =
    mode === "drag" ? 0.5 * rho * specMaterial.cd * area * snapshot.vy * snapshot.vy : 0;

  const sim = useRef<DropState>(dropState(0));
  const accumulator = useRef(0);
  const published = useRef(0);
  const trailRef = useRef<SVGPathElement>(null);
  const trailD = useRef("");
  const lastTrail = useRef<{ x: number; y: number } | null>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const velocityRef = useRef<SVGLineElement>(null);
  const gravityRef = useRef<SVGLineElement>(null);
  const heightRef = useRef<SVGLineElement>(null);
  const heightStemRef = useRef<SVGLineElement>(null);
  const heightValueRef = useRef<SVGTextElement>(null);
  const speedTextRef = useRef<SVGTextElement>(null);
  const graphRef = useRef<SVGPathElement>(null);
  const samples = useRef<number[]>([]);
  const lastSample = useRef(0);
  const graphMax = useRef(1);

  /** Write the current state into the stage — the one place the DOM is driven. */
  const paint = () => {
    const s = sim.current;
    const y = DROP_GROUND - s.y * DROP_PX;
    bodyRef.current?.setAttribute("transform", `translate(${DROP_X} ${y.toFixed(2)})`);
    heightRef.current?.setAttribute("y1", y.toFixed(2));
    heightRef.current?.setAttribute("y2", y.toFixed(2));
    heightStemRef.current?.setAttribute("y2", y.toFixed(2));
    if (heightValueRef.current) heightValueRef.current.textContent = s.y.toFixed(1);
    if (speedTextRef.current) {
      speedTextRef.current.setAttribute("y", (y + 4).toFixed(2));
      speedTextRef.current.textContent = `${Math.abs(s.vy).toFixed(1)} m/s`;
    }

    const speedLength = Math.min(120, Math.abs(s.vy) * 2.2);
    velocityRef.current?.setAttribute("y2", (s.vy <= 0 ? speedLength : -speedLength).toFixed(2));
    gravityRef.current?.setAttribute("y2", Math.min(96, gravity * 7).toFixed(2));

    const last = lastTrail.current;
    if (!last || Math.abs(y - last.y) >= 2.5) {
      lastTrail.current = { x: DROP_X, y };
      if (trailD.current.length < 16000) {
        trailD.current += `${trailD.current ? "L" : "M"}${DROP_X} ${y.toFixed(1)} `;
        trailRef.current?.setAttribute("d", trailD.current);
      }
    }
  };

  const drawGraph = () => {
    const values = samples.current;
    if (values.length < 2) {
      graphRef.current?.setAttribute("d", "");
      return;
    }
    const max = Math.max(1, graphMax.current);
    const path = values
      .map((value, index) => {
        const x = (index / (GRAPH_POINTS - 1)) * 900;
        const y = 78 - Math.min(1, value / max) * 70;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    graphRef.current?.setAttribute("d", path);
  };

  const park = () => {
    const next = dropState(u);
    sim.current = next;
    accumulator.current = 0;
    lastSample.current = 0;
    lastTrail.current = null;
    trailD.current = "";
    samples.current = [];
    trailRef.current?.setAttribute("d", "");
    graphRef.current?.setAttribute("d", "");
    setSnapshot({ ...next });
    paint();
  };

  /* Every control change parks the run at the clamp, and Auto-run releases it
     again immediately: the picture always describes the current spec sheet. */
  useEffect(() => {
    park();
    /* Free space with no release speed has nothing to animate: Auto-run parks
       it rather than idling a loop that can never move. */
    setPhase(autoRun && !floating ? "running" : "idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, gravity, k, autoRun]);

  graphMax.current = Math.max(1, predicted.impact * 1.06);

  const toggleRelease = () => {
    if (floating) return;
    if (phase === "running") {
      setPhase("paused");
      return;
    }
    if (phase === "paused") {
      setPhase("running");
      return;
    }
    park();
    setPhase("running");
  };

  const reset = () => {
    park();
    setPhase("idle");
  };

  useAnimationFrame((_, delta) => {
    if (phase !== "running" || floating) return;
    const dt = 1 / 240;
    accumulator.current += Math.min(delta / 1000, 0.05) * rate;
    let guard = 0;
    while (accumulator.current >= dt && guard < 1200) {
      stepDrop(sim.current, dt, gravity, k, specMaterial.bounce);
      accumulator.current -= dt;
      guard += 1;
      if (sim.current.settled) break;
    }
    paint();

    const s = sim.current;
    if (s.t - lastSample.current > 0.04) {
      lastSample.current = s.t;
      samples.current.push(Math.abs(s.vy));
      if (samples.current.length > GRAPH_POINTS) samples.current.shift();
      drawGraph();
    }

    if (s.settled) {
      setSnapshot({ ...s });
      setPhase("done");
      return;
    }
    const now = performance.now();
    if (now - published.current > 90) {
      published.current = now;
      setSnapshot({ ...s });
    }
  });

  const bounces = snapshot.bounces;
  const status = floating
    ? "Weightless — no fall"
    : phase === "running"
      ? "Falling"
      : phase === "paused"
        ? "Held"
        : phase === "done"
          ? bounces >= 12
            ? `Run ended · ${bounces} bounces`
            : bounces > 0
              ? `At rest · ${bounces} bounce${bounces === 1 ? "" : "s"}`
              : "At rest"
          : "At the clamp";

  const stats: Array<[string, string]> =
    mode === "energy"
      ? [
          ["Potential", `${Math.round(pe).toLocaleString()} J`],
          ["Kinetic", `${Math.round(ke).toLocaleString()} J`],
          ["Lost", `${Math.round(lost).toLocaleString()} J`],
          ["Peak impact", `${snapshot.impact.toFixed(1)} m/s`],
        ]
      : mode === "drag"
        ? [
            ["Time", `${snapshot.t.toFixed(2)} s`],
            ["Speed", `${Math.abs(snapshot.vy).toFixed(2)} m/s`],
            ["Drag force", `${dragForce.toFixed(1)} N`],
            ["Peak impact", `${snapshot.impact.toFixed(1)} m/s`],
          ]
        : [
            ["Height", `${snapshot.y.toFixed(1)} m`],
            ["Speed", `${Math.abs(snapshot.vy).toFixed(2)} m/s`],
            ["Acceleration", `${Math.abs(netAccel).toFixed(2)} m/s²`],
            /* Force is where the mass input shows up in a free fall: g does
               not care how heavy the specimen is, but the floor does. */
            ["Force", `${Math.abs(mass * netAccel).toFixed(1)} N`],
          ];

  const modeOptions = DROP_MODES.map((entry) => ({ id: entry.id, label: entry.label }));
  const bodyOptions = DROP_BODIES.map((entry) => ({ id: entry.id, label: entry.label }));
  const materialOptions = (Object.keys(DROP_MATERIALS) as DropMaterial[]).map((id) => ({
    id,
    label: DROP_MATERIALS[id].label,
  }));
  const worldOptions: Array<{ id: DropWorld; label: string }> = [
    ...DROP_WORLDS.map((entry) => ({
      id: entry.id as DropWorld,
      label: `${entry.label} · ${entry.g.toFixed(2)}`,
    })),
    { id: "custom", label: "Custom" },
  ];

  const selectWorld = (id: DropWorld) => {
    const presetWorld = DROP_WORLDS.find((entry) => entry.id === id);
    if (presetWorld) setGravity(presetWorld.g);
  };

  const footer = floating
    ? "With no gravity and no release speed there is no drop to watch: give the specimen a push, or stand it on a world with some pull under it."
    : `Released from ${DROP_HEIGHT} m in ${gravity.toFixed(2)} m/s²: the closed form reads ${analytic.toFixed(1)} m/s, the integrator with this specimen reads ${predicted.impact.toFixed(1)} m/s after ${predicted.time.toFixed(2)} s.`;

  const heightTicks = Array.from({ length: 9 }, (_, i) => i * 10);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Drop tower · {DROP_HEIGHT} m</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {specBody.label} released from the clamp
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
              onClick={toggleRelease}
              disabled={floating}
              data-active={phase === "running"}
              className="apple-lab-btn apple-lab-btn--solid !px-3.5 !py-2"
            >
              {phase === "running" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{phase === "running" ? "Hold" : phase === "paused" ? "Resume" : "Release"}</span>
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
          aria-label={`A ${specBody.label} dropping ${DROP_HEIGHT} metres with live vectors`}
        >
          {heightTicks.map((metres) => {
            const y = DROP_GROUND - metres * DROP_PX;
            return (
              <g key={metres}>
                <line
                  x1={54}
                  y1={y}
                  x2={metres % 20 === 0 ? 72 : 63}
                  y2={y}
                  style={{ stroke: ink(0.25) }}
                />
                {metres % 20 === 0 ? (
                  <text
                    x={44}
                    y={y + 3.5}
                    fontSize={10}
                    textAnchor="end"
                    style={{ fill: ink(0.55) }}
                  >
                    {`${metres} m`}
                  </text>
                ) : null}
              </g>
            );
          })}

          <line
            x1={40}
            y1={DROP_GROUND}
            x2={860}
            y2={DROP_GROUND}
            strokeWidth={1.6}
            style={{ stroke: ink(0.3) }}
          />
          {Array.from({ length: 24 }, (_, i) => (
            <line
              key={`hatch${i}`}
              x1={48 + i * 34}
              y1={DROP_GROUND}
              x2={38 + i * 34}
              y2={DROP_GROUND + 9}
              style={{ stroke: ink(0.12) }}
            />
          ))}

          <line
            x1={DROP_X}
            y1={DROP_TOP}
            x2={DROP_X}
            y2={DROP_GROUND}
            strokeDasharray="3 8"
            style={{ stroke: ink(0.16) }}
          />

          <rect
            x={DROP_X - 18}
            y={DROP_TOP - 28}
            width={36}
            height={11}
            rx={4}
            style={{ fill: plate(0.95), stroke: ink(0.5) }}
          />
          <line
            x1={DROP_X}
            y1={DROP_TOP - 17}
            x2={DROP_X}
            y2={DROP_TOP}
            strokeWidth={1.5}
            style={{ stroke: ink(0.4) }}
          />

          {/* The live height as a stage readout, not a tooltip: it is the
              quantity the whole bench is about, and the ruler alone makes the
              student read a 2 px tick to find it. */}
          <text
            ref={heightValueRef}
            x={196}
            y={176}
            fontSize={46}
            fontWeight={600}
            textAnchor="end"
            style={{ fill: ink(0.86), fontVariantNumeric: "tabular-nums" }}
          >
            {DROP_HEIGHT.toFixed(1)}
          </text>
          <text x={210} y={176} fontSize={16} fontWeight={600} style={{ fill: ink(0.45) }}>
            m
          </text>
          <text
            x={196}
            y={200}
            fontSize={9.5}
            textAnchor="end"
            letterSpacing={1.8}
            style={{ fill: ink(0.4) }}
          >
            HEIGHT
          </text>

          {/* Bracket: the readout at y=176 is connected to the falling height,
              so the number and the body are visibly the same measurement. */}
          <line
            ref={heightStemRef}
            x1={226}
            y1={176}
            x2={226}
            y2={DROP_TOP}
            strokeDasharray="2 6"
            style={{ stroke: ink(0.12) }}
          />
          <line
            ref={heightRef}
            x1={226}
            y1={DROP_TOP}
            x2={DROP_X - 26}
            y2={DROP_TOP}
            strokeDasharray="2 6"
            style={{ stroke: ink(0.2) }}
          />
          <text
            ref={speedTextRef}
            x={DROP_X + 34}
            y={DROP_TOP + 4}
            fontSize={11}
            fontWeight={600}
            style={{ fill: ink(0.7) }}
          >
            0.0 m/s
          </text>

          <path
            ref={trailRef}
            fill="none"
            strokeWidth={2.4}
            strokeLinecap="round"
            style={{ stroke: AMBER }}
          />

          <g ref={bodyRef} transform={`translate(${DROP_X} ${DROP_TOP})`}>
            <line
              ref={velocityRef}
              x1={0}
              y1={0}
              x2={0}
              y2={0}
              strokeWidth={2}
              strokeLinecap="round"
              style={{ stroke: VIOLET }}
            />
            <line
              ref={gravityRef}
              x1={0}
              y1={0}
              x2={0}
              y2={0}
              strokeWidth={2}
              strokeLinecap="round"
              style={{ stroke: CYAN }}
            />
            <text x={10} y={-12} fontSize={10.5} fontWeight={600} style={{ fill: VIOLET }}>
              v
            </text>
            <text x={-18} y={26} fontSize={10.5} fontWeight={600} style={{ fill: CYAN }}>
              g
            </text>
            {body === "cube" ? (
              <rect
                x={-bodyR}
                y={-bodyR}
                width={bodyR * 2}
                height={bodyR * 2}
                rx={2.5}
                strokeWidth={2}
                style={{ fill: plate(0.95), stroke: ink(0.9) }}
              />
            ) : body === "capsule" ? (
              /* Broadside: the long axis lies across the fall, so the frontal
                 area really is width × height (3.1r × 2r) and the drag term
                 matches the shape on screen. */
              <rect
                x={-bodyR * 1.55}
                y={-bodyR}
                width={bodyR * 3.1}
                height={bodyR * 2}
                rx={bodyR}
                strokeWidth={2}
                style={{ fill: plate(0.95), stroke: ink(0.9) }}
              />
            ) : (
              <circle
                r={bodyR}
                strokeWidth={2}
                style={{ fill: plate(0.95), stroke: ink(0.9) }}
              />
            )}
          </g>
        </svg>

        <div
          className="mt-3 rounded-xl border p-3"
          style={{ borderColor: "var(--lab-line)", background: ink(0.02) }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Speed against time</p>
            <p className="apple-lab-micro">
              0 → {Math.max(1, predicted.impact).toFixed(0)} m/s
            </p>
          </div>
          <svg
            viewBox="0 0 900 80"
            preserveAspectRatio="none"
            aria-hidden
            className="mt-2 h-20 w-full"
          >
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={900}
                y1={78 - fraction * 70}
                y2={78 - fraction * 70}
                style={{ stroke: ink(0.07) }}
              />
            ))}
            <line x1={0} x2={900} y1={78} y2={78} style={{ stroke: ink(0.16) }} />
            <path
              ref={graphRef}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              style={{ stroke: AMBER }}
            />
          </svg>
        </div>

        <p className="apple-lab-note mt-4">
          {spec.blurb} {footer}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Conditions</p>
          <div className="mt-3">
            <Picker label="What you are reading" value={mode} options={modeOptions} onChange={setMode} />
          </div>
          <p className="apple-lab-note mt-2">{spec.formula}</p>
          <div className="mt-4">
            <Picker label="World" value={world} options={worldOptions} onChange={selectWorld} />
          </div>
          <div className="mt-4">
            <Range
              label="Surface gravity"
              value={gravity}
              min={0}
              max={30}
              step={0.01}
              unit="m/s²"
              format={(value) => value.toFixed(2)}
              onChange={setGravity}
            />
          </div>
          <div className="mt-4">
            <Picker label="Playback" value={playback} options={PLAYBACKS} onChange={setPlayback} />
          </div>
          <button
            type="button"
            onClick={() => setAutoRun((on) => !on)}
            data-active={autoRun}
            className="apple-lab-btn mt-3 !px-2.5 !py-1 !text-[11px]"
          >
            Auto-run {autoRun ? "on" : "off"}
          </button>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Specimen</p>
          <div className="mt-3">
            <Picker label="Shape" value={body} options={bodyOptions} onChange={setBody} />
          </div>
          <div className="mt-4">
            <Picker
              label="Material"
              value={material}
              options={materialOptions}
              onChange={setMaterial}
            />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Range
              label="Mass"
              value={mass}
              min={0.5}
              max={500}
              step={0.5}
              unit="kg"
              format={(value) => value.toFixed(1)}
              onChange={setMass}
            />
            <Range
              label="Frontal size"
              value={size}
              min={0.2}
              max={3}
              step={0.1}
              unit="m"
              format={(value) => value.toFixed(1)}
              onChange={setSize}
            />
            {mode === "drag" ? (
              <Range
                label="Release speed"
                value={release}
                min={0}
                max={40}
                step={0.5}
                unit="m/s"
                format={(value) => value.toFixed(1)}
                onChange={setRelease}
              />
            ) : null}
          </div>
          <p className="apple-lab-note mt-3">
            {specMaterial.blurb} ρ {specMaterial.density.toLocaleString()} kg/m³ · restitution{" "}
            {specMaterial.bounce.toFixed(2)} · C_d {specMaterial.cd.toFixed(2)}
          </p>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Energy audit</p>
          <div className="mt-3 flex flex-col gap-3">
            {[
              { label: "Potential", value: pe, color: AMBER },
              { label: "Kinetic", value: ke, color: CYAN },
            ].map((meter) => (
              <div key={meter.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="apple-lab-note">{meter.label}</span>
                  <span className="apple-lab-value text-[13px] font-semibold">
                    {Math.round(meter.value).toLocaleString()} J
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                  style={{ background: ink(0.1) }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct(meter.value)}%`, background: meter.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-4 flex items-baseline justify-between border-t pt-3"
            style={{ borderColor: "var(--lab-line)" }}
          >
            <span className="apple-lab-micro">Total</span>
            <span className="apple-lab-value text-[13px] font-semibold">
              {Math.round(total).toLocaleString()} J
            </span>
          </div>
          <p className="apple-lab-note mt-2">
            Air and floor took {Math.round(lost).toLocaleString()} J. Peak impact{" "}
            {snapshot.impact.toFixed(1)} m/s.
          </p>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Oracle — before you release</p>
          <p className="apple-lab-value mt-2 text-2xl font-semibold">
            {Number.isFinite(predicted.time) ? predicted.impact.toFixed(2) : "—"}
            <span className="ml-1.5 text-[11px] font-medium text-[var(--lab-ink-dim)]">
              m/s at the floor
            </span>
          </p>
          <p className="apple-lab-note mt-1">
            {Number.isFinite(predicted.time)
              ? `after ${predicted.time.toFixed(2)} s. The closed form √(u² + 2gh) reads ${analytic.toFixed(2)} m/s; air is the difference.`
              : "nothing falls in free space without a push."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Readout label="Frontal area" value={`${area.toFixed(2)} m²`} />
            <Readout label="Air density" value={`${rho.toFixed(3)} kg/m³`} />
          </div>
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
