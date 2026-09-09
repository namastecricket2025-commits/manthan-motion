import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Beaker as BeakerIcon, Droplets, Flame, FlaskConical, RefreshCw, TriangleAlert } from "lucide-react";
import { REACTIONS, SUBSTANCES } from "./reactions";
import type { Reaction, Substance } from "./reactions";
import { sfx } from "./lab-sound";
import { SPRING, useCanvasSize, useRaf } from "./use-canvas";

/* ---------- formula rendering (digits → subscripts) ---------- */
function Chem({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: React.ReactNode[] = [];
    text.split(/(->)/).forEach((token, ti) => {
      if (token === "->") {
        out.push(
          <span key={ti} className="mx-1 text-slate-300">
            →
          </span>,
        );
        return;
      }
      token.split(/(\d+)/).forEach((chunk, ci) => {
        if (!chunk) return;
        if (/^\d+$/.test(chunk)) {
          out.push(
            <sub key={`${ti}-${ci}`} className="text-[0.72em]">
              {chunk}
            </sub>,
          );
        } else {
          out.push(
            <span key={`${ti}-${ci}`} className="font-semibold">
              {chunk}
            </span>,
          );
        }
      });
    });
    return out;
  }, [text]);
  return <span className="font-display text-[15px] tracking-wide text-slate-100">{parts}</span>;
}

const HAZARD: Record<string, { label: string; cls: string }> = {
  flammable: { label: "Flammable", cls: "border-orange-400/40 text-orange-300 bg-orange-400/10" },
  corrosive: { label: "Corrosive", cls: "border-red-400/40 text-red-300 bg-red-400/10" },
  toxic: { label: "Toxic", cls: "border-fuchsia-400/40 text-fuchsia-300 bg-fuchsia-400/10" },
  reactive: { label: "Reactive", cls: "border-amber-300/40 text-amber-200 bg-amber-300/10" },
  inert: { label: "Inert", cls: "border-slate-400/30 text-slate-400 bg-slate-400/10" },
};
const hazardOf = (id: string) => {
  if (["h2", "ch4"].includes(id)) return HAZARD.flammable;
  if (["hcl", "h2so4", "h2o2", "naoh"].includes(id)) return HAZARD.corrosive;
  if (["agno3", "cuso4", "bacl2", "kmno4"].includes(id)) return HAZARD.toxic;
  if (["na", "mg", "zn", "fe", "c", "cao"].includes(id)) return HAZARD.reactive;
  return HAZARD.inert;
};

/* ---------- particle collision screen ---------- */
function CollisionScreen({ a, b, temp, running }: { a: Substance; b: Substance; temp: number; running: boolean }) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const molecules = useRef<
    { x: number; y: number; vx: number; vy: number; r: number; c: string }[]
  >([]);
  const stats = useRef({ hits: 0, sparks: 0 });
  const state = useRef({ a, b, temp, running });
  state.current = { a, b, temp, running };

  useRaf((dt) => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const st = state.current;

    if (molecules.current.length === 0) {
      const mk = (c: string, n: number) => {
        for (let i = 0; i < n; i++) {
          molecules.current.push({
            x: 30 + Math.random() * (w - 60),
            y: 30 + Math.random() * (h - 60),
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            r: 5 + Math.random() * 4,
            c,
          });
        }
      };
      mk(st.a.color, 26);
      mk(st.b.color, 26);
    }

    const speed = 0.25 + st.temp * 0.85;
    const mols = molecules.current;
    if (st.running) {
      for (const m of mols) {
        m.vx += (Math.random() - 0.5) * 240 * dt;
        m.vy += (Math.random() - 0.5) * 240 * dt;
        const vmag = Math.hypot(m.vx, m.vy);
        if (vmag > 260 * speed) {
          m.vx = (m.vx / vmag) * 260 * speed;
          m.vy = (m.vy / vmag) * 260 * speed;
        }
        m.x += m.vx * dt * speed;
        m.y += m.vy * dt * speed;
        if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx); }
        if (m.x > w - m.r) { m.x = w - m.r; m.vx = -Math.abs(m.vx); }
        if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy); }
        if (m.y > h - m.r) { m.y = h - m.r; m.vy = -Math.abs(m.vy); }
      }
      // pair collisions
      for (let i = 0; i < mols.length; i++) {
        for (let j = i + 1; j < mols.length; j++) {
          const A = mols[i];
          const B = mols[j];
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const dist = Math.hypot(dx, dy);
          if (dist < A.r + B.r && dist > 0.001) {
            const rel = Math.hypot(A.vx - B.vx, A.vy - B.vy);
            stats.current.hits++;
            if (A.c !== B.c && rel > 200) stats.current.sparks++;
            // elastic-ish swap
            const nx = dx / dist;
            const ny = dy / dist;
            const vRel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
            if (vRel > 0) {
              A.vx -= vRel * nx; A.vy -= vRel * ny;
              B.vx += vRel * nx; B.vy += vRel * ny;
            }
          }
        }
      }
    } else {
      for (const m of mols) {
        m.x += m.vx * dt * 0.06;
        m.y += m.vy * dt * 0.06;
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // sparks
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of mols) {
      const g = ctx.createRadialGradient(m.x, m.y, 0.5, m.x, m.y, m.r * 3);
      g.addColorStop(0, m.c);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText(`collisions ${stats.current.hits} · energetic ${stats.current.sparks}`, 12, 18);
  });

  return (
    <canvas
      ref={ref}
      className="h-52 w-full rounded-xl border border-white/10 bg-[#0b1120] sm:h-56"
    />
  );
}

/* ---------- beaker ---------- */
function Beaker({
  label,
  substance,
  onDrop,
  onClear,
  over,
  setOver,
}: {
  label: string;
  substance: Substance | null;
  onDrop: (s: Substance) => void;
  onClear: () => void;
  over: boolean;
  setOver: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div
        className="lab-slot flex h-44 w-full items-end justify-center overflow-hidden p-3 transition-all"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData("text/plain");
          const s = SUBSTANCES.find((x) => x.id === id);
          if (s) onDrop(s);
        }}
      >
        <AnimatePresence mode="wait">
          {substance ? (
            <motion.div
              key={substance.id}
              initial={{ y: 40, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={SPRING}
              className="relative flex w-full flex-col items-center"
            >
              {/* liquid */}
              <motion.div
                className="w-full rounded-b-xl border border-t-0"
                style={{
                  height: 74,
                  borderColor: `${substance.color}66`,
                  background: `linear-gradient(180deg, ${substance.color}44, ${substance.color}22)`,
                }}
                initial={{ height: 6 }}
                animate={{ height: 74 }}
                transition={SPRING}
              />
              {/* bubble */}
              {substance.state === "gas" && (
                <span className="lab-float absolute -top-1 text-sm text-slate-300">◌◌◌</span>
              )}
              <div
                className="absolute bottom-0 flex w-full items-center justify-between rounded-b-xl px-3 py-1.5"
                style={{ background: `${substance.color}1f` }}
              >
                <span className="text-[11px] font-bold tracking-wider text-slate-100">
                  {substance.formula}
                </span>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-full px-1.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pb-6 text-center"
            >
              <BeakerIcon className={`mx-auto h-8 w-8 ${over ? "text-[#ff647c]" : "text-slate-500"}`} />
              <p className="mt-1 text-[11px] text-slate-500">
                Drag or tap a substance here
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="lab-label">{label}</span>
    </div>
  );
}

/* ---------- main bench ---------- */
export default function ReactionBench() {
  const [slotA, setSlotA] = useState<Substance | null>(null);
  const [slotB, setSlotB] = useState<Substance | null>(null);
  const [temp, setTemp] = useState(0.4); // 0..1 (25–600 °C)
  const [phase, setPhase] = useState<"idle" | "colliding" | "done">("idle");
  const [result, setResult] = useState<{ ok: boolean; r?: Reaction; a: Substance; b: Substance } | null>(null);
  const [over, setOver] = useState<"A" | "B" | null>(null);
  const timer = useRef<number | null>(null);

  const canReact = slotA && slotB && phase !== "colliding";

  const react = () => {
    if (!slotA || !slotB) return;
    setPhase("colliding");
    setResult(null);
    sfx.whoosh();
    const key = [slotA.id, slotB.id].sort().join("|");
    const r = REACTIONS[key];
    timer.current = window.setTimeout(() => {
      setResult({ ok: !!r, r, a: slotA, b: slotB });
      setPhase("done");
      sfx.pop();
    }, 3400);
  };

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setSlotA(null);
    setSlotB(null);
    setResult(null);
    setPhase("idle");
  };

  const addToSlot = (s: Substance) => {
    if (!slotA) setSlotA(s);
    else if (!slotB) setSlotB(s);
    else if (slotA.id !== s.id) setSlotB(s);
  };

  return (
    <div className="space-y-5">
      {/* shelf */}
      <div className="lab-glass p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Reagent shelf</p>
            <p className="text-[11px] text-slate-500">
              Drag a substance into a beaker, or tap to load the next empty one.
            </p>
          </div>
          <span className="lab-chip hidden sm:inline-flex">
            <Flame className="h-3.5 w-3.5 text-orange-400" /> {SUBSTANCES.length} reagents · curated pairs
          </span>
        </div>
        <div className="lab-scroll flex gap-3 overflow-x-auto pb-2">
          {SUBSTANCES.map((s) => {
            const hz = hazardOf(s.id);
            const inSlot = slotA?.id === s.id || slotB?.id === s.id;
            return (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", s.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addToSlot(s)}
                className="lab-tile h-[104px] w-[86px] shrink-0"
                style={{ ["--tile-c" as string]: s.color }}
                title={`${s.name} (${s.state})`}
              >
                <span
                  className={`rounded-full border px-1.5 py-px text-[8px] font-bold ${hz.cls}`}
                >
                  {hz.label}
                </span>
                <span className="font-display text-xl font-bold text-slate-50">
                  {s.formula}
                </span>
                <span className="max-w-[72px] truncate text-[9px] text-slate-400">{s.name}</span>
                <span className="text-[8px] uppercase tracking-widest text-slate-500">{s.state}</span>
                {inSlot && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff3b5c] shadow-[0_0_8px_rgba(255,59,92,0.9)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* bench */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="lab-glass p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">Workbench</p>
            <div className="flex items-center gap-2">
              <span className="lab-chip">
                <TriangleAlert className="h-3 w-3 text-amber-400" /> Safety goggles on
              </span>
              <button type="button" onClick={reset} className="lab-btn">
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <Beaker label="Beaker A" substance={slotA} over={over === "A"} setOver={(v) => setOver(v ? "A" : null)} onDrop={setSlotA} onClear={() => setSlotA(null)} />
            <motion.button
              type="button"
              onClick={react}
              disabled={!canReact}
              className="lab-btn lab-btn-neon mb-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              whileTap={{ scale: 0.94 }}
            >
              <FlaskConical className="h-4 w-4" />
              React
            </motion.button>
            <Beaker label="Beaker B" substance={slotB} over={over === "B"} setOver={(v) => setOver(v ? "B" : null)} onDrop={setSlotB} onClear={() => setSlotB(null)} />
          </div>

          {/* temperature */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <span className="lab-label">
                <Flame className="mr-1 inline h-3 w-3 text-orange-400" />
                Bunsen temperature
              </span>
              <span className="lab-value text-xs text-orange-300">
                {Math.round(25 + temp * 575)} °C
              </span>
            </div>
            <input
              type="range"
              className="lab-range mt-2"
              min={0}
              max={1}
              step={0.01}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
            />
          </div>
        </div>

        {/* split-screen collision + result */}
        <div className="lab-glass-deep flex flex-col overflow-hidden p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">
              {phase === "colliding" ? "Particle chamber — collision view" : "Reaction chamber"}
            </p>
            <span className="lab-chip">
              <Droplets className="h-3 w-3 text-cyan-300" /> gas-phase model
            </span>
          </div>
          {slotA && slotB ? (
            <>
              <CollisionScreen a={slotA} b={slotB} temp={temp} running={phase === "colliding"} />
              <AnimatePresence mode="wait">
                {phase === "colliding" ? (
                  <motion.div
                    key="colliding"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-center text-[11px] text-cyan-300"
                  >
                    <span className="lab-pulse inline-block">
                      Molecules colliding — raising temperature speeds them up…
                    </span>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key={result.ok ? "ok" : "none"}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING}
                    className="mt-3 rounded-xl border p-3"
                  >
                    {result.ok && result.r ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: result.a.color }}>
                            {result.a.formula}
                          </span>
                          <span className="text-slate-400">+</span>
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: result.b.color }}>
                            {result.b.formula}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="rounded-md bg-[#ff3b5c] px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(255,59,92,0.5)]">
                            products
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                          <Chem text={result.r.eq} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff647c]">
                            {result.r.type}
                          </p>
                          {result.r.energy === "exo" && (
                            <span className="lab-chip !border-orange-400/40 !text-orange-300">
                              <Flame className="h-3 w-3" /> Exothermic · heat released
                            </span>
                          )}
                          {result.r.energy === "endo" && (
                            <span className="lab-chip !border-cyan-400/40 !text-cyan-300">
                              <Droplets className="h-3 w-3" /> Endothermic · absorbs heat
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{result.r.note}</p>
                      </>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-200">No direct reaction</p>
                        <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-slate-500">
                          {result.a.name} and {result.b.name} don't combine under these conditions.
                          Try a different pair — e.g. an acid with a carbonate, or a metal with an acid.
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="wait"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 text-center text-[11px] text-slate-500"
                  >
                    Press <span className="font-semibold text-[#ff647c]">React</span> to observe the collision chamber.
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-center">
              <FlaskConical className="h-8 w-8 text-slate-600" />
              <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
                Load two substances into the beakers to arm the chamber. Balanced equations only
                appear for reactions that genuinely occur.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}