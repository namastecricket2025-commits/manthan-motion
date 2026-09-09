import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Activity, Pause, Play, RotateCcw } from "lucide-react";
import { sfx } from "../lab-sound";
import { SPRING, clamp, useNativeWheel } from "../use-canvas";

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

const QUESTIONS: { q: string; options: string[]; ok: number; why: string }[] = [
  {
    q: "Which chamber pumps deoxygenated blood to the lungs?",
    options: ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"],
    ok: 1,
    why: "The right ventricle drives deoxygenated blood through the pulmonary artery to the lungs.",
  },
  {
    q: "Which vessel is the only artery that carries deoxygenated blood?",
    options: ["Aorta", "Vena cava", "Pulmonary artery", "Pulmonary vein"],
    ok: 2,
    why: "The pulmonary artery runs from the right ventricle to the lungs — arteries usually carry oxygenated blood, this one is the exception.",
  },
  {
    q: "Oxygenated blood from the lungs first enters which chamber?",
    options: ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"],
    ok: 2,
    why: "The pulmonary veins deliver oxygenated blood into the left atrium.",
  },
  {
    q: "Which chamber has the thickest muscular wall?",
    options: ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle"],
    ok: 3,
    why: "The left ventricle must push blood through the entire body, so its wall is the thickest (~120 mmHg).",
  },
  {
    q: "The 'lub' of the heartbeat is caused by…",
    options: ["Semilunar valves snapping shut", "The AV valves (mitral + tricuspid) closing", "Blood hitting the aorta wall", "The atria contracting"],
    ok: 1,
    why: "At the start of systole the mitral and tricuspid (AV) valves slam shut — that's 'lub'.",
  },
  {
    q: "Which valve lies between the left atrium and left ventricle?",
    options: ["Tricuspid", "Aortic", "Pulmonary", "Mitral (bicuspid)"],
    ok: 3,
    why: "The two-flap mitral (bicuspid) valve guards the left atrioventricular opening.",
  },
  {
    q: "Where does oxygenated blood leave the heart for the body?",
    options: ["Pulmonary artery", "Aorta", "Vena cava", "Pulmonary vein"],
    ok: 1,
    why: "The left ventricle ejects into the aorta, the body's largest artery.",
  },
  {
    q: "The vena cava returns blood from the body into…",
    options: ["Left atrium", "Right ventricle", "Right atrium", "Left ventricle"],
    ok: 2,
    why: "Deoxygenated blood from the body empties into the right atrium via the venae cavae.",
  },
];

export default function HeartAnatomy() {
  const [bpm, setBpm] = useState(72);
  const [sv, setSv] = useState(70); // stroke volume, mL
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useNativeWheel(wrapRef); // keep the page from scrolling while zooming

  const cycle = 60 / bpm;
  const ps = paused ? "paused" : "running";
  const cardiacOutput = (sv * bpm) / 1000;
  const lvPeak = Math.round(80 + sv * 0.5);

  // lub-dub audio synced to the beat
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => sfx.thump(), 60000 / bpm);
    return () => window.clearInterval(id);
  }, [bpm, paused]);

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

            {/* ECG trace — sweeps with the beat */}
            <g opacity="0.85">
              <path
                d="M 58 40 L 120 40 L 130 40 L 135 30 L 141 50 L 147 40 L 170 40 L 178 40 L 184 36 L 190 44 L 196 40 L 360 40"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle r="3.5" fill="#22d3ee">
                <animateMotion
                  dur={`${cycle}s`}
                  repeatCount="indefinite"
                  path="M 58 40 L 120 40 L 130 40 L 135 30 L 141 50 L 147 40 L 170 40 L 178 40 L 184 36 L 190 44 L 196 40 L 360 40"
                />
              </circle>
              <text x="30" y="44" fontSize="9" fill="rgba(34,211,238,0.9)" fontFamily="monospace" fontWeight="700">
                ECG
              </text>
            </g>

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
            { k: "Left ventricle", unit: "mmHg", color: "#ff647c", end: String(lvPeak) },
            { k: "Aorta", unit: "mmHg", color: "#22d3ee", end: "120" },
          ].map((g) => (
            <div key={g.k} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="lab-label">{g.k} pressure</p>
                <span className="lab-value text-xs" style={{ color: g.color }}>{g.end}/{g.k === "Left ventricle" ? "5" : "80"}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="lab-gauge h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${g.color}66, ${g.color})`,
                    boxShadow: `0 0 12px ${g.color}88`,
                    animationDuration: `${cycle}s`,
                    animationPlayState: ps,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[9px] text-slate-500">
                {g.k === "Left ventricle" ? `0 → ${lvPeak} → 5 mmHg per beat (scales with stroke volume)` : "80 → 120 → 80 mmHg (systolic/diastolic)"}
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

        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Stroke volume</span>
            <span className="lab-value text-slate-200">{sv} mL</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={40} max={120} step={1} value={sv} onChange={(e) => setSv(Number(e.target.value))} />
          <p className="mt-1 text-[10px] text-slate-500">
            Cardiac output = SV × HR = <span className="lab-value text-slate-300">{cardiacOutput.toFixed(1)} L/min</span>
            {cardiacOutput > 8 && " — that's an exercising heart!"}
          </p>
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

        <div className="lab-rule" />

        {/* quick quiz */}
        <div>
          <p className="lab-label mb-2">Student check — quick quiz</p>
          {!quizDone ? (
            <>
              <p className="mb-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[12px] font-semibold leading-snug text-slate-100">
                Q{qIdx + 1}/{QUESTIONS.length} · {QUESTIONS[qIdx].q}
              </p>
              <div className="space-y-1.5">
                {QUESTIONS[qIdx].options.map((opt, oi) => {
                  const isPicked = picked === oi;
                  const isRight = oi === QUESTIONS[qIdx].ok;
                  const show = picked !== null;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={show}
                      onClick={() => {
                        setPicked(oi);
                        if (oi === QUESTIONS[qIdx].ok) {
                          setScore((s) => s + 1);
                          sfx.snap();
                        } else {
                          sfx.buzz();
                        }
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] transition-all ${
                        show && isRight
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                          : show && isPicked
                            ? "border-red-400/60 bg-red-400/10 text-red-300"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-[#ff3b5c]/50 hover:text-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-2">
                  <p className="text-[10px] leading-relaxed text-slate-400">{QUESTIONS[qIdx].why}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (qIdx + 1 >= QUESTIONS.length) {
                        setQuizDone(true);
                        sfx.pop();
                      } else {
                        setQIdx((i) => i + 1);
                        setPicked(null);
                      }
                    }}
                    className="lab-btn lab-btn-neon mt-2 w-full"
                  >
                    {qIdx + 1 >= QUESTIONS.length ? "See score" : "Next question"}
                  </button>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center">
              <p className="font-display text-2xl font-bold text-[#ff647c]">
                {score}/{QUESTIONS.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {score === QUESTIONS.length
                  ? "Perfect — you know this heart inside out."
                  : score >= 5
                    ? "Solid! Re-watch the cycle once more for the rest."
                    : "Hover the chambers and vessels, then try again."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQIdx(0);
                  setPicked(null);
                  setScore(0);
                  setQuizDone(false);
                }}
                className="lab-btn mt-2 w-full"
              >
                Retry quiz
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}