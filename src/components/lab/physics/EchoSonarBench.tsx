import {
  Picker,
  Questions,
  Range,
  ink,
  plate,
  AMBER,
  CYAN,
  MINT,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useRef, useState } from "react";

/**
 * Echo & SONAR — Class 9, "Sound".
 *
 * An echo measurement is a stopwatch with a reflection at the far end:
 *
 *   d = v · t / 2
 *
 * The bench draws the trip and the timing trace together. Above: the pulse
 * leaves the source, reaches the reflector and comes home. Below: the same
 * event as an oscilloscope trace — a tall outgoing spike at t = 0, a fainter
 * echo spike at t = 2d/v, and the ear's ~100 ms persistence window shaded on
 * the time axis. That window is the whole reason a short room does not echo:
 * reflections inside it merge into one prolonged sound.
 *
 * The numbers are the air's, not the animation's: the pulse is drawn over a
 * fixed 2.6 s of wall clock, while the clock beside it reads the real 2d/v.
 */

type Mode = "cliff" | "sonar";

const W = 860;
const SCENE_H = 300;
const TRACE_H = 170;
const SOURCE_X = 100;
const MAX_D = 1000;
const SURFACE_Y = 58;
const GROUND_Y = 232;

/** Seconds the full out-and-back trip takes to draw. */
const PULSE_SECONDS = 2.6;

/** v = 331 + 0.6 T m/s in air; water is a fixed comparison. */
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
    const next = Math.min(1, phase + dt / 1000 / PULSE_SECONDS);
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
  const homebound = phase > 0.5;

  /* Each scene places its reflector from the same slider, so distance on the
     plate and distance in the label are the same fact. */
  const reflectorX = SOURCE_X + 90 + (distance / MAX_D) * 500;
  const bedY = 104 + (distance / MAX_D) * 126;

  const pulseX = SOURCE_X + travel * (reflectorX - SOURCE_X);
  const pulseY = SURFACE_Y + 8 + travel * (bedY - SURFACE_Y - 8);

  const send = () => {
    setPhase(0);
    last.current = null;
    setRunning(true);
  };

  /* ---- the A-scan time axis ------------------------------------------ */
  const T0 = 0.3;
  const tMax = Math.max(T0, echoTime * 1.16);
  const axisL = 52;
  const axisR = W - 22;
  const traceBase = 128;
  const traceTop = 30;
  const tx = (time: number) => axisL + (time / tMax) * (axisR - axisL);
  const holdPx = tx(0.1) - tx(0);
  const echoX = tx(echoTime);
  /* Far echoes are fainter: the spike height falls off with distance. */
  const echoAmp = Math.max(18, 62 / (1 + distance / 420));
  const stepCandidates = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  const tickStep = stepCandidates.find((value) => value >= tMax / 6) ?? 5;
  const ticks: number[] = [];
  for (let tt = 0; tt <= tMax + 1e-9; tt += tickStep) ticks.push(tt);

  const verdictTone = distinct ? MINT : AMBER;

  return (
    <div className="flex flex-col gap-3">
      <section className="apple-lab-glass min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--lab-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Class 9 · Sound · reflection and echo</p>
            <h3 className="apple-lab-title mt-1 text-[15px] leading-tight">
              An echo is a stopwatch: d = v · t ÷ 2
            </h3>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              Send one pulse. The cliff returns it; the trace below times it.
              The shaded window is how long the ear keeps a sound — anything
              arriving inside it merges instead of echoing.
            </p>
          </div>
          <Picker
            label="Experiment"
            value={mode}
            options={[
              { id: "cliff", label: "Echo from a cliff" },
              { id: "sonar", label: "SONAR at sea" },
            ]}
            onChange={(next) => {
              setRunning(false);
              setPhase(0);
              setMode(next);
            }}
          />
        </div>

        {/* Scene: where the sound actually goes. */}
        <div className="px-2 pt-2 sm:px-3">
          <svg
            viewBox={`0 0 ${W} ${SCENE_H}`}
            className="block w-full"
            role="img"
            aria-label={
              mode === "cliff"
                ? `A pulse travelling from a person to a cliff ${distance} metres away and back`
                : `A SONAR pulse travelling from a ship to the sea bed ${distance} metres below and back`
            }
          >
            {mode === "cliff" ? (
              <>
                <line x1={20} y1={GROUND_Y} x2={W - 20} y2={GROUND_Y} stroke={ink(0.25)} strokeWidth={2} />
                {/* The cliff is drawn where the slider says it is. */}
                <path
                  d={`M ${reflectorX} ${GROUND_Y} L ${reflectorX} 92 L ${reflectorX + 20} 70 L ${reflectorX + 50} 88 L ${reflectorX + 50} ${GROUND_Y} Z`}
                  fill={plate(0.55)}
                  stroke={ink(0.4)}
                  strokeWidth={1.4}
                />
                <line x1={reflectorX + 7} y1={136} x2={reflectorX + 44} y2={129} stroke={ink(0.2)} strokeWidth={1.2} />
                <line x1={reflectorX + 7} y1={178} x2={reflectorX + 44} y2={169} stroke={ink(0.2)} strokeWidth={1.2} />
                <text x={reflectorX + 25} y={60} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>
                  cliff
                </text>

                {/* Person */}
                <circle cx={SOURCE_X} cy={173} r={7} fill="none" stroke={ink(0.6)} strokeWidth={2} />
                <path
                  d={`M ${SOURCE_X} 180 l0 26 M ${SOURCE_X - 14} 192 l14 -6 l14 6 M ${SOURCE_X} 206 l-10 18 M ${SOURCE_X} 206 l10 18`}
                  fill="none"
                  stroke={ink(0.6)}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <text x={SOURCE_X} y={GROUND_Y + 18} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>
                  you
                </text>

                <line x1={SOURCE_X} y1={GROUND_Y - 6} x2={reflectorX} y2={GROUND_Y - 6} stroke={ink(0.28)} strokeWidth={1.2} strokeDasharray="5 5" />
                <line x1={SOURCE_X} y1={GROUND_Y - 12} x2={SOURCE_X} y2={GROUND_Y} stroke={ink(0.28)} strokeWidth={1.2} />
                <line x1={reflectorX} y1={GROUND_Y - 12} x2={reflectorX} y2={GROUND_Y} stroke={ink(0.28)} strokeWidth={1.2} />
                <text x={(SOURCE_X + reflectorX) / 2} y={GROUND_Y + 18} textAnchor="middle" fontSize={12} fill={ink(0.65)}>
                  d = {distance} m
                </text>
              </>
            ) : (
              <>
                <rect x={20} y={SURFACE_Y} width={W - 40} height={SCENE_H - SURFACE_Y - 14} fill={CYAN} opacity={0.05} />
                <line x1={20} y1={SURFACE_Y} x2={W - 20} y2={SURFACE_Y} stroke={CYAN} strokeWidth={1.6} opacity={0.65} />
                <path
                  d={`M 20 ${bedY + 8} Q 120 ${bedY - 6} 240 ${bedY + 5} T 460 ${bedY + 3} T 700 ${bedY + 8} L 700 ${bedY + 26} L 20 ${bedY + 26} Z`}
                  fill={plate(0.5)}
                  stroke={ink(0.35)}
                  strokeWidth={1.2}
                />
                <text x={W - 32} y={bedY + 22} textAnchor="end" fontSize={11} fill={ink(0.5)}>
                  sea bed
                </text>

                <path d={`M ${140 - 38} ${SURFACE_Y} l8 -22 l60 0 l8 22 Z`} fill={plate(0.72)} stroke={ink(0.45)} strokeWidth={1.3} />
                <line x1={140} y1={SURFACE_Y - 22} x2={140} y2={SURFACE_Y - 48} stroke={ink(0.5)} strokeWidth={1.6} />
                <line x1={140} y1={SURFACE_Y - 42} x2={160} y2={SURFACE_Y - 35} stroke={ink(0.5)} strokeWidth={1.4} />
                <text x={140} y={SURFACE_Y - 56} textAnchor="middle" fontSize={11} fill={ink(0.55)}>
                  ship
                </text>

                <path d={`M 126 ${SURFACE_Y + 2} L 60 ${bedY} L 228 ${bedY} Z`} fill={CYAN} opacity={0.06} />

                <line x1={286} y1={SURFACE_Y} x2={286} y2={bedY} stroke={ink(0.28)} strokeWidth={1.2} strokeDasharray="5 5" />
                <line x1={279} y1={SURFACE_Y} x2={293} y2={SURFACE_Y} stroke={ink(0.28)} strokeWidth={1.2} />
                <line x1={279} y1={bedY} x2={293} y2={bedY} stroke={ink(0.28)} strokeWidth={1.2} />
                <text x={304} y={(SURFACE_Y + bedY) / 2 + 4} fontSize={12} fill={ink(0.65)}>
                  d = {distance} m
                </text>
              </>
            )}

            {/* The pulse: concentric arcs, brighter at the front. */}
            {phase > 0 ? (
              <g>
                {[0, 1, 2].map((ring) => (
                  <circle
                    key={ring}
                    cx={mode === "cliff" ? pulseX : 140}
                    cy={mode === "cliff" ? 200 : pulseY}
                    r={9 + ring * 11}
                    fill="none"
                    stroke={homebound ? MINT : AMBER}
                    strokeWidth={2 - ring * 0.45}
                    opacity={0.85 - ring * 0.22}
                  />
                ))}
                <circle cx={mode === "cliff" ? pulseX : 140} cy={mode === "cliff" ? 200 : pulseY} r={3.4} fill={homebound ? MINT : AMBER} />
              </g>
            ) : null}

            <text x={22} y={24} fontSize={11} fill={ink(0.45)}>
              {mode === "cliff" ? `air at ${temp} °C · v = ${speed.toFixed(0)} m/s` : `sea water · v = ${WATER} m/s`}
            </text>
            <text x={W - 22} y={24} textAnchor="end" fontSize={11} fill={ink(0.45)}>
              {running ? (homebound ? "returning" : "outgoing") : phase >= 1 ? "pulse home" : "press send"}
            </text>
          </svg>
        </div>

        {/* The timing trace: the same event as an instrument would record it. */}
        <div className="mt-1 border-t border-[var(--lab-line-soft)] px-2 pt-1 sm:px-3">
          <svg
            viewBox={`0 0 ${W} ${TRACE_H}`}
            className="block w-full"
            role="img"
            aria-label={`Time trace: outgoing pulse at zero, echo at ${echoTime.toFixed(3)} seconds`}
          >
            {/* Persistence window */}
            <rect x={tx(0)} y={traceTop} width={Math.max(1, holdPx)} height={traceBase - traceTop} fill={AMBER} opacity={0.09} />
            <line x1={tx(0.1)} y1={traceTop} x2={tx(0.1)} y2={traceBase} stroke={AMBER} strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />

            {/* Axis */}
            <line x1={axisL} y1={traceBase} x2={axisR} y2={traceBase} stroke={ink(0.3)} strokeWidth={1.2} />
            {ticks.map((tt) => (
              <g key={tt}>
                <line x1={tx(tt)} y1={traceBase} x2={tx(tt)} y2={traceBase + 5} stroke={ink(0.25)} strokeWidth={1} />
                <text x={tx(tt)} y={traceBase + 18} textAnchor="middle" fontSize={9.5} fill={ink(0.4)}>
                  {tt === 0 ? "0" : `${Number(tt.toFixed(2))}s`}
                </text>
              </g>
            ))}

            {/* Transmit spike */}
            <line x1={tx(0)} y1={traceBase} x2={tx(0)} y2={traceTop + 8} stroke={AMBER} strokeWidth={2.6} />
            <path
              d={`M${tx(0)} ${traceTop + 8} l-6 -8 M${tx(0)} ${traceTop + 8} l6 -8`}
              stroke={AMBER}
              strokeWidth={1.6}
              fill="none"
            />
            <text x={tx(0) + 8} y={traceTop + 6} fontSize={10.5} fill={AMBER}>
              shout
            </text>

            {/* Echo spike, height falling with distance */}
            <line x1={echoX} y1={traceBase} x2={echoX} y2={traceBase - echoAmp} stroke={verdictTone} strokeWidth={2.4} />
            <path
              d={`M${echoX} ${traceBase - echoAmp} l-5 -7 M${echoX} ${traceBase - echoAmp} l5 -7`}
              stroke={verdictTone}
              strokeWidth={1.5}
              fill="none"
            />
            <text
              x={echoX - 8}
              y={traceBase - echoAmp - 10}
              textAnchor="end"
              fontSize={10.5}
              fill={verdictTone}
            >
              echo
            </text>

            {/* The clock, swept with the pulse */}
            {phase > 0 && phase < 1 ? (
              <>
                <line x1={tx(clock)} y1={traceTop} x2={tx(clock)} y2={traceBase} stroke={ink(0.4)} strokeWidth={1} />
                <circle cx={tx(clock)} cy={traceBase} r={3.2} fill={ink(0.65)} />
              </>
            ) : null}

            <text x={axisR} y={traceTop + 4} textAnchor="end" fontSize={10} fill={ink(0.4)}>
              {mode === "cliff" ? "air" : "water"} · time →
            </text>
            <text x={tx(0.1) + 6} y={traceTop + 28} fontSize={10} fill={AMBER} opacity={0.85}>
              ear holds ~100 ms
            </text>
          </svg>
        </div>

        {/* Readout + trigger */}
        <div className="border-t border-[var(--lab-line-soft)] px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-[240px] flex-1">
              <Range
                label="Reflector distance d"
                value={distance}
                min={10}
                max={MAX_D}
                step={10}
                unit="m"
                format={(value) => value.toFixed(0)}
                onChange={(value) => {
                  setRunning(false);
                  setPhase(0);
                  setDistance(value);
                }}
              />
            </div>
            {mode === "cliff" ? (
              <div className="w-full sm:w-[190px]">
                <Range
                  label="Air temperature"
                  value={temp}
                  min={0}
                  max={40}
                  step={1}
                  unit="°C"
                  format={(value) => value.toFixed(0)}
                  onChange={setTemp}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`apple-lab-btn ${running ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
                onClick={() => (running ? setRunning(false) : send())}
              >
                {running ? "Halt" : phase >= 1 ? "Send again" : "Send pulse"}
              </button>
              <button
                type="button"
                className="apple-lab-btn"
                disabled={phase === 0 && !running}
                onClick={() => {
                  setRunning(false);
                  setPhase(0);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 border-t border-[var(--lab-line-soft)] pt-3 sm:grid-cols-[auto_1fr] sm:items-baseline">
            <p className="apple-lab-value text-[15px] font-semibold tabular-nums">
              t = {echoTime.toFixed(3)} s
              <span className="ml-2 text-[11px] font-normal text-[var(--lab-ink-dim)]">
                = 2 × {distance} m ÷ {speed.toFixed(0)} m/s
              </span>
            </p>
            <p className="text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              <span style={{ color: verdictTone, fontWeight: 600 }}>
                {distinct ? "Two sounds." : "One prolonged sound."}
              </span>{" "}
              {distinct
                ? `The echo returns ${(echoTime * 1000).toFixed(0)} ms after the shout — past the ear's ~100 ms hold, so you hear it as a second sound. Anything nearer than ${minDistinct.toFixed(0)} m comes back too soon.`
                : `It returns in ${(echoTime * 1000).toFixed(0)} ms, inside the ear's ~100 ms hold, so it only lengthens the shout. Move past ${minDistinct.toFixed(0)} m to hear a separate echo.`}
            </p>
          </div>

          <p className="mt-2 text-[10.5px] text-[var(--lab-ink-micro)]">
            One-way time d/v = {oneWay.toFixed(3)} s · shortest distinct echo at this speed ={" "}
            {minDistinct.toFixed(1)} m (v × 0.1 s ÷ 2)
          </p>
        </div>
      </section>

      <Questions
        items={[
          {
            q: "Why divide by 2?",
            a: "The pulse travels to the reflector and back, so the clock measures twice the distance. d = v × t ÷ 2.",
          },
          {
            q: "Why does a small room not echo?",
            a: "A wall 3 m away returns the sound in about 17 ms — well inside the ear's 100 ms hold, so it merges with the original. A hall has to be roughly 17 m across before the reflection arrives late enough to be heard separately.",
          },
          {
            q: "Why is the echo fainter than the shout?",
            a: "The reflection spreads its energy over a larger area and the surface absorbs some of it; the sound also travels the distance twice, so it loses more energy.",
          },
          {
            q: "How do bats and ships use this?",
            a: "Both send a pulse, wait for the return and time it. A bat uses ultrasound; a ship's SONAR does the same in water, where sound travels about four times faster than in air.",
          },
        ]}
      />
    </div>
  );
}

export default EchoSonarBench;
