import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dna, RotateCcw } from "lucide-react";
import { sfx } from "../lab-sound";
import { SPRING, useCanvasSize, useRaf, clamp } from "../use-canvas";

const SLOTS = 8;
const SEQ = ["A", "T", "G", "C", "A", "T", "G", "C"]; // 5' → 3' template strand
const COMPL: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
const HBONDS: Record<string, number> = { A: 2, T: 2, G: 3, C: 3 };
const COLORS: Record<string, string> = {
  A: "#ff6b6b",
  T: "#60a5fa",
  G: "#4ade80",
  C: "#fbbf24",
};

const R = 64;
const PITCH = 36;
const Y0 = 46;
const YAW = 0.78;
const DIST = 380;
const F = 620;

const yawOf = (twist: number) => YAW + twist * 0.35;

function strandPoints(twist: number) {
  const yaw = yawOf(twist);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return (phase: number, cssW: number, cssH: number) => {
    const pts: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < SLOTS; i++) {
      const th = i * 0.85 + phase;
      const x = R * Math.cos(th);
      const z = R * Math.sin(th);
      const y = Y0 + i * PITCH;
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const s = F / (F + DIST + z1);
      pts.push({ x: cssW / 2 + x1 * s, y: cssH / 2 + y * s, z: z1, s });
    }
    return pts;
  };
}

export default function DnaSandbox() {
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const [mode, setMode] = useState<"explore" | "transcribe">("explore");
  const [twist, setTwist] = useState(0);
  const [selectedTile, setSelectedTile] = useState<number | null>(null); // index into tiles
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  const [flying, setFlying] = useState<{ tileIdx: number; slot: number } | null>(null);
  const [done, setDone] = useState(false);

  const dragRef = useRef<{ x: number; twist0: number } | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const st = useRef({ twist, mode, matched });
  st.current = { twist, mode, matched };
  const cssW = size.current.w / Math.max(1, size.current.dpr);
  const cssH = size.current.h / Math.max(1, size.current.dpr);

  const tiles = useMemo(() => {
    const list = SEQ.map((b) => COMPL[b]);
    // deterministic shuffle
    return [...list].sort(() => 0.45 - Math.random() * 0.9);
  }, []);

  useRaf(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = st.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cw = w / dpr;
    const ch = h / dpr;
    const ptsA = strandPoints(S.twist)(0, cw, ch);

    // backbone A
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(100,116,139,0.85)";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ptsA.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    if (S.mode === "explore") {
      const ptsB = strandPoints(S.twist)(Math.PI, cw, ch);
      // rungs
      ptsA.forEach((p, i) => {
        const q = ptsB[i];
        ctx.strokeStyle = COLORS[SEQ[i]];
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // bases
        for (const pt of [p, q]) {
          ctx.fillStyle = COLORS[SEQ[i]];
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5.5 * pt.s + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      // backbone B
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(100,116,139,0.6)";
      ctx.beginPath();
      ptsB.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    } else {
      // transcribe: slots + growing strand
      ptsA.forEach((p, i) => {
        const m = S.matched.has(i);
        ctx.fillStyle = m ? COLORS[COMPL[SEQ[i]]] : "rgba(148,163,184,0.4)";
        ctx.strokeStyle = m ? COLORS[COMPL[SEQ[i]]] : "rgba(148,163,184,0.5)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0b1120";
        ctx.font = "700 10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m ? COMPL[SEQ[i]] : "?", p.x, p.y + 0.5);
        // growing strand offset
        ctx.strokeStyle = COLORS[COMPL[SEQ[i]]];
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 120, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x + 120, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[COMPL[SEQ[i]]];
        ctx.fill();
      });
    }

    // 5'/3' labels
    ctx.fillStyle = "rgba(148,163,184,0.8)";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.textAlign = "left";
    const top = ptsA[0];
    const bot = ptsA[SLOTS - 1];
    ctx.fillText("5′", top.x + 16, top.y - 6);
    ctx.fillText("3′", bot.x + 16, bot.y + 8);
  });

  const slotScreen = (i: number) => {
    const pts = strandPoints(twist)(0, cssW, cssH);
    return pts[i];
  };

  const onCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "explore") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, twist0: twist };
  };
  const onCanvasMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTwist(clamp(d.twist0 + (e.clientX - d.x) * 0.014, -1.6, 1.6));
  };

  const snapTile = (tileIdx: number, slot: number) => {
    if (matched.has(slot) || done) return;
    const tile = tiles[tileIdx];
    if (COMPL[SEQ[slot]] === tile) {
      const btn = tileRefs.current[tileIdx];
      const canvas = canvasRef.current;
      if (btn && canvas) {
        const br = btn.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        const target = slotScreen(slot);
        setFlying({ tileIdx, slot });
        // store travel for the flying element (fixed coords)
        flyingFrom.current = { x: br.left + br.width / 2, y: br.top + br.height / 2, tx: cr.left + target.x, ty: cr.top + target.y };
      }
      setSelectedTile(null);
    } else {
      setWrongSlot(slot);
      sfx.buzz();
      window.setTimeout(() => setWrongSlot(null), 450);
    }
  };

  const flyingFrom = useRef<{ x: number; y: number; tx: number; ty: number }>({ x: 0, y: 0, tx: 0, ty: 0 });

  const startTranscribe = () => {
    setMode("transcribe");
    setTwist(0);
    setMatched(new Set());
    setDone(false);
    setFlying(null);
    setSelectedTile(null);
  };

  const hBonds = [...matched].reduce((acc, i) => acc + HBONDS[SEQ[i]], 0);
  const reset = () => {
    setMode("explore");
    setMatched(new Set());
    setDone(false);
    setFlying(null);
    setSelectedTile(null);
    setTwist(0);
  };

  return (
    <div className="space-y-4">
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">DNA transcription sandbox</p>
            <p className="text-[11px] text-slate-500">
              {mode === "explore"
                ? "Drag horizontally to twist the double helix. Antiparallel strands pair A–T (2 H-bonds) and G–C (3 H-bonds)."
                : "The helix is split — click a floating nucleotide, then tap a slot to snap it onto the growing strand."}
            </p>
          </div>
          <div className="lab-tabs">
            <button type="button" className={`lab-tab ${mode === "explore" ? "lab-tab--on" : ""}`} onClick={() => setMode("explore")}>
              Explore helix
            </button>
            <button type="button" className={`lab-tab ${mode === "transcribe" ? "lab-tab--on" : ""}`} onClick={startTranscribe}>
              Transcribe
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="h-[380px] w-full cursor-grab touch-none rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_30%,#101b30_0%,#0b1120_82%)] active:cursor-grabbing"
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={() => (dragRef.current = null)}
        />

        {/* flying tile */}
        <AnimatePresence>
          {flying && (
          <motion.button
            key={`fly-${flying.tileIdx}-${flying.slot}`}
              className="pointer-events-none fixed z-50 flex h-8 w-8 items-center justify-center rounded-full font-bold text-[#0b1120]"
              style={{ background: COLORS[tiles[flying.tileIdx]] }}
              initial={{ left: flyingFrom.current.x - 16, top: flyingFrom.current.y - 16, scale: 1 }}
              animate={{ left: flyingFrom.current.tx - 16, top: flyingFrom.current.ty - 16, scale: 0.7 }}
              transition={SPRING}
              onAnimationComplete={() => {
                sfx.snap();
                setMatched((m) => {
                  const next = new Set(m);
                  next.add(flying.slot);
                  if (next.size === SLOTS) {
                    setDone(true);
                    sfx.pop();
                  }
                  return next;
                });
                setFlying(null);
              }}
            >
              {tiles[flying.tileIdx]}
            </motion.button>
          )}
        </AnimatePresence>

        {/* nucleotide tray */}
        {mode === "transcribe" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="lab-label">Nucleotide pool — click one, then a slot</p>
              <div className="flex items-center gap-2">
                <span className="lab-chip">
                  {matched.size}/{SLOTS} paired
                </span>
                <span className="lab-chip">{hBonds} H-bonds</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tiles.map((b, i) => {
                const flyingAway = flying?.tileIdx === i;
                return (
                  <motion.button
                    key={i}
                    ref={(el) => {
                      tileRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => {
                      if (flying || matched.size >= SLOTS) return;
                      setSelectedTile(selectedTile === i ? null : i);
                    }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl font-display text-lg font-bold text-[#0b1120]"
                    style={{
                      background: COLORS[b],
                      boxShadow: selectedTile === i ? "0 0 20px rgba(255,255,255,0.5)" : "0 6px 16px rgba(2,6,23,0.5)",
                      opacity: flyingAway ? 0 : 1,
                    }}
                  >
                    {b}
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              {(["A", "T", "G", "C"] as const).map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[b] }} />
                  {b} pairs with {COMPL[b]} · {HBONDS[b]} H-bonds
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === "transcribe" && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {SEQ.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectedTile !== null && snapTile(selectedTile, i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-all ${wrongSlot === i ? "lab-shake border-red-400 bg-red-400/20 text-red-300" : matched.has(i) ? "border-white/30 bg-white/10 text-slate-300" : "border-dashed border-slate-500/50 text-slate-400 hover:border-[#ff3b5c]"}`}
                >
                  {b}
                </button>
              ))}
            </div>
            <button type="button" onClick={reset} className="lab-btn">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        )}
      </div>

      {/* completion banner */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="lab-glass-deep flex items-center gap-3 p-4"
          >
            <Dna className="h-6 w-6 text-[#ff647c]" />
            <div>
              <p className="text-sm font-bold text-slate-100">Strand synthesised!</p>
              <p className="text-[11px] text-slate-400">
                The growing strand reads {SEQ.map((b) => COMPL[b]).join("")} — antiparallel to the
                template {SEQ.join("")}. {SEQ.reduce((acc, b) => acc + HBONDS[b], 0)} hydrogen bonds hold the duplex together.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}