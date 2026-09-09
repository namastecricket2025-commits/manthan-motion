import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Atom, Move, Pause, Play, RotateCcw, Waves, Zap } from "lucide-react";
import { SPRING, useCanvasSize, useRaf, clamp } from "./use-canvas";
import OpticsBench from "./physics/OpticsBench";
import WaveTank from "./physics/WaveTank";
import ACCircuit from "./physics/ACCircuit";

type PhysTab = "motion" | "optics" | "waves" | "circuits";

const PRESETS = [
  { key: "ice", label: "Ice", mu: 0.03 },
  { key: "wood", label: "Wood", mu: 0.3 },
  { key: "rubber", label: "Rubber", mu: 0.6 },
];

/* ---------------- motion lab ---------------- */
function MotionLab() {
  const [v0, setV0] = useState(8);
  const [mass, setMass] = useState(2);
  const [mu, setMu] = useState(0.3);
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  const [x, setX] = useState(0);
  const [v, setV] = useState(0);
  const [a, setA] = useState(0);
  const [ended, setEnded] = useState<"stopped" | "ran-off" | null>(null);
  const log = useRef<{ t: number; x: number; v: number; a: number }[]>([]);
  const [traces, setTraces] = useState({ pos: true, vel: true, acc: true });
  const state = useRef({ v0, mass, mu, running });
  state.current = { v0, mass, mu, running };

  const g = 9.81;
  const predicted = useMemo(() => {
    const dec = g * mu;
    return { ts: v0 / dec, ds: (v0 * v0) / (2 * dec) };
  }, [v0, mu, g]);

  useRaf((dt) => {
    const st = state.current;
    if (!st.running) return;
    const dec = g * st.mu;
    let nv = v - dec * dt;
    let nx = x + ((v + nv) / 2) * dt;
    let nt = t + dt;
    if (nv <= 0) {
      nv = 0;
      setRunning(false);
      setEnded("stopped");
    }
    if (nx >= 100) {
      nx = 100;
      setRunning(false);
      setEnded("ran-off");
    }
    setT(nt);
    setX(nx);
    setV(nv);
    setA(nv > 0 ? -dec : 0);
    log.current.push({ t: nt, x: nx, v: nv, a: nv > 0 ? -dec : 0 });
    if (log.current.length > 900) log.current.splice(0, 60);
  });

  const start = () => {
    setRunning(true);
    setEnded(null);
  };
  const reset = () => {
    setRunning(false);
    setT(0);
    setX(0);
    setV(v0);
    setA(0);
    setEnded(null);
    log.current = [];
  };

  const ke = 0.5 * mass * v * v;
  const p = mass * v;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
      <div className="space-y-4">
        {/* track */}
        <div className="lab-glass p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-100">Motion lab — friction dynamics</p>
              <p className="text-[11px] text-slate-500">
                Set initial velocity, mass and friction; run the block and read its live kinematics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!running ? (
                <button type="button" onClick={start} className="lab-btn lab-btn-neon" disabled={!!ended && x >= 100}>
                  <Play className="h-3.5 w-3.5" /> Run
                </button>
              ) : (
                <button type="button" onClick={() => setRunning(false)} className="lab-btn">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
              )}
              <button type="button" onClick={reset} className="lab-btn">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>

          {/* track */}
          <div className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120]">
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700" />
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-slate-600" style={{ left: `${i * 5}%` }} />
            ))}
            {[0, 25, 50, 75, 100].map((m) => (
              <span key={m} className="absolute top-[62%] -translate-x-1/2 text-[9px] text-slate-500" style={{ left: `${m}%` }}>
                {m} m
              </span>
            ))}
            {/* block */}
            <motion.div
              className="absolute top-1/2 z-10 -translate-y-1/2 rounded-lg border border-slate-300/60 bg-gradient-to-br from-slate-200 to-slate-400 shadow-[0_4px_14px_rgba(2,6,23,0.6)]"
              style={{ left: `calc(${clamp(x, 0, 100)}% - 17px)`, width: 34, height: 30 }}
              animate={running ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.35 }}
            />
            {/* friction shimmer */}
            <span
              className="absolute bottom-1 left-0 h-[3px] rounded-full bg-[#ff3b5c] transition-all duration-100"
              style={{ width: `${clamp(x, 0, 100)}%`, opacity: a < -0.01 ? 0.5 : 0 }}
            />
            {ended === "ran-off" && (
              <span className="lab-pulse absolute right-3 top-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Ran off the 100 m track
              </span>
            )}
          </div>

          {/* readouts */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { k: "Time", v: `${t.toFixed(2)} s` },
              { k: "Distance", v: `${x.toFixed(1)} m` },
              { k: "Velocity", v: `${v.toFixed(2)} m/s` },
              { k: "Accel.", v: `${a.toFixed(2)} m/s²` },
              { k: "Kinetic E", v: `${ke.toFixed(2)} J` },
              { k: "Momentum", v: `${p.toFixed(2)} kg·m/s` },
            ].map((r) => (
              <div key={r.k} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <p className="lab-label">{r.k}</p>
                <p className="lab-value mt-1 text-[13px]">{r.v}</p>
              </div>
            ))}
          </div>

          {/* stop report */}
          {ended && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 text-[11px]"
            >
              {ended === "stopped" ? (
                <>
                  <span className="font-bold text-emerald-300">Block came to rest</span>
                  <span className="lab-value">
                    t actual {t.toFixed(2)} s vs predicted {predicted.ts.toFixed(2)} s
                  </span>
                  <span className="lab-value">
                    d actual {x.toFixed(1)} m vs predicted {predicted.ds.toFixed(1)} m
                  </span>
                  <span className="text-slate-500">deceleration a = −μg = {(-g * mu).toFixed(2)} m/s²</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-amber-300">Track ran out first</span>
                  <span className="text-slate-400">
                    With μ = {mu} the block would stop at {predicted.ds.toFixed(0)} m — beyond the 100 m
                    rail. Increase friction to see it halt.
                  </span>
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* graph */}
        <div className="lab-glass p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-100">Live graph</p>
            <div className="flex gap-1.5">
              {(
                [
                  { key: "pos", label: "position", color: "#22d3ee" },
                  { key: "vel", label: "velocity", color: "#a78bfa" },
                  { key: "acc", label: "accel", color: "#ff647c" },
                ] as const
              ).map((tr) => (
                <button
                  key={tr.key}
                  type="button"
                  onClick={() => setTraces((trs) => ({ ...trs, [tr.key]: !trs[tr.key] }))}
                  className="lab-chip"
                  style={{ borderColor: traces[tr.key] ? `${tr.color}66` : undefined, color: traces[tr.key] ? tr.color : "rgba(100,116,139,0.9)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tr.color }} />
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
          <Graph log={log} traces={traces} v0={v0} />
        </div>
      </div>

      {/* controls */}
      <div className="lab-glass-deep h-fit space-y-4 p-4">
        <p className="lab-label">Setup</p>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setMu(p.mu);
                reset();
              }}
              className={`lab-btn flex-1 ${mu === p.mu ? "lab-btn--active" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {[
          { label: "Initial velocity", v: `${v0} m/s`, min: 1, max: 20, set: setV0, get: v0 },
          { label: "Mass", v: `${mass} kg`, min: 0.5, max: 10, step: 0.5, set: setMass, get: mass },
          { label: "Friction μ", v: mu.toFixed(2), min: 0.01, max: 1, step: 0.01, set: setMu, get: mu },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">{s.label}</span>
              <span className="lab-value text-slate-200">{s.v}</span>
            </div>
            <input type="range" className="lab-range mt-1.5" min={s.min} max={s.max} step={s.step ?? 1} value={s.get} onChange={(e) => s.set(Number(e.target.value))} />
          </div>
        ))}
        <div className="lab-rule" />
        <div>
          <p className="lab-label mb-1.5">Physics</p>
          <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
            <p>Friction force: <span className="lab-value text-slate-200">F = μ·m·g = {(mu * mass * g).toFixed(1)} N</span></p>
            <p>Deceleration: <span className="lab-value text-slate-200">a = −μg = {(-g * mu).toFixed(2)} m/s²</span> (mass-independent)</p>
            <p>Stop time: <span className="lab-value text-slate-200">t = v₀/μg = {predicted.ts.toFixed(2)} s</span></p>
            <p>Stop distance: <span className="lab-value text-slate-200">d = v₀²/2μg = {predicted.ds.toFixed(1)} m</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Graph({
  log,
  traces,
  v0,
}: {
  log: React.RefObject<{ t: number; x: number; v: number; a: number }[]>;
  traces: { pos: boolean; vel: boolean; acc: boolean };
  v0: number;
}) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const p = useRef({ log, traces, v0 });
  p.current = { log, traces, v0 };

  useRaf(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = p.current.log.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 34, r: 10, t: 10, b: 22 };
    const gw = w - pad.l - pad.r;
    const gh = h - pad.t - pad.b;
    const tMax = Math.max(6, ...data.map((d) => d.t));
    const X = (t: number) => pad.l + (t / tMax) * gw;

    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.fillStyle = "rgba(100,116,139,0.8)";
    ctx.font = "9px ui-monospace, monospace";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * gh;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(String((i / 4) * 100), 4, y + 3);
    }

    const plot = (get: (d: (typeof data)[number]) => number, scale: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = X(d.t);
        const y = pad.t + gh - (clamp(get(d), 0, scale) / scale) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    if (traces.pos) plot((d) => d.x, 100, "#22d3ee");
    if (traces.vel) plot((d) => d.v, p.current.v0, "#a78bfa");
    if (traces.acc) plot((d) => -d.a, 10, "#ff647c");

    ctx.fillStyle = "rgba(226,232,240,0.7)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("t (s)", w - 24, h - 6);
  });

  return <canvas ref={ref} className="h-44 w-full rounded-xl border border-white/10 bg-[#0b1120]" />;
}

/* ---------------- shell ---------------- */
export default function PhysicsSim() {
  const [tab, setTab] = useState<PhysTab>("motion");
  return (
    <div className="space-y-4">
      <div className="lab-tabs">
        {(
          [
            { key: "motion", label: "Motion", icon: Move },
            { key: "optics", label: "Optics", icon: Atom },
            { key: "waves", label: "Waves", icon: Waves },
            { key: "circuits", label: "AC Circuits", icon: Zap },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="lab-tab">
              {active && <motion.span layoutId="phys-sub-pill" className="lab-pill" transition={SPRING} />}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#ff647c]" : "text-slate-500"}`} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "motion" && (
          <motion.div key="motion" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <MotionLab />
          </motion.div>
        )}
        {tab === "optics" && (
          <motion.div key="optics" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <OpticsBench />
          </motion.div>
        )}
        {tab === "waves" && (
          <motion.div key="waves" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <WaveTank />
          </motion.div>
        )}
        {tab === "circuits" && (
          <motion.div key="circuits" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <ACCircuit />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}