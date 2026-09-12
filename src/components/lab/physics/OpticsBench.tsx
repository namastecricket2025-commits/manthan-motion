import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Focus, Move, MousePointerClick, Trash2, Zap } from "lucide-react";
import { SPRING, clamp } from "../use-canvas";

type Optic = "convex" | "concave" | "mirror" | "prism" | "block";

interface Slot {
  type: Optic | null;
  x: number;
  y: number;
}

const PALETTE: { type: Optic; label: string; desc: string }[] = [
  { type: "convex", label: "Convex lens", desc: "converging · f = 90 px" },
  { type: "concave", label: "Concave lens", desc: "diverging · f = −90 px" },
  { type: "mirror", label: "Plane mirror", desc: "reflects θᵢ = θᵣ" },
  { type: "prism", label: "Glass prism", desc: "disperses white light" },
  { type: "block", label: "Glass block", desc: "parallel shift" },
];

const OPTIC_LABEL: Record<Optic, string> = {
  convex: "Convex lens",
  concave: "Concave lens",
  mirror: "Plane mirror",
  prism: "Glass prism",
  block: "Glass block",
};

/** Half-height of each optic in viewBox units — the beam only bends if it actually hits it. */
const HALF: Record<Optic, number> = { convex: 44, concave: 44, mirror: 48, prism: 40, block: 36 };

interface Ray {
  pts: { x: number; y: number }[];
  color: string;
}

/** Thin-optics ray trace in SVG coordinates (y grows downwards). */
function traceRays(angleDeg: number, slots: Slot[]): { rays: Ray[]; foci: { x: number; y: number; label: string }[] } {
  const rays: Ray[] = [];
  const foci: { x: number; y: number; label: string }[] = [];
  const a = (angleDeg * Math.PI) / 180;
  let cx0 = 66;
  let cy0 = 200;
  let ddx = Math.cos(a);
  let ddy = Math.sin(a);
  let start = { x: cx0, y: cy0 };
  let active = true;
  const F = 90;

  for (const slot of [...slots].sort((p, q) => p.x - q.x)) {
    if (!active || !slot.type) continue;
    if (ddx <= 0) break;
    const t = (slot.x - cx0) / ddx;
    if (t <= 1) continue;
    const yE = cy0 + ddy * t;
    // the optic only acts where it physically stands — drag it out of the
    // beam and the light sails straight past it
    if (Math.abs(yE - slot.y) > HALF[slot.type] + 4) continue;

    rays.push({ pts: [start, { x: slot.x, y: yE }], color: "#ff647c" });
    start = { x: slot.x, y: yE };

    switch (slot.type) {
      case "convex": {
        const nd = { x: F, y: -yE };
        const n = Math.hypot(nd.x, nd.y) || 1;
        cx0 = slot.x;
        cy0 = yE;
        ddx = nd.x / n;
        ddy = nd.y / n;
        foci.push({ x: slot.x + F, y: 200, label: "F" });
        break;
      }
      case "concave": {
        const nd = { x: F, y: yE };
        const n = Math.hypot(nd.x, nd.y) || 1;
        cx0 = slot.x;
        cy0 = yE;
        ddx = nd.x / n;
        ddy = nd.y / n;
        foci.push({ x: slot.x - F, y: 200, label: "F′" });
        break;
      }
      case "mirror": {
        cx0 = slot.x;
        cy0 = yE;
        ddx = -ddx;
        break;
      }
      case "prism": {
        const base = Math.atan2(ddy, ddx);
        const delta = ((1.52 - 1) * 30 * Math.PI) / 180;
        const spread = 2.2 * (Math.PI / 180);
        const cols = ["#ff6b6b", "#4ade80", "#60a5fa"];
        for (let i = 0; i < 3; i++) {
          const ang = base + (i - 1) * spread + delta;
          rays.push({ pts: [start, { x: slot.x + 320, y: yE + Math.tan(ang) * 320 }], color: cols[i] });
        }
        active = false;
        break;
      }
      case "block": {
        const thI = Math.atan2(ddy, ddx);
        const thR = Math.asin(Math.min(0.98, Math.sin(thI) / 1.52));
        const tb = 22;
        const off = (tb * Math.sin(thI - thR)) / Math.cos(thR);
        const exit = { x: slot.x + tb, y: yE + off };
        rays.push({ pts: [start, exit], color: "#ff647c" });
        cx0 = exit.x;
        cy0 = exit.y;
        start = exit;
        break;
      }
    }
  }

  if (active) {
    const end = { x: 890, y: cy0 + (ddy / ddx) * (890 - cx0) };
    rays.push({ pts: [start, end], color: "#ff647c" });
  }
  return { rays, foci };
}

function OpticShape({ type, x, y }: { type: Optic; x: number; y: number }) {
  const g = "url(#optics-glass)";
  switch (type) {
    case "convex":
      return (
        <path d={`M ${x} ${y - 44} Q ${x + 17} ${y} ${x} ${y + 44} Q ${x - 17} ${y} ${x} ${y - 44} Z`} fill={g} stroke="rgba(186,230,253,0.8)" strokeWidth="1.6" />
      );
    case "concave":
      return (
        <path d={`M ${x} ${y - 44} Q ${x - 11} ${y} ${x} ${y + 44} Q ${x + 11} ${y} ${x} ${y - 44} Z`} fill={g} stroke="rgba(186,230,253,0.8)" strokeWidth="1.6" />
      );
    case "mirror":
      return (
        <g>
          <rect x={x} y={y - 48} width="9" height="96" fill="url(#optics-mirror)" stroke="rgba(226,232,240,0.8)" strokeWidth="1.6" />
          {[-40, -20, 0, 20, 40].map((dy) => (
            <line key={dy} x1={x + 1.5} y1={y + dy - 4} x2={x + 7.5} y2={y + dy + 4} stroke="rgba(226,232,240,0.4)" strokeWidth="1" />
          ))}
        </g>
      );
    case "prism":
      return <polygon points={`${x - 28},${y + 40} ${x + 28},${y + 40} ${x},${y - 42}`} fill={g} stroke="rgba(186,230,253,0.8)" strokeWidth="1.6" />;
    case "block":
      return <rect x={x - 20} y={y - 36} width="40" height="72" rx="6" fill={g} stroke="rgba(186,230,253,0.8)" strokeWidth="1.6" />;
  }
}

export default function OpticsBench() {
  const [angle, setAngle] = useState(6);
  const [slots, setSlots] = useState<Slot[]>([
    { type: "convex", x: 300, y: 200 },
    { type: null, x: 500, y: 200 },
    { type: null, x: 680, y: 200 },
  ]);
  const [pending, setPending] = useState<Optic | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragRef = useRef<{ idx: number; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { rays, foci } = useMemo(() => traceRays(angle, slots), [angle, slots]);
  const activeOptic = slots.find((s) => s.type)?.type;

  const landing = useMemo(() => {
    let best: { x: number; y: number } | null = null;
    for (const r of rays) {
      const e = r.pts[r.pts.length - 1];
      if (e.x >= 855 && (!best || e.x > best.x)) best = e;
    }
    return best;
  }, [rays]);

  const incidence = Math.abs(angle);

  const place = (idx: number) => {
    if (!pending) return;
    setSlots((ss) => ss.map((s, i) => (i === idx ? { ...s, type: pending } : s)));
    setPending(null);
  };

  /* ── free drag: the optic follows the pointer anywhere on the bench ── */
  const onDown = (e: React.PointerEvent, idx: number) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const s = slots[idx];
    dragRef.current = { idx, sx: s.x, sy: s.y, cx: e.clientX, cy: e.clientY };
    setDragIdx(idx);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = rect.width / 900 || 1;
    const x = clamp(d.sx + (e.clientX - d.cx) / scale, 120, 872);
    const y = clamp(d.sy + (e.clientY - d.cy) / scale, 70, 320);
    setSlots((ss) => ss.map((s, i) => (i === d.idx ? { ...s, x, y } : s)));
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragIdx(null);
  };

  return (
    <div className="lab-col lab-split">
      <div className="lab-stage-pane lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Advanced optics bench</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Drag any optic anywhere — the high-intensity beam re-traces live. Drag it clear of the beam and the light passes straight on.
            </p>
          </div>
          <span className="lab-chip">
            <Zap className="h-3.5 w-3.5 text-[#ff647c]" /> source angle {angle}°
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 900 340"
          className="lab-stage w-full touch-none rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_40%,#16233b_0%,#070c16_78%)]"
        >
          <defs>
            <linearGradient id="optics-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(186,230,253,0.42)" />
              <stop offset="0.5" stopColor="rgba(226,232,240,0.1)" />
              <stop offset="1" stopColor="rgba(186,230,253,0.38)" />
            </linearGradient>
            <linearGradient id="optics-mirror" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(226,232,240,0.55)" />
              <stop offset="1" stopColor="rgba(148,163,184,0.25)" />
            </linearGradient>
            <radialGradient id="laser-dot" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.35" stopColor="#ff647c" />
              <stop offset="1" stopColor="rgba(255,59,92,0)" />
            </radialGradient>
            {/* high-intensity bloom for the beam */}
            <filter id="laser-bloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="b1" />
              <feGaussianBlur stdDeviation="2.2" result="b2" />
              <feMerge>
                <feMergeNode in="b1" />
                <feMergeNode in="b2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* rail + graduations */}
          <line x1="20" y1="200" x2="880" y2="200" stroke="rgba(148,163,184,0.28)" strokeWidth="2" />
          {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
            <line key={x} x1={x} y1="196" x2={x} y2="204" stroke="rgba(148,163,184,0.22)" strokeWidth="1.2" />
          ))}
          <line x1="20" y1="200" x2="880" y2="200" stroke="rgba(148,163,184,0.14)" strokeWidth="1" strokeDasharray="2 6" />

          {/* source */}
          <g>
            <rect x="24" y="188" width="36" height="24" rx="5" fill="#111a2c" stroke="rgba(255,59,92,0.75)" />
            <circle cx="66" cy="200" r="12" fill="url(#laser-dot)" opacity="0.85" />
            <circle cx="66" cy="200" r="4.5" fill="#fff" />
            <text x="42" y="180" fontSize="9" fill="rgba(148,163,184,0.85)" textAnchor="middle" fontFamily="monospace">
              LASER
            </text>
          </g>

          {/* beams: wide bloom + mid glow + white-hot core */}
          {rays.map((r, i) => {
            const pts = r.pts.map((p) => `${p.x},${p.y}`).join(" ");
            const tint = r.color === "#ff647c" ? "#ff3b5c" : r.color;
            return (
              <g key={i} style={{ filter: "url(#laser-bloom)" }}>
                <polyline points={pts} fill="none" stroke={tint} strokeWidth="9" strokeLinecap="round" opacity="0.2" />
                <polyline points={pts} fill="none" stroke={tint} strokeWidth="4" strokeLinecap="round" opacity="0.55" />
                <polyline points={pts} fill="none" stroke="#fff5f7" strokeWidth="1.5" strokeLinecap="round" opacity="0.95" />
                <polyline points={pts} fill="none" stroke={tint} strokeWidth="1.6" strokeLinecap="round" className="lab-dash" opacity="0.85" />
              </g>
            );
          })}

          {/* focal markers */}
          {foci.map((f, i) => (
            <g key={`${f.x}-${i}`}>
              <line x1={f.x} y1="150" x2={f.x} y2="250" stroke="rgba(255,59,92,0.28)" strokeWidth="1" strokeDasharray="3 5" />
              <circle cx={f.x} cy={f.y} r="5" fill="rgba(255,59,92,0.95)">
                <animate attributeName="opacity" values="0.45;1;0.45" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x={f.x} y={f.y + 22} fontSize="11" fill="#ff647c" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                {f.label}
              </text>
            </g>
          ))}

          {/* target screen */}
          <g>
            <rect x="858" y="96" width="10" height="208" rx="3" fill="rgba(17,26,44,0.9)" stroke="rgba(148,163,184,0.4)" strokeWidth="1.2" />
            {Array.from({ length: 20 }, (_, i) => (
              <line key={i} x1="858" y1={100 + i * 10} x2="868" y2={100 + i * 10} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
            ))}
            {landing && (
              <>
                <circle cx="861" cy={landing.y} r="7" fill="url(#laser-dot)">
                  <animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <text x="876" y={landing.y + 4} fontSize="10" fill="#ff647c" fontFamily="monospace" fontWeight="700">
                  {Math.round(landing.y)}
                </text>
              </>
            )}
            <text x="863" y="90" fontSize="8" fill="rgba(148,163,184,0.75)" textAnchor="middle" fontFamily="monospace">
              SCREEN
            </text>
          </g>

          {/* mounts / optics */}
          {slots.map((s, i) => (
            <g key={`${i}-${s.type ?? "empty"}`}>
              {s.type ? (
                <g
                  style={{ cursor: dragIdx === i ? "grabbing" : "grab" }}
                  onPointerDown={(e) => onDown(e, i)}
                  onPointerMove={onMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onDoubleClick={() => setSlots((ss) => ss.map((x, j) => (j === i ? { ...x, type: null } : x)))}
                >
                  {dragIdx === i && <circle cx={s.x} cy={s.y} r="56" fill="rgba(255,59,92,0.07)" />}
                  <OpticShape type={s.type} x={s.x} y={s.y} />
                  <circle cx={s.x} cy={s.y + 56} r="6" fill="#111a2c" stroke="rgba(148,163,184,0.45)" />
                  <text x={s.x} y={s.y + 74} fontSize="9" fill="rgba(203,213,225,0.8)" textAnchor="middle" fontFamily="monospace">
                    {OPTIC_LABEL[s.type]}
                  </text>
                </g>
              ) : (
                <g onClick={() => place(i)} style={{ cursor: pending ? "pointer" : "default" }}>
                  <rect
                    x={s.x - 34}
                    y={s.y - 46}
                    width="68"
                    height="92"
                    rx="10"
                    fill="none"
                    stroke={pending ? "rgba(255,59,92,0.6)" : "rgba(148,163,184,0.22)"}
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                  />
                  <text x={s.x} y={s.y + 4} fontSize="9" fill={pending ? "rgba(255,100,124,0.95)" : "rgba(148,163,184,0.5)"} textAnchor="middle" fontFamily="monospace">
                    {pending ? "place here" : "mount"}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* palette */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PALETTE.map((p) => (
            <button key={p.type} type="button" onClick={() => setPending(pending === p.type ? null : p.type)} className={`lab-btn ${pending === p.type ? "lab-btn--active" : ""}`}>
              <MousePointerClick className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSlots((ss) => ss.map((s) => ({ ...s, type: null })));
              setPending(null);
            }}
            className="lab-btn ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear bench
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <span className="lab-label">Beam angle (from optical axis)</span>
            <span className="lab-value text-xs text-[#ff647c]">{angle}°</span>
          </div>
          <input type="range" className="lab-range mt-2" min={-35} max={35} step={1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
        </div>
      </div>

      {/* side panel */}
      <div className="lab-deck-pane lab-glass-deep space-y-4 p-4">
        <div>
          <p className="lab-label mb-2">
            <Focus className="mr-1 inline h-3 w-3" /> Bench notes
          </p>
          <motion.div key={activeOptic ?? "none"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="rounded-xl border border-white/10 bg-black/25 p-3">
            {activeOptic ? (
              <>
                <p className="text-xs font-bold text-slate-100">{OPTIC_LABEL[activeOptic]}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  {activeOptic === "convex" && "Parallel rays refract toward the focal point F on the far side. A ray through the optical centre passes undeviated — focal length here is 90 px."}
                  {activeOptic === "concave" && "A concave lens spreads parallel rays outward, as if they came from a virtual focus F′ on the source side. Images are always virtual, upright and smaller."}
                  {activeOptic === "mirror" && "The plane mirror reflects the beam so the angle of incidence equals the angle of reflection. Extend the reflected ray backwards — the virtual image sits behind the mirror."}
                  {activeOptic === "prism" && "Each wavelength refracts by a slightly different angle ((n−1)·α), so white light fans into its spectrum — red bends least, blue bends most."}
                  {activeOptic === "block" && "Entering the block the ray bends toward the normal; leaving, it bends back. The beam is displaced sideways but stays parallel to its original path."}
                </p>
              </>
            ) : (
              <p className="text-[11px] leading-relaxed text-slate-500">No optic mounted yet. Choose one from the palette, then tap an empty mount — or drag an existing optic anywhere on the bench.</p>
            )}
          </motion.div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="lab-label mb-1.5">
            <Move className="mr-1 inline h-3 w-3" /> Live trace
          </p>
          {[
            { k: "Ray segments", v: rays.length },
            { k: "Focal points", v: foci.length },
            { k: "Incidence angle", v: `${incidence}° from axis` },
            { k: "Screen hit", v: landing ? `y = ${Math.round(landing.y)} px` : "misses screen" },
            { k: "Reflection rule", v: activeOptic === "mirror" ? "θᵢ = θᵣ" : activeOptic === "convex" ? "f = 90 px" : "—" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between py-1 text-[11px]">
              <span className="text-slate-500">{r.k}</span>
              <span className="lab-value text-slate-200">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="lab-label mb-1.5">How to use</p>
          <ol className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
            <li>1 · Pick an optic from the palette, then tap a mount.</li>
            <li>2 · Drag the optic freely in x and y — the beam re-traces instantly.</li>
            <li>3 · Slide an optic off the beam and the light continues straight.</li>
            <li>4 · Double-tap an optic to remove it.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
