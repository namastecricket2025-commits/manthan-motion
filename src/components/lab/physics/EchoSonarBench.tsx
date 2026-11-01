import { Picker, Questions, Range, Readout, ink, plate, AMBER, CYAN, MINT } from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useRef, useState } from "react";

/**
 * Echo & SONAR — Class 9.
 *
 * Sound takes time to travel, and every echo measurement is that sentence
 * turned into arithmetic. The bench sends one pulse to a reflector and back:
 *
 *   d = v · t / 2
 *
 * The pulse on the plate is deliberately slowed (the caption says by how much)
 * because a real echo from 340 m returns in two seconds and one from 34 m in a
 * fifth — the point is not to watch it in real time but to see that the round
 * trip is *twice* the distance. The clock in the readout is the real one.
 *
 * The "distinct echo" verdict comes from the ear's persistence: a reflection
 * arriving sooner than about 0.1 s after the original is heard as a single
 * prolonged sound. At 20 °C that puts the minimum reflector at about 17 m —
 * the number the textbook quotes, recomputed here from the temperature.
 */

type Mode = "cliff" | "sonar";

const PLATE_W = 720;
const PLATE_H = 300;
const CX = 120; /* source, left edge of the travel */
const REFLECTOR_DX = 500; /* plate pixels available for the full distance */
const MAX_D = 1000;

/** v = 331 + 0.6 T m/s in air; water and steel are fixed for comparison. */
function airSpeed(t: number) {
  return 331 + 0.6 * t;
}
const WATER = 1500;
const STEEL = 5100;

export function EchoSonarBench() {
  const [mode, setMode] = useState<Mode>("cliff");
  const [distance, setDistance] = useState(170);
  const [temp, setTemp] = useState(25);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0); /* 0 at source → 0.5 at reflector → 1 home */
  const last = useRef<number | null>(null);

  useAnimationFrame((time) => {
    if (!running) {
      last.current = time;
      return;
    }
    if (last.current === null) last.current = time;
    const dt = Math.min(64, time - last.current);
    last.current = time;
    setPhase((p) => {
      const next = p + dt / 2200;
      if (next >= 1) {
        setRunning(false);
        return 1;
      }
      return next;
    });
  });

  const speed = mode === "cliff" ? airSpeed(temp) : WATER;
  const echoTime = (2 * distance) / speed;
  const oneWay = distance / speed;
  /* The ear holds a sound for ~0.1 s; closer than this the echo merges. */
  const minDistinct = (speed * 0.1) / 2;
  const distinct = distance >= minDistinct;

  const toReflector = Math.min(1, distance / MAX_D) * REFLECTOR_DX;
  const travel = phase <= 0.5 ? phase / 0.5 : (1 - phase) / 0.5;
  const pulseX = CX + travel * toReflector;

  const run = () => {
    setPhase(0);
    setRunning(true);
  };

  const slowed = Math.max(1, Math.round((echoTime * 1000) / 2200));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
        <svg viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} className="w-full" role="img" aria-label={mode === "cliff" ? "A pulse travelling from a person to a cliff and back" : "A SONAR pulse travelling from a ship to the sea bed and back"}>
          {/* Ground / sea */}
          {mode === "cliff" ? (
            <>
              <line x1={20} y1={238} x2={PLATE_W - 20} y2={238} stroke={ink(0.25)} strokeWidth={2} />
              {/* Cliff face on the right */}
              <path d={`M ${CX + REFLECTOR_DX + 10} 70 L ${CX + REFLECTOR_DX + 10} 238 L ${CX + REFLECTOR_DX + 70} 238 L ${CX + REFLECTOR_DX + 70} 96 Z`} fill={plate(0.5)} stroke={ink(0.35)} strokeWidth={1.4} />
              <text x={CX + REFLECTOR_DX + 40} y={64} textAnchor="middle" fontSize={11} fill={ink(0.55)}>cliff</text>
              {/* Person */}
              <circle cx={CX} cy={200} r={7} fill="none" stroke={ink(0.6)} strokeWidth={2} />
              <path d={`M ${CX} 207 l0 22 M ${CX - 13} 218 l13 -6 l13 6 M ${CX} 229 l-9 16 M ${CX} 229 l9 16`} fill="none" stroke={ink(0.6)} strokeWidth={2} strokeLinecap="round" />
              <text x={CX} y={258} textAnchor="middle" fontSize={11} fill={ink(0.55)}>you</text>
            </>
          ) : (
            <>
              <rect x={20} y={40} width={PLATE_W - 40} height={26} fill={CYAN} opacity={0.14} />
              <line x1={20} y1={66} x2={PLATE_W - 20} y2={66} stroke={CYAN} strokeWidth={1.6} opacity={0.6} />
              <text x={32} y={34} fontSize={11} fill={CYAN}>sea surface</text>
              {/* Ship */}
              <path d={`M ${CX - 34} 66 l8 -22 l52 0 l8 22 Z`} fill={plate(0.7)} stroke={ink(0.45)} strokeWidth={1.3} />
              <line x1={CX} y1={44} x2={CX} y2={24} stroke={ink(0.5)} strokeWidth={1.6} />
              <text x={CX} y={92} textAnchor="middle" fontSize={11} fill={ink(0.55)}>ship</text>
              {/* Sea bed, tilted */}
              <path d={`M ${CX + REFLECTOR_DX - 40} 250 L ${PLATE_W - 30} 224 L ${PLATE_W - 30} 258 Z`} fill={plate(0.5)} stroke={ink(0.35)} strokeWidth={1.2} />
            </>
          )}

          {/* The one-way distance bracket */}
          <line x1={CX} y1={mode === "cliff" ? 222 : 100} x2={CX + toReflector} y2={mode === "cliff" ? 222 : 100} stroke={ink(0.3)} strokeWidth={1.2} strokeDasharray="5 5" />
          <text x={CX + toReflector / 2} y={mode === "cliff" ? 216 : 94} textAnchor="middle" fontSize={11} fill={ink(0.6)}>
            d = {distance} m
          </text>

          {/* The pulse: concentric arcs, brighter at the front. */}
          {running || phase > 0 ? (
            <g>
              {[0, 1, 2].map((ring) => {
                const r = 10 + ring * 12;
                return (
                  <circle
                    key={ring}
                    cx={pulseX}
                    cy={mode === "cliff" ? 204 : 66}
                    r={r}
                    fill="none"
                    stroke={phase > 0.5 && phase < 1 ? MINT : AMBER}
                    strokeWidth={2 - ring * 0.45}
                    opacity={0.85 - ring * 0.22}
                  />
                );
              })}
              <circle cx={pulseX} cy={mode === "cliff" ? 204 : 66} r={3.4} fill={phase > 0.5 && phase < 1 ? MINT : AMBER} />
            </g>
          ) : null}

          <text x={20} y={26} fontSize={11} fill={ink(0.5)}>
            amber = going out · green = coming home
          </text>
          <text x={PLATE_W - 20} y={PLATE_H - 12} textAnchor="end" fontSize={11} fill={ink(0.55)}>
            {running ? `pulse slowed ×${slowed} so you can watch it` : "press Send pulse"}
          </text>
        </svg>

        <div className="flex items-center gap-2">
          <button type="button" className="apple-lab-btn" onClick={run}>
            {running ? "Sending…" : "Send pulse"}
          </button>
          <span className="apple-lab-note">
            {mode === "cliff"
              ? `At ${temp} °C sound covers ${speed.toFixed(0)} m/s in air.`
              : "In sea water sound travels at about 1500 m/s — five times faster than in air."}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <p className="apple-lab-micro">Class 9 · Sound — reflection and echo</p>
          <Picker
            label="Experiment"
            value={mode}
            options={[
              { id: "cliff", label: "Echo from a cliff" },
              { id: "sonar", label: "SONAR at sea" },
            ]}
            onChange={(next) => {
              setMode(next);
              setRunning(false);
              setPhase(0);
            }}
          />
          <Range label="Reflector distance d" value={distance} min={10} max={MAX_D} step={10} unit="m" format={(v) => v.toFixed(0)} onChange={setDistance} />
          {mode === "cliff" ? (
            <Range label="Air temperature" value={temp} min={0} max={40} step={1} unit="°C" format={(v) => v.toFixed(0)} onChange={setTemp} />
          ) : null}
          <p className="apple-lab-note">
            The pulse must go there and come back, so the clock measures 2d — which is
            why the depth is half of v × t. SONAR uses exactly this sum, with sound
            too high-pitched for us to hear.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Readout label="Speed of sound" value={`${speed.toFixed(0)} m/s`} />
          <Readout label="One-way time d/v" value={`${oneWay.toFixed(3)} s`} />
          <Readout label="Echo time 2d/v" value={`${echoTime.toFixed(3)} s`} />
          <Readout label="Shortest distinct echo" value={`${minDistinct.toFixed(1)} m`} />
          <div className="apple-lab-card col-span-2 px-3 py-2.5">
            <p className="apple-lab-micro">Would you hear it as a separate sound?</p>
            <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
              {distinct
                ? `Yes. The echo arrives ${(echoTime * 1000).toFixed(0)} ms after the shout — later than the ear's ~100 ms hold, so it comes back as a second sound.`
                : `No. At ${distance} m it returns in ${(echoTime * 1000).toFixed(0)} ms, inside the ear's ~100 ms hold, so it just makes the shout sound longer. Move past ${minDistinct.toFixed(0)} m to hear it.`}
            </p>
          </div>
        </div>

        <Questions
          items={[
            { q: "Why divide by 2?", a: "The pulse travels to the reflector and back, so the clock measures twice the distance. d = v × t ÷ 2." },
            { q: "Why is the echo fainter than the shout?", a: "The reflection spreads its energy over a larger area and the surface absorbs some of it; the sound is also travelling the distance twice, so it loses more energy." },
            { q: "How do bats and ships use this?", a: "Both send a pulse, wait for the return, and time it. A bat uses ultrasound; a ship's SONAR does the same in water, where sound is about five times faster." },
          ]}
        />
      </div>
    </div>
  );
}

export default EchoSonarBench;
