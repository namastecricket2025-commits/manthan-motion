import {
  BenchStage,
  LiveDot,
  Picker,
  Questions,
  Range,
  StageStat,
  StageToggle,
  ink,
  plate,
  AMBER,
  CYAN,
  MINT,
} from "@/components/lab/bench-atoms";
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
 *
 * "Sweep the distance" walks the reflector from near to far and back, so the
 * reader sees the two times grow together and can catch the exact distance at
 * which the echo stops being a second sound.
 */

type Mode = "cliff" | "sonar";

const W = 820;
const H = 380;
const SOURCE_X = 100;
const MAX_D = 1000;
const SURFACE_Y = 66;

/** Seconds the full out-and-back trip takes to draw. */
const PULSE_SECONDS = 2.6;
/** Seconds a full distance sweep takes. */
const SWEEP_SECONDS = 12;

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
  const [sweeping, setSweeping] = useState(false);
  const [phase, setPhase] = useState(0); /* 0 at source → 0.5 at reflector → 1 home */
  const last = useRef<number | null>(null);
  const sweepPhase = useRef(0);

  useAnimationFrame((time) => {
    if (!running && !sweeping) {
      last.current = time;
      return;
    }
    if (last.current === null) last.current = time;
    const dt = Math.min(64, time - last.current);
    last.current = time;

    if (running) {
      const next = Math.min(1, phase + dt / 1000 / PULSE_SECONDS);
      setPhase(next);
      if (next >= 1) setRunning(false);
    }
    if (sweeping) {
      /* 20 m → 980 m and back, so the reflector never sits still. */
      sweepPhase.current = (sweepPhase.current + dt / 1000 / SWEEP_SECONDS) % 2;
      const triangle = sweepPhase.current <= 1 ? sweepPhase.current : 2 - sweepPhase.current;
      setDistance(Math.round((20 + triangle * 960) / 10) * 10);
    }
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
  const reflectorX = SOURCE_X + 80 + (distance / MAX_D) * 520;
  const bedY = 108 + (distance / MAX_D) * 168;

  const run = () => {
    if (running) return;
    setPhase(0);
    setRunning(true);
  };
  const toggleSweep = () => {
    if (!sweeping) {
      last.current = null;
      setPhase(0);
    }
    setSweeping((value) => !value);
  };

  const pulseX = SOURCE_X + travel * (reflectorX - SOURCE_X);
  const pulseY = SURFACE_Y + travel * (bedY - SURFACE_Y);
  const homebound = phase > 0.5;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 9 · Sound — reflection and echo"
        title="Send a pulse, time it back"
        meta={
          <>
            <span className="apple-lab-chip">
              {mode === "cliff" ? `air at ${temp} °C · ${speed.toFixed(0)} m/s` : `sea water · ${WATER} m/s`}
            </span>
            <LiveDot on={running || sweeping} label={running ? (homebound ? "returning" : "outgoing") : sweeping ? "sweeping d" : "ready"} />
          </>
        }
        toolbar={
          <>
            <Picker
              label="Experiment"
              value={mode}
              options={[
                { id: "cliff", label: "Echo from a cliff" },
                { id: "sonar", label: "SONAR at sea" },
              ]}
              onChange={(next) => {
                setRunning(false);
                setSweeping(false);
                setMode(next);
              }}
            />
            <div>
              <p className="apple-lab-micro">On the plate</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageToggle label="Sweep the distance" checked={sweeping} onChange={() => toggleSweep()} />
              </div>
            </div>
          </>
        }
        rail={
          <>
            <button
              type="button"
              className={`apple-lab-btn ${running ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
              onClick={() => (running ? setRunning(false) : run())}
            >
              {running ? "Halt the pulse" : phase >= 1 ? "Send again" : "Send pulse"}
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(phase * 100).toFixed(1)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              t = {clock.toFixed(3)} s of {echoTime.toFixed(3)} s
            </span>
            <span className="ml-auto inline-flex items-center gap-3 text-[10.5px] text-[var(--lab-ink-dim)]">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} /> out
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: MINT }} /> back
              </span>
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="Speed of sound" value={`${speed.toFixed(0)} m/s`} tone="cyan" />
            <StageStat label="One-way time d/v" value={`${oneWay.toFixed(3)} s`} />
            <StageStat label="Echo time 2d/v" value={`${echoTime.toFixed(3)} s`} tone="amber" />
            <StageStat label="Shortest distinct echo" value={`${minDistinct.toFixed(1)} m`} tone="mint" />
          </>
        }
        note="The pulse must go there and come back, so the clock measures 2d — which is why the depth is half of v × t. SONAR uses exactly this sum, with sound too high-pitched for us to hear."
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={mode === "cliff" ? "A pulse travelling from a person to a cliff and back" : "A SONAR pulse travelling from a ship to the sea bed and back"}>
          {mode === "cliff" ? (
            <>
              <line x1={20} y1={272} x2={W - 20} y2={272} stroke={ink(0.25)} strokeWidth={2} />
              {/* The cliff is drawn where the slider says it is. */}
              <path
                d={`M ${reflectorX} 272 L ${reflectorX} 96 L ${reflectorX + 20} 76 L ${reflectorX + 50} 92 L ${reflectorX + 50} 272 Z`}
                fill={plate(0.55)}
                stroke={ink(0.4)}
                strokeWidth={1.4}
              />
              <line x1={reflectorX + 7} y1={140} x2={reflectorX + 44} y2={133} stroke={ink(0.2)} strokeWidth={1.2} />
              <line x1={reflectorX + 7} y1={182} x2={reflectorX + 44} y2={173} stroke={ink(0.2)} strokeWidth={1.2} />
              <text x={reflectorX + 25} y={66} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>
                cliff
              </text>

              {/* Person */}
              <circle cx={SOURCE_X} cy={213} r={7} fill="none" stroke={ink(0.6)} strokeWidth={2} />
              <path
                d={`M ${SOURCE_X} 220 l0 26 M ${SOURCE_X - 14} 232 l14 -6 l14 6 M ${SOURCE_X} 246 l-10 18 M ${SOURCE_X} 246 l10 18`}
                fill="none"
                stroke={ink(0.6)}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <text x={SOURCE_X} y={292} textAnchor="middle" fontSize={11.5} fill={ink(0.55)}>
                you
              </text>
            </>
          ) : (
            <>
              <rect x={20} y={SURFACE_Y} width={W - 40} height={H - SURFACE_Y - 14} fill={CYAN} opacity={0.05} />
              <line x1={20} y1={SURFACE_Y} x2={W - 20} y2={SURFACE_Y} stroke={CYAN} strokeWidth={1.6} opacity={0.65} />
              {/* Sea bed at the depth the slider says. */}
              <path
                d={`M 20 ${bedY + 8} Q 120 ${bedY - 6} 240 ${bedY + 5} T 460 ${bedY + 3} T 700 ${bedY + 8} L 700 ${bedY + 30} L 20 ${bedY + 30} Z`}
                fill={plate(0.5)}
                stroke={ink(0.35)}
                strokeWidth={1.2}
              />
              <text x={W - 32} y={bedY + 24} textAnchor="end" fontSize={11} fill={ink(0.5)}>
                sea bed
              </text>

              {/* Ship on the surface, with a mast so it reads at a glance. */}
              <path
                d={`M ${140 - 38} ${SURFACE_Y} l8 -22 l60 0 l8 22 Z`}
                fill={plate(0.72)}
                stroke={ink(0.45)}
                strokeWidth={1.3}
              />
              <line x1={140} y1={SURFACE_Y - 22} x2={140} y2={SURFACE_Y - 48} stroke={ink(0.5)} strokeWidth={1.6} />
              <line x1={140} y1={SURFACE_Y - 42} x2={160} y2={SURFACE_Y - 35} stroke={ink(0.5)} strokeWidth={1.4} />
              <text x={140} y={SURFACE_Y - 56} textAnchor="middle" fontSize={11} fill={ink(0.55)}>
                ship
              </text>

              {/* The sonar cone the pulse travels inside. */}
              <path
                d={`M 126 ${SURFACE_Y + 2} L 60 ${bedY} L 228 ${bedY} Z`}
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
                y1={318}
                x2={reflectorX}
                y2={318}
                stroke={ink(0.32)}
                strokeWidth={1.2}
                strokeDasharray="5 5"
              />
              <line x1={SOURCE_X} y1={311} x2={SOURCE_X} y2={325} stroke={ink(0.32)} strokeWidth={1.2} />
              <line x1={reflectorX} y1={311} x2={reflectorX} y2={325} stroke={ink(0.32)} strokeWidth={1.2} />
              <text
                x={(SOURCE_X + reflectorX) / 2}
                y={338}
                textAnchor="middle"
                fontSize={12}
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
                x1={286}
                y1={SURFACE_Y}
                x2={286}
                y2={bedY}
                stroke={ink(0.32)}
                strokeWidth={1.2}
                strokeDasharray="5 5"
              />
              <line x1={279} y1={SURFACE_Y} x2={293} y2={SURFACE_Y} stroke={ink(0.32)} strokeWidth={1.2} />
              <line x1={279} y1={bedY} x2={293} y2={bedY} stroke={ink(0.32)} strokeWidth={1.2} />
              <text
                x={302}
                y={(SURFACE_Y + bedY) / 2 + 4}
                fontSize={12}
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
                  cx={mode === "cliff" ? pulseX : 140}
                  cy={mode === "cliff" ? 216 : pulseY}
                  r={9 + ring * 11}
                  fill="none"
                  stroke={homebound ? MINT : AMBER}
                  strokeWidth={2 - ring * 0.45}
                  opacity={0.85 - ring * 0.22}
                />
              ))}
              <circle
                cx={mode === "cliff" ? pulseX : 140}
                cy={mode === "cliff" ? 216 : pulseY}
                r={3.4}
                fill={homebound ? MINT : AMBER}
              />
            </g>
          ) : null}
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Set the measurement</p>
            <span className="text-[10.5px] text-[var(--lab-ink-micro)]">the drawing follows</span>
          </div>
          <Range
            label="Reflector distance d"
            value={distance}
            min={10}
            max={MAX_D}
            step={10}
            unit="m"
            format={(v) => v.toFixed(0)}
            onChange={(v) => {
              setRunning(false);
              setSweeping(false);
              setDistance(v);
            }}
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
              onChange={setTemp}
            />
          ) : null}
        </div>

        <div
          className={`rounded-xl border px-3.5 py-3 ${distinct ? "border-[color-mix(in_srgb,var(--lab-diagram-mint)_45%,transparent)]" : "border-[color-mix(in_srgb,var(--lab-diagram-amber)_45%,transparent)]"}`}
        >
          <p
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: distinct ? "var(--lab-diagram-mint)" : "var(--lab-diagram-amber)" }}
          >
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: distinct ? "var(--lab-diagram-mint)" : "var(--lab-diagram-amber)" }} />
            {distinct ? "You hear two sounds" : "You hear one prolonged sound"}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--lab-ink-dim)]">
            {distinct
              ? `The echo arrives ${(echoTime * 1000).toFixed(0)} ms after the shout — later than the ear's ~100 ms hold, so it comes back as a second sound.`
              : `At ${distance} m it returns in ${(echoTime * 1000).toFixed(0)} ms, inside the ear's ~100 ms hold, so it just makes the shout sound longer. Move past ${minDistinct.toFixed(0)} m to hear it.`}
          </p>
        </div>

        <Questions
          columns={1}
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
