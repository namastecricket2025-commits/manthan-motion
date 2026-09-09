import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Droplets, Focus, Minus, Plus } from "lucide-react";
import { SPRING, clamp, useNativeWheel } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  kidney: { name: "Kidney", def: "Beans the size of a fist that filter ~180 L of blood every day into ~1.5 L of urine." },
  cortex: { name: "Renal cortex", def: "The outer kidney layer where most nephrons and their glomeruli sit." },
  medulla: { name: "Renal medulla", def: "The inner layer of pyramid-shaped tissue that concentrates urine as it drains." },
  pelvis: { name: "Renal pelvis", def: "The funnel that collects urine from the pyramids and funnels it into the ureter." },
  ureter: { name: "Ureter", def: "A muscular tube that pushes urine from the kidney to the bladder by peristalsis." },
  bladder: { name: "Urinary bladder", def: "A stretchy muscular sac storing urine (up to ~500 mL) until voiding." },
  urethra: { name: "Urethra", def: "The tube that carries urine out of the body; much shorter in females, which is why UTIs are more common there." },
  nephron: { name: "Nephron", def: "The kidney's functional unit (~1 million per kidney): filter, reabsorb, secrete, excrete." },
  glomerulus: { name: "Glomerulus", def: "A knot of capillaries where blood pressure forces water, salts and wastes into the capsule." },
  bowman: { name: "Bowman's capsule", def: "The cup that cups the glomerulus and catches the filtered fluid (filtrate)." },
  duct: { name: "Collecting duct", def: "The final tube where water is reabsorbed under ADH control, concentrating the urine." },
  artery: { name: "Renal artery", def: "Brings ~20% of cardiac output to each kidney — the highest blood flow per gram of any organ." },
  vein: { name: "Renal vein", def: "Returns cleaned blood from the kidney to the inferior vena cava." },
};

const URETER_L = "M 235 235 C 220 320, 250 400, 370 452";
const URETER_R = "M 565 235 C 580 320, 550 400, 430 452";

export default function Excretory() {
  const [zoom, setZoom] = useState(1.05);
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
          <p className="text-sm font-bold text-slate-100">Excretory system — filtration</p>
          <p className="text-[11px] text-slate-500">
            Blood is filtered in the glomeruli; the nephron reclaims what the body needs, and urine drains away.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { k: "Nephron", x: 200, y: 130 },
              { k: "Bladder", x: 400, y: 480 },
              { k: "Kidney", x: 260, y: 150 },
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
            <linearGradient id="kidney-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(251,146,60,0.22)" />
              <stop offset="1" stopColor="rgba(194,65,12,0.1)" />
            </linearGradient>
            <linearGradient id="bladder-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(251,191,36,0.16)" />
              <stop offset="1" stopColor="rgba(251,191,36,0.05)" />
            </linearGradient>
          </defs>

          {/* ---- kidneys ---- */}
          <g {...h("kidney")}>
            {/* left kidney */}
            <path
              d="M 330 150 C 320 90, 210 80, 172 122 C 130 168, 138 252, 196 284 C 252 312, 336 262, 330 196 Z"
              fill="url(#kidney-g)"
              stroke={hover === "kidney" ? "#ff647c" : "rgba(251,146,60,0.6)"}
              strokeWidth="3"
            />
            {/* cortex */}
            <path
              d="M 316 152 C 308 104, 222 96, 190 130 C 158 168, 166 238, 212 266 C 258 288, 324 248, 316 196 Z"
              fill="none"
              stroke={hover === "cortex" ? "#ff647c" : "rgba(251,191,36,0.5)"}
              strokeWidth="2"
              strokeDasharray="3 5"
            />
            {/* medulla pyramids */}
            <g {...h("medulla")}>
              {[
                [216, 168, 232, 212], [240, 160, 252, 206], [264, 158, 268, 200],
              ].map(([x1, y1, x2, y2], i) => (
                <path key={i} d={`M ${x1} ${y1} L ${x2} ${y2} L ${x1 + 12} ${y2} Z`} fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.45)" strokeWidth="1.2" />
              ))}
            </g>
            {/* pelvis */}
            <path d="M 228 214 L 260 214 L 250 244 Z" fill="rgba(226,232,240,0.25)" stroke="rgba(226,232,240,0.5)" strokeWidth="1.4" {...h("pelvis")} />

            {/* right kidney (closed view) */}
            <path
              d="M 470 150 C 480 90, 590 80, 628 122 C 670 168, 662 252, 604 284 C 548 312, 464 262, 470 196 Z"
              fill="url(#kidney-g)"
              stroke={hover === "kidney" ? "#ff647c" : "rgba(251,146,60,0.6)"}
              strokeWidth="3"
            />
            <text x="552" y="190" fontSize="11" fill="rgba(226,232,240,0.75)" textAnchor="middle" fontFamily="monospace">kidney</text>
          </g>

          {/* renal vessels */}
          <g {...h("artery")}>
            <path d="M 210 120 C 160 96, 130 84, 96 92" fill="none" stroke="#ff647c" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
            <path d="M 210 120 C 160 96, 130 84, 96 92" fill="none" className="lab-flow lab-flow-red" strokeWidth="3.4" strokeLinecap="round" />
            <text x="96" y="82" fontSize="9" fill="rgba(255,100,124,0.9)" fontFamily="monospace">renal artery</text>
          </g>
          <g {...h("vein")}>
            <path d="M 214 262 C 168 290, 130 300, 100 292" fill="none" stroke="#38bdf8" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
            <path d="M 214 262 C 168 290, 130 300, 100 292" fill="none" className="lab-flow lab-flow-blue lab-flow--slow" strokeWidth="3.4" strokeLinecap="round" />
            <text x="100" y="306" fontSize="9" fill="rgba(56,189,248,0.9)" fontFamily="monospace">renal vein</text>
          </g>

          {/* ---- nephron blow-up (top right) ---- */}
          <g opacity="0.98">
            <rect x="640" y="36" width="150" height="196" rx="12" fill="rgba(11,17,32,0.55)" stroke="rgba(148,163,184,0.3)" strokeWidth="1.2" />
            <text x="715" y="54" fontSize="9" fill="rgba(148,163,184,0.8)" textAnchor="middle" fontFamily="monospace">NEPHRON DETAIL</text>

            {/* glomerulus */}
            <g {...h("glomerulus")}>
              <circle cx="676" cy="96" r="17" fill="none" stroke="rgba(255,100,124,0.8)" strokeWidth="2.2" />
              {[
                [668, 90, 684, 102], [670, 102, 684, 90], [676, 86, 676, 106], [666, 96, 686, 96],
              ].map(([x1, y1, x2, y2], i) => (
                <path key={i} d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 5} ${x2} ${y2}`} stroke="rgba(255,100,124,0.9)" strokeWidth="1.6" fill="none" />
              ))}
            </g>
            {/* bowman's capsule */}
            <path d="M 652 96 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0" fill="rgba(255,100,124,0.08)" stroke="rgba(255,100,124,0.75)" strokeWidth="1.8" {...h("bowman")} />
            {/* tubule */}
            <path d="M 676 120 C 676 138, 726 138, 726 156 C 726 174, 688 174, 688 190" fill="none" stroke="rgba(56,189,248,0.85)" strokeWidth="3.4" strokeLinecap="round" />
            {/* collecting duct */}
            <path d="M 688 192 L 688 220" stroke="rgba(167,139,250,0.9)" strokeWidth="4" strokeLinecap="round" {...h("duct")} />
            {/* filtrate droplet */}
            <circle r="4.5" fill="rgba(56,189,248,0.95)">
              <animateMotion dur="2.6s" repeatCount="indefinite" path="M 676 120 C 676 138, 726 138, 726 156 C 726 174, 688 174, 688 190 L 688 218" />
            </circle>
            <text x="715" y="132" fontSize="8.5" fill="rgba(148,163,184,0.85)" textAnchor="middle" fontFamily="monospace">tubule</text>
            <text x="700" y="236" fontSize="8.5" fill="rgba(167,139,250,0.9)" textAnchor="middle" fontFamily="monospace">collecting duct</text>
            <circle cx="668" cy="84" r="2.5" fill="#ff647c" />
            <circle cx="684" cy="108" r="2.5" fill="#ff647c" />
            <g {...h("nephron")}>
              <text x="676" y="252" fontSize="9" fill="rgba(226,232,240,0.75)" textAnchor="middle" fontFamily="monospace">nephron</text>
            </g>
          </g>

          {/* ---- ureters ---- */}
          <g {...h("ureter")}>
            <path d={URETER_L} fill="none" stroke="rgba(251,191,36,0.55)" strokeWidth="11" strokeLinecap="round" />
            <path d={URETER_L} fill="none" className="lab-flow lab-flow--slow" stroke="rgba(251,191,36,0.8)" strokeWidth="3.4" strokeLinecap="round" />
            <path d={URETER_R} fill="none" stroke="rgba(251,191,36,0.55)" strokeWidth="11" strokeLinecap="round" />
            <path d={URETER_R} fill="none" className="lab-flow lab-flow--slow" stroke="rgba(251,191,36,0.8)" strokeWidth="3.4" strokeLinecap="round" />
          </g>
          {/* filtrate drops in ureters */}
          <circle r="4" fill="rgba(251,191,36,0.95)">
            <animateMotion dur="3.4s" repeatCount="indefinite" path={URETER_L} />
          </circle>
          <circle r="4" fill="rgba(251,191,36,0.95)">
            <animateMotion dur="3.9s" begin="1s" repeatCount="indefinite" path={URETER_R} />
          </circle>
          <text x="300" y="368" fontSize="9.5" fill="rgba(251,191,36,0.85)" textAnchor="middle" fontFamily="monospace">ureters</text>

          {/* ---- bladder ---- */}
          <g {...h("bladder")}>
            <path
              d="M 330 470 C 330 430, 470 430, 470 470 C 470 520, 440 540, 400 540 C 360 540, 330 520, 330 470 Z"
              fill="url(#bladder-g)"
              stroke={hover === "bladder" ? "#ff647c" : "rgba(251,191,36,0.6)"}
              strokeWidth="3"
            />
            <path
              d="M 340 470 C 340 440, 460 440, 460 470 C 460 510, 436 528, 400 528 C 364 528, 340 510, 340 470 Z"
              fill="rgba(251,191,36,0.18)"
              className="lab-fill"
              style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
            />
            <text x="400" y="500" fontSize="11" fill="rgba(226,232,240,0.85)" textAnchor="middle" fontFamily="monospace">bladder</text>
          </g>

          {/* ---- urethra ---- */}
          <g {...h("urethra")}>
            <path d="M 400 540 L 400 596" stroke="rgba(148,163,184,0.7)" strokeWidth="9" strokeLinecap="round" />
            <path d="M 400 540 L 400 596" stroke="rgba(148,163,184,0.4)" strokeWidth="3" strokeDasharray="4 6" />
            <text x="416" y="580" fontSize="9.5" fill="rgba(148,163,184,0.9)" fontFamily="monospace">urethra</text>
          </g>

          {/* labels */}
          <g>
            <text x="196" y="120" fontSize="10" fill="rgba(251,191,36,0.85)" textAnchor="middle" fontFamily="monospace">cortex</text>
            <text x="252" y="196" fontSize="9" fill="rgba(251,191,36,0.7)" textAnchor="middle" fontFamily="monospace">medulla</text>
            <text x="400" y="320" fontSize="11" fill="rgba(226,232,240,0.8)" textAnchor="middle" fontFamily="monospace">filtration → reabsorption → excretion</text>
          </g>
        </svg>

        {/* scale badge */}
        <div className="pointer-events-none absolute left-3 top-3">
          <span className="lab-chip border-white/20 bg-black/50 text-slate-300">
            <Droplets className="h-3.5 w-3.5 text-[#ff647c]" /> {Math.round(zoom * 100)}%
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
              Hover any part to inspect it. Golden dots are filtrate draining to the bladder; the nephron box shows the glomerular filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}