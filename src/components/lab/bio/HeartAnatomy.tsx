import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Activity, Pause, Play, RotateCcw } from "lucide-react";
import { SPRING, clamp } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  ra: { name: "Right atrium", def: "Receives deoxygenated blood from the venae cavae and pushes it into the right ventricle." },
  rv: { name: "Right ventricle", def: "Pumps deoxygenated blood through the pulmonary artery to the lungs for oxygenation." },
  la: { name: "Left atrium", def: "Receives oxygenated blood from the pulmonary veins and delivers it to the left ventricle." },
  lv: { name: "Left ventricle", def: "The strongest chamber — its thick muscular wall drives oxygenated blood into the aorta at ~120 mmHg." },
  tricuspid: { name: "Tricuspid valve", def: "Three flaps between right atrium and ventricle; closes during ventricular contraction to stop backflow." },
  mitral: { name: "Mitral valve", def: "Two flaps between left atrium and ventricle; slams shut at the start of systole — the 'lub' of the heartbeat." },
  aorta: { name: "Aorta", def: "The body's largest artery; elastic walls stretch with each beat and recoil to keep blood flowing." },
  pulmArt: { name: "Pulmonary artery", def: "Carries deoxygenated blood from the right ventricle to the lungs — the only artery carrying deoxygenated blood." },
  venaCava: { name: "Vena cava", def: "Returns deoxygenated blood from the body into the right atrium." },
  pulmVein: { name: "Pulmonary veins", def: "Bring oxygenated blood back from the lungs into the left atrium — the only veins carrying oxygenated blood." },
};

export default function HeartAnatomy() {
  const [bpm, setBpm] = useState(72);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const cycle = 60 / bpm;
  const ps = paused ? "paused" : "running";

  const onWheel = (e: React.WheelEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const next = clamp(zoom * (e.deltaY > 0 ? 0.92 : 1.09), 1, 2.4);
    const ratio = next / zoom;
    setPan({ x: mx - (mx - pan.x) * ratio, y: my - (my - pan.y) * ratio });
    setZoom(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Anatomy suite — human heart</p>
            <p className="text-[11px] text-slate-500">
              Loop the cardiac cycle: watch the chambers pump, valves flap and blood flow red (oxygenated) / blue (deoxygenated).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPaused(!paused)} className="lab-btn">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Play" : "Pause"}
            </button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="lab-btn">
              <RotateCcw className="h-3.5 w-3.5" /> Fit
            </button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative h-[480px] cursor-grab touch-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_30%,#101b30_0%,#0b1120_82%)] active:cursor-grabbing"
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
            viewBox="0 0 420 480"
            className="h-full w-full"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", transition: "transform 0.05s linear" }}
          >
            <defs>
              <linearGradient id="heart-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3b1a24" />
                <stop offset="1" stopColor="#1a1020" />
              </linearGradient>
              <linearGradient id="muscle" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fda4af" stopOpacity="0.16" />
                <stop offset="1" stopColor="#881337" stopOpacity="0.16" />
              </linearGradient>
              <marker id="arrow-red" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#ff647c" />
              </marker>
              <marker id="arrow-blue" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#38bdf8" />
              </marker>
            </defs>

            {/* ---- vessels (behind) ---- */}
            {/* aorta — oxygenated out */}
            <path d="M 218 210 C 214 120, 226 64, 250 44 C 282 18, 336 30, 356 66" fill="none" stroke="#ff647c" strokeWidth="13" strokeLinecap="round" opacity="0.22" />
            <path d="M 218 210 C 214 120, 226 64, 250 44 C 282 18, 336 30, 356 66" fill="none" className="lab-flow lab-flow-red" strokeWidth="5" strokeLinecap="round" markerEnd="url(#arrow-red)" />
            {/* pulmonary artery — deoxygenated out */}
            <path d="M 190 190 C 176 130, 156 96, 120 84 C 92 74, 64 88, 52 112" fill="none" stroke="#38bdf8" strokeWidth="11" strokeLinecap="round" opacity="0.22" />
            <path d="M 190 190 C 176 130, 156 96, 120 84 C 92 74, 64 88, 52 112" fill="none" className="lab-flow lab-flow-blue lab-flow--slow" strokeWidth="4" strokeLinecap="round" markerEnd="url(#arrow-blue)" />
            {/* vena cava — deoxygenated in */}
            <path d="M 332 40 C 322 74, 316 100, 300 130" fill="none" stroke="#38bdf8" strokeWidth="11" strokeLinecap="round" opacity="0.22" />
            <path d="M 332 40 C 322 74, 316 100, 300 130" fill="none" className="lab-flow lab-flow-blue" strokeWidth="4" strokeLinecap="round" markerEnd="url(#arrow-blue)" />
            {/* pulmonary veins — oxygenated in */}
            <path d="M 88 64 C 106 92, 120 112, 132 138" fill="none" stroke="#ff647c" strokeWidth="11" strokeLinecap="round" opacity="0.22" />
            <path d="M 88 64 C 106 92, 120 112, 132 138" fill="none" className="lab-flow lab-flow-red lab-flow--slow" strokeWidth="4" strokeLinecap="round" markerEnd="url(#arrow-red)" />

            {/* ---- beating heart ---- */}
            <g className="lab-beat" style={{ animationDuration: `${cycle}s`, animationPlayState: ps }}>
              {/* outer shape */}
              <path
                d="M 210 96 C 262 40, 356 70, 356 170 C 356 250, 290 330, 210 430 C 130 330, 64 250, 64 170 C 64 70, 158 40, 210 96 Z"
                fill="url(#heart-fill)"
                stroke="rgba(251,113,133,0.5)"
                strokeWidth="2.5"
              />
              <path d="M 210 96 C 262 40, 356 70, 356 170 C 356 250, 290 330, 210 430 C 130 330, 64 250, 64 170 C 64 70, 158 40, 210 96 Z" fill="url(#muscle)" />

              {/* chambers */}
              <path d="M 92 190 C 92 150, 150 128, 196 132 C 190 180, 186 230, 182 280 C 150 280, 110 260, 92 190 Z" fill="#1d4ed8" opacity="0.3" />
              <path d="M 182 290 C 186 340, 178 396, 150 414 C 116 396, 96 350, 100 300 C 122 284, 156 282, 182 290 Z" fill="#1d4ed8" opacity="0.24" />
              <path d="M 230 130 C 270 124, 322 142, 326 186 C 320 236, 306 268, 288 288 C 262 272, 240 240, 232 190 Z" fill="#e11d48" opacity="0.3" />
              <path d="M 282 300 C 300 320, 308 366, 284 400 C 250 414, 214 398, 202 366 C 212 330, 246 304, 282 300 Z" fill="#e11d48" opacity="0.24" />

              {/* septum */}
              <path d="M 196 128 C 200 200, 198 330, 196 402" stroke="rgba(148,163,184,0.35)" strokeWidth="3" fill="none" />

              {/* valves — flap open/closed with the beat */}
              <g style={{ animationDuration: `${cycle}s`, animationPlayState: ps }}>
                <g className="lab-valve">
                  <path d="M 180 262 Q 196 246 212 262 Q 196 278 180 262 Z" fill="#fda4af" opacity="0.85" stroke="#fb7185" strokeWidth="1.5" />
                </g>
                <g className="lab-valve">
                  <path d="M 232 258 Q 248 242 264 258 Q 248 274 232 258 Z" fill="#fda4af" opacity="0.85" stroke="#fb7185" strokeWidth="1.5" />
                </g>
              </g>

              {/* chamber labels */}
              <text x="140" y="200" fontSize="13" fontWeight="700" fill="rgba(186,230,253,0.9)" textAnchor="middle" fontFamily="monospace">RA</text>
              <text x="142" y="352" fontSize="13" fontWeight="700" fill="rgba(186,230,253,0.9)" textAnchor="middle" fontFamily="monospace">RV</text>
              <text x="280" y="200" fontSize="13" fontWeight="700" fill="rgba(254,205,211,0.95)" textAnchor="middle" fontFamily="monospace">LA</text>
              <text x="258" y="352" fontSize="13" fontWeight="700" fill="rgba(254,205,211,0.95)" textAnchor="middle" fontFamily="monospace">LV</text>

              {/* interactive hotspots */}
              {(
                [
                  { id: "ra", x: 140, y: 190 },
                  { id: "rv", x: 142, y: 350 },
                  { id: "la", x: 280, y: 195 },
                  { id: "lv", x: 258, y: 350 },
                  { id: "tricuspid", x: 196, y: 262 },
                  { id: "mitral", x: 248, y: 258 },
                  { id: "aorta", x: 300, y: 60 },
                  { id: "pulmArt", x: 110, y: 100 },
                  { id: "venaCava", x: 322, y: 80 },
                  { id: "pulmVein", x: 100, y: 95 },
                ] as const
              ).map((h) => (
                <circle
                  key={h.id}
                  cx={h.x}
                  cy={h.y}
                  r="26"
                  fill="transparent"
                  onMouseEnter={() => setHover(h.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "help" }}
                >
                  <title>{PARTS[h.id].name}</title>
                </circle>
              ))}
            </g>

            {/* vessel labels */}
            {(
              [
                { id: "aorta", x: 306, y: 30 },
                { id: "pulmArt", x: 74, y: 108 },
                { id: "venaCava", x: 330, y: 26 },
                { id: "pulmVein", x: 62, y: 66 },
              ] as const
            ).map((l) => (
              <g key={l.id}>
                <circle cx={l.x} cy={l.y} r="2.5" fill={l.id === "aorta" || l.id === "pulmVein" ? "#ff647c" : "#38bdf8"} />
                <text x={l.x + 8} y={l.y + 4} fontSize="9.5" fill="rgba(148,163,184,0.85)" fontFamily="monospace">
                  {PARTS[l.id].name}
                </text>
              </g>
            ))}
          </svg>

          {/* hover inspector */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
            {hover ? (
              <motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
                <p className="text-xs font-bold text-[#ff647c]">{PARTS[hover].name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{PARTS[hover].def}</p>
              </motion.div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Hover a chamber, valve or vessel to inspect it. Wheel to zoom, drag to pan.
              </p>
            )}
          </div>
        </div>

        {/* pressure gauges */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { k: "Left ventricle", unit: "mmHg", color: "#ff647c", fill: "lab-gauge", end: "120" },
            { k: "Aorta", unit: "mmHg", color: "#22d3ee", fill: "lab-gauge", end: "80" },
          ].map((g) => (
            <div key={g.k} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="lab-label">{g.k} pressure</p>
                <span className="lab-value text-xs" style={{ color: g.color }}>{g.end}/{g.end === "120" ? "5" : "80"}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`${g.fill} h-full rounded-full`}
                  style={{
                    background: `linear-gradient(90deg, ${g.color}66, ${g.color})`,
                    boxShadow: `0 0 12px ${g.color}88`,
                    animationDuration: `${cycle}s`,
                    animationPlayState: ps,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[9px] text-slate-500">
                {g.k === "Left ventricle" ? "0 → 120 → 5 mmHg per beat" : "80 → 120 → 80 mmHg (systolic/diastolic)"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* side panel */}
      <div className="lab-glass-deep h-fit space-y-4 p-4">
        <div>
          <p className="lab-label mb-2">
            <Activity className="mr-1 inline h-3 w-3 text-[#ff647c]" /> Heart rate
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Beats per minute</span>
            <span className="lab-value text-slate-200">{bpm} BPM</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={40} max={140} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <p className="mt-1 text-[10px] text-slate-500">cycle {cycle.toFixed(2)} s · systole ≈ 0.36 s</p>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">The cardiac cycle</p>
          <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
            <p><span className="lab-value text-slate-200">Systole</span> — ventricles contract; mitral/tricuspid valves shut ("lub"), blood erupts into aorta and pulmonary artery.</p>
            <p><span className="lab-value text-slate-200">Diastole</span> — ventricles relax; semilunar valves close ("dub"), atria refill from the veins.</p>
          </div>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">Blood flow</p>
          <div className="space-y-1.5 text-[11px]">
            <p className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded-full" style={{ background: "linear-gradient(90deg, #ff647c, #ff3b5c)", boxShadow: "0 0 6px rgba(255,59,92,0.8)" }} /> Oxygenated — pulmonary veins → LA → LV → aorta → body</p>
            <p className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded-full" style={{ background: "linear-gradient(90deg, #38bdf8, #0ea5e9)", boxShadow: "0 0 6px rgba(56,189,248,0.8)" }} /> Deoxygenated — vena cava → RA → RV → pulmonary artery → lungs</p>
          </div>
        </div>
      </div>
    </div>
  );
}