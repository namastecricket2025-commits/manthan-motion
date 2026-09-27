import { LabThemeToggle, useLabTheme } from "@/components/lab/lab-theme";
import { useSpringTransition, useStillMotion, viewVariants } from "@/lib/motion";
import { AnimatePresence, motion, useAnimationFrame } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

/**
 * Biology — premium structural schematics.
 *
 * Every plate is crisp SVG geometry, not a picture of a diagram: translucent
 * fills, hairline strokes, no pixels to go soft when it scales. Clicking a
 * structure drops the rest of the plate to 40% ink, lights the target with an
 * inset glow and pulls a label flag out along a pointer line.
 *
 * The animated double helix is the lab's processing indicator: two strands
 * turning continuously, with a brighter band of base pairs travelling down
 * them while a workspace composes data.
 *
 * The bench carries the same light/dark switch as Chemistry: `data-lab-theme`
 * on the root, with the plates' structural ink and the accents re-tinted so a
 * plate still reads in daylight.
 */

/* Accents and diagram ink are tokens rather than literals, so a bench switched
   to light can re-tint the whole plate. Ink is an RGB triple because every
   line picks its own alpha. */
const VIOLET = "var(--lab-diagram-violet)";
const CYAN = "var(--lab-diagram-cyan)";
const AMBER = "var(--lab-diagram-amber)";
const MINT = "var(--lab-diagram-mint)";
const ROSE = "var(--lab-diagram-rose)";
const ink = (alpha: number) => `rgba(var(--lab-diagram-ink), ${alpha})`;

type Part = {
  id: string;
  label: string;
  note: string;
  accent: string;
  shape: ReactNode;
  /** Where the pointer line leaves the structure. */
  anchor: [number, number];
  /** Where the label flag sits. */
  flag: [number, number];
};

type Diagram = {
  id: string;
  label: string;
  blurb: string;
  viewBox: string;
  base?: ReactNode;
  parts: Part[];
};

/* ------------------------------------------------------------------ */
/* The plates                                                          */
/* ------------------------------------------------------------------ */

const MEMBRANE =
  "M 150 214 C 132 120 214 62 306 74 C 396 86 486 74 528 148 C 566 216 528 330 430 352 C 330 374 168 348 150 214 Z";

function cellParts(plant: boolean): Part[] {
  const parts: Part[] = [
    {
      id: "membrane",
      label: "Cell membrane",
      note: "A phospholipid bilayer that decides what enters and leaves the cell.",
      accent: CYAN,
      anchor: [512, 116],
      flag: [548, 78],
      shape: (
        <>
          <path d={MEMBRANE} fill="rgba(125,211,252,0.07)" stroke="rgba(125,211,252,0.55)" strokeWidth={2} />
          <path d={MEMBRANE} fill="none" strokeWidth={7} strokeDasharray="2 10" style={{ stroke: ink(0.16) }} />
        </>
      ),
    },
    {
      id: "nucleus",
      label: "Nucleus",
      note: "Stores the DNA and runs transcription. The nucleolus inside builds ribosomes.",
      accent: VIOLET,
      anchor: [250, 140],
      flag: [158, 82],
      shape: (
        <>
          <ellipse cx={250} cy={200} rx={68} ry={58} fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.6)" strokeWidth={2} />
          <ellipse cx={250} cy={200} rx={68} ry={58} fill="none" strokeWidth={6} strokeDasharray="3 9" style={{ stroke: ink(0.16) }} />
          <circle cx={238} cy={196} r={19} stroke="rgba(167,139,250,0.7)" strokeWidth={1.4} style={{ fill: ink(0.14) }} />
        </>
      ),
    },
    {
      id: "mitochondria",
      label: "Mitochondria",
      note: "Cristae-folded membranes where respiration turns glucose into ATP.",
      accent: AMBER,
      anchor: [448, 122],
      flag: [560, 176],
      shape: (
        <g transform="rotate(-16 448 152)">
          <rect x={388} y={126} width={120} height={54} rx={27} fill="rgba(252,211,77,0.1)" stroke="rgba(252,211,77,0.6)" strokeWidth={2} />
          <path
            d="M 410 132 C 420 152 404 162 414 176 M 448 130 C 458 150 442 160 452 178 M 486 132 C 496 152 480 162 490 176"
            fill="none"
            stroke="rgba(252,211,77,0.55)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      ),
    },
    {
      id: "er",
      label: "Endoplasmic reticulum",
      note: "Folded membranes beside the nucleus that build and ship proteins and lipids.",
      accent: MINT,
      anchor: [372, 268],
      flag: [286, 366],
      shape: (
        <>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M ${300 + i * 6} ${296 - i * 16} C ${352 - i * 6} ${256 - i * 16}, ${432 - i * 8} ${258 - i * 14}, ${478 - i * 10} ${300 - i * 18}`}
              fill="none"
              stroke="rgba(110,231,183,0.6)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ))}
        </>
      ),
    },
    {
      id: "golgi",
      label: "Golgi apparatus",
      note: "Stacked cisternae that modify, sort and package proteins for export.",
      accent: ROSE,
      anchor: [470, 312],
      flag: [572, 336],
      shape: (
        <>
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M ${418 + i * 4} ${330 - i * 13} C ${452} ${312 - i * 13}, ${498} ${312 - i * 13}, ${528 - i * 4} ${330 - i * 13}`}
              fill="none"
              stroke="rgba(253,164,175,0.62)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ))}
        </>
      ),
    },
    {
      id: "ribosomes",
      label: "Ribosomes",
      note: "The protein factories — free in the cytosol or docked on the rough ER.",
      accent: ink(0.75),
      anchor: [356, 176],
      flag: [420, 56],
      shape: (
        <>
          {[
            [340, 168],
            [372, 192],
            [316, 210],
            [392, 232],
            [300, 250],
            [352, 268],
            [432, 214],
            [470, 250],
            [286, 302],
            [410, 348],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4} style={{ fill: ink(0.5) }} />
          ))}
        </>
      ),
    },
  ];

  if (plant) {
    parts.push(
      {
        id: "wall",
        label: "Cell wall",
        note: "A rigid cellulose jacket outside the membrane — plant cells only.",
        accent: "#d8b4fe",
        anchor: [176, 344],
        flag: [96, 384],
        shape: (
          <path
            d="M 132 214 C 112 112 206 46 306 58 C 404 70 498 58 544 140 C 586 214 546 342 440 366 C 336 390 152 358 132 214 Z"
            fill="none"
            stroke="rgba(216,180,254,0.5)"
            strokeWidth={2.5}
          />
        ),
      },
      {
        id: "chloroplast",
        label: "Chloroplast",
        note: "Thylakoid stacks that capture light and fix carbon into sugar.",
        accent: MINT,
        anchor: [452, 366],
        flag: [520, 384],
        shape: (
          <g transform="rotate(12 452 364)">
            <ellipse cx={452} cy={364} rx={44} ry={22} fill="rgba(110,231,183,0.12)" stroke="rgba(110,231,183,0.6)" strokeWidth={2} />
            <path d="M 430 356 L 474 372 M 430 372 L 474 356" stroke="rgba(110,231,183,0.5)" strokeWidth={1.4} />
          </g>
        ),
      },
      {
        id: "vacuole",
        label: "Central vacuole",
        note: "A water store that keeps the cell turgid — the biggest plant-cell organelle.",
        accent: CYAN,
        anchor: [268, 320],
        flag: [214, 384],
        shape: (
          <path
            d="M 214 296 C 214 252 292 240 352 258 C 408 274 404 340 344 352 C 286 364 214 344 214 296 Z"
            fill="rgba(125,211,252,0.08)"
            stroke="rgba(125,211,252,0.5)"
            strokeWidth={2}
          />
        ),
      },
    );
  }
  return parts;
}

function chamber(x: number, y: number, w: number, h: number, accent: string, stroke: string) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={30}
      fill={accent}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

const HEART_OUTLINE =
  "M 168 108 C 152 62 246 40 320 52 C 394 40 488 62 472 108 C 500 208 470 322 400 362 C 340 394 300 394 240 362 C 170 322 140 208 168 108 Z";

function heartParts(): Part[] {
  return [
    {
      id: "ra",
      label: "Right atrium",
      note: "Receives deoxygenated blood from the body through the vena cava.",
      accent: CYAN,
      anchor: [232, 122],
      flag: [128, 74],
      shape: chamber(172, 96, 122, 82, "rgba(125,211,252,0.12)", "rgba(125,211,252,0.6)"),
    },
    {
      id: "rv",
      label: "Right ventricle",
      note: "Pumps that blood to the lungs through the pulmonary artery.",
      accent: MINT,
      anchor: [232, 300],
      flag: [126, 340],
      shape: chamber(176, 192, 118, 138, "rgba(110,231,183,0.1)", "rgba(110,231,183,0.6)"),
    },
    {
      id: "la",
      label: "Left atrium",
      note: "Takes oxygenated blood back from the lungs through the pulmonary veins.",
      accent: CYAN,
      anchor: [408, 122],
      flag: [516, 74],
      shape: chamber(348, 96, 122, 82, "rgba(125,211,252,0.12)", "rgba(125,211,252,0.6)"),
    },
    {
      id: "lv",
      label: "Left ventricle",
      note: "The thickest chamber — it drives blood around the whole body from the aorta.",
      accent: ROSE,
      anchor: [408, 300],
      flag: [522, 340],
      shape: chamber(352, 192, 118, 138, "rgba(253,164,175,0.1)", "rgba(253,164,175,0.6)"),
    },
    {
      id: "tricuspid",
      label: "Tricuspid valve",
      note: "Three leaflets between the right atrium and right ventricle.",
      accent: AMBER,
      anchor: [232, 186],
      flag: [140, 186],
      shape: (
        <>
          <path d="M 186 190 L 232 178 L 278 190" fill="none" stroke="rgba(252,211,77,0.75)" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M 206 190 L 214 208 M 258 190 L 250 208" stroke="rgba(252,211,77,0.5)" strokeWidth={1.6} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "mitral",
      label: "Mitral valve",
      note: "Two leaflets on the left side — the valve that can narrow or leak.",
      accent: AMBER,
      anchor: [408, 186],
      flag: [540, 186],
      shape: (
        <>
          <path d="M 362 190 L 408 178 L 454 190" fill="none" stroke="rgba(252,211,77,0.75)" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M 382 190 L 390 208 M 434 190 L 426 208" stroke="rgba(252,211,77,0.5)" strokeWidth={1.6} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "aorta",
      label: "Aorta",
      note: "The body's largest artery, leaving the left ventricle in an arch.",
      accent: VIOLET,
      anchor: [456, 96],
      flag: [552, 44],
      shape: (
        <>
          <path
            d="M 412 100 C 414 44 486 34 522 66"
            fill="none"
            stroke="rgba(167,139,250,0.55)"
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d="M 412 100 C 414 44 486 34 522 66"
            fill="none"
            strokeWidth={1.4}
            strokeLinecap="round"
            style={{ stroke: ink(0.25) }}
          />
        </>
      ),
    },
  ];
}

function respiratoryParts(): Part[] {
  return [
    {
      id: "trachea",
      label: "Trachea",
      note: "Cartilage rings keep the windpipe open on the way to the bronchi.",
      accent: CYAN,
      anchor: [320, 60],
      flag: [320, 30],
      shape: (
        <>
          <rect x={302} y={46} width={36} height={120} rx={18} fill="rgba(125,211,252,0.1)" stroke="rgba(125,211,252,0.55)" strokeWidth={2} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={306} y1={70 + i * 24} x2={334} y2={70 + i * 24} stroke="rgba(125,211,252,0.5)" strokeWidth={1.6} />
          ))}
        </>
      ),
    },
    {
      id: "bronchi",
      label: "Bronchi",
      note: "Two branches that carry air into each lung, then split into bronchioles.",
      accent: MINT,
      anchor: [378, 176],
      flag: [470, 150],
      shape: (
        <>
          <path d="M 320 166 C 300 196 262 214 224 232" fill="none" stroke="rgba(110,231,183,0.6)" strokeWidth={9} strokeLinecap="round" />
          <path d="M 338 166 C 358 196 396 214 434 232" fill="none" stroke="rgba(110,231,183,0.6)" strokeWidth={9} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "right-lung",
      label: "Right lung",
      note: "Three lobes, sitting slightly larger than the left to clear the heart.",
      accent: VIOLET,
      anchor: [246, 214],
      flag: [150, 190],
      shape: (
        <>
          <path d="M 268 178 C 214 178 168 226 160 300 C 154 354 186 384 236 380 C 282 376 302 336 300 282 C 298 220 294 178 268 178 Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.6)" strokeWidth={2} />
          <path d="M 176 300 C 210 292 262 288 296 284" fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth={1.6} />
          <path d="M 178 344 C 216 336 266 332 298 330" fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "left-lung",
      label: "Left lung",
      note: "Two lobes with a cardiac notch cut into the inner edge.",
      accent: VIOLET,
      anchor: [414, 214],
      flag: [514, 190],
      shape: (
        <>
          <path d="M 392 178 C 446 178 486 226 492 300 C 496 354 466 384 418 380 C 374 376 356 336 358 282 C 360 220 366 178 392 178 Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.6)" strokeWidth={2} />
          <path d="M 366 300 C 404 292 452 288 486 284" fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "alveoli",
      label: "Alveoli",
      note: "Air sacs one cell thick where oxygen crosses into the blood.",
      accent: AMBER,
      anchor: [462, 246],
      flag: [566, 236],
      shape: (
        <>
          {[
            [440, 240],
            [468, 232],
            [494, 244],
            [452, 268],
            [480, 264],
            [506, 274],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={15} fill="rgba(252,211,77,0.1)" stroke="rgba(252,211,77,0.55)" strokeWidth={1.6} />
          ))}
        </>
      ),
    },
    {
      id: "diaphragm",
      label: "Diaphragm",
      note: "Contracts and flattens to pull air in — the muscle that does the breathing.",
      accent: ROSE,
      anchor: [320, 360],
      flag: [166, 388],
      shape: (
        <path d="M 132 352 C 210 388 430 388 508 352" fill="none" stroke="rgba(253,164,175,0.65)" strokeWidth={6} strokeLinecap="round" />
      ),
    },
  ];
}

function excretoryParts(): Part[] {
  return [
    {
      id: "right-kidney",
      label: "Right kidney",
      note: "Filters blood into urine; sits slightly lower under the liver.",
      accent: VIOLET,
      anchor: [206, 150],
      flag: [116, 108],
      shape: (
        <>
          <path d="M 196 92 C 158 96 132 138 140 186 C 148 236 190 268 224 250 C 250 236 254 206 244 182 C 262 176 266 150 252 130 C 238 108 220 90 196 92 Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.6)" strokeWidth={2} />
          <path d="M 196 130 C 176 150 174 186 192 206" fill="none" stroke="rgba(167,139,250,0.4)" strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "left-kidney",
      label: "Left kidney",
      note: "Mirror twin of the right; together they clear the whole blood volume daily.",
      accent: VIOLET,
      anchor: [436, 150],
      flag: [524, 108],
      shape: (
        <>
          <path d="M 446 92 C 484 96 510 138 502 186 C 494 236 452 268 418 250 C 392 236 388 206 398 182 C 380 176 376 150 390 130 C 404 108 422 90 446 92 Z" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.6)" strokeWidth={2} />
          <path d="M 446 130 C 466 150 468 186 450 206" fill="none" stroke="rgba(167,139,250,0.4)" strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "renal",
      label: "Renal artery and vein",
      note: "The artery brings unfiltered blood in; the vein carries clean blood out.",
      accent: ROSE,
      anchor: [320, 128],
      flag: [320, 84],
      shape: (
        <>
          <path d="M 322 128 C 288 132 258 140 238 158" fill="none" stroke="rgba(253,164,175,0.6)" strokeWidth={7} strokeLinecap="round" />
          <path d="M 318 142 C 288 148 262 158 240 176" fill="none" stroke="rgba(253,164,175,0.32)" strokeWidth={5} strokeLinecap="round" />
          <path d="M 318 128 C 352 132 382 140 402 158" fill="none" stroke="rgba(253,164,175,0.6)" strokeWidth={7} strokeLinecap="round" />
          <path d="M 322 142 C 352 148 378 158 400 176" fill="none" stroke="rgba(253,164,175,0.32)" strokeWidth={5} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "ureters",
      label: "Ureters",
      note: "Muscular tubes that push urine from each kidney down to the bladder.",
      accent: CYAN,
      anchor: [268, 250],
      flag: [176, 262],
      shape: (
        <>
          <path d="M 240 234 C 254 284 278 312 300 336" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth={6} strokeLinecap="round" />
          <path d="M 402 234 C 388 284 364 312 342 336" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth={6} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "bladder",
      label: "Urinary bladder",
      note: "A stretchy muscular sac that stores urine until it is passed.",
      accent: MINT,
      anchor: [320, 350],
      flag: [446, 372],
      shape: (
        <>
          <path d="M 264 340 C 264 316 376 316 376 340 C 376 380 350 396 320 396 C 290 396 264 380 264 340 Z" fill="rgba(110,231,183,0.1)" stroke="rgba(110,231,183,0.6)" strokeWidth={2} />
          <path d="M 320 322 C 336 332 348 344 352 358" fill="none" stroke="rgba(110,231,183,0.4)" strokeWidth={1.4} />
        </>
      ),
    },
    {
      id: "urethra",
      label: "Urethra",
      note: "The final tube out of the body, with a sphincter that keeps it closed.",
      accent: AMBER,
      anchor: [320, 404],
      flag: [474, 392],
      shape: (
        <>
          <rect x={306} y={396} width={28} height={22} rx={11} fill="rgba(252,211,77,0.1)" stroke="rgba(252,211,77,0.6)" strokeWidth={2} />
        </>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Plate renderer                                                      */
/* ------------------------------------------------------------------ */

const PLATE_W = 640;
const PLATE_H = 420;

function PartFlag({ part }: { part: Part }) {
  const transition = useSpringTransition();
  /* Flags near an edge pull inward instead of centring, so a callout never
     hangs outside the plate it belongs to. */
  const side =
    part.flag[0] > 470 ? "right" : part.flag[0] < 170 ? "left" : "center";
  const anchorClass =
    side === "right"
      ? "-translate-x-[85%]"
      : side === "left"
        ? "-translate-x-[15%]"
        : "-translate-x-1/2";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...transition, delay: 0.08 }}
      className={`apple-lab-flag pointer-events-none absolute w-44 -translate-y-1/2 ${anchorClass}`}
      style={{
        left: `${(part.flag[0] / PLATE_W) * 100}%`,
        top: `${(part.flag[1] / PLATE_H) * 100}%`,
      }}
    >
      <p className="apple-lab-micro" style={{ color: part.accent }}>
        {part.label}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">{part.note}</p>
    </motion.div>
  );
}

function VectorDiagram({ diagram }: { diagram: Diagram }) {
  const transition = useSpringTransition();
  const [selectedId, setSelectedId] = useState<string | null>(diagram.parts[0]?.id ?? null);
  const selected = diagram.parts.find((part) => part.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="apple-lab-micro">{diagram.label}</p>
            <h3 className="apple-lab-title mt-1 text-lg">{diagram.blurb}</h3>
          </div>
          <span className="apple-lab-chip">click a structure</span>
        </div>

        <div className="relative mt-4">
          <svg
            viewBox={diagram.viewBox}
            className="w-full"
            style={{ aspectRatio: `${PLATE_W} / ${PLATE_H}` }}
            role="img"
            aria-label={`${diagram.label} schematic`}
          >
            <defs>
              <filter id={`lab-blur-${diagram.id}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>

            {/* the shared silhouette sits behind the structures */}
            {diagram.base}

            {diagram.parts.map((part) => {
              const isSelected = part.id === selectedId;
              return (
                <motion.g
                  key={part.id}
                  initial={false}
                  animate={{ opacity: selectedId && !isSelected ? 0.4 : 1 }}
                  transition={transition}
                  onClick={() => setSelectedId(part.id)}
                  style={{ cursor: "pointer" }}
                >
                  {part.shape}
                </motion.g>
              );
            })}

            {/* the target: inset glow clipped to its own geometry, then a crisp rim */}
            {selected && (
              <g pointerEvents="none">
                <clipPath id={`lab-clip-${selected.id}`}>{selected.shape}</clipPath>
                <g clipPath={`url(#lab-clip-${selected.id})`}>
                  <rect
                    x={0}
                    y={0}
                    width={PLATE_W}
                    height={PLATE_H}
                    fill="none"
                    strokeWidth={26}
                    style={{ stroke: selected.accent }}
                    opacity={0.55}
                    filter={`url(#lab-blur-${diagram.id})`}
                  />
                </g>
                {/* a second, wider pass densifies the inner boundary */}
                <g clipPath={`url(#lab-clip-${selected.id})`}>
                  <rect
                    x={0}
                    y={0}
                    width={PLATE_W}
                    height={PLATE_H}
                    fill="none"
                    strokeWidth={46}
                    style={{ stroke: selected.accent }}
                    opacity={0.3}
                    filter={`url(#lab-blur-${diagram.id})`}
                  />
                </g>
                <motion.path
                  d={`M ${selected.anchor[0]} ${selected.anchor[1]} L ${selected.flag[0]} ${selected.flag[1]}`}
                  fill="none"
                  strokeWidth={1.3}
                  style={{ stroke: selected.accent }}
                  strokeDasharray="1 6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={transition}
                />
                <circle cx={selected.anchor[0]} cy={selected.anchor[1]} r={4} style={{ fill: selected.accent }} />
              </g>
            )}
          </svg>

          <AnimatePresence mode="wait">
            {selected && <PartFlag key={selected.id} part={selected} />}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="apple-lab-micro">Structures</p>
        {diagram.parts.map((part) => {
          const isSelected = part.id === selectedId;
          return (
            <motion.button
              key={part.id}
              type="button"
              onClick={() => setSelectedId(part.id)}
              onMouseEnter={() => setSelectedId(part.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.99 }}
              transition={transition}
              className="apple-lab-card flex flex-col items-start gap-1.5 px-3.5 py-3 text-left"
              style={{ borderColor: isSelected ? part.accent : undefined }}
            >
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: part.accent }} />
                <span className="apple-lab-value text-[13px] font-semibold">{part.label}</span>
              </span>
              <span className="text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">{part.note}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The processing helix                                                */
/* ------------------------------------------------------------------ */

const HELIX_W = 260;
const HELIX_H = 320;
const RUNGS = 26;

function DnaHelix() {
  const still = useStillMotion();
  const strandA = useRef<SVGPathElement>(null);
  const strandB = useRef<SVGPathElement>(null);
  const rungRefs = useRef<(SVGLineElement | null)[]>([]);
  const phase = useRef(0);
  const pulse = useRef(0);

  useAnimationFrame((_, delta) => {
    const seconds = delta / 1000;
    if (!still) {
      phase.current += seconds * 1.15;
      pulse.current = (pulse.current + seconds * 78) % (HELIX_H + 120);
    }

    const amplitude = 74;
    const wave = (y: number, offset: number) =>
      HELIX_W / 2 + amplitude * Math.sin((y / 92) * Math.PI + phase.current + offset);

    const sample = (offset: number) => {
      const points: string[] = [];
      for (let i = 0; i <= 40; i += 1) {
        const y = (i / 40) * HELIX_H;
        points.push(`${i === 0 ? "M" : "L"}${wave(y, offset).toFixed(2)} ${y.toFixed(2)}`);
      }
      return points.join(" ");
    };

    strandA.current?.setAttribute("d", sample(0));
    strandB.current?.setAttribute("d", sample(Math.PI));

    for (let i = 0; i < RUNGS; i += 1) {
      const node = rungRefs.current[i];
      if (!node) continue;
      const y = 12 + (i / RUNGS) * (HELIX_H - 24);
      const xa = wave(y, 0);
      const xb = wave(y, Math.PI);
      const depth = Math.abs(Math.cos((y / 92) * Math.PI + phase.current));
      const distance = Math.abs(y - pulse.current);
      const heat = Math.max(0, 1 - distance / 90);
      node.setAttribute("x1", xa.toFixed(2));
      node.setAttribute("x2", xb.toFixed(2));
      node.setAttribute("y1", y.toFixed(2));
      node.setAttribute("y2", y.toFixed(2));
      node.setAttribute("stroke-width", (0.8 + depth * 1.5).toFixed(2));
      node.setAttribute("opacity", (0.16 + depth * 0.34 + heat * 0.5).toFixed(3));
    }
  });

  return (
    <div className="apple-lab-panel apple-lab-glass">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="apple-lab-micro">Processing indicator</p>
          <h3 className="apple-lab-title mt-1 text-lg">Live double helix</h3>
        </div>
        <span className="apple-lab-chip">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: MINT }} />
          {RUNGS} base pairs in view
        </span>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[260px_1fr]">
        <svg
          viewBox={`0 0 ${HELIX_W} ${HELIX_H}`}
          className="h-[300px] w-full"
          role="img"
          aria-label="A rotating double helix with a band of base pairs travelling down it"
        >
          <defs>
            <linearGradient id="lab-strand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: CYAN }} />
              <stop offset="50%" style={{ stopColor: VIOLET }} />
              <stop offset="100%" style={{ stopColor: MINT }} />
            </linearGradient>
            <filter id="lab-strand-glow" x="-30%" y="-20%" width="160%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: RUNGS }, (_, index) => (
            <line
              key={index}
              ref={(node) => {
                rungRefs.current[index] = node;
              }}
              x1={HELIX_W / 2}
              x2={HELIX_W / 2}
              y1={12 + (index / RUNGS) * (HELIX_H - 24)}
              y2={12 + (index / RUNGS) * (HELIX_H - 24)}
              strokeLinecap="round"
              style={{ stroke: ink(0.6) }}
            />
          ))}

          <path ref={strandA} fill="none" stroke="url(#lab-strand)" strokeWidth={2.6} strokeLinecap="round" filter="url(#lab-strand-glow)" />
          <path ref={strandB} fill="none" stroke="url(#lab-strand)" strokeWidth={2.6} strokeLinecap="round" opacity={0.75} />
        </svg>

        <div className="flex flex-col gap-3">
          <p className="apple-lab-note">
            Two anti-parallel strands turn continuously while a brighter band of
            base pairs travels down the rungs — the lab's way of saying a
            workspace is still composing, without a spinner anywhere on screen.
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ["Strand pitch", "3.4 nm"],
              ["Turn", "10.5 bp"],
              ["Separation", "2.0 nm"],
            ].map(([label, value]) => (
              <div key={label} className="apple-lab-card px-3 py-2.5">
                <p className="apple-lab-micro">{label}</p>
                <p className="apple-lab-value mt-1 text-[13px] font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] leading-relaxed text-[var(--lab-ink-micro)]">
            B-DNA reference proportions — the indicator is decorative, the
            measurements are the textbook ones.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export function BiologyVectorLab() {
  const transition = useSpringTransition();
  const { theme, toggle } = useLabTheme();
  const [plate, setPlate] = useState("cell");
  const [plant, setPlant] = useState(false);

  const diagrams: Diagram[] = [
    {
      id: "cell",
      label: plant ? "Plant cell" : "Animal cell",
      blurb: plant
        ? "Rigid wall, chloroplasts and one huge vacuole"
        : "Membrane, nucleus, mitochondria and the protein line",
      viewBox: `0 0 ${PLATE_W} ${PLATE_H}`,
      parts: cellParts(plant),
    },
    {
      id: "heart",
      label: "Heart",
      blurb: "Four chambers, two valves and the aortic arch",
      viewBox: `0 0 ${PLATE_W} ${PLATE_H}`,
      base: (
        <path
          d={HEART_OUTLINE}
          strokeWidth={2}
          style={{ fill: ink(0.022), stroke: ink(0.16) }}
        />
      ),
      parts: heartParts(),
    },
    {
      id: "respiratory",
      label: "Respiratory system",
      blurb: "Airway, lungs, alveoli and the diaphragm",
      viewBox: `0 0 ${PLATE_W} ${PLATE_H}`,
      base: (
        <>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M ${64 + i * 16} ${140 - i * 30} C ${200 - i * 10} ${100 - i * 26}, ${440 + i * 10} ${100 - i * 26}, ${576 - i * 16} ${140 - i * 30}`}
              fill="none"
              strokeWidth={6}
              strokeLinecap="round"
              style={{ stroke: ink(0.07) }}
            />
          ))}
          <path d="M 60 300 C 200 356 440 356 580 300" fill="none" strokeWidth={3} style={{ stroke: ink(0.05) }} />
        </>
      ),
      parts: respiratoryParts(),
    },
    {
      id: "excretory",
      label: "Excretory system",
      blurb: "Kidneys, ureters, bladder and the way out",
      viewBox: `0 0 ${PLATE_W} ${PLATE_H}`,
      base: (
        <path
          d="M 320 84 C 330 140 330 220 322 300"
          fill="none"
          strokeWidth={2}
          strokeDasharray="4 8"
          style={{ stroke: ink(0.05) }}
        />
      ),
      parts: excretoryParts(),
    },
  ];

  const active = diagrams.find((diagram) => diagram.id === plate) ?? diagrams[0];

  return (
    <div data-lab-theme={theme} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="apple-lab-tabrail" role="tablist" aria-label="Biology plates">
          {diagrams.map((diagram) => {
            const isActive = diagram.id === plate;
            return (
              <button
                key={diagram.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="apple-lab-tab"
                onClick={() => setPlate(diagram.id)}
              >
                {isActive && (
                  <motion.span layoutId="biology-plate-pill" className="apple-lab-pill" transition={transition} />
                )}
                <span className="relative z-10">{diagram.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plate === "cell" && (
            <button
              type="button"
              className="apple-lab-btn"
              data-active={plant}
              onClick={() => setPlant((value) => !value)}
            >
              {plant ? "Animal cell" : "Plant cell"}
            </button>
          )}
          <LabThemeToggle theme={theme} subject="biology" onToggle={toggle} />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${plate}-${plant}`}
          variants={viewVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={transition}
        >
          <VectorDiagram diagram={active} />
        </motion.div>
      </AnimatePresence>

      <DnaHelix />
    </div>
  );
}

export default BiologyVectorLab;
