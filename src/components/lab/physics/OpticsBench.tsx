import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Focus, MousePointerClick, Trash2, Zap } from "lucide-react";
import { SPRING, clamp } from "../use-canvas";

type Optic = "convex" | "concave" | "mirror" | "prism" | "block";

interface Slot {
  type: Optic | null;
  x: number;
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

interface Ray {
  pts: { x: number; y: number }[];
  color: string;
}

/** Deterministic thin-optics ray tracer in SVG coordinates (y down). */
function traceRays(angleDeg: number, slots: Slot[]): { rays: Ray[]; foci: { x: number; label: string }[] } {
  const rays: Ray[] = [];
  const foci: { x: number; label: string }[] = [];
  const a = (angleDeg * Math.PI) / 180;
  let cx0 = 60;
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
    if (t <= 1) continue; // optic behind the source (or exactly at it)
    const yE = cy0 + ddy * t;

    // every segment from the previous point to this optic is drawn — the
    // source-to-first-optic ray used to be skipped, which made the laser
    // look dead.
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
        foci.push({ x: slot.x + F, label: "F" });
        break;
      }
      case "concave": {
        const nd = { x: F, y: yE };
        const n = Math.hypot(nd.x, nd.y) || 1;
        cx0 = slot.x;
        cy0 = yE;
        ddx = nd.x / n;
        ddy = nd.y / n;
        foci.push({ x: slot.x - F, label: "F" });
        break;
      }
      case "mirror": {
        cx0 = slot.x;
        cy0 = yE;
        ddx = -ddx;
        break;
      }
      case "prism": {
        const base = Math.atan2(ddy, ddx); // rad
        const delta = ((1.52 - 1) * 30 * Math.PI) / 180; // thin prism ≈ (n−1)α
        const spread = 2.2 * (Math.PI / 180);
        const cols = ["#ff6b6b", "#4ade80", "#60a5fa"];
        for (let i = 0; i < 3; i++) {
          const ang = base + (i - 1) * spread + delta;
          rays.push({
            pts: [start, { x: slot.x + 320, y: yE + Math.tan(ang) * 320 }],
            color: cols[i],
          });
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
        <path
          d={`M ${x} ${y - 42} Q ${x + 16} ${y} ${x} ${y + 42} Q ${x - 16} ${y} ${x} ${y - 42} Z`}
          fill={g}
          stroke="rgba(148,163,184,0.7)"
          strokeWidth="1.4"
        />
      );
    case "concave":
      return (
        <path
          d={`M ${x} ${y - 42} Q ${x - 10} ${y} ${x} ${y + 42} Q ${x + 10} ${y} ${x} ${y - 42} Z`}
          fill={g}
          stroke="rgba(148,163,184,0.7)"
          strokeWidth="1.4"
        />
      );
    case "mirror":
      return (
        <g>
          <rect x={x} y={y - 46} width="9" height="92" fill="url(#optics-glass)" stroke="rgba(148,163,184,0.8)" strokeWidth="1.4" />
          {[-36, -18, 0, 18, 36].map((dy) => (
            <line key={dy} x1={x + 1.5} y1={y + dy - 4} x2={x + 7.5} y2={y + dy + 4} stroke="rgba(226,232,240,0.35)" strokeWidth="1" />
          ))}
        </g>
      );
    case "prism":
      return (
        <polygon
          points={`${x - 26},${y + 42} ${x + 26},${y + 42} ${x},${y - 40}`}
          fill={g}
          stroke="rgba(148,163,184,0.7)"
          strokeWidth="1.4"
        />
      );
    case "block":
      return (
        <rect x={x - 20} y={y - 34} width="40" height="68" rx="6" fill={g} stroke="rgba(148,163,184,0.7)" strokeWidth="1.4" />
      );
  }
}

export default function OpticsBench() {
  const [angle, setAngle] = useState(6);
  const [slots, setSlots] = useState<Slot[]>([
    { type: "convex", x: 300 },
    { type: null, x: 500 },
    { type: null, x: 680 },
  ]);
  const [pending, setPending] = useState<Optic | null>(null);
  const dragRef = useRef<{ idx: number; startX: number; startClient: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { rays, foci } = useMemo(() => traceRays(angle, slots), [angle, slots]);
  const activeOptic = slots.find((s) => s.type)?.type;

  // where the surviving beam hits the screen at the right edge (if it does)
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

  const onElDown = (e: React.PointerEvent, idx: number) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { idx, startX: slots[idx].x, startClient: e.clientX };
  };
  const onElMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - d.startClient) / rect.width) * 900;
    const x = clamp(d.startX + dx, 130, 870);
    setSlots((ss) => ss.map((s, i) => (i === d.idx ? { ...s, x } : s)));
  };

  const placeRef = useRef(place);
  placeRef.current = place;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_270px]">
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Advanced optics bench</p>
            <p className="text-[11px] text-slate-500">Pick an optic, tap a mount, then drag optics along the rail.</p>
          </div>
          <span className="lab-chip">
            <Zap className="h-3.5 w-3.5 text-[#ff647c]" /> source angle {angle}°
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 900 340"
          className="w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_40%,#16233b_0%,#0b1120_78%)]"
        >
          <defs>
            <linearGradient id="optics-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(148,163,184,0.3)" />
              <stop offset="0.5" stopColor="rgba(226,232,240,0.08)" />
              <stop offset="1" stopColor="rgba(148,163,184,0.28)" />
            </linearGradient>
            <radialGradient id="laser-dot" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.4" stopColor="#ff647c" />
              <stop offset="1" stopColor="rgba(255,59,92,0)" />
            </radialGradient>
          </defs>

          {/* rail */}
          <line x1="20" y1="200" x2="880" y2="200" stroke="rgba(148,163,184,0.25)" strokeWidth="2" />
          {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
            <line key={x} x1={x} y1="196" x2={x} y2="204" stroke="rgba(148,163,184,0.2)" strokeWidth="1.2" />
          ))}

          {/* optical axis */}
          <line x1="20" y1="150" x2="880" y2="150" stroke="rgba(148,163,184,0.12)" strokeWidth="1" strokeDasharray="2 6" />

          {/* source */}
          <g>
            <rect x="24" y="188" width="34" height="24" rx="4" fill="#1e293b" stroke="rgba(255,59,92,0.6)" />
            <circle cx="66" cy="200" r="7" fill="url(#laser-dot)" />
            <text x="41" y="181" fontSize="9" fill="rgba(148,163,184,0.8)" textAnchor="middle" fontFamily="monospace">
              LASER
            </text>
          </g>

          {/* beams */}
          {rays.map((r, i) => (
            <g key={i} className="lab-flow-red" style={{ filter: r.color === "#ff647c" ? "drop-shadow(0 0 5px rgba(255,59,92,0.9))" : `drop-shadow(0 0 5px ${r.color})` }}>
              <polyline points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={r.color} strokeWidth="7" strokeLinecap="round" opacity="0.18" />
              <polyline points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={r.color} strokeWidth="2.4" strokeLinecap="round" />
              <polyline points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={r.color} strokeWidth="2.4" strokeLinecap="round" className="lab-dash" opacity="0.8" />
            </g>
          ))}

          {/* focal markers */}
          {foci.map((f, i) => (
            <g key={`${f.x}-${i}`}>
              <line x1={f.x} y1="150" x2={f.x} y2="250" stroke="rgba(255,59,92,0.3)" strokeWidth="1" strokeDasharray="3 5" />
              <circle cx={f.x} cy="200" r="5" fill="rgba(255,59,92,0.9)">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x={f.x} y="222" fontSize="11" fill="#ff647c" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                {f.label}
              </text>
            </g>
          ))}

          {/* target screen */}
          <g>
            <rect x="858" y="96" width="10" height="208" rx="3" fill="rgba(30,41,59,0.85)" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />
            {Array.from({ length: 20 }, (_, i) => (
              <line key={i} x1="858" y1={100 + i * 10} x2="868" y2={100 + i * 10} stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
            ))}
            {landing && (
              <>
                <circle cx="860" cy={landing.y} r="6" fill="url(#laser-dot)">
                  <animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <text x="876" y={landing.y + 4} fontSize="10" fill="#ff647c" fontFamily="monospace" fontWeight="700">
                  {Math.round(landing.y)}
                </text>
              </>
            )}
            <text x="863" y="90" fontSize="8" fill="rgba(148,163,184,0.7)" textAnchor="middle" fontFamily="monospace">
              SCREEN
            </text>
          </g>

          {/* mounts */}
          {slots.map((s, i) => (
            <g key={`${i}-${s.type ?? "empty"}`}>
              {s.type ? (
                <g
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => onElDown(e, i)}
                  onPointerMove={onElMove}
                  onPointerUp={() => (dragRef.current = null)}
                  onDoubleClick={() => setSlots((ss) => ss.map((x, j) => (j === i ? { ...x, type: null } : x)))}
                >
                  <OpticShape type={s.type} x={s.x} y={200} />
                  <circle cx={s.x} cy="252" r="6" fill="#1e293b" stroke="rgba(148,163,184,0.4)" />
                  <text x={s.x} y="270" fontSize="9" fill="rgba(148,163,184,0.7)" textAnchor="middle" fontFamily="monospace">
                    {OPTIC_LABEL[s.type]}
                  </text>
                </g>
              ) : (
                <g onClick={() => placeRef.current(i)} style={{ cursor: pending ? "pointer" : "default" }}>
                  <rect
                    x={s.x - 34}
                    y="154"
                    width="68"
                    height="92"
                    rx="10"
                    fill="none"
                    stroke={pending ? "rgba(255,59,92,0.55)" : "rgba(148,163,184,0.2)"}
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                  />
                  <text x={s.x} y="228" fontSize="9" fill={pending ? "rgba(255,100,124,0.9)" : "rgba(148,163,184,0.45)"} textAnchor="middle" fontFamily="monospace">
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
            <button
              key={p.type}
              type="button"
              onClick={() => setPending(pending === p.type ? null : p.type)}
              className={`lab-btn ${pending === p.type ? "lab-btn--active" : ""}`}
            >
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

        {/* angle control */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <span className="lab-label">Beam angle (from optical axis)</span>
            <span className="lab-value text-xs text-[#ff647c]">{angle}°</span>
          </div>
          <input type="range" className="lab-range mt-2" min={-35} max={35} step={1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
        </div>
      </div>

      {/* side panel */}
      <div className="lab-glass-deep h-fit space-y-4 p-4">
        <div>
          <p className="lab-label mb-2">
            <Focus className="mr-1 inline h-3 w-3" /> Bench notes
          </p>
          <motion.div
            key={activeOptic ?? "none"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="rounded-xl border border-white/10 bg-black/25 p-3"
          >
            {activeOptic ? (
              <>
                <p className="text-xs font-bold text-slate-100">{OPTIC_LABEL[activeOptic]}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  {activeOptic === "convex" &&
                    "Parallel rays refract toward the focal point F on the far side. Rays through the centre pass undeviated — the focal length here is 90 px."}
                  {activeOptic === "concave" &&
                    "A concave lens spreads parallel rays outward, as if they came from a virtual focus F on the source side. Images are always virtual, upright and smaller."}
                  {activeOptic === "mirror" &&
                    "The plane mirror reflects the beam so the angle of incidence equals the angle of reflection. Trace the reflected ray back — the virtual image sits behind the mirror."}
                  {activeOptic === "prism" &&
                    "Each wavelength refracts by a slightly different angle ((n−1)·α), so white light fans into its spectrum — red bends least, blue bends most."}
                  {activeOptic === "block" &&
                    "Entering the block the ray bends toward the normal; leaving, it bends back. The beam is displaced but stays parallel to its original path."}
                </p>
              </>
            ) : (
              <p className="text-[11px] leading-relaxed text-slate-500">
                No optic mounted yet. Choose one from the palette, tap an empty mount, then drag it along the rail. Double-click an optic to remove it.
              </p>
            )}
          </motion.div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="lab-label mb-1.5">Live trace</p>
          {[
            { k: "Ray segments", v: rays.length },
            { k: "Focal points", v: foci.length },
            { k: "Incidence angle", v: `${incidence}° from axis` },
            {
              k: "Screen hit",
              v: landing ? `y = ${Math.round(landing.y)} px` : "misses screen",
            },
            {
              k: "Reflection rule",
              v: activeOptic === "mirror" ? "θᵢ = θᵣ" : activeOptic === "convex" ? `f = 90 px` : "—",
            },
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
            <li>1 · Pick an optic from the palette.</li>
            <li>2 · Tap an empty mount to place it.</li>
            <li>3 · Drag the optic along the rail — the beam re-traces live.</li>
            <li>4 · Double-click an optic to remove it.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}