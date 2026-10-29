import { Range } from "@/components/lab/bench-atoms";
import { useStillMotion } from "@/lib/motion";
import { useAnimationFrame } from "motion/react";
import { Play, RotateCcw, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The nervous system plate.
 *
 * Every other biology plate answers "what is this made of". This one answers
 * "what does it do, and how fast": press Fire and an impulse runs the neuron
 * from dendrite to synapse, or runs the reflex loop from skin to muscle. The
 * route is a real SVG path and the dot is `getPointAtLength` along it, so the
 * signal cannot drift off the fibre it is supposed to be travelling on.
 *
 * The one number that is not drawn to scale is time: a myelinated axon carries
 * an impulse at 120 m/s and a bare one at 2 m/s, so the animation is compressed
 * to a second or two and the *readout* carries the true latency. That split is
 * stated on the panel rather than hidden, because a diagram that pretends to be
 * real-time teaches the wrong thing about the thing it is drawing.
 *
 * The impulse is the only warm colour on the plate. Everything structural is
 * ink at three weights, which is what keeps a moving amber dot legible without
 * turning the bench into a light show.
 */

const W = 760;
const H = 420;

const INK = "var(--lab-ink)";
const SIGNAL = "var(--lab-diagram-amber)";

const ink = (alpha: number) =>
  `color-mix(in srgb, var(--lab-ink) ${Math.round(alpha * 100)}%, transparent)`;

type Mode = "neuron" | "reflex";

const NEURON_ROUTE =
  "M 110 150 C 142 166 172 190 206 208 L 596 212 L 636 212";
const REFLEX_ROUTE =
  "M 96 296 C 112 246 168 184 240 160 C 292 142 342 132 410 132 C 470 132 500 172 548 220 C 578 250 600 274 630 296";

type Part = { id: string; label: string; note: string };

const NEURON_PARTS: Part[] = [
  {
    id: "dendrites",
    label: "Dendrites",
    note: "The receiving branches. One neuron can carry thousands of these, and each one collects a small input from another cell.",
  },
  {
    id: "soma",
    label: "Cell body",
    note: "The soma adds up every input arriving at the dendrites. If the total crosses the threshold, the neuron fires — all of it, or none of it.",
  },
  {
    id: "axon",
    label: "Axon",
    note: "One long fibre leaving the soma. The impulse travels down it without fading, because the membrane regenerates the signal as it goes.",
  },
  {
    id: "myelin",
    label: "Myelin sheath",
    note: "Fatty insulation wrapped around the axon. The impulse jumps from one gap to the next instead of crawling along every patch of membrane — up to sixty times faster.",
  },
  {
    id: "node",
    label: "Node of Ranvier",
    note: "A bare gap between two myelin sheaths. The signal is rebuilt here, so the jump does not lose strength between nodes.",
  },
  {
    id: "synapse",
    label: "Synapse",
    note: "The junction with the next cell. There is a gap here, so the electrical impulse becomes a chemical message — then becomes electrical again.",
  },
];

const REFLEX_PARTS: Part[] = [
  {
    id: "receptor",
    label: "Receptor",
    note: "Sensors in the skin detect the pin and start an impulse. This is the input end of the loop.",
  },
  {
    id: "sensory",
    label: "Sensory neuron",
    note: "Carries the impulse inward, to the spinal cord. Its cell body sits in a ganglion just outside the cord.",
  },
  {
    id: "cord",
    label: "Spinal cord",
    note: "The relay. Its own interneuron connects the incoming fibre straight to the outgoing one — the brain is informed afterwards, not asked first.",
  },
  {
    id: "motor",
    label: "Motor neuron",
    note: "Carries the answer back out to the muscle, on the opposite side of the cord from the incoming signal.",
  },
  {
    id: "muscle",
    label: "Muscle",
    note: "Contracts. By the time the brain registers the pain, the hand has already moved — which is the entire point of a reflex.",
  },
];

/** True latency, in milliseconds, for the route drawn on the plate. */
function latency(mode: Mode, myelinated: boolean) {
  const metres = mode === "neuron" ? 1 : 1.4;
  const speed = myelinated ? 120 : 2;
  const synapse = mode === "reflex" ? 5 : 0.5;
  return (metres / speed) * 1000 + synapse;
}

export function NerveStage({ label, blurb }: { label: string; blurb: string }) {
  const still = useStillMotion();
  const [mode, setMode] = useState<Mode>("neuron");
  const [myelin, setMyelin] = useState(true);
  const [stimulus, setStimulus] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [fired, setFired] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pulse, setPulse] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const routeRef = useRef<SVGPathElement | null>(null);
  const lengthRef = useRef(0);
  const startedAt = useRef(0);
  const [routeLength, setRouteLength] = useState(0);

  const parts = mode === "neuron" ? NEURON_PARTS : REFLEX_PARTS;
  const part = parts.find((entry) => entry.id === selected) ?? null;

  const route = mode === "neuron" ? NEURON_ROUTE : REFLEX_ROUTE;

  /* The length is measured once per route (not per frame): the trail's
     dash-offset and the dot's position both come from it. */
  useEffect(() => {
    setFiring(false);
    setFired(false);
    setProgress(0);
    setPulse(null);
    setNote(null);
    setSelected(null);
  }, [mode]);

  useEffect(() => {
    const path = routeRef.current;
    if (!path) return;
    lengthRef.current = path.getTotalLength();
    setRouteLength(lengthRef.current);
  }, [mode, route]);

  const fire = () => {
    if (firing) return;
    if (stimulus < 3) {
      setNote("No impulse — the stimulus is below threshold. A neuron fires all of it, or not at all.");
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
      setFired(true);
      return;
    }
    startedAt.current = performance.now();
    setFiring(true);
  };

  useAnimationFrame(() => {
    if (!firing) return;
    const duration = mode === "reflex" ? (myelin ? 1.3 : 2.7) : myelin ? 1.1 : 2.5;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const next = Math.min(1, elapsed / duration);
    const path = routeRef.current;
    if (path && lengthRef.current) {
      const point = path.getPointAtLength(lengthRef.current * next);
      setPulse({ x: point.x, y: point.y });
    }
    setProgress(next);
    if (next >= 1) {
      setFiring(false);
      setFired(true);
    }
  });

  const reset = () => {
    setFiring(false);
    setFired(false);
    setProgress(0);
    setPulse(null);
    setNote(null);
  };

  const ms = latency(mode, myelin);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Nervous system plates">
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
          <button type="button" className="apple-lab-btn" onClick={reset} aria-label="Reset the signal">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="apple-lab-card relative overflow-hidden p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="apple-lab-title truncate text-[13px]">{label}</p>
              <p className="truncate text-[11px] text-[var(--lab-ink-dim)]">{blurb}</p>
            </div>
            <span className="apple-lab-chip shrink-0 !gap-1.5">
              <Zap className="h-3 w-3" style={{ color: SIGNAL }} />
              {firing ? "Travelling" : fired ? "Delivered" : "Idle"}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-ink)_2%,transparent)]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block w-full"
              role="group"
              aria-label={`${mode === "neuron" ? "Neuron" : "Reflex arc"}, fired at stimulus ${stimulus} of 5`}
            >
              {/* The route is hidden geometry: the visible fibres are drawn
                  separately so each can be lit on its own, but the dot and the
                  trail both follow this one path end to end. */}
              <path ref={routeRef} d={route} fill="none" stroke="none" />

              {mode === "neuron" ? (
                <NeuronDrawing
                  myelin={myelin}
                  selected={selected}
                  onSelect={setSelected}
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
                  under the dot and over the fibres. */}
              {progress > 0 ? (
                <path
                  d={route}
                  fill="none"
                  stroke={SIGNAL}
                  strokeOpacity={0.55}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray={`${routeLength * progress} ${routeLength}`}
                />
              ) : null}
              {pulse ? (
                <g>
                  <circle cx={pulse.x} cy={pulse.y} r={14} fill={SIGNAL} opacity={0.14} />
                  <circle cx={pulse.x} cy={pulse.y} r={4.6} fill={SIGNAL} />
                </g>
              ) : null}
            </svg>
          </div>

          <p className="mt-2 px-1 text-[10.5px] text-[var(--lab-ink-micro)]">
            {mode === "neuron"
              ? "Time is compressed; the panel carries the real conduction time."
              : "The loop completes in the cord. Nothing here waits for the brain."}
          </p>
        </div>

        <aside className="flex flex-col gap-3">
          <section className="apple-lab-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="apple-lab-micro">Signal</p>
              <span className="text-[10.5px] text-[var(--lab-ink-micro)]">real time</span>
            </div>

            <div className="mt-2 flex flex-col">
              <Reading label="Route" value={mode === "neuron" ? "1.0 m axon" : "1.4 m loop"} />
              <Reading
                label="Conduction"
                value={myelin ? "120 m/s" : "2 m/s"}
              />
              <Reading
                label={mode === "neuron" ? "Travel time" : "Response time"}
                value={`≈ ${Math.round(ms)} ms`}
              />
            </div>

            <div className="mt-3">
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
            </div>

            <p
              className="mt-2 min-h-[2.6rem] text-[11px] leading-relaxed"
              style={{ color: note ? SIGNAL : "var(--lab-ink-dim)" }}
            >
              {note ??
                (stimulus < 3
                  ? "Below threshold: the membrane will not reach an action potential."
                  : fired
                    ? mode === "neuron"
                      ? "Impulse delivered to the synapse."
                      : "Impulse delivered. The muscle has already contracted."
                    : "Threshold is 3. Below it, nothing fires.")}
            </p>
          </section>

          <section className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">Structures</p>
            <div className="mt-2 flex flex-col gap-1">
              {parts.map((entry, index) => {
                const active = selected === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(active ? null : entry.id)}
                    className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition-colors"
                    style={{
                      borderColor: active ? ink(0.3) : "transparent",
                      background: active ? ink(0.07) : "transparent",
                      color: active ? "var(--lab-ink)" : "var(--lab-ink-dim)",
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-semibold"
                      style={{ borderColor: ink(0.22), color: "var(--lab-ink)" }}
                    >
                      {index + 1}
                    </span>
                    {entry.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 min-h-[4.5rem] rounded-xl border border-[var(--lab-line-soft)] p-2.5 text-[11.5px] leading-relaxed">
              {part ? (
                <>
                  <strong className="font-semibold text-[var(--lab-ink)]">{part.label}</strong>
                  <span className="mt-1 block text-[var(--lab-ink-dim)]">{part.note}</span>
                </>
              ) : (
                <span className="text-[var(--lab-ink-micro)]">
                  Pick a numbered marker on the plate, or a structure above.
                </span>
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

/* The figures ------------------------------------------------------- */

function Marker({
  x,
  y,
  n,
  active,
  onSelect,
  label,
}: {
  x: number;
  y: number;
  n: number;
  active: boolean;
  onSelect: () => void;
  label: string;
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
  return <g opacity={dim ? 0.45 : 1}>{children}</g>;
}

function NeuronDrawing({
  myelin,
  selected,
  onSelect,
}: {
  myelin: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const dim = (id: string) => Boolean(selected) && selected !== id;
  const pick = (id: string) => () => onSelect(selected === id ? null : id);

  return (
    <g>
      {/* Dendrites. The first one is also the start of the signal path, so the
          dot begins on a visible fibre rather than in empty space. */}
      <Group dim={dim("dendrites")}>
        <path d="M 110 150 C 142 166 172 190 206 208" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M 140 165 C 128 151 122 143 116 131" fill="none" stroke={INK} strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" />
        <path d="M 140 165 C 154 153 160 145 168 133" fill="none" stroke={INK} strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" />

        <path d="M 128 250 C 158 234 182 224 208 219" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M 152 238 C 142 250 136 256 128 264" fill="none" stroke={INK} strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" />
        <path d="M 176 184 C 170 158 168 142 166 118" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M 170 152 C 158 144 150 140 140 136" fill="none" stroke={INK} strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" />
        <path d="M 168 146 C 180 138 188 136 198 134" fill="none" stroke={INK} strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" />
        <path d="M 154 292 C 178 268 192 248 204 234" fill="none" stroke={INK} strokeOpacity={0.42} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M 230 190 C 242 170 248 158 256 144" fill="none" stroke={INK} strokeOpacity={0.38} strokeWidth={1.3} strokeLinecap="round" />
      </Group>

      {/* Soma, with the nucleus inside it. */}
      <Group dim={dim("soma")}>
        <circle cx={206} cy={212} r={36} fill={INK} fillOpacity={0.035} stroke={INK} strokeOpacity={0.55} strokeWidth={1.5} />
        <circle cx={198} cy={214} r={11} fill={INK} fillOpacity={0.07} stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
        {selected === "soma" ? (
          <circle cx={206} cy={212} r={48} fill="none" stroke={INK} strokeOpacity={0.16} strokeWidth={1} />
        ) : null}
      </Group>

      {/* Axon: plain fibre when the myelin is stripped off. */}
      <Group dim={dim("axon")}>
        <line x1={242} y1={212} x2={596} y2={212} stroke={INK} strokeOpacity={0.55} strokeWidth={myelin ? 3 : 1.6} />
      </Group>

      {/* Myelin sheaths. Off is not "hidden": the ghost outlines show where
          the insulation sits, so turning it off reads as removing something. */}
      <Group dim={dim("myelin")}>
        {[270, 332, 394, 456, 518].map((x) => (
          <rect
            key={x}
            x={x}
            y={204}
            width={54}
            height={16}
            rx={8}
            fill={INK}
            fillOpacity={myelin ? 0.045 : 0}
            stroke={INK}
            strokeOpacity={myelin ? 0.34 : 0.12}
            strokeDasharray={myelin ? undefined : "3 5"}
            strokeWidth={1}
          />
        ))}
      </Group>

      {/* Nodes of Ranvier — the gaps the impulse jumps between. */}
      <Group dim={dim("node")}>
        {[328, 390, 452, 514].map((x) => (
          <line key={x} x1={x} y1={202} x2={x} y2={222} stroke={INK} strokeOpacity={0.5} strokeWidth={1.2} />
        ))}
      </Group>

      {/* Terminal knobs and the synaptic gap. */}
      <Group dim={dim("synapse")}>
        <path d="M 596 212 C 610 212 618 198 628 188" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
        <path d="M 596 212 C 612 212 620 226 632 236" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={596} y1={212} x2={636} y2={212} stroke={INK} strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
        {[
          { x: 628, y: 188 },
          { x: 632, y: 236 },
          { x: 636, y: 212 },
        ].map((knob) => (
          <circle key={`${knob.x}-${knob.y}`} cx={knob.x} cy={knob.y} r={4.5} fill={INK} fillOpacity={0.25} stroke={INK} strokeOpacity={0.45} strokeWidth={1} />
        ))}
        <path d="M 660 212 C 680 200 694 194 712 192" fill="none" stroke={INK} strokeOpacity={0.22} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M 660 212 C 680 224 694 230 712 232" fill="none" stroke={INK} strokeOpacity={0.22} strokeWidth={1.2} strokeLinecap="round" />
      </Group>

      <text x={648} y={252} fontSize="10.5" fill={INK} fillOpacity={0.4} textAnchor="middle">
        synapse
      </text>

      <Marker x={120} y={124} n={1} label="Dendrites" active={selected === "dendrites"} onSelect={pick("dendrites")} />
      <Marker x={250} y={252} n={2} label="Cell body" active={selected === "soma"} onSelect={pick("soma")} />
      <Marker x={476} y={188} n={3} label="Axon" active={selected === "axon"} onSelect={pick("axon")} />
      <Marker x={300} y={186} n={4} label="Myelin sheath" active={selected === "myelin"} onSelect={pick("myelin")} />
      <Marker x={368} y={246} n={5} label="Node of Ranvier" active={selected === "node"} onSelect={pick("node")} />
      <Marker x={616} y={166} n={6} label="Synapse" active={selected === "synapse"} onSelect={pick("synapse")} />
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

  return (
    <g>
      {/* Skin / receptor */}
      <Group dim={dim("receptor")}>
        <rect x={66} y={258} width={60} height={84} rx={26} fill={INK} fillOpacity={0.03} stroke={INK} strokeOpacity={0.35} strokeWidth={1.3} />
        {[288, 300, 312].map((y) => (
          <circle key={y} cx={96} cy={y} r={2.4} fill={INK} fillOpacity={0.4} />
        ))}
      </Group>

      {/* Sensory neuron, with its cell body in the dorsal root ganglion. */}
      <Group dim={dim("sensory")}>
        <path d="M 96 280 C 112 238 168 182 240 160 C 292 144 342 134 384 132" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        <circle cx={236} cy={162} r={11} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.35} strokeWidth={1.1} />
        {myelin ? (
          <>
            <rect x={146} y={190} width={26} height={14} rx={7} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.25} strokeWidth={1} transform="rotate(-36 159 197)" />
            <rect x={196} y={162} width={24} height={14} rx={7} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.25} strokeWidth={1} transform="rotate(-14 208 169)" />
            <rect x={290} y={136} width={24} height={14} rx={7} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.25} strokeWidth={1} transform="rotate(-5 302 143)" />
          </>
        ) : null}
      </Group>

      {/* Spinal cord: the relay. Its interneuron is drawn inside the capsule. */}
      <Group dim={dim("cord")}>
        <rect x={380} y={62} width={60} height={160} rx={30} fill={INK} fillOpacity={0.03} stroke={INK} strokeOpacity={0.38} strokeWidth={1.3} />
        <line x1={410} y1={132} x2={410} y2={176} stroke={INK} strokeOpacity={0.28} strokeWidth={1.1} strokeDasharray="3 4" />
        <circle cx={410} cy={152} r={5} fill={INK} fillOpacity={0.18} stroke={INK} strokeOpacity={0.4} strokeWidth={1} />
        <text x={410} y={52} textAnchor="middle" fontSize="10" letterSpacing="1.4" fill={INK} fillOpacity={0.38}>
          SPINAL CORD
        </text>
      </Group>

      {/* Motor neuron, leaving from the other side of the cord. */}
      <Group dim={dim("motor")}>
        <path d="M 434 152 C 486 170 540 224 600 278" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        {myelin ? (
          <>
            <rect x={474} y={176} width={26} height={14} rx={7} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.25} strokeWidth={1} transform="rotate(38 487 183)" />
            <rect x={528} y={218} width={26} height={14} rx={7} fill={INK} fillOpacity={0.04} stroke={INK} strokeOpacity={0.25} strokeWidth={1} transform="rotate(44 541 225)" />
          </>
        ) : null}
      </Group>

      {/* Muscle spindle. It shortens a little once the impulse lands. */}
      <Group dim={dim("muscle")}>
        <g
          style={{
            transform: fired ? "scale(0.94, 0.9)" : "scale(1, 1)",
            transformOrigin: "646px 300px",
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <ellipse cx={646} cy={300} rx={62} ry={24} fill={INK} fillOpacity={0.045} stroke={INK} strokeOpacity={0.4} strokeWidth={1.3} transform="rotate(-18 646 300)" />
          {[-30, -12, 6, 24].map((offset) => (
            <path
              key={offset}
              d={`M ${604 + offset} ${282 - offset * 0.2} C ${626 + offset} ${292 - offset * 0.2} ${660 + offset} ${306 - offset * 0.2} ${684 + offset} ${318 - offset * 0.2}`}
              fill="none"
              stroke={INK}
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
        </g>
        {fired ? (
          <g stroke={INK} strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round">
            <path d="M 588 344 C 596 352 596 362 590 370" fill="none" />
            <path d="M 618 352 C 626 360 626 370 620 378" fill="none" />
          </g>
        ) : null}
      </Group>

      <text x={96} y={368} textAnchor="middle" fontSize="10.5" fill={INK} fillOpacity={0.4}>
        skin
      </text>

      <Marker x={116} y={344} n={1} label="Receptor" active={selected === "receptor"} onSelect={pick("receptor")} />
      <Marker x={262} y={128} n={2} label="Sensory neuron" active={selected === "sensory"} onSelect={pick("sensory")} />
      <Marker x={452} y={94} n={3} label="Spinal cord" active={selected === "cord"} onSelect={pick("cord")} />
      <Marker x={512} y={188} n={4} label="Motor neuron" active={selected === "motor"} onSelect={pick("motor")} />
      <Marker x={712} y={336} n={5} label="Muscle" active={selected === "muscle"} onSelect={pick("muscle")} />
    </g>
  );
}

export default NerveStage;
