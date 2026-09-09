import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Focus, Minus, Plus, Wind } from "lucide-react";
import { SPRING, clamp, useNativeWheel } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  trachea: { name: "Trachea (windpipe)", def: "A cartilage-ringed tube that carries air from the larynx to the bronchi; it stays open even when the neck bends." },
  larynx: { name: "Larynx", def: "The voice box — folds of tissue vibrate as air passes to produce sound." },
  bronchus: { name: "Bronchi", def: "The trachea splits into left and right bronchi, one per lung, which divide into ever-smaller bronchioles." },
  bronchioles: { name: "Bronchioles", def: "Fine branching airways (< 1 mm) that distribute air through the lung; their muscle can tighten in asthma." },
  alveoli: { name: "Alveoli", def: "Tiny air sacs (≈300 million) wrapped in capillaries — the actual site of O₂/CO₂ exchange by diffusion." },
  diaphragm: { name: "Diaphragm", def: "The dome-shaped muscle under the lungs; contracting it expands the chest and sucks air in." },
  pleura: { name: "Pleural membranes", def: "Two thin layers around each lung with a lubricating film, so the lungs glide during breathing." },
  ribs: { name: "Rib cage", def: "The bony cage that protects the lungs; rib muscles lift it to enlarge the chest on inspiration." },
};

const FLOW = {
  o2: "M 400 60 C 400 120, 400 170, 400 220",
  co2L: "M 240 300 C 240 220, 300 170, 400 140",
  co2R: "M 560 300 C 560 220, 500 170, 400 140",
};

export default function Respiratory() {
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
    const z = 2;
    setPan({ x: rect.width / 2 - sx * z, y: rect.height / 2 - sy * z });
    setZoom(z);
  };

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
          <p className="text-sm font-bold text-slate-100">Respiratory system — gas exchange</p>
          <p className="text-[11px] text-slate-500">
            Watch O₂ stream in and CO₂ stream out. Scroll to zoom, drag to pan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { k: "Alveoli", x: 380, y: 480 },
              { k: "Trachea", x: 400, y: 205 },
              { k: "Diaphragm", x: 400, y: 545 },
            ] as const
          ).map((f) => (
            <button key={f.k} type="button" onClick={() => focus(f.x, f.y)} className="lab-chip hover:border-[#ff3b5c] hover:text-slate-100">
              <Focus className="h-3 w-3 text-[#ff647c]" /> {f.k}
            </button>
          ))}
          <button type="button" onClick={() => setZoom(clamp(zoom * 1.15, 0.7, 3.2))} className="lab-btn !px-2" title="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setZoom(clamp(zoom * 0.87, 0.7, 3.2))} className="lab-btn !px-2" title="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
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
            <linearGradient id="lung-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(244,114,182,0.14)" />
              <stop offset="1" stopColor="rgba(190,24,93,0.08)" />
            </linearGradient>
            <linearGradient id="trach" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(148,163,184,0.5)" />
              <stop offset="1" stopColor="rgba(148,163,184,0.2)" />
            </linearGradient>
          </defs>

          {/* ribs (faint) */}
          <g opacity="0.25" {...h("ribs")}>
            {[-2, -1, 0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M 150 ${470 + i * 34} C 230 ${420 + i * 34}, 570 ${420 + i * 34}, 650 ${470 + i * 34}`}
                fill="none"
                stroke={hover === "ribs" ? "#ff647c" : "rgba(203,213,225,0.8)"}
                strokeWidth="3"
              />
            ))}
          </g>

          {/* head + neck hint */}
          <ellipse cx="400" cy="52" rx="86" ry="50" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="2" />
          <text x="400" y="20" fontSize="12" fill="rgba(148,163,184,0.7)" textAnchor="middle" fontFamily="monospace">
            nasal cavity
          </text>

          {/* larynx + trachea */}
          <g {...h("larynx")}>
            <path d="M 388 78 L 412 78 L 416 112 L 384 112 Z" fill="url(#trach)" stroke={hover === "larynx" ? "#ff647c" : "rgba(148,163,184,0.6)"} strokeWidth="2" />
            <path d="M 384 112 Q 400 124 416 112" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2.5" />
          </g>
          <g {...h("trachea")}>
            <rect x="384" y="120" width="32" height="150" rx="6" fill="url(#trach)" stroke={hover === "trachea" ? "#ff647c" : "rgba(148,163,184,0.6)"} strokeWidth="2" />
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M 386 ${130 + i * 15} h 28`} stroke="rgba(226,232,240,0.25)" strokeWidth="2" />
            ))}
          </g>

          {/* bronchi */}
          <g {...h("bronchus")}>
            <path d="M 400 270 C 380 290, 340 290, 292 306" fill="none" stroke={hover === "bronchus" ? "#ff647c" : "rgba(148,163,184,0.75)"} strokeWidth="13" strokeLinecap="round" />
            <path d="M 400 270 C 420 290, 460 290, 508 306" fill="none" stroke={hover === "bronchus" ? "#ff647c" : "rgba(148,163,184,0.75)"} strokeWidth="13" strokeLinecap="round" />
          </g>

          {/* lungs */}
          <g className="lab-breathe">
            <path
              d="M 300 250 C 220 260, 150 330, 158 440 C 164 520, 230 560, 300 556 C 360 552, 386 520, 392 470 C 394 420, 380 360, 372 320 C 362 278, 330 256, 300 250 Z"
              fill="url(#lung-fill)"
              stroke={hover === "alveoli" ? "#ff647c" : "rgba(244,114,182,0.5)"}
              strokeWidth="2.5"
            />
            <path
              d="M 500 250 C 580 260, 650 330, 642 440 C 636 520, 570 560, 500 556 C 440 552, 414 520, 408 470 C 406 420, 420 360, 428 320 C 438 278, 470 256, 500 250 Z"
              fill="url(#lung-fill)"
              stroke={hover === "alveoli" ? "#ff647c" : "rgba(244,114,182,0.5)"}
              strokeWidth="2.5"
            />

            {/* bronchioles + alveoli clusters */}
            <g {...h("bronchioles")}>
              {[
                [330, 320, 300, 380, 265, 430],
                [350, 350, 345, 420, 330, 480],
                [360, 400, 360, 470, 362, 520],
                [470, 320, 500, 380, 535, 430],
                [450, 350, 455, 420, 470, 480],
                [440, 400, 440, 470, 438, 520],
              ].map(([x1, y1, x2, y2, x3, y3], i) => (
                <path key={i} d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`} fill="none" stroke="rgba(244,114,182,0.45)" strokeWidth="2.5" />
              ))}
            </g>
            <g {...h("alveoli")}>
              {[
                [252, 440], [282, 452], [266, 468], [300, 442], [310, 468], [330, 452], [352, 480], [340, 505], [372, 498],
                [548, 440], [518, 452], [534, 468], [500, 442], [490, 468], [470, 452], [448, 480], [460, 505], [428, 498],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="9" fill="rgba(251,113,133,0.28)" stroke="rgba(251,113,133,0.7)" strokeWidth="1.6">
                  <animate attributeName="r" values="8;10;8" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          </g>

          {/* gas flow */}
          <g>
            {[0, 0.5, 1].map((off) => (
              <circle key={`o${off}`} r="5" fill="#ff647c" opacity="0.95">
                <animateMotion dur="3.2s" begin={`${off * 1.1}s`} repeatCount="indefinite" path={FLOW.o2} />
              </circle>
            ))}
            {[0, 0.6].map((off) => (
              <circle key={`c${off}`} r="4" fill="#38bdf8" opacity="0.9">
                <animateMotion dur="4s" begin={`${off * 1.3}s`} repeatCount="indefinite" path={FLOW.co2L} />
              </circle>
            ))}
            {[0, 0.6].map((off) => (
              <circle key={`d${off}`} r="4" fill="#38bdf8" opacity="0.9">
                <animateMotion dur="4s" begin={`${off * 1.3}s`} repeatCount="indefinite" path={FLOW.co2R} />
              </circle>
            ))}
          </g>
          <text x="322" y="150" fontSize="10" fill="#ff647c" fontFamily="monospace">O₂ in</text>
          <text x="430" y="150" fontSize="10" fill="#38bdf8" fontFamily="monospace">CO₂ out</text>

          {/* pleura */}
          <g {...h("pleura")}>
            <path d="M 150 330 C 140 440, 160 540, 300 566" fill="none" stroke={hover === "pleura" ? "#ff647c" : "rgba(148,163,184,0.3)"} strokeWidth="1.6" strokeDasharray="4 6" />
            <path d="M 650 330 C 660 440, 640 540, 500 566" fill="none" stroke={hover === "pleura" ? "#ff647c" : "rgba(148,163,184,0.3)"} strokeWidth="1.6" strokeDasharray="4 6" />
          </g>

          {/* diaphragm */}
          <g {...h("diaphragm")}>
            <path
              className="lab-diaphragm"
              d="M 130 575 C 240 500, 560 500, 670 575"
              fill="none"
              stroke={hover === "diaphragm" ? "#ff647c" : "rgba(251,191,36,0.65)"}
              strokeWidth="4"
              strokeLinecap="round"
            />
            {[-2, -1, 0, 1, 2].map((i) => (
              <path key={i} d={`M ${320 + i * 42} 548 l -8 12 l 8 12`} stroke="rgba(251,191,36,0.4)" strokeWidth="1.4" fill="none" />
            ))}
          </g>

          {/* labels */}
          <g>
            <text x="400" y="235" fontSize="12" fill="rgba(226,232,240,0.9)" textAnchor="middle" fontFamily="monospace">trachea</text>
            <text x="400" y="90" fontSize="11" fill="rgba(226,232,240,0.8)" textAnchor="middle" fontFamily="monospace">larynx</text>
            <text x="270" y="290" fontSize="10" fill="rgba(148,163,184,0.85)" textAnchor="middle" fontFamily="monospace">bronchi</text>
            <text x="206" y="570" fontSize="11" fill="rgba(226,232,240,0.8)" textAnchor="middle" fontFamily="monospace">alveoli</text>
            <text x="594" y="570" fontSize="11" fill="rgba(226,232,240,0.8)" textAnchor="middle" fontFamily="monospace">alveoli</text>
            <text x="400" y="596" fontSize="12" fill="rgba(251,191,36,0.9)" textAnchor="middle" fontFamily="monospace">diaphragm</text>
          </g>
        </svg>

        {/* scale badge */}
        <div className="pointer-events-none absolute left-3 top-3">
          <span className="lab-chip border-white/20 bg-black/50 text-slate-300">
            <Wind className="h-3.5 w-3.5 text-[#ff647c]" /> {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* hover inspector */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          {hover ? (
            <motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
              <p className="text-xs font-bold text-[#ff647c]">{PARTS[hover].name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{PARTS[hover].def}</p>
            </motion.div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Hover any part to inspect it. Red dots are oxygen streaming in; blue dots are carbon dioxide leaving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}