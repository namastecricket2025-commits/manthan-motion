import { Range } from "@/components/lab/bench-atoms";
import { useStillMotion } from "@/lib/motion";
import { useAnimationFrame } from "motion/react";
import { Box, Play, RotateCcw, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import NerveModelView from "./NerveModelView";

/**
 * The nervous system plate.
 *
 * Every other biology plate answers "what is this made of". This one answers
 * "what does it do, and how fast": press Fire and an impulse runs the neuron
 * from dendrite to synapse, or runs the reflex loop from skin to muscle. The
 * route is a real SVG path and the dot is `getPointAtLength` along it, so the
 * signal cannot drift off the fibre it is supposed to be travelling on.
 *
 * Both figures are drawn as plates rather than as icons. The neuron is a
 * tapering dendritic arbor, an axon hillock, a segmented sheath and a terminal
 * arbor of five boutons; the reflex is a skin section, a dorsal root ganglion,
 * a spinal-cord cross-section with its own butterfly of grey matter, and a
 * muscle spindle. Numbers sit on leaders, the way they would on a printed
 * figure, and the notes beside them use the space a real figure leaves for
 * prose: the questions the drawing raises are answered in type, not in boxes.
 *
 * The one number that is not drawn to scale is time: a myelinated axon carries
 * an impulse at 120 m/s and a bare one at 2 m/s, so the animation is compressed
 * to a second or two and the *readout* carries the true latency. Myelinated
 * travel is stepped between nodes, because that is what saltatory conduction
 * looks like — the impulse is rebuilt at the gaps, not carried under the
 * sheath.
 *
 * The impulse is the only warm colour on the plate. Everything structural is
 * ink at three weights, which is what keeps a moving amber dot legible without
 * turning the bench into a light show.
 */

const W = 760;
const H = 432;

const INK = "var(--lab-ink)";
const SIGNAL = "var(--lab-diagram-amber)";

const ink = (alpha: number) =>
  `color-mix(in srgb, var(--lab-ink) ${Math.round(alpha * 100)}%, transparent)`;

type Mode = "neuron" | "reflex";

/* The route the impulse follows. It starts on a dendrite, passes through the
   soma, runs the axon and ends on a bouton — the visible fibres are drawn
   separately so each can be dimmed on its own. */
const NEURON_ROUTE =
  "M 96 150 C 136 164 176 190 204 228 L 250 228 L 596 228 C 624 224 648 204 664 186";
const REFLEX_ROUTE =
  "M 104 288 C 132 250 186 196 250 176 C 296 164 330 158 356 158 C 372 156 382 172 386 190 C 394 214 410 238 430 246 C 448 262 462 280 478 290 C 506 302 548 300 576 294 L 602 292";

type Part = { id: string; label: string; note: string };

const NEURON_PARTS: Part[] = [
  {
    id: "dendrites",
    label: "Dendrites",
    note: "The receiving branches. A single neuron can carry thousands of them, and each one collects a small input from another cell. They taper as they divide, which is why the tips are the thinnest strokes on the plate.",
  },
  {
    id: "soma",
    label: "Cell body",
    note: "The soma adds up every input arriving at the dendrites. If the total crosses the threshold, the neuron fires — all of it, or none of it. The nucleus sits inside, and the axon leaves from the cone-shaped hillock on its right.",
  },
  {
    id: "axon",
    label: "Axon",
    note: "One long fibre leaving the soma. The impulse travels down it without fading, because the membrane rebuilds the signal as it goes. The first stretch is bare even when the rest is myelinated.",
  },
  {
    id: "myelin",
    label: "Myelin sheath",
    note: "Fatty insulation wrapped around the axon. The membrane under it cannot fire, so the impulse is rebuilt only at the gaps — up to sixty times faster than a bare fibre, for the same fibre and the same distance.",
  },
  {
    id: "node",
    label: "Node of Ranvier",
    note: "A bare gap between two myelin sheaths. The signal is regenerated here at full amplitude, so the jump between nodes loses nothing. The gaps are spaced by the sheath, not by the impulse.",
  },
  {
    id: "synapse",
    label: "Synapse",
    note: "The junction with the next cell. There is a gap here, so the electrical impulse becomes a chemical message and then becomes electrical again. One axon branches to make many of these contacts, not one.",
  },
];

const REFLEX_PARTS: Part[] = [
  {
    id: "receptor",
    label: "Receptor",
    note: "Free nerve endings in the skin. The twigs drawn here are branches of one ending, not separate sensors. They respond to a stimulus strong enough to threaten tissue and start an impulse — the input end of the loop, and the one place on the fibre that is bare.",
  },
  {
    id: "ganglion",
    label: "Dorsal root ganglion",
    note: "The swelling on the incoming fibre. Sensory neurons keep their cell bodies out here, not inside the cord, and their fibre runs unbroken from skin to spinal cord — so no synapse is needed on the way in.",
  },
  {
    id: "sensory",
    label: "Sensory neuron",
    note: "Carries the impulse inward to the dorsal horn of the cord. It is a single fibre with its cell body in the ganglion, which is why the signal reaches the cord without being relayed first.",
  },
  {
    id: "cord",
    label: "Spinal cord",
    note: "The relay. Its own interneuron connects the incoming fibre straight to the outgoing one, inside the butterfly of grey matter. The brain is informed afterwards, not asked first.",
  },
  {
    id: "motor",
    label: "Motor neuron",
    note: "Carries the answer back out through the ventral root to the muscle, on the opposite side of the cord from the incoming signal. Its cell body sits inside the grey matter, unlike the sensory neuron's.",
  },
  {
    id: "muscle",
    label: "Muscle",
    note: "Contracts. By the time the brain registers the pain, the hand has already moved — which is the entire point of a reflex. The spindle shortens a little when the impulse lands.",
  },
];

/** Route length, fibre speed and the number of synapses it has to cross. */
function routeOf(mode: Mode) {
  return mode === "neuron"
    ? { metres: 1, synapses: 1 }
    : { metres: 1.4, synapses: 3 };
}

const SYNAPSE_MS = 0.7;

function latency(mode: Mode, myelinated: boolean) {
  const { metres, synapses } = routeOf(mode);
  const speed = myelinated ? 120 : 2;
  return (metres / speed) * 1000 + synapses * SYNAPSE_MS;
}

/**
 * Saltatory travel: the impulse rests at a node, hops to the next, rests
 * again. `p` is progress along the myelinated stretch, `nodes` the number of
 * hops. The 14% hold at each end is what makes the jump read as a jump rather
 * than as a stutter.
 */
function hop(p: number, nodes: number) {
  const span = 1 / nodes;
  const index = Math.min(nodes - 1, Math.floor(p / span));
  const local = (p - index * span) / span;
  const eased =
    local < 0.14 ? 0 : local > 0.72 ? 1 : (local - 0.14) / 0.58;
  return (index + eased) / nodes;
}

/**
 * A dendritic arbor, generated once at module load. Hand-drawing sixty
 * branches produces either a starburst or a scribble; a seeded generator with
 * a taper gives the same figure on every load and reads like a real cell.
 */
type Stroke = { d: string; w: number; o: number };

function growArbor(cx: number, cy: number): Stroke[] {
  let seed = 0x5eed;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out: Stroke[] = [];

  const grow = (
    x: number,
    y: number,
    angle: number,
    len: number,
    width: number,
    opacity: number,
    depth: number,
  ) => {
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    const bend = (rnd() - 0.5) * len * 0.55;
    const mx = (x + nx) / 2 - Math.sin(angle) * bend;
    const my = (y + ny) / 2 + Math.cos(angle) * bend;
    out.push({
      d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`,
      w: width,
      o: opacity,
    });
    if (depth === 0) return;
    const children = depth === 3 ? 2 : rnd() > 0.72 ? 3 : 2;
    for (let i = 0; i < children; i += 1) {
      const spread = 0.3 + rnd() * 0.22;
      grow(
        nx,
        ny,
        angle + (i - (children - 1) / 2) * spread + (rnd() - 0.5) * 0.14,
        len * (0.6 + rnd() * 0.16),
        Math.max(0.55, width * 0.64),
        opacity * 0.82,
        depth - 1,
      );
    }
  };

  [116, 144, 172, 200, 228, 256].forEach((degrees) => {
    const angle = (degrees * Math.PI) / 180;
    grow(
      cx + Math.cos(angle) * 30,
      cy + Math.sin(angle) * 32,
      angle,
      42 + rnd() * 9,
      2,
      0.5,
      3,
    );
  });

  return out;
}

const ARBOR = growArbor(206, 228);

/** Five sheaths, each 46 long, leaving a 24-unit node between them. */
const MYELIN_SEGMENTS = [262, 332, 402, 472, 542].map((x) => ({ x }));

const NEURON_QUESTIONS = [
  {
    q: "Why does the impulse appear to jump?",
    a: "Myelin is a sheath the membrane cannot fire through. The impulse is rebuilt only at the bare gaps between sheaths, so it crosses each insulated stretch in one step. Remove the sheath and every patch of membrane has to fire in turn: 2 m/s instead of 120.",
  },
  {
    q: "Why five terminal boutons?",
    a: "One axon ends in a terminal arbor — often hundreds of boutons, each on a different cell. Five are drawn. The count is a choice of the drawing, not a property of the neuron, and the same is true of the number of sheaths.",
  },
  {
    q: "Does the signal weaken on the way?",
    a: "No. It is not a current leaking along a wire: each node rebuilds the impulse at full amplitude. All-or-none applies to the whole length, which is why a metre of axon delivers what it started with.",
  },
  {
    q: "Why is the animation not real time?",
    a: "A metre of myelinated axon takes about nine milliseconds. At real speed the dot would be gone before you saw it, so the travel is slowed down and the real time is carried in the panel.",
  },
  {
    q: "Why is the bare fibre so much slower?",
    a: "Not because the current runs slower, but because every patch of membrane along it has to fire in turn: the impulse is rebuilt step by step for the whole metre. Myelin skips all of it except the gaps, so the same metre takes 8 ms instead of 500.",
  },
];

const REFLEX_QUESTIONS = [
  {
    q: "Why doesn't the brain decide?",
    a: "The whole circuit sits in the cord: sensory fibre, interneuron, motor fibre. It answers in about fourteen milliseconds. The copy sent up to the brain arrives after the hand has already moved.",
  },
  {
    q: "Why is there a swelling on the sensory fibre?",
    a: "That is the dorsal root ganglion, where sensory neurons keep their cell bodies — outside the cord. Their fibre runs unbroken from skin to cord, so the signal is not relayed on the way in.",
  },
  {
    q: "What does myelin buy a reflex?",
    a: "Time: about fourteen milliseconds instead of seven hundred. The loop still works without it, but slowly — demyelinating disease slows exactly this, and the reflex that protects you arrives late.",
  },
  {
    q: "Why only one muscle?",
    a: "A withdrawal uses a handful of muscles and relaxes their opposites. One spindle is drawn; the circuit is the same for every one of them, and the brain recruits the rest afterwards.",
  },
  {
    q: "Are those twigs three separate sensors?",
    a: "No. They are branches of one free nerve ending, drawn apart so the branching is visible. A single sensory neuron samples its patch of skin through many such twigs, and all of them report up the same fibre.",
  },
  {
    q: "Why does the dot pause at the cord?",
    a: "Because each synapse costs time. The signal stops being electrical, crosses a gap as a chemical, and starts again on the next cell — about 0.7 ms each, and this loop has three of them.",
  },
];

export function NerveStage({ label, blurb }: { label: string; blurb: string }) {
  const still = useStillMotion();
  const [mode, setMode] = useState<Mode>("neuron");
  const [myelin, setMyelin] = useState(true);
  const [stimulus, setStimulus] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [fired, setFired] = useState(false);
  const [progress, setProgress] = useState(0);
  /* The same instant, before the plate's saltatory stepping is applied. The 3D
     model has its own internode boundaries, so it steps its own copy. */
  const [phase, setPhase] = useState(0);
  const [view, setView] = useState<"plate" | "model">("plate");
  const [pulse, setPulse] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const routeRef = useRef<SVGPathElement | null>(null);
  const lengthRef = useRef(0);
  const startedAt = useRef(0);
  const [routeLength, setRouteLength] = useState(0);
  /* Where the axon starts and ends on the route, as fractions of its length.
     Myelinated travel is stepped inside this window only: the dendrites and
     the terminal arbor are not insulated. */
  const axonSpan = useRef({ a: 0, b: 1 });

  const parts = mode === "neuron" ? NEURON_PARTS : REFLEX_PARTS;
  const part = parts.find((entry) => entry.id === selected) ?? null;
  const route = mode === "neuron" ? NEURON_ROUTE : REFLEX_ROUTE;
  const questions = mode === "neuron" ? NEURON_QUESTIONS : REFLEX_QUESTIONS;

  const { metres, synapses } = routeOf(mode);
  const ms = latency(mode, myelin);
  const fastMs = latency(mode, true);
  /* How far the bare fibre gets in the time the myelinated one arrives. */
  const bareCover = (metres / 120) * 2;

  useEffect(() => {
    setFiring(false);
    setFired(false);
    setProgress(0);
    setPhase(0);
    setPulse(null);
    setNote(null);
    setSelected(null);
  }, [mode]);

  useEffect(() => {
    const path = routeRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    lengthRef.current = total;
    setRouteLength(total);

    if (mode === "neuron") {
      let a = 0;
      let b = total;
      for (let d = 0; d <= total; d += 2) {
        const point = path.getPointAtLength(d);
        if (!a && point.x >= 252 && Math.abs(point.y - 228) < 4) a = d;
        if (point.x >= 596) {
          b = d;
          break;
        }
      }
      axonSpan.current = { a: a || total * 0.28, b };
    } else {
      axonSpan.current = { a: 0, b: total };
    }
  }, [mode, route]);

  const fire = () => {
    if (firing) return;
    if (stimulus < 3) {
      setNote(
        "No impulse — the stimulus is below threshold. A neuron fires all of it, or not at all.",
      );
      setFired(false);
      setProgress(0);
      setPulse(null);
      return;
    }
    setNote(null);
    setFired(false);
    setProgress(0);
    if (!routeLength) return;
    if (still) {
      const path = routeRef.current;
      if (path) {
        const end = path.getPointAtLength(routeLength);
        setPulse({ x: end.x, y: end.y });
      }
      setProgress(1);
      setPhase(1);
      setFired(true);
      return;
    }
    startedAt.current = performance.now();
    setFiring(true);
  };

  useAnimationFrame(() => {
    if (!firing) return;
    const duration =
      mode === "reflex" ? (myelin ? 1.4 : 2.9) : myelin ? 1.2 : 2.7;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const next = Math.min(1, elapsed / duration);
    const path = routeRef.current;
    const total = lengthRef.current;

    /* Time → distance. With myelin the distance is stepped along the axon. */
    let travelled = next;
    if (myelin && mode === "neuron" && total) {
      const { a, b } = axonSpan.current;
      const from = a / total;
      const to = b / total;
      if (next > from && next < to) {
        travelled = from + (to - from) * hop((next - from) / (to - from), 5);
      }
    }

    if (path && total) {
      const point = path.getPointAtLength(total * travelled);
      setPulse({ x: point.x, y: point.y });
    }
    setProgress(travelled);
    setPhase(next);
    if (next >= 1) {
      setFiring(false);
      setFired(true);
    }
  });

  const reset = () => {
    setFiring(false);
    setFired(false);
    setProgress(0);
    setPhase(0);
    setPulse(null);
    setNote(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Nervous system plates"
        >
          {(
            [
              { id: "neuron", label: "Neuron" },
              { id: "reflex", label: "Reflex arc" },
            ] as Array<{ id: Mode; label: string }>
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={mode === entry.id}
              data-active={mode === entry.id}
              className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]"
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--lab-line)]" aria-hidden="true" />
          <button
            type="button"
            className="apple-lab-btn !px-2.5 !py-1.5 !text-[11px]"
            data-active={view === "plate"}
            aria-pressed={view === "plate"}
            onClick={() => setView("plate")}
          >
            Plate
          </button>
          <button
            type="button"
            className="apple-lab-btn !px-2.5 !py-1.5 !text-[11px]"
            data-active={view === "model"}
            aria-pressed={view === "model"}
            onClick={() => setView("model")}
          >
            <Box className="h-3 w-3" />
            3D
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="apple-lab-btn apple-lab-btn--solid"
            onClick={fire}
            disabled={firing}
          >
            <Play className="h-3.5 w-3.5" />
            {firing ? "Firing…" : "Fire"}
          </button>
          <button
            type="button"
            className="apple-lab-btn"
            data-active={myelin}
            aria-pressed={myelin}
            onClick={() => {
              setMyelin((value) => !value);
              reset();
            }}
          >
            Myelin {myelin ? "on" : "off"}
          </button>
          <button
            type="button"
            className="apple-lab-btn"
            onClick={reset}
            aria-label="Reset the signal"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="apple-lab-card relative overflow-hidden p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="apple-lab-title truncate text-[13px]">{label}</p>
              <p className="truncate text-[11px] text-[var(--lab-ink-dim)]">
                {blurb}
              </p>
            </div>
            <span className="apple-lab-chip shrink-0 !gap-1.5">
              <Zap className="h-3 w-3" style={{ color: SIGNAL }} />
              {firing ? "Travelling" : fired ? "Delivered" : "Idle"}
            </span>
          </div>

          {view === "model" ? (
            <NerveModelView
              mode={mode}
              myelin={myelin}
              phase={phase}
              fired={fired}
            />
          ) : (
          <div className="relative overflow-hidden rounded-xl border border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-ink)_2%,transparent)]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block w-full"
              role="group"
              aria-label={`${mode === "neuron" ? "Neuron" : "Reflex arc"}, fired at stimulus ${stimulus} of 5`}
            >
              <path ref={routeRef} d={route} fill="none" stroke="none" />

              {mode === "neuron" ? (
                <NeuronDrawing
                  myelin={myelin}
                  selected={selected}
                  onSelect={setSelected}
                  fired={fired}
                />
              ) : (
                <ReflexDrawing
                  myelin={myelin}
                  selected={selected}
                  onSelect={setSelected}
                  fired={fired}
                />
              )}

              {/* The trail: the same route, revealed by dash length. It sits
                  under the dot and over the fibres. Saltatory travel makes it
                  appear in lengths rather than as one growing line. */}
              {progress > 0 ? (
                <path
                  d={route}
                  fill="none"
                  stroke={SIGNAL}
                  strokeOpacity={0.5}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeDasharray={`${routeLength * progress} ${routeLength}`}
                />
              ) : null}
              {pulse ? (
                <g>
                  <circle cx={pulse.x} cy={pulse.y} r={13} fill={SIGNAL} opacity={0.12} />
                  <circle cx={pulse.x} cy={pulse.y} r={4.2} fill={SIGNAL} />
                </g>
              ) : null}
            </svg>
          </div>
          )}

          <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-[var(--lab-ink-micro)]">
            {view === "model"
              ? mode === "neuron"
                ? "Modelled cell: nucleus, nucleolus and Nissl bodies in the soma, a dendrite arbor that tapers at every fork, six myelin internodes with their Schwann cells, and seven boutons on the next membrane. Turn it, and the impulse jumps node to node."
                : "A real Human Reference Atlas cord segment (NIH 3D) with the grey-matter butterfly inside it; skin, the branched ending, the dorsal-root ganglion, the rootlets, the motor fibre and one muscle are modelled around it. Everything you see completing, completes inside the cord."
              : mode === "neuron"
                ? "Drawn flat and not to scale: five sheaths, five boutons, one axon. Time in the panel is real; the travel is slowed so you can see it."
                : "The loop completes inside the cord. Nothing on this plate waits for the brain, and the drawing is a schematic — one muscle of the several a withdrawal uses."}
          </p>

          {/* The questions the figure raises, answered where a plate would
              leave its notes: plain text, hairline rules, no callout boxes. */}
          <div className="mt-2.5 border-t border-[var(--lab-line-soft)] px-1 pt-2.5">
            <p className="apple-lab-micro">
              Questions this {view === "model" ? "model" : "plate"} invites
            </p>
            <div className="mt-2 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
              {questions.map((entry) => (
                <div key={entry.q}>
                  <p className="text-[11.5px] font-semibold text-[var(--lab-ink)]">
                    {entry.q}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    {entry.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <section className="apple-lab-card p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="apple-lab-micro">Signal</p>
              <span className="text-[10.5px] text-[var(--lab-ink-micro)]">real time</span>
            </div>

            <div className="mt-2 flex flex-col">
              <Reading
                label="Route"
                value={mode === "neuron" ? "1.0 m axon" : "1.4 m loop"}
              />
              <Reading label="Conduction" value={myelin ? "120 m/s" : "2 m/s"} />
              <Reading
                label="Synapses"
                value={`${synapses} × ${SYNAPSE_MS} ms`}
              />
              <Reading
                label={mode === "neuron" ? "Travel time" : "Response time"}
                value={`≈ ${Math.round(ms)} ms`}
              />
            </div>

            {/* The whole point of the toggle. The two bars share one instant,
                so the 60× gap is visible as a sliver rather than asserted in
                a sentence. */}
            <div className="mt-3 border-t border-[var(--lab-line-soft)] pt-3">
              <p className="apple-lab-micro">Same instant</p>
              <div className="mt-2 flex flex-col gap-2">
                <CoverRow
                  label="Myelinated"
                  detail="120 m/s"
                  value={`${metres.toFixed(1)} m`}
                  fill={1}
                  active={myelin}
                />
                <CoverRow
                  label="Bare"
                  detail="2 m/s"
                  value={`${bareCover.toFixed(2)} m`}
                  fill={bareCover / metres}
                  active={!myelin}
                />
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--lab-ink-micro)]">
                In the {Math.round(fastMs)} ms the myelinated impulse needs, the
                bare fibre covers {Math.round(bareCover * 100)} cm of the same
                route. Myelin is not a faster cable; it stops the membrane under
                the sheath from firing, so the impulse is rebuilt only at the
                gaps.
              </p>
            </div>

            <div className="mt-3 border-t border-[var(--lab-line-soft)] pt-3">
              <Range
                label="Stimulus"
                value={stimulus}
                min={1}
                max={5}
                step={1}
                unit="/ 5"
                onChange={(value) => {
                  setStimulus(value);
                  setNote(null);
                }}
              />
              <p
                className="mt-2 min-h-[2.6rem] text-[11px] leading-relaxed"
                style={{ color: note ? SIGNAL : "var(--lab-ink-dim)" }}
              >
                {note ??
                  (stimulus < 3
                    ? "Below threshold: the membrane will not reach an action potential, and nothing is sent."
                    : fired
                      ? mode === "neuron"
                        ? "Impulse delivered to the synapse."
                        : "Impulse delivered. The muscle has already contracted."
                      : "Threshold is 3. Below it, nothing fires.")}
              </p>
            </div>
          </section>

          <section className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">Structures</p>
            <div className="mt-2 flex flex-col gap-0.5">
              {parts.map((entry, index) => {
                const active = selected === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(active ? null : entry.id)}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors"
                    style={{
                      background: active ? ink(0.07) : "transparent",
                      color: active ? "var(--lab-ink)" : "var(--lab-ink-dim)",
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-semibold"
                      style={{
                        borderColor: active ? ink(0.4) : ink(0.2),
                        color: "var(--lab-ink)",
                      }}
                    >
                      {index + 1}
                    </span>
                    {entry.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 border-t border-[var(--lab-line-soft)] pt-2.5">
              {part ? (
                <>
                  <p className="text-[12px] font-semibold text-[var(--lab-ink)]">
                    {part.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    {part.note}
                  </p>
                </>
              ) : (
                <p className="text-[11px] leading-relaxed text-[var(--lab-ink-micro)]">
                  {view === "model"
                    ? "Pick a structure above for the note it carries in the figure. The model is the same cell from the other side of the same fact."
                    : "Pick a numbered marker on the plate, or a structure above. The notes below the plate answer what the drawing itself does not."}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--lab-line-soft)] py-1.5 text-[11.5px] last:border-0">
      <span className="text-[var(--lab-ink-dim)]">{label}</span>
      <span className="apple-lab-value font-semibold">{value}</span>
    </div>
  );
}

function CoverRow({
  label,
  detail,
  value,
  fill,
  active,
}: {
  label: string;
  detail: string;
  value: string;
  fill: number;
  active: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
        <span
          style={{ color: active ? "var(--lab-ink)" : "var(--lab-ink-micro)" }}
        >
          {label}
        </span>
        <span
          className="apple-lab-value text-[10.5px]"
          style={{ color: active ? "var(--lab-ink)" : "var(--lab-ink-micro)" }}
        >
          {value}
        </span>
      </div>
      <div className="mt-1 flex h-[3px] w-full overflow-hidden rounded-full bg-[var(--lab-line-soft)]">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.max(fill * 100, 2)}%`,
            background: active ? "var(--lab-ink-dim)" : "var(--lab-line)",
          }}
        />
      </div>
      <p className="mt-0.5 text-[9.5px] tracking-[0.02em] text-[var(--lab-ink-micro)]">
        {detail}
      </p>
    </div>
  );
}

/* The figures ------------------------------------------------------- */

function Marker({
  x,
  y,
  n,
  active,
  onSelect,
  label,
  tx,
  ty,
}: {
  x: number;
  y: number;
  n: number;
  active: boolean;
  onSelect: () => void;
  label: string;
  tx?: number;
  ty?: number;
}) {
  return (
    <g
      className="nerve-marker"
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={active}
      style={{ cursor: "pointer", outline: "none" }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {tx !== undefined && ty !== undefined ? (
        <line
          x1={x}
          y1={y}
          x2={tx}
          y2={ty}
          stroke={INK}
          strokeOpacity={active ? 0.5 : 0.24}
          strokeWidth={1}
        />
      ) : null}
      <circle cx={x} cy={y} r={16} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={10}
        fill={active ? ink(0.14) : "var(--lab-canvas)"}
        stroke={active ? ink(0.72) : ink(0.28)}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + 3.4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={INK}
        style={{ userSelect: "none" }}
      >
        {n}
      </text>
    </g>
  );
}

/** A part that can be dimmed when another part is in focus. */
function Group({ dim, children }: { dim: boolean; children: ReactNode }) {
  return <g opacity={dim ? 0.32 : 1}>{children}</g>;
}

/** Small caps used for the anatomy labels inside the drawing. */
function PlateLabel({
  x,
  y,
  children,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize="8.6"
      letterSpacing="1.3"
      fill={INK}
      fillOpacity={0.34}
    >
      {children}
    </text>
  );
}

function NeuronDrawing({
  myelin,
  selected,
  onSelect,
  fired,
}: {
  myelin: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  fired: boolean;
}) {
  const dim = (id: string) => Boolean(selected) && selected !== id;
  const pick = (id: string) => () => onSelect(selected === id ? null : id);

  return (
    <g>
      {/* Dendrites. The arbor hangs off the left of the soma, so the axon has
          the right half of the plate to itself. */}
      <Group dim={dim("dendrites")}>
        {ARBOR.map((branch, index) => (
          <path
            key={index}
            d={branch.d}
            fill="none"
            stroke={INK}
            strokeOpacity={branch.o}
            strokeWidth={branch.w}
            strokeLinecap="round"
          />
        ))}
      </Group>

      {/* Axon hillock: the cone the fibre leaves from. */}
      <Group dim={dim("axon")}>
        <path
          d="M 232 208 C 244 212 250 220 256 226 L 256 230 C 250 236 244 244 234 248 Z"
          fill={INK}
          fillOpacity={0.13}
          stroke={INK}
          strokeOpacity={0.4}
          strokeWidth={1}
        />
      </Group>

      {/* Myelin sheaths as five segments rather than a dashed line: each has an
          edge and a Schwann-cell nucleus, and the gaps between them are the
          nodes. Stripped, the ghost outlines stay, so "off" reads as removed
          insulation on the same fibre. */}
      <Group dim={dim("myelin")}>
        {MYELIN_SEGMENTS.map((segment, index) => (
          <g key={segment.x}>
            <rect
              x={segment.x}
              y={220}
              width={46}
              height={16}
              rx={8}
              fill={INK}
              fillOpacity={myelin ? 0.09 : 0.015}
              stroke={INK}
              strokeOpacity={myelin ? 0.34 : 0.1}
              strokeWidth={1.1}
            />
            {myelin ? (
              <ellipse
                cx={segment.x + 23}
                cy={233.4}
                rx={4.6}
                ry={2.2}
                fill={INK}
                fillOpacity={0.2 + index * 0.015}
              />
            ) : null}
          </g>
        ))}
      </Group>

      {/* The fibre itself. It is visible between the sheaths: those gaps are
          the nodes, and the only places the membrane can fire. */}
      <Group dim={dim("axon")}>
        <line
          x1={250}
          y1={228}
          x2={600}
          y2={228}
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={myelin ? 2.4 : 1.6}
        />
      </Group>

      {/* Soma, over the arbor stubs so the branches attach to the cell body. */}
      <Group dim={dim("soma")}>
        <path
          d="M 236 204 C 246 214 250 224 246 238 C 242 254 228 266 212 266 C 194 266 178 254 172 238 C 166 222 172 206 186 198 C 200 190 224 192 236 204 Z"
          fill={INK}
          fillOpacity={0.04}
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />
        <ellipse
          cx={206}
          cy={226}
          rx={15}
          ry={14}
          fill={INK}
          fillOpacity={0.07}
          stroke={INK}
          strokeOpacity={0.28}
          strokeWidth={1}
        />
        <circle cx={212} cy={222} r={3.2} fill={INK} fillOpacity={0.28} />
        {/* Nissl bodies: the rough endoplasmic reticulum that makes a neuron's
            cytoplasm look grainy under a microscope. */}
        <g fill={INK} fillOpacity={0.22}>
          <ellipse cx={195} cy={232} rx={2.6} ry={1.5} transform="rotate(20 195 232)" />
          <ellipse cx={201} cy={240} rx={2.2} ry={1.4} transform="rotate(-14 201 240)" />
          <ellipse cx={216} cy={236} rx={2.4} ry={1.4} transform="rotate(10 216 236)" />
          <ellipse cx={223} cy={228} rx={1.9} ry={1.3} transform="rotate(-24 223 228)" />
        </g>
      </Group>

      {/* Terminal arbor. One axon, five contacts — the count is illustrative,
          and the plate's note says so. */}
      <Group dim={dim("synapse")}>
        <path
          d="M 596 228 C 616 222 638 202 656 186"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 596 228 C 620 222 648 212 676 204"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 596 228 C 626 228 656 228 686 228"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 596 228 C 620 234 648 244 676 252"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 596 228 C 616 234 638 254 656 270"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        {[
          { x: 656, y: 186 },
          { x: 676, y: 204 },
          { x: 686, y: 228 },
          { x: 676, y: 252 },
          { x: 656, y: 270 },
        ].map((bouton, index) => (
          <g key={`${bouton.x}-${bouton.y}`}>
            <ellipse
              cx={bouton.x}
              cy={bouton.y}
              rx={6.2}
              ry={5}
              fill={INK}
              fillOpacity={0.3}
              stroke={INK}
              strokeOpacity={0.52}
              strokeWidth={1}
            />
            {/* Vesicles, on the bouton that sits nearest the next cell. */}
            {index === 2 ? (
              <g fill={INK} fillOpacity={0.55}>
                <circle cx={bouton.x - 2} cy={bouton.y - 1.6} r={0.95} />
                <circle cx={bouton.x + 1.4} cy={bouton.y - 1.1} r={0.95} />
                <circle cx={bouton.x - 0.4} cy={bouton.y + 1.8} r={0.95} />
                <circle cx={bouton.x + 2.2} cy={bouton.y + 1.2} r={0.8} />
              </g>
            ) : null}
          </g>
        ))}

        {/* The postsynaptic membrane, across the cleft. It is the only line on
            the plate that changes when the impulse arrives. */}
        <path
          d="M 702 164 C 716 194 716 260 702 290"
          fill="none"
          stroke={INK}
          strokeOpacity={fired ? 0.42 : 0.18}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Group>

      <PlateLabel x={716} y={320} anchor="end">
        next cell
      </PlateLabel>

      <Marker x={96} y={100} n={1} label="Dendrites" active={selected === "dendrites"} onSelect={pick("dendrites")} tx={124} ty={140} />
      <Marker x={158} y={326} n={2} label="Cell body" active={selected === "soma"} onSelect={pick("soma")} tx={192} ty={264} />
      <Marker x={520} y={290} n={3} label="Axon" active={selected === "axon"} onSelect={pick("axon")} tx={530} ty={236} />
      <Marker x={350} y={158} n={4} label="Myelin sheath" active={selected === "myelin"} onSelect={pick("myelin")} tx={350} ty={218} />
      <Marker x={398} y={300} n={5} label="Node of Ranvier" active={selected === "node"} onSelect={pick("node")} tx={390} ty={231} />
      <Marker x={696} y={134} n={6} label="Synapse" active={selected === "synapse"} onSelect={pick("synapse")} tx={664} ty={180} />
    </g>
  );
}

function ReflexDrawing({
  myelin,
  selected,
  onSelect,
  fired,
}: {
  myelin: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  fired: boolean;
}) {
  const dim = (id: string) => Boolean(selected) && selected !== id;
  const pick = (id: string) => () => onSelect(selected === id ? null : id);

  const sensory =
    "M 104 288 C 132 250 186 196 250 176 C 296 164 330 158 356 158";
  const motor =
    "M 438 250 C 450 264 462 278 476 288 C 506 302 546 300 576 294 L 602 292";

  return (
    <g>
      {/* Skin, in section: two lines for epidermis and dermis, with the free
          nerve endings inside. */}
      <Group dim={dim("receptor")}>
        <path
          d="M 82 178 C 58 228 58 322 82 374 L 118 360 C 98 312 98 236 118 190 Z"
          fill={INK}
          fillOpacity={0.035}
          stroke={INK}
          strokeOpacity={0.42}
          strokeWidth={1.4}
        />
        {/* Epidermis as its own band, with the dermo-epidermal junction drawn
            as interlocking papillae — that boundary is why a blister lifts the
            whole epidermis and leaves the dermis behind. */}
        <path
          d="M 82 178 C 58 228 58 322 82 374 L 92 368 C 70 312 70 236 92 184 Z"
          fill={INK}
          fillOpacity={0.07}
          stroke={INK}
          strokeOpacity={0.26}
          strokeWidth={0.9}
        />
        <g stroke={INK} strokeOpacity={0.2} strokeWidth={0.9}>
          <line x1={81} y1={218} x2={87} y2={218} />
          <line x1={78} y1={246} x2={84} y2={246} />
          <line x1={77} y1={275} x2={83} y2={275} />
          <line x1={78} y1={304} x2={84} y2={304} />
          <line x1={81} y1={332} x2={87} y2={332} />
        </g>
        <path
          d="M 105 198 C 89 240 89 312 105 354"
          fill="none"
          stroke={INK}
          strokeOpacity={0.14}
          strokeWidth={1}
        />
        {/* The stimulus, drawn as what it is: something touching the skin. */}
        <g>
          <line x1={24} y1={288} x2={56} y2={288} stroke={INK} strokeOpacity={0.42} strokeWidth={1.2} />
          <path d="M 51 284.2 L 58 288 L 51 291.8 Z" fill={INK} fillOpacity={0.45} />
        </g>
        <path
          d="M 104 288 C 96 272 90 266 82 262"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <path
          d="M 104 288 C 96 294 90 302 82 308"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <path
          d="M 104 288 C 100 266 98 250 90 240"
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        {/* Two more twigs, fanning the other way: the ending samples a patch
            of skin through many of these, not through one wire. */}
        <path
          d="M 104 288 C 106 306 110 316 112 324"
          fill="none"
          stroke={INK}
          strokeOpacity={0.4}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        <path
          d="M 104 288 C 108 274 112 264 114 256"
          fill="none"
          stroke={INK}
          strokeOpacity={0.4}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        {[
          { x: 82, y: 262 },
          { x: 82, y: 308 },
          { x: 90, y: 240 },
          { x: 112, y: 324 },
          { x: 114, y: 256 },
        ].map((tip) => (
          <circle key={`${tip.x}-${tip.y}`} cx={tip.x} cy={tip.y} r={1.8} fill={INK} fillOpacity={0.42} />
        ))}
      </Group>

      <PlateLabel x={20} y={276} anchor="start">
        STIMULUS
      </PlateLabel>
      <PlateLabel x={120} y={352} anchor="start">
        ONE BRANCHED ENDING
      </PlateLabel>

      {/* Sensory fibre: myelinated right up to the endings, with the cell body
          in the dorsal root ganglion. */}
      <Group dim={dim("sensory")}>
        {myelin ? (
          <path
            d={sensory}
            fill="none"
            stroke={INK}
            strokeOpacity={0.16}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray="40 26"
            strokeDashoffset={40}
          />
        ) : null}
        <path
          d={sensory}
          fill="none"
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={myelin ? 2 : 1.5}
          strokeLinecap="round"
        />
      </Group>

      <Group dim={dim("ganglion")}>
        <ellipse
          cx={300}
          cy={166}
          rx={17}
          ry={11}
          transform="rotate(-9 300 166)"
          fill="var(--lab-canvas)"
          stroke={INK}
          strokeOpacity={0.45}
          strokeWidth={1.2}
        />
        <circle cx={300} cy={166} r={4.6} fill={INK} fillOpacity={0.1} stroke={INK} strokeOpacity={0.3} strokeWidth={0.9} />
      </Group>

      {/* Spinal cord, in cross-section: white matter outside, the butterfly of
          grey matter inside, and the central canal at its waist. */}
      <Group dim={dim("cord")}>
        <ellipse
          cx={406}
          cy={214}
          rx={63}
          ry={115}
          fill="none"
          stroke={INK}
          strokeOpacity={0.14}
          strokeWidth={1}
        />
        <ellipse
          cx={406}
          cy={214}
          rx={59}
          ry={111}
          fill={INK}
          fillOpacity={0.028}
          stroke={INK}
          strokeOpacity={0.34}
          strokeWidth={1.3}
        />
        {/* The butterfly of grey matter: two dorsal horns above, two broad
            ventral horns below, joined by the commissure around the canal. */}
        <path
          d="M 406 222 C 399 208 393 190 388 172 C 384 158 380 146 374 144 C 366 142 366 156 370 168 C 376 186 381 202 381 216 C 379 228 368 240 358 252 C 352 262 354 274 368 272 C 384 270 396 254 402 238 C 403 236 405 236 406 238 C 410 254 424 270 442 270 C 454 272 458 260 450 250 C 442 238 433 228 431 216 C 431 202 436 186 442 168 C 446 156 446 142 438 144 C 432 146 428 158 424 172 C 420 190 413 208 406 222 Z"
          fill={INK}
          fillOpacity={0.06}
          stroke={INK}
          strokeOpacity={0.3}
          strokeWidth={1}
        />
        <circle cx={406} cy={230} r={2} fill="none" stroke={INK} strokeOpacity={0.26} strokeWidth={0.9} />
      </Group>

      {/* White matter outside, grey matter inside — the two tissues the
          butterfly and its surround are made of. */}
      <g>
        <line x1={458} y1={196} x2={488} y2={196} stroke={INK} strokeOpacity={0.2} strokeWidth={0.9} />
        <line x1={458} y1={222} x2={488} y2={222} stroke={INK} strokeOpacity={0.2} strokeWidth={0.9} />
      </g>
      <PlateLabel x={490} y={199} anchor="start">
        GREY MATTER
      </PlateLabel>
      <PlateLabel x={490} y={225} anchor="start">
        WHITE MATTER
      </PlateLabel>

      {/* The interneuron that closes the loop inside the grey matter. */}
      <Group dim={dim("cord")}>
        <path
          d="M 371 158 C 378 172 386 186 392 200 C 400 216 412 232 426 242"
          fill="none"
          stroke={INK}
          strokeOpacity={0.38}
          strokeWidth={1.3}
          strokeDasharray="4 3"
        />
        <circle cx={396} cy={208} r={4.4} fill={INK} fillOpacity={0.12} stroke={INK} strokeOpacity={0.4} strokeWidth={1} />
      </Group>

      {/* Motor neuron: cell body in the ventral horn, axon out through the
          ventral root, ending on the muscle. */}
      <Group dim={dim("motor")}>
        {myelin ? (
          <path
            d={motor}
            fill="none"
            stroke={INK}
            strokeOpacity={0.16}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray="40 26"
          />
        ) : null}
        <path
          d={motor}
          fill="none"
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={myelin ? 2 : 1.5}
          strokeLinecap="round"
        />
        <circle cx={432} cy={246} r={8} fill={INK} fillOpacity={0.07} stroke={INK} strokeOpacity={0.42} strokeWidth={1.1} />
        <circle cx={432} cy={246} r={3.2} fill={INK} fillOpacity={0.18} />
      </Group>

      {/* Muscle spindle, with tendons and three fibres. It shortens a little
          once the impulse lands. */}
      <Group dim={dim("muscle")}>
        <g
          style={{
            transform: fired ? "scale(0.95, 0.91)" : "scale(1, 1)",
            transformOrigin: "656px 298px",
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <path
            d="M 604 292 C 626 274 654 270 682 278 C 702 284 706 300 688 311 C 662 326 626 318 604 292 Z"
            fill={INK}
            fillOpacity={0.045}
            stroke={INK}
            strokeOpacity={0.42}
            strokeWidth={1.3}
          />
          <path
            d="M 618 292 C 640 283 664 282 688 290"
            fill="none"
            stroke={INK}
            strokeOpacity={0.24}
            strokeWidth={1}
          />
          <path
            d="M 616 300 C 642 294 668 294 692 300"
            fill="none"
            stroke={INK}
            strokeOpacity={0.24}
            strokeWidth={1}
          />
          <path
            d="M 620 308 C 642 306 666 308 686 312"
            fill="none"
            stroke={INK}
            strokeOpacity={0.24}
            strokeWidth={1}
          />
          <path
            d="M 700 302 C 712 304 720 306 728 308"
            fill="none"
            stroke={INK}
            strokeOpacity={0.22}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
        {/* Motor end plate. */}
        <ellipse cx={602} cy={291} rx={5} ry={3.6} fill={INK} fillOpacity={0.34} stroke={INK} strokeOpacity={0.48} strokeWidth={0.9} />
        {fired ? (
          <path
            d="M 616 334 C 628 340 644 340 656 334"
            fill="none"
            stroke={INK}
            strokeOpacity={0.3}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        ) : null}
      </Group>

      <PlateLabel x={406} y={82}>
        SPINAL CORD
      </PlateLabel>
      <PlateLabel x={66} y={390} anchor="start">
        SKIN
      </PlateLabel>
      <PlateLabel x={664} y={350} anchor="middle">
        MUSCLE
      </PlateLabel>

      <Marker x={124} y={238} n={1} label="Receptor" active={selected === "receptor"} onSelect={pick("receptor")} tx={100} ty={250} />
      <Marker x={300} y={122} n={2} label="Dorsal root ganglion" active={selected === "ganglion"} onSelect={pick("ganglion")} tx={300} ty={152} />
      <Marker x={192} y={226} n={3} label="Sensory neuron" active={selected === "sensory"} onSelect={pick("sensory")} tx={204} ty={194} />
      <Marker x={486} y={104} n={4} label="Spinal cord" active={selected === "cord"} onSelect={pick("cord")} tx={446} ty={128} />
      <Marker x={520} y={338} n={5} label="Motor neuron" active={selected === "motor"} onSelect={pick("motor")} tx={536} ty={306} />
      <Marker x={704} y={354} n={6} label="Muscle" active={selected === "muscle"} onSelect={pick("muscle")} tx={686} ty={320} />
    </g>
  );
}

export default NerveStage;
