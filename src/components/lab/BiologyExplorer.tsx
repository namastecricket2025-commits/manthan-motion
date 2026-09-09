import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dna, Droplets, Focus, HeartPulse, Microscope, Wind } from "lucide-react";
import { SPRING, clamp, useCanvasSize, useNativeWheel, useRaf } from "./use-canvas";
import DnaSandbox from "./bio/DnaSandbox";
import HeartAnatomy from "./bio/HeartAnatomy";
import Respiratory from "./bio/Respiratory";
import Excretory from "./bio/Excretory";

type BioTab = "explorer" | "resp" | "excrete" | "dna" | "heart";

/* ---------------- molecular particle mosaic ---------------- */
function ParticleMosaic() {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const ions = useRef<
    { x: number; y: number; vx: number; vy: number; r: number; label: string; color: string }[]
  >([]);

  useRaf((dt, t) => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (ions.current.length === 0) {
      const defs = [
        { label: "Na⁺", color: "#ff6b6b" },
        { label: "K⁺", color: "#a78bfa" },
        { label: "Ca²⁺", color: "#fbbf24" },
        { label: "Cl⁻", color: "#4ade80" },
      ];
      for (let i = 0; i < 18; i++) {
        const d = defs[i % defs.length];
        ions.current.push({
          x: 60 + Math.random() * (w - 120),
          y: 60 + Math.random() * (h - 120),
          vx: (Math.random() - 0.5) * 130,
          vy: (Math.random() - 0.5) * 130,
          r: 7 + Math.random() * 3,
          label: d.label,
          color: d.color,
        });
      }
    }

    const pad = 34;
    const chX = w / 2;
    const chW = 26;
    const chTop = pad;
    const chBot = h - pad;
    const speed = 0.7 + 0.3 * Math.sin(t * 0.6);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // membrane
    ctx.strokeStyle = "rgba(148,163,184,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 26);
    ctx.stroke();
    // channel proteins
    for (const cy of [chTop, chBot]) {
      ctx.fillStyle = "rgba(255,59,92,0.55)";
      ctx.fillRect(chX - chW / 2, cy - 4, chW, 8);
      ctx.strokeStyle = "rgba(255,100,124,0.9)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(chX - chW / 2, cy - 4, chW, 8);
    }

    for (const ion of ions.current) {
      ion.x += ion.vx * dt * speed;
      ion.y += ion.vy * dt * speed;
      const inChannelTop = Math.abs(ion.x - chX) < chW / 2 - 2 && ion.y < chTop + 6;
      const inChannelBot = Math.abs(ion.x - chX) < chW / 2 - 2 && ion.y > chBot - 6;
      if (inChannelTop && ion.y < pad) ion.y = pad + 2;
      if (inChannelBot && ion.y > h - pad) ion.y = h - pad - 2;
      if (ion.x < pad + ion.r) { ion.x = pad + ion.r; ion.vx = Math.abs(ion.vx); }
      if (ion.x > w - pad - ion.r) { ion.x = w - pad - ion.r; ion.vx = -Math.abs(ion.vx); }
      if (!inChannelTop && ion.y < pad + ion.r) { ion.y = pad + ion.r; ion.vy = Math.abs(ion.vy); }
      if (!inChannelBot && ion.y > h - pad - ion.r) { ion.y = h - pad - ion.r; ion.vy = -Math.abs(ion.vy); }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(ion.x, ion.y, 0.5, ion.x, ion.y, ion.r * 2.6);
      g.addColorStop(0, ion.color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, ion.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(226,232,240,0.95)";
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(ion.label, ion.x, ion.y - ion.r - 3);
    }
  });

  return <canvas ref={ref} className="h-full w-full" />;
}

/* ---------------- structural explorer ---------------- */
const STRUCTS: Record<string, { name: string; def: string }> = {
  membrane: { name: "Plasma membrane", def: "Phospholipid bilayer studded with proteins — controls what enters and leaves the cell." },
  nucleus: { name: "Nucleus", def: "The control centre; houses chromatin (DNA) and directs protein synthesis via mRNA." },
  nucleolus: { name: "Nucleolus", def: "Ribosome factory — dense region where ribosomal RNA is made." },
  dna: { name: "DNA (chromatin)", def: "Circular loops of DNA complexed with histones — the cell's genetic blueprint." },
  mito: { name: "Mitochondrion", def: "Powerhouse of the cell; folds (cristae) maximise surface area for ATP production." },
  er: { name: "Rough endoplasmic reticulum", def: "Studded with ribosomes that fold proteins into the lumen for transport." },
  golgi: { name: "Golgi apparatus", def: "Sorting and packaging depot — modifies proteins and ships them in vesicles." },
  lysosome: { name: "Lysosome", def: "Digestive sac of enzymes that breaks down worn-out organelles and pathogens." },
  ribo: { name: "Ribosomes", def: "Molecular machines reading mRNA to assemble proteins from amino acids." },
  vesicle: { name: "Vesicle", def: "Membrane bubble ferrying cargo between organelles and the membrane." },
  cent: { name: "Centrosome", def: "Organises microtubules; anchors the mitotic spindle during cell division." },
};

function ExplorerTab() {
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useNativeWheel(wrapRef); // keep the page from scrolling while zooming

  const onWheel = (e: React.WheelEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const next = clamp(zoom * (e.deltaY > 0 ? 0.93 : 1.08), 0.7, 3.2);
    const ratio = next / zoom;
    setPan({ x: mx - (mx - pan.x) * ratio, y: my - (my - pan.y) * ratio });
    setZoom(next);
  };

  const focus = (sx: number, sy: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const z = 2.1;
    setPan({ x: rect.width / 2 - sx * z, y: rect.height / 2 - sy * z });
    setZoom(z);
  };

  // zoom-level label streaming
  const bigOp = clamp((1.45 - zoom) / 0.35, 0, 1);
  const orgOp = clamp((zoom - 1.05) / 0.25, 0, 1) * clamp((2.75 - zoom) / 0.5, 0, 1);
  const detOp = clamp((zoom - 1.75) / 0.3, 0, 1) * clamp((2.95 - zoom) / 0.4, 0, 1);
  const molOp = clamp((zoom - 2.45) / 0.3, 0, 1);
  const detailVis = clamp((zoom - 1.35) / 0.35, 0, 1);

  // Hover only engages when the user isn't dragging — otherwise panning
  // over structures flickers the inspector.
  const h = (id: string) => ({
    onMouseEnter: () => {
      if (!dragRef.current) setHover(id);
    },
    onMouseLeave: () => {
      if (!dragRef.current) setHover(null);
    },
    style: { cursor: "help" as const },
  });

  return (
    <div className="lab-glass p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-100">Structural explorer — animal cell</p>
          <p className="text-[11px] text-slate-500">
            Scroll or pinch to zoom — large labels fade out as organelles and molecular detail stream in. Above 250% the view dissolves into an ion-transport mosaic.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { k: "Nucleus", x: 400, y: 265 },
              { k: "Mitochondria", x: 230, y: 190 },
              { k: "DNA", x: 350, y: 240 },
              { k: "Membrane", x: 130, y: 300 },
            ] as const
          ).map((f) => (
            <button key={f.k} type="button" onClick={() => focus(f.x, f.y)} className="lab-chip hover:border-[#ff3b5c] hover:text-slate-100">
              <Focus className="h-3 w-3 text-[#ff647c]" /> {f.k}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[520px] touch-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,#12203a_0%,#0b1120_80%)]"
        onWheel={onWheel}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
        }}
        onPointerUp={() => (dragRef.current = null)}
      >
        <svg
          viewBox="0 0 800 620"
          className="h-full w-full"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          <defs>
            <radialGradient id="cyto" cx="0.5" cy="0.45" r="0.62">
              <stop offset="0" stopColor="rgba(103,232,249,0.10)" />
              <stop offset="1" stopColor="rgba(15,23,42,0.4)" />
            </radialGradient>
            <linearGradient id="nuc-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(99,102,241,0.22)" />
              <stop offset="1" stopColor="rgba(79,70,229,0.1)" />
            </linearGradient>
          </defs>

          {/* membrane + cytoplasm */}
          <path
            d="M 120 300 C 120 140, 240 56, 400 56 C 560 56, 680 140, 680 300 C 680 460, 560 566, 400 566 C 240 566, 120 460, 120 300 Z"
            fill="url(#cyto)"
            stroke={hover === "membrane" ? "#ff647c" : "rgba(103,232,249,0.55)"}
            strokeWidth="4"
            {...h("membrane")}
          />

          {/* nucleus */}
          <g {...h("nucleus")}>
            <ellipse cx="400" cy="265" rx="138" ry="112" fill="url(#nuc-fill)" stroke={hover === "nucleus" ? "#ff647c" : "rgba(148,163,184,0.65)"} strokeWidth="3" />
            <ellipse cx="400" cy="265" rx="124" ry="99" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5" strokeDasharray="3 7" />
            {/* nuclear pores */}
            <g opacity={detailVis}>
              {Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;
                return (
                  <circle key={i} cx={400 + 124 * Math.cos(a)} cy={265 + 99 * Math.sin(a)} r="4" fill="rgba(226,232,240,0.6)" />
                );
              })}
            </g>
            {/* DNA loops */}
            <g opacity={detailVis} {...h("dna")}>
              <g className="lab-spin">
                <circle cx="350" cy="240" r="42" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="6 4" />
                <circle cx="350" cy="240" r="20" fill="none" stroke="#fb7185" strokeWidth="1.6" />
                <circle cx="392" cy="240" r="4" fill="#f43f5e" />
              </g>
              <g className="lab-spin lab-spin--slow">
                <circle cx="455" cy="300" r="36" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="6 4" />
                <circle cx="455" cy="300" r="17" fill="none" stroke="#fb7185" strokeWidth="1.6" />
                <circle cx="419" cy="300" r="4" fill="#f43f5e" />
              </g>
            </g>
            <circle cx="400" cy="250" r="30" fill="rgba(99,102,241,0.35)" stroke="rgba(165,180,252,0.7)" strokeWidth="2" {...h("nucleolus")} />
          </g>

          {/* mitochondria */}
          <g {...h("mito")}>
            <path
              d="M 170 190 C 188 148, 258 142, 296 172 C 318 190, 304 232, 262 238 C 210 244, 176 226, 170 190 Z"
              fill="rgba(248,113,113,0.16)"
              stroke={hover === "mito" ? "#ff647c" : "rgba(251,113,133,0.6)"}
              strokeWidth="2.6"
            />
            <g opacity={detailVis}>
              {[
                [192, 190, 268, 180],
                [196, 205, 272, 196],
                [200, 220, 262, 212],
              ].map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(253,164,175,0.75)" strokeWidth="2" />
              ))}
            </g>
            <path
              d="M 545 395 C 558 362, 608 358, 634 380 C 650 392, 640 420, 610 424 C 574 428, 550 415, 545 395 Z"
              fill="rgba(248,113,113,0.14)"
              stroke={hover === "mito" ? "#ff647c" : "rgba(251,113,133,0.55)"}
              strokeWidth="2.4"
            />
          </g>

          {/* rough ER */}
          <g {...h("er")}>
            {[0, 1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M 268 ${305 + i * 16} C 240 ${295 + i * 16}, 210 ${315 + i * 16}, 178 ${300 + i * 16}`}
                fill="none"
                stroke={hover === "er" ? "#ff647c" : "rgba(129,140,248,0.7)"}
                strokeWidth="4"
              />
            ))}
            <g opacity={detailVis}>
              {[0, 1, 2, 3].map((i) =>
                [255, 225, 198].map((xx, j) => (
                  <circle key={`${i}-${j}`} cx={xx} cy={299 + i * 16 + (j % 2 === 0 ? -5 : 5)} r="3.4" fill="rgba(165,180,252,0.85)" />
                )),
              )}
            </g>
          </g>

          {/* golgi */}
          <g {...h("golgi")}>
            {[0, 1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M 570 ${250 - i * 14} C 590 ${242 - i * 14}, 620 ${242 - i * 14}, 640 ${252 - i * 14}`}
                fill="none"
                stroke={hover === "golgi" ? "#ff647c" : "rgba(45,212,191,0.7)"}
                strokeWidth="5"
                strokeLinecap="round"
              />
            ))}
            <g opacity={detailVis}>
              {[
                [652, 240],
                [660, 258],
                [648, 272],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="5" fill="rgba(45,212,191,0.6)" />
              ))}
            </g>
          </g>

          {/* lysosome */}
          <circle cx="562" cy="520" r="21" fill="rgba(251,146,60,0.18)" stroke={hover === "lysosome" ? "#ff647c" : "rgba(251,146,60,0.7)"} strokeWidth="2.4" {...h("lysosome")} />

          {/* ribosomes (detail) */}
          <g opacity={detailVis} {...h("ribo")}>
            {[
              [150, 380],
              [470, 480],
              [620, 420],
              [300, 470],
              [520, 150],
              [170, 140],
              [640, 180],
              [350, 520],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x - 4} cy={y - 2} r="4.5" fill="rgba(165,180,252,0.9)" />
                <circle cx={x + 4} cy={y + 2} r="4.5" fill="rgba(129,140,248,0.9)" />
              </g>
            ))}
          </g>

          {/* vesicle + centrosome (detail) */}
          <circle cx="190" cy="440" r="12" fill="rgba(103,232,249,0.2)" stroke="rgba(103,232,249,0.75)" strokeWidth="2" opacity={detailVis} {...h("vesicle")} />
          <g opacity={detailVis} {...h("cent")}>
            <rect x="452" y="122" width="30" height="12" rx="4" fill="rgba(232,121,249,0.4)" transform="rotate(-25 467 128)" />
            <rect x="452" y="122" width="30" height="12" rx="4" fill="rgba(232,121,249,0.4)" transform="rotate(25 467 128)" />
          </g>

          {/* ---------- labels ---------- */}
          {/* big labels — fade out while zooming */}
          <g opacity={bigOp}>
            <text x="400" y="40" fontSize="26" fontWeight="700" fill="rgba(226,232,240,0.92)" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif">
              Animal cell (eukaryote)
            </text>
            <text x="112" y="300" fontSize="13" fill="rgba(103,232,249,0.85)" textAnchor="end" fontFamily="monospace">plasma membrane</text>
          </g>

          {/* organelle labels */}
          <g opacity={orgOp}>
            <text x="400" y="186" fontSize="13" fill="rgba(165,180,252,0.95)" textAnchor="middle" fontFamily="monospace">nucleus</text>
            <text x="400" y="300" fontSize="11" fill="rgba(165,180,252,0.8)" textAnchor="middle" fontFamily="monospace">nucleolus</text>
            <text x="240" y="120" fontSize="12" fill="rgba(253,164,175,0.95)" textAnchor="middle" fontFamily="monospace">mitochondria</text>
            <text x="210" y="372" fontSize="12" fill="rgba(165,180,252,0.9)" textAnchor="middle" fontFamily="monospace">rough ER</text>
            <text x="640" y="220" fontSize="12" fill="rgba(45,212,191,0.95)" textAnchor="middle" fontFamily="monospace">golgi</text>
            <text x="600" y="556" fontSize="12" fill="rgba(251,146,60,0.95)" textAnchor="middle" fontFamily="monospace">lysosome</text>
          </g>

          {/* detail labels */}
          <g opacity={detOp}>
            <text x="150" y="356" fontSize="10" fill="rgba(165,180,252,0.85)" textAnchor="middle" fontFamily="monospace">ribosomes</text>
            <text x="350" y="180" fontSize="10" fill="rgba(251,113,133,0.95)" textAnchor="middle" fontFamily="monospace">DNA loops</text>
            <text x="182" y="470" fontSize="10" fill="rgba(103,232,249,0.85)" textAnchor="middle" fontFamily="monospace">vesicle</text>
            <text x="500" y="120" fontSize="10" fill="rgba(232,121,249,0.9)" textAnchor="middle" fontFamily="monospace">centrosome</text>
            <text x="330" y="230" fontSize="10" fill="rgba(165,180,252,0.75)" textAnchor="middle" fontFamily="monospace">nuclear pores</text>
          </g>
        </svg>

        {/* molecular mosaic overlay */}
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ opacity: molOp }}>
          <ParticleMosaic />
        </div>

        {/* scale badge */}
        <div className="pointer-events-none absolute left-3 top-3">
          <span className="lab-chip border-white/20 bg-black/50 text-slate-300">
            <Microscope className="h-3.5 w-3.5 text-[#ff647c]" />
            {zoom <= 1.05 ? "Macro" : zoom <= 1.75 ? "Cellular" : zoom <= 2.45 ? "Organelle" : "Molecular"}
            {" · "}
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* hover inspector */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          {hover ? (
            <motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
              <p className="text-xs font-bold text-[#ff647c]">{STRUCTS[hover].name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{STRUCTS[hover].def}</p>
            </motion.div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Hover a structure to inspect it — zoom in to reveal ribosomes, DNA loops and the molecular membrane mosaic.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */
export default function BiologyExplorer() {
  const [tab, setTab] = useState<BioTab>("explorer");
  return (
    <div className="space-y-4">
      <div className="lab-tabs">
        {(
          [
            { key: "explorer", label: "Cell", icon: Microscope },
            { key: "resp", label: "Respiratory", icon: Wind },
            { key: "excrete", label: "Excretory", icon: Droplets },
            { key: "dna", label: "DNA", icon: Dna },
            { key: "heart", label: "Heart", icon: HeartPulse },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="lab-tab">
              {active && <motion.span layoutId="bio-sub-pill" className="lab-pill" transition={SPRING} />}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#ff647c]" : "text-slate-500"}`} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "explorer" && (
          <motion.div key="explorer" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <ExplorerTab />
          </motion.div>
        )}
        {tab === "resp" && (
          <motion.div key="resp" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <Respiratory />
          </motion.div>
        )}
        {tab === "excrete" && (
          <motion.div key="excrete" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <Excretory />
          </motion.div>
        )}
        {tab === "dna" && (
          <motion.div key="dna" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <DnaSandbox />
          </motion.div>
        )}
        {tab === "heart" && (
          <motion.div key="heart" initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <HeartAnatomy />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}