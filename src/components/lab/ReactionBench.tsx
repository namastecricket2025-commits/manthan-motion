import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, Beaker as BeakerIcon, Droplets, Flame, FlaskConical, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { REACTIONS, SUBSTANCES } from "./reactions";
import type { Reaction, Substance } from "./reactions";
import { sfx } from "./lab-sound";
import { SPRING, useCanvasSize, useRaf } from "./use-canvas";
import { animDt } from "@/lib/app-settings";
import { useTelemetryPublisher } from "./PhysicsSim";

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
  if (["h2", "ch4", "s"].includes(id)) return HAZARD.flammable;
  if (["hcl", "h2so4", "h2o2", "naoh"].includes(id)) return HAZARD.corrosive;
  if (["agno3", "cuso4", "bacl2", "kmno4", "pbno3", "h2s", "so2"].includes(id)) return HAZARD.toxic;
  if (["na", "mg", "zn", "fe", "c", "cao", "k", "al", "ca"].includes(id)) return HAZARD.reactive;
  return HAZARD.inert;
};

/* ---------- shelf groups ---------- */
const GROUPS: { key: string; label: string; ids: string[] }[] = [
  {
    key: "metals",
    label: "Metals & elemental",
    ids: ["na", "k", "ca", "mg", "al", "zn", "fe", "cu", "pb", "c", "s"],
  },
  { key: "acids", label: "Acids", ids: ["hcl", "h2so4"] },
  {
    key: "bases",
    label: "Bases & carbonates",
    ids: ["naoh", "nh3", "na2co3", "nahco3", "cao", "fe2o3", "caco3"],
  },
  {
    key: "solutions",
    label: "Solutions",
    ids: ["h2o", "h2o2", "nacl", "cuso4", "agno3", "bacl2", "na2so4", "ki", "pbno3", "nabr", "kmno4"],
  },
  { key: "gases", label: "Gases", ids: ["h2", "o2", "n2", "cl2", "co2", "ch4", "h2s", "so2"] },
];

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
    /* Motionless Mode parks the gas cloud: velocities stop being kicked and the
       integrator is fed a zero delta, so the collision screen holds its frame. */
    const adt = animDt(dt);
    if (st.running && adt > 0) {
      for (const m of mols) {
        m.vx += (Math.random() - 0.5) * 240 * adt;
        m.vy += (Math.random() - 0.5) * 240 * adt;
        const vmag = Math.hypot(m.vx, m.vy);
        if (vmag > 260 * speed) {
          m.vx = (m.vx / vmag) * 260 * speed;
          m.vy = (m.vy / vmag) * 260 * speed;
        }
        m.x += m.vx * adt * speed;
        m.y += m.vy * adt * speed;
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
        m.x += m.vx * adt * 0.06;
        m.y += m.vy * adt * 0.06;
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
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
              <BeakerIcon className={`mx-auto h-8 w-8 ${over ? "text-[#aab3ff]" : "text-slate-500"}`} />
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
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const timer = useRef<number | null>(null);

  // publish live bench telemetry
  const publish = useTelemetryPublisher();
  useEffect(() => {
    const celsius = Math.round(25 + temp * 575);
    publish({
      subject: "Chemistry · Reaction bench",
      rows: [
        { k: "Reagents loaded", v: `${slotA ? 1 : 0} + ${slotB ? 1 : 0}` },
        { k: "Temperature", v: `${celsius} °C` },
        { k: "Reaction phase", v: phase },
        { k: "Outcome", v: result ? (result.ok ? result.r!.eq : "no reaction") : "—" },
      ],
      equation: "k = A·e^(−Ea/RT)",
      eqNote: "Arrhenius: raise T and the collision-energy tail crosses the activation-energy barrier more often.",
      signal: temp,
      accent: "#aab3ff",
    });
  }, [slotA, slotB, temp, phase, result, publish]);

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

  const swap = () => {
    setSlotA(slotB);
    setSlotB(slotA);
    setResult(null);
    setPhase("idle");
  };

  const addToSlot = (s: Substance) => {
    if (!slotA) setSlotA(s);
    else if (!slotB) setSlotB(s);
    else if (slotA.id !== s.id) setSlotB(s);
    else if (slotB.id !== s.id) setSlotB(s);
  };

  const q = query.trim().toLowerCase();
  const visible = (id: string) => {
    if (group !== "all" && !GROUPS.find((g) => g.key === group)?.ids.includes(id)) return false;
    if (!q) return true;
    const s = SUBSTANCES.find((x) => x.id === id)!;
    return s.name.toLowerCase().includes(q) || s.formula.toLowerCase().includes(q);
  };

  return (
    <div className="lab-col space-y-5">
      {/* shelf */}
      <div className="lab-glass p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Reagent shelf</p>
            <p className="text-[11px] text-slate-500">
              {SUBSTANCES.length} reagents · drag into a beaker, or tap to load the next empty one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a reagent…"
                className="lab-search"
                style={{ width: 150 }}
              />
            </div>
            <span className="lab-chip hidden sm:inline-flex">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> {SUBSTANCES.length} reagents
            </span>
          </div>
        </div>

        {/* group filter */}
        <div className="lab-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setGroup("all")}
            className={`lab-chip shrink-0 !cursor-pointer ${group === "all" ? "!border-[#8b93ff]/60 !text-[#aab3ff]" : ""}`}
          >
            All
          </button>
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroup(group === g.key ? "all" : g.key)}
              className={`lab-chip shrink-0 !cursor-pointer ${group === g.key ? "!border-[#8b93ff]/60 !text-[#aab3ff]" : ""}`}
            >
              {g.label}
              <span className="text-slate-500">{g.ids.length}</span>
            </button>
          ))}
        </div>

        {/* shelf grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3">
          {SUBSTANCES.filter((s) => visible(s.id)).map((s) => {
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
                className="lab-tile h-[108px] shrink-0"
                style={{ ["--tile-c" as string]: s.color }}
                title={`${s.name} (${s.state})`}
              >
                <span className={`rounded-full border px-1.5 py-px text-[8px] font-bold ${hz.cls}`}>
                  {hz.label}
                </span>
                <span className="font-display text-xl font-bold text-slate-50">
                  {s.formula}
                </span>
                <span className="max-w-[76px] truncate text-[9px] text-slate-400">{s.name}</span>
                <span className="text-[8px] uppercase tracking-widest text-slate-500">{s.state}</span>
                {inSlot && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#8b93ff] shadow-[0_0_8px_rgba(139,147,255,0.9)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* bench */}
      <div className="lab-split">
        <div className="lab-stage-pane lab-glass p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">Workbench</p>
            <div className="flex items-center gap-2">
              <span className="lab-chip hidden sm:inline-flex">
                <TriangleAlert className="h-3 w-3 text-amber-400" /> Safety goggles on
              </span>
              <button type="button" onClick={swap} className="lab-btn" disabled={!slotA && !slotB} title="Swap beakers">
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
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
            <p className="mt-1 text-[10px] text-slate-500">
              Higher temperature = faster molecular motion = more energetic collisions (but never invents a reaction that doesn't exist).
            </p>
          </div>
        </div>

        {/* split-screen collision + result */}
        <div className="lab-deck-pane lab-glass-deep flex flex-col overflow-hidden p-4 sm:p-5">
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
                          <span className="rounded-md bg-[#8b93ff] px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(139,147,255,0.5)]">
                            products
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                          <Chem text={result.r.eq} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#aab3ff]">
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
                    Press <span className="font-semibold text-[#aab3ff]">React</span> to observe the collision chamber.
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