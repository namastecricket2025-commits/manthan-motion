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
 * The drawing is a real distance drawing: the reflector moves along the plate
 * with the slider, so the pulse always stops exactly at the cliff (or the sea
 * bed) whose distance the label quotes. The first version pinned the cliff to
 * the far edge and sent the pulse to a point in mid-air chosen by the slider —
 * the label said 170 m while the pulse stopped two metres from the shouter.
 *
 * The clock is the real one, read from the same phase that moves the pulse:
 * t = (2d)/v at the moment the pulse reaches the reflector is a fiction of the
 * animation's clock, but the *numbers* are the air's. The "distinct echo"
 * verdict comes from the ear's persistence: a reflection arriving sooner than
 * about 0.1 s after the original is heard as one prolonged sound.
 */

type Mode = "cliff" | "sonar";

const W = 720;
const H = 320;
const SOURCE_X = 92;
const MAX_D = 1000;
const SURFACE_Y = 64;

/** v = 331 + 0.6 T m/s in air; water is fixed for comparison. */
function airSpeed(t: number) {
  return 331 + 0.6 * t;
}
const WATER = 1500;

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
    const next = Math.min(1, phase + dt / 2400);
    setPhase(next);
    if (next >= 1) setRunning(false);
  });

  const speed = mode === "cliff" ? airSpeed(temp) : WATER;
  const echoTime = (2 * distance) / speed;
  const oneWay = distance / speed;
  const minDistinct = (speed * 0.1) / 2;
  const distinct = distance >= minDistinct;
  const travel = phase <= 0.5 ? phase / 0.5 : (1 - phase) / 0.5;
  const clock = phase * echoTime;

  /* Each scene places its reflector from the same slider, so distance on the
     plate and distance in the label are the same fact. */
  const reflectorX = SOURCE_X + 74 + (distance / MAX_D) * 470;
  const bedY = 104 + (distance / MAX_D) * 146;

  const run = () => {
    if (running) return;
    setPhase(0);
    setRunning(true);
  };

  const reset = (next: () => void) => {
    setRunning(false);
    setPhase(0);
    next();
  };

  const pulseX = SOURCE_X + travel * (reflectorX - SOURCE_X);
  const pulseY = SURFACE_Y + travel * (bedY - SURFACE_Y);
  const homebound = phase > 0.5;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            mode === "cliff"
              ? "A pulse travelling from a person to a cliff and back"
              : "A SONAR pulse travelling from a ship to the sea bed and back"
          }
        >
          {mode === "cliff" ? (
            <>
              <line x1={20} y1={252} x2={W - 20} y2={252} stroke={ink(0.25)} strokeWidth={2} />
              {/* The cliff is drawn where the slider says it is. */}
              <path
                d={`M ${reflectorX} 252 L ${reflectorX} 92 L ${reflectorX + 18} 74 L ${reflectorX + 46} 90 L ${reflectorX + 46} 252 Z`}
                fill={plate(0.55)}
                stroke={ink(0.4)}
                strokeWidth={1.4}
              />
              <line x1={reflectorX + 6} y1={138} x2={reflectorX + 40} y2={132} stroke={ink(0.2)} strokeWidth={1.2} />
              <line x1={reflectorX + 6} y1={176} x2={reflectorX + 40} y2={168} stroke={ink(0.2)} strokeWidth={1.2} />
              <text x={reflectorX + 23} y={64} textAnchor="middle" fontSize={11} fill={ink(0.55)}>
                cliff
              </text>

              {/* Person */}
              <circle cx={SOURCE_X} cy={199} r={6.5} fill="none" stroke={ink(0.6)} strokeWidth={2} />
              <path
                d={`M ${SOURCE_X} 205 l0 24 M ${SOURCE_X - 13} 216 l13 -6 l13 6 M ${SOURCE_X} 229 l-9 17 M ${SOURCE_X} 229 l9 17`}
                fill="none"
                stroke={ink(0.6)}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <text x={SOURCE_X} y={270} textAnchor="middle" fontSize={11} fill={ink(0.55)}>
                you
              </text>
            </>
          ) : (
            <>
              <rect x={20} y={SURFACE_Y} width={W - 40} height={H - SURFACE_Y - 12} fill={CYAN} opacity={0.05} />
              <line x1={20} y1={SURFACE_Y} x2={W - 20} y2={SURFACE_Y} stroke={CYAN} strokeWidth={1.6} opacity={0.65} />
              {/* Sea bed at the depth the slider says. */}
              <path
                d={`M 20 ${bedY + 8} Q 120 ${bedY - 6} 240 ${bedY + 5} T 460 ${bedY + 3} T 700 ${bedY + 8} L 700 ${bedY + 28} L 20 ${bedY + 28} Z`}
                fill={plate(0.5)}
                stroke={ink(0.35)}
                strokeWidth={1.2}
              />
              <text x={W - 32} y={bedY + 22} textAnchor="end" fontSize={10.5} fill={ink(0.5)}>
                sea bed
              </text>

              {/* Ship on the surface, with a mast so it reads at a glance. */}
              <path
                d={`M ${134 - 36} ${SURFACE_Y} l8 -20 l56 0 l8 20 Z`}
                fill={plate(0.72)}
                stroke={ink(0.45)}
                strokeWidth={1.3}
              />
              <line x1={134} y1={SURFACE_Y - 20} x2={134} y2={SURFACE_Y - 42} stroke={ink(0.5)} strokeWidth={1.6} />
              <line x1={134} y1={SURFACE_Y - 38} x2={152} y2={SURFACE_Y - 32} stroke={ink(0.5)} strokeWidth={1.4} />
              <text x={134} y={SURFACE_Y - 50} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>
                ship
              </text>

              {/* The sonar cone the pulse travels inside. */}
              <path
                d={`M 120 ${SURFACE_Y + 2} L 54 ${bedY} L 214 ${bedY} Z`}
                fill={CYAN}
                opacity={0.055}
              />
            </>
          )}

          {/* Distance bracket, tied to the drawn reflector. */}
          {mode === "cliff" ? (
            <>
              <line
                x1={SOURCE_X}
                y1={286}
                x2={reflectorX}
                y2={286}
                stroke={ink(0.32)}
                strokeWidth={1.2}
                strokeDasharray="5 5"
              />
              <line x1={SOURCE_X} y1={280} x2={SOURCE_X} y2={292} stroke={ink(0.32)} strokeWidth={1.2} />
              <line x1={reflectorX} y1={280} x2={reflectorX} y2={292} stroke={ink(0.32)} strokeWidth={1.2} />
              <text
                x={(SOURCE_X + reflectorX) / 2}
                y={306}
                textAnchor="middle"
                fontSize={11.5}
                fill={ink(0.65)}
                paintOrder="stroke"
                stroke={plate(0.92)}
                strokeWidth={3.5}
              >
                d = {distance} m
              </text>
            </>
          ) : (
            <>
              <line
                x1={258}
                y1={SURFACE_Y}
                x2={258}
                y2={bedY}
                stroke={ink(0.32)}
                strokeWidth={1.2}
                strokeDasharray="5 5"
              />
              <line x1={252} y1={SURFACE_Y} x2={264} y2={SURFACE_Y} stroke={ink(0.32)} strokeWidth={1.2} />
              <line x1={252} y1={bedY} x2={264} y2={bedY} stroke={ink(0.32)} strokeWidth={1.2} />
              <text
                x={274}
                y={(SURFACE_Y + bedY) / 2 + 4}
                fontSize={11.5}
                fill={ink(0.65)}
                paintOrder="stroke"
                stroke={plate(0.92)}
                strokeWidth={3.5}
              >
                d = {distance} m
              </text>
            </>
          )}

          {/* The pulse: concentric arcs, brighter at the front. */}
          {running || phase > 0 ? (
            <g>
              {[0, 1, 2].map((ring) => (
                <circle
                  key={ring}
                  cx={mode === "cliff" ? pulseX : 134}
                  cy={mode === "cliff" ? 202 : pulseY}
                  r={9 + ring * 11}
                  fill="none"
                  stroke={homebound ? MINT : AMBER}
                  strokeWidth={2 - ring * 0.45}
                  opacity={0.85 - ring * 0.22}
                />
              ))}
              <circle
                cx={mode === "cliff" ? pulseX : 134}
                cy={mode === "cliff" ? 202 : pulseY}
                r={3.4}
                fill={homebound ? MINT : AMBER}
              />
            </g>
          ) : null}

          <text x={W - 20} y={24} textAnchor="end" fontSize={11} fill={ink(0.5)}>
            {mode === "cliff"
              ? "one pulse, there and back — the clock measures both journeys"
              : "the pulse returns from the sea bed, not from the surface"}
          </text>
        </svg>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className="apple-lab-btn" onClick={run} disabled={running}>
            {running ? "Sending…" : phase >= 1 ? "Send again" : "Send pulse"}
          </button>
          <span className="apple-lab-note">
            {mode === "cliff"
              ? `At ${temp} °C sound covers ${speed.toFixed(0)} m/s in air.`
              : "In sea water sound travels at about 1500 m/s — four times faster than in air."}
          </span>
          <span className="ml-auto inline-flex items-center gap-3 text-[10.5px] text-[var(--lab-ink-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} /> out
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-1.5 w-1.5 rounded-full" style={{ background: MINT }} /> back
            </span>
            <span className="tabular-nums">t = {clock.toFixed(3)} s</span>
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
            onChange={(next) => reset(() => setMode(next))}
          />
          <Range
            label="Reflector distance d"
            value={distance}
            min={10}
            max={MAX_D}
            step={10}
            unit="m"
            format={(v) => v.toFixed(0)}
            onChange={(v) => reset(() => setDistance(v))}
          />
          {mode === "cliff" ? (
            <Range
              label="Air temperature"
              value={temp}
              min={0}
              max={40}
              step={1}
              unit="°C"
              format={(v) => v.toFixed(0)}
              onChange={(v) => reset(() => setTemp(v))}
            />
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
            { q: "How do bats and ships use this?", a: "Both send a pulse, wait for the return, and time it. A bat uses ultrasound; a ship's SONAR does the same in water, where sound is about four times faster." },
          ]}
        />
      </div>
    </div>
  );
}

export default EchoSonarBench;
