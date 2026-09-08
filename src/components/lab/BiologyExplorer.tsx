import { Slider } from "@/components/ui/slider";
import { Dna, Heart, Maximize, Minimize } from "lucide-react";
import { useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Annotation model                                                    */
/* ------------------------------------------------------------------ */

interface Annotation {
  id: string;
  name: string;
  def: string;
  x: number; // anchor on the structure
  y: number;
  lx: number; // label position
  ly: number;
  minor?: boolean; // only shown when zoomed in
}

const CELL_ANNOTATIONS: Annotation[] = [
  { id: "membrane", name: "Cell membrane", def: "The phospholipid boundary that controls what enters and leaves the cell.", x: 44, y: 250, lx: 30, ly: 128 },
  { id: "cytoplasm", name: "Cytoplasm", def: "The jelly-like fluid filling the cell where organelles float and reactions occur.", x: 300, y: 330, lx: 300, ly: 380 },
  { id: "nucleus", name: "Nucleus", def: "The control centre — stores DNA and directs the cell's activities.", x: 215, y: 185, lx: 150, ly: 105 },
  { id: "nucleolus", name: "Nucleolus", def: "A dense spot inside the nucleus where ribosomes are assembled.", x: 240, y: 165, lx: 296, ly: 128, minor: true },
  { id: "mitochondria", name: "Mitochondrion", def: "The powerhouse — burns glucose to make ATP through cellular respiration.", x: 410, y: 130, lx: 468, ly: 92 },
  { id: "er", name: "Rough ER", def: "A folded membrane factory studded with ribosomes, making and folding proteins.", x: 128, y: 130, lx: 62, ly: 78 },
  { id: "smoothER", name: "Smooth ER", def: "Membrane tubes that make lipids and detoxify chemicals.", x: 96, y: 268, lx: 42, ly: 316, minor: true },
  { id: "golgi", name: "Golgi apparatus", def: "The post office — packages and ships proteins to where they're needed.", x: 172, y: 350, lx: 118, ly: 410 },
  { id: "lysosome", name: "Lysosome", def: "The recycling bin — enzymes break down worn-out parts and waste.", x: 330, y: 235, lx: 386, ly: 224, minor: true },
  { id: "vacuole", name: "Vacuole", def: "A storage sac holding water, ions and nutrients; large in plant cells.", x: 400, y: 300, lx: 452, ly: 336 },
  { id: "ribosomes", name: "Ribosomes", def: "Tiny machines that build proteins from mRNA instructions.", x: 300, y: 95, lx: 352, ly: 60, minor: true },
];

const HEART_ANNOTATIONS: Annotation[] = [
  { id: "ra", name: "Right atrium", def: "Receives deoxygenated blood from the body via the venae cavae.", x: 195, y: 195, lx: 108, ly: 108 },
  { id: "rv", name: "Right ventricle", def: "Pumps deoxygenated blood to the lungs through the pulmonary artery.", x: 205, y: 330, lx: 108, ly: 386 },
  { id: "la", name: "Left atrium", def: "Receives oxygenated blood from the lungs via the pulmonary veins.", x: 368, y: 195, lx: 452, ly: 108 },
  { id: "lv", name: "Left ventricle", def: "The strongest chamber — pumps oxygenated blood to the whole body.", x: 342, y: 348, lx: 452, ly: 420 },
  { id: "septum", name: "Septum", def: "The muscular wall separating oxygenated and deoxygenated sides.", x: 258, y: 280, lx: 258, ly: 240, minor: true },
  { id: "aorta", name: "Aorta", def: "The body's largest artery, carrying oxygenated blood out of the heart.", x: 318, y: 96, lx: 356, ly: 40 },
  { id: "pulmArt", name: "Pulmonary artery", def: "Carries deoxygenated blood from the right ventricle to the lungs.", x: 228, y: 104, lx: 186, ly: 44 },
  { id: "svc", name: "Vena cava", def: "The large vein returning deoxygenated blood from the upper body.", x: 182, y: 118, lx: 108, ly: 60, minor: true },
  { id: "pulmVein", name: "Pulmonary veins", def: "Return oxygenated blood from the lungs into the left atrium.", x: 428, y: 176, lx: 480, ly: 216, minor: true },
  { id: "tricuspid", name: "Tricuspid valve", def: "One-way flap between the right atrium and ventricle.", x: 222, y: 252, lx: 176, ly: 258, minor: true },
  { id: "mitral", name: "Mitral valve", def: "One-way flap between the left atrium and ventricle.", x: 338, y: 252, lx: 384, ly: 258, minor: true },
  { id: "pulmValve", name: "Pulmonary valve", def: "Prevents blood flowing back into the right ventricle from the lungs.", x: 244, y: 138, lx: 244, ly: 168, minor: true },
];

/* ------------------------------------------------------------------ */
/* Shared interactive label layer                                      */
/* ------------------------------------------------------------------ */

function AnnotationLayer({
  list,
  hovered,
  onHover,
  color = "var(--signal)",
}: {
  list: Annotation[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  color?: string;
}) {
  return (
    <g>
      {list.map((a) => {
        const active = hovered === a.id;
        return (
          <g key={a.id} pointerEvents="none">
            <line
              x1={a.x}
              y1={a.y}
              x2={a.lx}
              y2={a.ly}
              stroke={active ? color : "color-mix(in srgb, var(--text-dim) 55%, transparent)"}
              strokeWidth={active ? 1.8 : 1.2}
              strokeDasharray="3 4"
            />
            <circle cx={a.x} cy={a.y} r={active ? 4 : 2.6} fill={active ? color : "var(--text-dim)"} />
            <text
              x={a.lx}
              y={a.ly}
              fontSize="11"
              fontWeight={active ? 700 : 500}
              textAnchor={a.lx < 280 ? "start" : "end"}
              className={active ? "fill-[var(--signal)]" : "fill-[var(--text-dim)]"}
            >
              {a.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Diagrams                                                           */
/* ------------------------------------------------------------------ */

function CellDiagram({
  zoomed,
  hovered,
  onHover,
}: {
  zoomed: boolean;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const hov = (id: string) => ({
    onPointerEnter: () => onHover(id),
    onPointerLeave: () => onHover(null),
    style: hovered === id ? { stroke: "var(--signal)", strokeWidth: 2.6 } : undefined,
  });
  return (
    <svg viewBox="0 0 560 480" className="block h-auto w-full">
      <defs>
        <radialGradient id="cytoGrad" cx="0.42" cy="0.4" r="0.75">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--text-main) 13%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--signal) 5%, transparent)" />
        </radialGradient>
        <radialGradient id="nucleusGrad" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--text-main) 22%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--signal) 14%, transparent)" />
        </radialGradient>
        <clipPath id="mitoClip1">
          <ellipse cx="410" cy="130" rx="52" ry="30" transform="rotate(-24 410 130)" />
        </clipPath>
        <clipPath id="mitoClip2">
          <ellipse cx="150" cy="330" rx="40" ry="22" transform="rotate(18 150 330)" />
        </clipPath>
      </defs>

      {/* cytoplasm */}
      <ellipse cx="280" cy="250" rx="236" ry="196" fill="url(#cytoGrad)" />
      {/* membrane — outer + inner line */}
      <ellipse
        cx="280"
        cy="250"
        rx="238"
        ry="198"
        fill="none"
        stroke="color-mix(in srgb, var(--signal) 70%, transparent)"
        strokeWidth="3.5"
        {...hov("membrane")}
      />
      <ellipse cx="280" cy="250" rx="228" ry="189" fill="none" stroke="color-mix(in srgb, var(--text-main) 30%, transparent)" strokeWidth="1.2" />

      {/* organelles */}
      <g {...hov("er")}>
        <path
          d="M 118 108 Q 150 96 146 124 Q 142 152 172 140 Q 200 128 190 158"
          fill="none"
          stroke="#b97750"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="196" cy="132" r="2.4" fill="#b97750" />
        <circle cx="178" cy="112" r="2.4" fill="#b97750" />
        <circle cx="150" cy="136" r="2.4" fill="#b97750" />
      </g>
      <g {...hov("smoothER")}>
        <path
          d="M 84 258 Q 112 246 108 272 Q 104 298 134 286"
          fill="none"
          stroke="color-mix(in srgb, var(--signal-2) 65%, transparent)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <g {...hov("nucleus")}>
        <ellipse cx="215" cy="185" rx="78" ry="62" fill="url(#nucleusGrad)" stroke="color-mix(in srgb, var(--signal) 55%, transparent)" strokeWidth="2.2" />
        <circle cx="240" cy="166" r="13" fill="#b97750" opacity="0.85" {...hov("nucleolus")} />
        {zoomed && (
          <ellipse cx="215" cy="185" rx="70" ry="55" fill="none" stroke="color-mix(in srgb, var(--text-main) 35%, transparent)" strokeWidth="1.1" strokeDasharray="4 5" />
        )}
      </g>
      <g {...hov("mitochondria")}>
        <ellipse cx="410" cy="130" rx="52" ry="30" transform="rotate(-24 410 130)" fill="color-mix(in srgb, var(--signal) 24%, transparent)" stroke="color-mix(in srgb, var(--signal) 70%, transparent)" strokeWidth="2.2" />
        {zoomed && (
          <g clipPath="url(#mitoClip1)">
            <path d="M 370 118 Q 390 138 410 118 T 450 118" fill="none" stroke="color-mix(in srgb, var(--signal) 65%, transparent)" strokeWidth="2" />
          </g>
        )}
      </g>
      <g {...hov("mitochondria")}>
        <ellipse cx="150" cy="330" rx="40" ry="22" transform="rotate(18 150 330)" fill="color-mix(in srgb, var(--signal) 20%, transparent)" stroke="color-mix(in srgb, var(--signal) 60%, transparent)" strokeWidth="2" />
        {zoomed && (
          <g clipPath="url(#mitoClip2)">
            <path d="M 120 320 Q 138 338 156 320 T 190 320" fill="none" stroke="color-mix(in srgb, var(--signal) 55%, transparent)" strokeWidth="1.8" />
          </g>
        )}
      </g>
      <g {...hov("golgi")}>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M ${150 + i * 10} ${372 - i * 9} Q 172 ${342 - i * 9} 194 ${372 - i * 9}`}
            fill="none"
            stroke="#b97750"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={0.75 - i * 0.12}
          />
        ))}
      </g>
      <g {...hov("lysosome")}>
        <circle cx="330" cy="235" r="13" fill="color-mix(in srgb, #7d8f78 45%, transparent)" stroke="#7d8f78" strokeWidth="2" />
        <circle cx="327" cy="231" r="3.5" fill="#7d8f78" opacity="0.7" />
      </g>
      <g {...hov("vacuole")}>
        <ellipse cx="400" cy="300" rx="54" ry="42" fill="color-mix(in srgb, #4f7f8a 22%, transparent)" stroke="color-mix(in srgb, #4f7f8a 55%, transparent)" strokeWidth="2" />
        <ellipse cx="392" cy="292" rx="30" ry="20" fill="color-mix(in srgb, #4f7f8a 18%, transparent)" />
      </g>
      <g {...hov("ribosomes")}>
        {[
          [300, 95],
          [352, 82],
          [392, 210],
          [138, 208],
          [262, 330],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.4" fill="color-mix(in srgb, var(--signal) 75%, transparent)" />
        ))}
      </g>
      <g {...hov("vesicle")}>
        <circle cx="262" cy="306" r="8" fill="color-mix(in srgb, var(--text-dim) 40%, transparent)" stroke="color-mix(in srgb, var(--text-dim) 70%, transparent)" strokeWidth="1.6" />
      </g>

      {/* annotations */}
      <AnnotationLayer
        list={CELL_ANNOTATIONS.filter((a) => (a.minor ? zoomed : true))}
        hovered={hovered}
        onHover={onHover}
      />
    </svg>
  );
}

function HeartDiagram({
  zoomed,
  hovered,
  onHover,
}: {
  zoomed: boolean;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const hov = (id: string) => ({
    onPointerEnter: () => onHover(id),
    onPointerLeave: () => onHover(null),
    style: hovered === id ? { stroke: "var(--signal)", strokeWidth: 3 } : undefined,
  });
  return (
    <svg viewBox="0 0 560 480" className="block h-auto w-full">
      <defs>
        <linearGradient id="bloodGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c24046" />
          <stop offset="100%" stopColor="#7a1d24" />
        </linearGradient>
        <linearGradient id="chamberGrad" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, #c24046 34%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, #7a1d24 26%, transparent)" />
        </linearGradient>
        <radialGradient id="heartGlow" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--signal) 16%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--signal) 4%, transparent)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="560" height="480" rx="18" fill="url(#heartGlow)" />

      {/* silhouette */}
      <path
        d="M 280 412 C 188 352, 108 292, 118 200 C 128 128, 198 98, 244 134 C 261 149, 271 168, 280 186 C 289 168, 299 149, 316 134 C 362 98, 432 128, 442 200 C 452 292, 372 352, 280 412 Z"
        fill="color-mix(in srgb, var(--signal) 10%, transparent)"
        stroke="color-mix(in srgb, var(--signal) 55%, transparent)"
        strokeWidth="2.5"
      />

      {/* septum */}
      <path
        d="M 252 172 C 258 220, 258 262, 252 302 C 259 330, 263 360, 260 392"
        fill="none"
        stroke="color-mix(in srgb, var(--text-main) 45%, transparent)"
        strokeWidth="4"
        strokeLinecap="round"
        {...hov("septum")}
      />

      {/* chambers */}
      <g {...hov("ra")}>
        <path
          d="M 150 192 C 158 156, 208 144, 234 164 C 250 180, 252 210, 240 236 C 226 262, 194 272, 174 252 C 150 228, 142 210, 150 192 Z"
          fill="url(#chamberGrad)"
          stroke="color-mix(in srgb, #c24046 80%, transparent)"
          strokeWidth="2"
        />
      </g>
      <g {...hov("rv")}>
        <path
          d="M 174 302 C 200 282, 236 282, 250 306 C 262 330, 260 362, 240 382 C 210 402, 168 396, 152 370 C 136 344, 156 320, 174 302 Z"
          fill="url(#chamberGrad)"
          stroke="color-mix(in srgb, #c24046 80%, transparent)"
          strokeWidth="2"
        />
      </g>
      <g {...hov("la")}>
        <path
          d="M 326 166 C 346 148, 396 154, 406 178 C 416 202, 406 226, 386 236 C 360 250, 330 244, 318 222 C 308 202, 312 180, 326 166 Z"
          fill="url(#chamberGrad)"
          stroke="color-mix(in srgb, #c24046 80%, transparent)"
          strokeWidth="2"
        />
      </g>
      <g {...hov("lv")}>
        <path
          d="M 310 306 C 330 286, 362 288, 376 312 C 392 342, 386 376, 362 392 C 332 410, 292 406, 278 380 C 268 358, 286 322, 310 306 Z"
          fill="url(#chamberGrad)"
          stroke="color-mix(in srgb, #c24046 80%, transparent)"
          strokeWidth="2"
        />
      </g>

      {/* vessels — thick rounded strokes */}
      <g {...hov("aorta")}>
        <path d="M 318 150 C 330 116, 330 86, 314 58" fill="none" stroke="url(#bloodGrad)" strokeWidth="26" strokeLinecap="round" />
      </g>
      <g {...hov("pulmArt")}>
        <path d="M 246 152 C 236 120, 216 96, 190 84" fill="none" stroke="url(#bloodGrad)" strokeWidth="20" strokeLinecap="round" />
      </g>
      <g {...hov("svc")}>
        <path d="M 180 64 C 188 94, 192 116, 198 140" fill="none" stroke="url(#bloodGrad)" strokeWidth="18" strokeLinecap="round" />
      </g>
      <g {...hov("pulmVein")}>
        <path d="M 468 148 C 432 154, 414 160, 410 176" fill="none" stroke="url(#bloodGrad)" strokeWidth="16" strokeLinecap="round" />
        <path d="M 468 192 C 434 194, 416 198, 410 208" fill="none" stroke="url(#bloodGrad)" strokeWidth="16" strokeLinecap="round" />
      </g>

      {/* valves (zoomed detail) */}
      {zoomed && (
        <g>
          <g {...hov("tricuspid")}>
            <path d="M 208 236 Q 226 226 244 238" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g {...hov("mitral")}>
            <path d="M 316 238 Q 334 226 352 236" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g {...hov("pulmValve")}>
            <path d="M 228 142 Q 240 132 252 142" fill="none" stroke="var(--text-main)" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <g {...hov("aorticValve")}>
            <path d="M 306 132 Q 318 122 330 132" fill="none" stroke="var(--text-main)" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>
      )}

      {/* annotations */}
      <AnnotationLayer
        list={HEART_ANNOTATIONS.filter((a) => (a.minor ? zoomed : true))}
        hovered={hovered}
        onHover={onHover}
        color="#ff8a5e"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Explorer shell                                                      */
/* ------------------------------------------------------------------ */

function Explorer({ kind }: { kind: "cell" | "heart" }) {
  const list = kind === "cell" ? CELL_ANNOTATIONS : HEART_ANNOTATIONS;
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const scale = 0.75 + ((zoom - 1) / 9) * 1.55; // 0.75 → 2.3
  const zoomed = scale >= 1.55;
  const active = list.find((a) => a.id === hovered) ?? null;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
      {/* Zoom deck */}
      <div className="flex shrink-0 flex-row items-center justify-center gap-3 lg:w-16 lg:flex-col">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
          <Maximize className="h-3.5 w-3.5" />
          Micro
        </span>
        <div className="flex h-44 items-center lg:h-64">
          <Slider
            orientation="vertical"
            min={1}
            max={10}
            step={1}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            className="h-44 lg:h-64"
          />
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
          <Minimize className="h-3.5 w-3.5" />
          Macro
        </span>
      </div>

      {/* Diagram */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_3%,transparent)]"
        onPointerMove={(e) => {
          if (!active) return;
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onPointerLeave={() => setTip(null)}
      >
        <div className="absolute left-3 top-3 z-10 rounded-full border border-[var(--card-border)] bg-[var(--panel-bg)] px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-text-dim backdrop-blur-md">
          {scale.toFixed(2)}×
        </div>
        <div
          className="flex h-full min-h-[420px] items-center justify-center p-4"
          style={{
            transform: `scale(${scale})`,
            transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {kind === "cell" ? (
            <CellDiagram zoomed={zoomed} hovered={hovered} onHover={setHovered} />
          ) : (
            <HeartDiagram zoomed={zoomed} hovered={hovered} onHover={setHovered} />
          )}
        </div>

        {/* cursor tooltip (pointer devices) */}
        {active && tip && (
          <div
            className="pointer-events-none absolute z-20 max-w-[220px] rounded-xl border border-[var(--signal)] bg-[var(--ink)]/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md"
            style={{
              left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth ?? 300) - 230),
              top: Math.max(tip.y - 90, 8),
            }}
          >
            <p className="font-display text-xs font-bold text-foreground">{active.name}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-dim">{active.def}</p>
          </div>
        )}
      </div>

      {/* Inspector */}
      <div className="w-full shrink-0 lg:w-72">
        <div className="glass-panel sticky top-24 flex min-h-52 flex-col p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            Structure inspector
          </p>
          {active ? (
            <div key={active.id} className="mt-3">
              <p className="font-display text-lg font-bold tracking-tight text-foreground">
                {active.name}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-dim">{active.def}</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-2 text-center">
              <Dna className="h-5 w-5 text-[var(--signal)]" />
              <p className="text-sm font-medium text-foreground">
                Hover or tap a structure
              </p>
              <p className="text-xs leading-relaxed text-text-dim">
                Zoom from macro to micro with the slider — fine detail appears as
                you move in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BiologyExplorer() {
  const [kind, setKind] = useState<"cell" | "heart">("cell");

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <Heart className="h-4 w-4 text-[var(--signal)]" />
              Structural explorer
            </h2>
            <p className="mt-0.5 text-xs text-text-dim">
              Scalable diagrams — zoom in and hover any part for its definition.
            </p>
          </div>
          <div className="glass-chip flex items-center gap-1 p-1">
            {(
              [
                { key: "cell", label: "Animal cell" },
                { key: "heart", label: "Human heart" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setKind(t.key);
                }}
                className={
                  "rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors " +
                  (kind === t.key
                    ? "bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-foreground"
                    : "text-text-dim hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>
        <div className="p-5 sm:p-6">
          <Explorer key={kind} kind={kind} />
        </div>
      </section>
    </div>
  );
}