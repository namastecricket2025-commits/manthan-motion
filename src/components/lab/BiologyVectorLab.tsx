import { useLabTheme } from "@/components/lab/lab-theme";
import OrganStage, { type OrganSystem } from "@/components/lab/bio/OrganStage";
import HeartModelViewer from "@/components/lab/bio/HeartModelViewer";
import RespiratoryModelViewer from "@/components/lab/bio/RespiratoryModelViewer";
import ExcretoryModelViewer from "@/components/lab/bio/ExcretoryModelViewer";
import { useSpringTransition, viewVariants } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

/**
 * Biology — premium structural schematics.
 *
 * Every plate is crisp SVG geometry, not a picture of a diagram: translucent
 * fills, hairline strokes, no pixels to go soft when it scales. Clicking a
 * structure drops the rest of the plate to 40% ink, lights the target with an
 * inset glow and pulls a label flag out along a pointer line.
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
const LILAC = "var(--lab-diagram-lilac)";
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

/** The four plates: the cell stays a vector schematic, the three organ
    systems render in the shared Three.js stage (OrganStage). */
type Plate = "cell" | OrganSystem;

type Diagram = {
  id: Plate;
  label: string;
  blurb: string;
  viewBox: string;
  base?: ReactNode;
  parts: Part[];
};

/* ------------------------------------------------------------------ */
/* The plates                                                          */
/* ------------------------------------------------------------------ */

/* Every outline on this bench is traced from a public-domain reference plate
   rather than invented, so the anatomy can be checked against its source:

     cells    "Animal cell structure en.svg" / "Plant cell structure-en.svg",
              LadyofHats (Mariana Ruiz Villarreal), released into the public
              domain.  commons.wikimedia.org/wiki/File:Animal_cell_structure_en.svg
     heart    Gray's Anatomy, 20th ed. (1918): plate 491, posterior view (the
              apex lands to the lower left in that projection) and plate 497,
              the aortic valve cusps.  H. V. Carter, public domain.
              commons.wikimedia.org/wiki/File:Gray491.png
     lungs    Gray's plate 962, redrawn by Edelhart Kempeneers as
              "Lungs anatomy.png", public domain.
              commons.wikimedia.org/wiki/File:Lungs_anatomy.png
     kidneys  Gray's plate 1127, "Section of kidney", public domain.
              commons.wikimedia.org/wiki/File:Kidney_section.jpg

   Proportions, landmark points and lobe counts are the plates'; only the line
   weight and the colour are the bench's. */

type Pt = [number, number];

/** Catmull-Rom through landmarks, emitted as cubic segments: a closed curve
    with real curvature between the points, instead of the four-arc oval that
    reads as a placeholder. */
function smooth(points: Pt[], close = true, tension = 1): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < (close ? n : n - 1); i += 1) {
    const p0 = close ? at(i - 1) : points[Math.max(0, i - 1)];
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = close ? at(i + 2) : points[Math.min(n - 1, i + 2)];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 6, p1[1] + ((p2[1] - p0[1]) * tension) / 6];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 6, p2[1] - ((p3[1] - p1[1]) * tension) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return close ? `${d} Z` : d;
}

/** A point r away from a centre, deg degrees round it (screen y grows down). */
function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** A spiral: the radius grows as the angle sweeps, which is how a folded ER
    sheet is drawn - it doubles back on itself instead of stacking up as
    concentric arcs. */
function spiral(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, steps = 24): string {
  const out: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const p = polar(cx, cy, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t);
    out.push(`${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`);
  }
  return out.join(" ");
}

/** A deterministic even scatter inside an ellipse. The cytosol grain has to be
    identical on every render, so this is a hash and not Math.random. */
function scatter(count: number, seed: number, cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: count }, (_, i) => {
    const hash = (k: number) => {
      const v = Math.sin((i + seed) * k) * 43758.5453;
      return v - Math.floor(v);
    };
    const angle = hash(12.9898) * Math.PI * 2;
    const radius = Math.sqrt(hash(78.233));
    return {
      x: cx + Math.cos(angle) * radius * rx,
      y: cy + Math.sin(angle) * radius * ry,
      r: 0.7 + hash(37.719) * 1.5,
    };
  });
}

/* The animal cell membrane: eight landmarks off the reference plate's
   irregular outline, with the curvature between them interpolated. */
const MEMBRANE = smooth([
  [112, 158], [252, 58], [412, 56], [548, 158], [544, 276], [410, 374], [256, 372], [118, 268],
]);

/* Plant cells only. The wall is a rigid rounded rectangle, not a blob, and the
   eight units between its two lines are the packed cellulose lamellae the
   reference plate draws as hatching. */
const WALL_OUTER =
  "M 84 30 L 564 30 A 22 22 0 0 1 586 52 L 586 380 A 22 22 0 0 1 564 402 L 84 402 A 22 22 0 0 1 62 380 L 62 52 A 22 22 0 0 1 84 30 Z";
const WALL_INNER =
  "M 90 38 L 558 38 A 16 16 0 0 1 578 54 L 578 378 A 16 16 0 0 1 558 394 L 90 394 A 16 16 0 0 1 70 378 L 70 54 A 16 16 0 0 1 90 38 Z";
const LAMELLAE: [number, number, number, number][] = [
  [62, 110, 70, 110], [62, 170, 70, 170], [62, 230, 70, 230], [62, 290, 70, 290], [62, 350, 70, 350],
  [578, 110, 586, 110], [578, 170, 586, 170], [578, 230, 586, 230], [578, 290, 586, 290], [578, 350, 586, 350],
  [140, 30, 140, 38], [220, 30, 220, 38], [300, 30, 300, 38], [380, 30, 380, 38], [460, 30, 460, 38],
  [520, 30, 520, 38], [200, 402, 200, 394], [280, 402, 280, 394], [360, 402, 360, 394], [440, 402, 440, 394],
];

/* Plant cells only: the central vacuole, the largest thing in the cell and the
   reason the organelles are crowded into the cortex. */
const VACUOLE = smooth([
  [330, 202], [420, 164], [498, 196], [502, 256], [462, 322], [386, 348], [340, 310], [318, 248],
]);
const TONOPLAST = smooth([
  [338, 208], [420, 174], [490, 202], [494, 254], [456, 314], [386, 340], [348, 306], [328, 250],
]);

/* A mitochondrion is a bean, not an almond: the upper edge rises, dips and
   rises again the way the reference plate draws it. Local grid 120 x 68. */
const BEAN: Pt[] = [
  [-60, 2], [-52, -20], [-26, -32], [-4, -30], [10, -22], [24, -28], [46, -26], [58, -6],
  [56, 16], [30, 30], [0, 33], [-30, 30], [-52, 18],
];
/* Cristae: folds of the inner membrane crossing the matrix. */
const CRISTAE = [
  "M -46 -14 C -36 -6 -34 6 -42 14",
  "M -28 -26 C -20 -12 -22 8 -30 20",
  "M -8 -26 C 0 -14 -2 6 -10 22",
  "M 12 -20 C 20 -8 18 8 10 24",
  "M 32 -22 C 40 -10 38 6 30 22",
  "M 48 -18 C 54 -8 52 6 46 16",
];
const NUC = { cx: 246, cy: 186, rx: 66, ry: 56 };
/* Plant cells park the organelles in the cortex: everything shifts up and left
   so the vacuole can hold the middle. */
const PLANT_SHIFT = { scale: 0.94, dx: -26, dy: -22 };
const GOLGI = { cx: 250, cy: 300 };

/** One mitochondrion: outer membrane, inner membrane, folded cristae. */
function mitochondrion(cx: number, cy: number, rot: number, key: string) {
  const outline = (k: number) => smooth(BEAN.map(([x, y]): Pt => [x * k, y * k]));
  return (
    <g key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <path d={outline(1)} fill={AMBER} fillOpacity={0.08} stroke={AMBER} strokeOpacity={0.62} strokeWidth={2.2} />
      <path d={outline(0.84)} fill="none" stroke={AMBER} strokeOpacity={0.34} strokeWidth={1.2} />
      {CRISTAE.map((d) => (
        <path key={d} d={d} fill="none" stroke={AMBER} strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** One chloroplast: an oval with grana - thylakoid stacks joined by lamellae. */
function chloroplast(cx: number, cy: number, rot: number, key: string) {
  return (
    <g key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <ellipse rx={34} ry={18} fill={MINT} fillOpacity={0.1} stroke={MINT} strokeOpacity={0.6} strokeWidth={2} />
      <ellipse rx={26} ry={11} fill="none" stroke={MINT} strokeOpacity={0.2} strokeWidth={1.1} />
      {[-18, -6, 6, 18].map((x) => (
        <g key={x}>
          {[-4.5, -1.5, 1.5, 4.5].map((y) => (
            <line
              key={y}
              x1={x - 4.5}
              y1={y}
              x2={x + 4.5}
              y2={y}
              stroke={MINT}
              strokeOpacity={0.5}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}
      <path
        d="M -30 -8 C -18 -14 18 -14 30 -8 M -30 8 C -18 14 18 14 30 8"
        fill="none"
        stroke={MINT}
        strokeOpacity={0.3}
        strokeWidth={1.1}
      />
    </g>
  );
}

/** The alveoli are grapes: small sacs clustered on the end of a bronchiole,
    each one cell thick - which is the whole point of them. */
function alveoli(cx: number, cy: number, scale: number, key: string) {
  const sacs: Pt[] = [
    [0, -22], [-20, -14], [19, -15], [-30, 4], [-9, -2], [11, 1], [29, 6], [-24, 22], [-2, 24], [21, 23],
  ];
  return (
    <g key={key}>
      {sacs.map(([dx, dy]) => (
        <circle
          key={`${dx}-${dy}`}
          cx={cx + dx * scale}
          cy={cy + dy * scale}
          r={10 * scale}
          fill={AMBER}
          fillOpacity={0.08}
          stroke={AMBER}
          strokeOpacity={0.5}
          strokeWidth={1.4}
        />
      ))}
    </g>
  );
}

function cellParts(plant: boolean): Part[] {
  const organelle = `translate(${PLANT_SHIFT.dx} ${PLANT_SHIFT.dy}) scale(${PLANT_SHIFT.scale})`;
  /* Plant cells keep the same organelles, moved into the cortex: pt() maps a
     reference coordinate to wherever the plant layout puts it. */
  const pt = (x: number, y: number): Pt =>
    plant ? [x * PLANT_SHIFT.scale + PLANT_SHIFT.dx, y * PLANT_SHIFT.scale + PLANT_SHIFT.dy] : [x, y];
  /* A point on the nuclear envelope: k = 1 is the envelope line itself. */
  const envelope = (deg: number, k: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return [NUC.cx + NUC.rx * k * Math.cos(a), NUC.cy + NUC.ry * k * Math.sin(a)];
  };
  /* The ER wraps the nucleus's right flank, from just over the top round to
     the lower right. A plant cell has less room, so it wraps less far. */
  const erFrom = plant ? -40 : -70;
  const erTo = plant ? 52 : 56;
  /* Ribosomes docked on the rough ER: the outer sheet's own surface. */
  const docked = [0, 1, 2, 3, 4, 5].map((i) =>
    pt(...polar(NUC.cx, NUC.cy, plant ? 102 : 112, erFrom + 8 + (i * (erTo - erFrom - 16)) / 5)),
  );
  const free: Pt[] = plant
    ? [[150, 240], [212, 322], [332, 374], [470, 142], [536, 206]]
    : [[150, 160], [186, 118], [142, 240], [176, 304], [220, 348], [284, 368], [356, 376], [538, 256], [524, 188]];

  const parts: Part[] = [
    {
      id: "membrane",
      label: "Cell membrane",
      note: "A phospholipid bilayer that decides what enters and leaves the cell.",
      accent: CYAN,
      /* the membrane keeps its own outline in both variants, so the pointer
         stays on the real edge rather than the shifted organelle grid */
      anchor: [548, 158],
      flag: [556, 96],
      shape: (
        <>
          <path d={MEMBRANE} fill="none" stroke={CYAN} strokeOpacity={0.6} strokeWidth={2.4} />
          <path d={MEMBRANE} fill="none" strokeWidth={8} strokeDasharray="2 11" style={{ stroke: ink(0.14) }} />
        </>
      ),
    },
    {
      id: "nucleus",
      label: "Nucleus",
      note: "Stores the DNA and runs transcription. The nucleolus inside builds ribosomes.",
      accent: VIOLET,
      anchor: pt(NUC.cx, NUC.cy - NUC.ry),
      flag: pt(146, 74),
      shape: (
        <g transform={organelle}>
          <ellipse cx={NUC.cx} cy={NUC.cy} rx={NUC.rx} ry={NUC.ry} fill={VIOLET} fillOpacity={0.09} stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2.2} />
          {/* the inner membrane: a nucleus is a double envelope, not a circle */}
          <ellipse cx={NUC.cx} cy={NUC.cy} rx={NUC.rx - 7} ry={NUC.ry - 7} fill="none" stroke={VIOLET} strokeOpacity={0.3} strokeWidth={1.2} />
          {/* nuclear pores, straddling the envelope */}
          {[-64, -28, 6, 40, 78, 118, 158, 202].map((deg) => {
            const a = envelope(deg, 0.88);
            const b = envelope(deg, 1.05);
            return (
              <line
                key={deg}
                x1={a[0].toFixed(1)}
                y1={a[1].toFixed(1)}
                x2={b[0].toFixed(1)}
                y2={b[1].toFixed(1)}
                stroke={VIOLET}
                strokeOpacity={0.34}
                strokeWidth={2.6}
              />
            );
          })}
          {/* the nucleolus, with chromatin threads round it */}
          <circle cx={NUC.cx - 14} cy={NUC.cy - 6} r={19} fill={ink(0.1)} stroke={VIOLET} strokeOpacity={0.72} strokeWidth={1.5} />
          <circle cx={NUC.cx - 19} cy={NUC.cy - 11} r={4.6} style={{ fill: ink(0.14) }} />
          <path
            d="M 206 162 C 222 150 238 164 232 182 C 228 194 240 202 256 198"
            fill="none"
            stroke={VIOLET}
            strokeOpacity={0.26}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
          <path d="M 268 148 C 286 152 292 170 280 182" fill="none" stroke={VIOLET} strokeOpacity={0.22} strokeWidth={1.3} strokeLinecap="round" />
        </g>
      ),
    },
    {
      id: "mitochondria",
      label: "Mitochondria",
      note: "Cristae-folded membranes where respiration turns glucose into ATP.",
      accent: AMBER,
      anchor: pt(380, 140),
      flag: pt(552, 152),
      shape: (
        <g transform={organelle}>
          {mitochondrion(436, 126, -12, "a")}
          {/* the vacuole takes the second bean's patch in a plant cell */}
          {!plant && mitochondrion(443, 300, 16, "b")}
        </g>
      ),
    },
    {
      id: "er",
      label: "Endoplasmic reticulum",
      note: "Folded membranes beside the nucleus that build and ship proteins and lipids.",
      accent: MINT,
      anchor: pt(...polar(NUC.cx, NUC.cy, 120, erTo - 4)),
      flag: pt(486, 372),
      shape: (
        <g transform={organelle}>
          {/* two sheets of one lumen, doubling back round the nucleus */}
          <path d={spiral(NUC.cx, NUC.cy, 74, 106, erFrom, erTo)} fill="none" stroke={MINT} strokeOpacity={0.62} strokeWidth={2.4} strokeLinecap="round" />
          <path d={spiral(NUC.cx, NUC.cy, 88, 120, erFrom - 6, erTo - 4)} fill="none" stroke={MINT} strokeOpacity={0.5} strokeWidth={2.2} strokeLinecap="round" />
          {/* three bridges join the sheets: one network, not two floating arcs */}
          {[erFrom + 22, erFrom + 70, erTo - 20].map((deg) => {
            const outer = polar(NUC.cx, NUC.cy, 74 + (32 * (deg - erFrom)) / (erTo - erFrom), deg);
            const inner = polar(NUC.cx, NUC.cy, 88 + (32 * (deg - erFrom + 6)) / (erTo - erFrom + 2), deg);
            return (
              <line
                key={deg}
                x1={outer[0].toFixed(1)}
                y1={outer[1].toFixed(1)}
                x2={inner[0].toFixed(1)}
                y2={inner[1].toFixed(1)}
                stroke={MINT}
                strokeOpacity={0.4}
                strokeWidth={1.4}
              />
            );
          })}
        </g>
      ),
    },
    {
      id: "golgi",
      label: "Golgi apparatus",
      note: "Stacked cisternae that modify, sort and package proteins for export.",
      accent: ROSE,
      anchor: pt(GOLGI.cx - 46, GOLGI.cy - 28),
      flag: pt(150, 386),
      shape: (
        <g transform={organelle}>
          {/* six cisternae: flattened curved sacs, narrowing to the trans face */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M ${GOLGI.cx - 46 + i * 4} ${GOLGI.cy - 28 + i * 10} C ${GOLGI.cx - 14} ${GOLGI.cy - 42 + i * 10}, ${GOLGI.cx + 14} ${GOLGI.cy - 42 + i * 10}, ${GOLGI.cx + 46 - i * 4} ${GOLGI.cy - 28 + i * 10}`}
              fill="none"
              stroke={ROSE}
              strokeOpacity={0.62 - i * 0.045}
              strokeWidth={2.6 - i * 0.14}
              strokeLinecap="round"
            />
          ))}
          {/* vesicles budding off the trans face */}
          {[[-34, 34], [-14, 40], [10, 40]].map(([dx, dy]) => (
            <circle key={`${dx}-${dy}`} cx={GOLGI.cx + dx} cy={GOLGI.cy + dy} r={4} fill="none" stroke={ROSE} strokeOpacity={0.45} strokeWidth={1.4} />
          ))}
        </g>
      ),
    },
    {
      id: "ribosomes",
      label: "Ribosomes",
      note: "The protein factories — free in the cytosol or docked on the rough ER.",
      accent: ink(0.75),
      anchor: docked[0],
      flag: pt(430, 86),
      shape: (
        <>
          {/* scattered in the cytosol, plus a row docked on the rough ER */}
          {[...docked, ...free].map(([x, y], i) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={3.1} style={{ fill: ink(0.5) }} />
              <circle cx={x + 5.4} cy={y + 3.8} r={2.1} style={{ fill: ink(0.32) }} />
              {i % 3 === 0 && <circle cx={x - 4.4} cy={y + 4.6} r={1.7} style={{ fill: ink(0.28) }} />}
            </g>
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
        accent: LILAC,
        anchor: [84, 30],
        flag: [124, 396],
        shape: (
          <>
            <path d={WALL_OUTER} fill="none" stroke={LILAC} strokeOpacity={0.55} strokeWidth={2.6} />
            <path d={WALL_INNER} fill="none" stroke={LILAC} strokeOpacity={0.3} strokeWidth={1.2} />
            {/* lamellae: the cellulose sheets packed between the two lines */}
            {LAMELLAE.map(([x1, y1, x2, y2]) => (
              <line
                key={`${x1}-${y1}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={LILAC}
                strokeOpacity={0.32}
                strokeWidth={1.4}
              />
            ))}
          </>
        ),
      },
      {
        id: "chloroplast",
        label: "Chloroplast",
        note: "Thylakoid stacks that capture light and fix carbon into sugar.",
        accent: MINT,
        anchor: [268, 310],
        flag: [498, 386],
        shape: (
          <>
            {chloroplast(272, 328, 10, "a")}
            {/* the second one pressed against the wall, long axis vertical */}
            {chloroplast(534, 216, -78, "b")}
          </>
        ),
      },
      {
        id: "vacuole",
        label: "Central vacuole",
        note: "A water store that keeps the cell turgid — the biggest plant-cell organelle.",
        accent: CYAN,
        anchor: [502, 256],
        flag: [556, 344],
        shape: (
          <>
            <path d={VACUOLE} fill={CYAN} fillOpacity={0.06} stroke={CYAN} strokeOpacity={0.5} strokeWidth={2} />
            {/* the tonoplast, plus one sap line across the middle */}
            <path d={TONOPLAST} fill="none" stroke={CYAN} strokeOpacity={0.22} strokeWidth={1.1} />
            <path d="M 352 244 C 400 230 442 240 478 264" fill="none" stroke={CYAN} strokeOpacity={0.2} strokeWidth={1.2} />
          </>
        ),
      },
    );
  }
  return parts;
}

/** The cell's own background: the membrane's tint, the cytosol wash and the
    granular texture under it. Not selectable, so it never competes with a
    structure, and clipped to the membrane so the grain never spills out. */
function cellBase(plant: boolean) {
  const clip = plant ? "lab-plant-cytosol" : "lab-cell-cytosol";
  return (
    <g>
      <clipPath id={clip}>
        <path d={MEMBRANE} />
      </clipPath>
      <path d={MEMBRANE} fill={CYAN} fillOpacity={0.05} />
      <g clipPath={`url(#${clip})`}>
        {scatter(170, 5, 330, 216, 214, 156).map((dot, i) => (
          <circle key={i} cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r={dot.r.toFixed(2)} style={{ fill: ink(i % 3 === 0 ? 0.13 : 0.07) }} />
        ))}
        {/* two faint washes, so the cytosol has depth and not only noise */}
        <path d="M 130 224 C 200 184 300 254 380 204 C 450 162 500 214 566 182" fill="none" strokeWidth={28} style={{ stroke: ink(0.022) }} />
        <path d="M 150 304 C 240 272 330 334 430 296 C 480 276 520 304 560 284" fill="none" strokeWidth={32} style={{ stroke: ink(0.022) }} />
      </g>
    </g>
  );
}

/* The heart, posterior view (Gray's plate 491): wider across the top than it
   is tall, tapering to the apex at the lower left. Every chamber is a region
   inside that outline, not a box drawn beside it. */
const HEART_OUTLINE = smooth([
  [204, 118], [250, 56], [330, 74], [430, 58], [498, 120], [512, 208],
  [478, 282], [408, 338], [318, 364], [252, 388], [204, 342], [176, 268], [180, 192],
]);
const CHAMBER: Record<string, Pt[]> = {
  la: [[206, 118], [250, 56], [322, 80], [344, 140], [346, 172], [262, 180], [200, 184], [190, 150]],
  ra: [[352, 84], [430, 58], [498, 120], [510, 160], [500, 168], [430, 172], [362, 170], [352, 120]],
  lv: [[196, 190], [178, 268], [206, 342], [252, 386], [316, 358], [344, 298], [350, 226], [340, 178], [262, 182], [202, 184]],
  rv: [[500, 166], [514, 206], [482, 278], [414, 332], [336, 362], [326, 332], [348, 262], [360, 180], [430, 172]],
};
/* The myocardium is a second line inside each ventricle's outline: ten units
   in on the left, four on the right. That gap is the wall thickness. */
const LV_WALL: Pt[] = [[212, 198], [198, 266], [222, 330], [254, 374], [306, 348], [330, 292], [334, 228], [326, 184], [266, 188], [214, 190]];
const RV_WALL: Pt[] = [[494, 174], [504, 208], [476, 270], [412, 324], [340, 352], [334, 330], [350, 264], [362, 190], [428, 180]];
/* The aortic arch leaves the left ventricle and crosses over the top. */
const AORTA = "M 326 176 C 318 126 320 88 350 68 C 378 50 424 46 456 62 C 482 75 494 100 496 126";

function heartParts(): Part[] {
  return [
    {
      id: "ra",
      label: "Right atrium",
      note: "Receives deoxygenated blood from the body through the vena cava.",
      accent: CYAN,
      anchor: [430, 58],
      flag: [516, 62],
      shape: (
        <>
          <path d={smooth(CHAMBER.ra)} fill={CYAN} fillOpacity={0.1} stroke={CYAN} strokeOpacity={0.6} strokeWidth={2} />
          {/* the vena cava opening into the roof of the atrium */}
          <path d="M 492 70 C 506 100 506 128 498 150" fill="none" stroke={CYAN} strokeOpacity={0.4} strokeWidth={7} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "rv",
      label: "Right ventricle",
      note: "Pumps that blood to the lungs through the pulmonary artery.",
      accent: MINT,
      anchor: [514, 206],
      flag: [528, 386],
      shape: (
        <>
          <path d={smooth(CHAMBER.rv)} fill={MINT} fillOpacity={0.09} stroke={MINT} strokeOpacity={0.6} strokeWidth={2} />
          {/* a thin wall: the inner line sits close to the outer one */}
          <path d={smooth(RV_WALL)} fill="none" stroke={MINT} strokeOpacity={0.4} strokeWidth={1.5} />
        </>
      ),
    },
    {
      id: "la",
      label: "Left atrium",
      note: "Takes oxygenated blood back from the lungs through the pulmonary veins.",
      accent: CYAN,
      anchor: [250, 56],
      flag: [146, 66],
      shape: (
        <>
          <path d={smooth(CHAMBER.la)} fill={CYAN} fillOpacity={0.1} stroke={CYAN} strokeOpacity={0.6} strokeWidth={2} />
          {/* pulmonary veins coming back in from the left */}
          <path d="M 192 106 C 178 118 172 134 176 152" fill="none" stroke={CYAN} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
        </>
      ),
    },
    {
      id: "lv",
      label: "Left ventricle",
      note: "The thickest chamber — it drives blood around the whole body from the aorta.",
      accent: ROSE,
      anchor: [178, 268],
      flag: [140, 386],
      shape: (
        <>
          <path d={smooth(CHAMBER.lv)} fill={ROSE} fillOpacity={0.1} stroke={ROSE} strokeOpacity={0.62} strokeWidth={2.2} />
          {/* ten units of myocardium between the outer and inner lines */}
          <path d={smooth(LV_WALL)} fill="none" stroke={ROSE} strokeOpacity={0.48} strokeWidth={1.8} />
        </>
      ),
    },
    {
      id: "tricuspid",
      label: "Tricuspid valve",
      note: "Three leaflets between the right atrium and right ventricle.",
      accent: AMBER,
      anchor: [410, 176],
      flag: [548, 190],
      shape: (
        <>
          {/* the annulus, then three leaflets hanging into the ventricle */}
          <path d="M 372 172 C 408 168 442 168 476 172" fill="none" stroke={AMBER} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
          {[384, 418, 452].map((x) => (
            <path
              key={x}
              d={`M ${x} 170 C ${x + 3} 194, ${x + 16} 198, ${x + 20} 170`}
              fill="none"
              stroke={AMBER}
              strokeOpacity={0.72}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          ))}
        </>
      ),
    },
    {
      id: "mitral",
      label: "Mitral valve",
      note: "Two leaflets on the left side — the valve that can narrow or leak.",
      accent: AMBER,
      anchor: [296, 194],
      flag: [176, 232],
      shape: (
        <>
          {/* two leaflets, as the note says */}
          <path d="M 244 182 C 274 177 306 176 336 180" fill="none" stroke={AMBER} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
          {[256, 296].map((x) => (
            <path
              key={x}
              d={`M ${x} 180 C ${x + 4} 206, ${x + 20} 210, ${x + 26} 180`}
              fill="none"
              stroke={AMBER}
              strokeOpacity={0.72}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          ))}
        </>
      ),
    },
    {
      id: "aorta",
      label: "Aorta",
      note: "The body's largest artery, leaving the left ventricle in an arch.",
      accent: VIOLET,
      anchor: [402, 52],
      flag: [508, 30],
      shape: (
        <>
          {/* a wide lumen with one crisp line down the middle of it */}
          <path d={AORTA} fill="none" stroke={VIOLET} strokeOpacity={0.16} strokeWidth={22} strokeLinecap="round" />
          <path d={AORTA} fill="none" stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ),
    },
  ];
}

/* The lungs, from Gray's plate 962: three lobes on the right divided by the
   horizontal and oblique fissures, two on the left with the cardiac notch cut
   into the medial border opposite the heart. */
const RIGHT_LUNG = smooth([
  [246, 122], [206, 150], [178, 202], [170, 268], [186, 336], [224, 366],
  [278, 380], [300, 350], [306, 292], [296, 190], [278, 128],
]);
const LEFT_LUNG = smooth([
  [394, 122], [436, 150], [462, 202], [468, 268], [452, 336], [414, 366],
  [366, 378], [406, 350], [414, 300], [386, 248], [378, 190], [382, 132],
]);

function respiratoryParts(): Part[] {
  /* The bronchial tree: each lobe gets a branch off its main bronchus, and the
     twigs end on the alveolar clusters the alveoli part draws. */
  const TREE = [
    "M 314 150 C 296 172 272 184 250 190",
    "M 326 150 C 344 172 368 184 390 190",
    "M 250 190 C 244 172 238 160 232 152",
    "M 250 192 C 238 210 226 226 216 238",
    "M 250 194 C 246 226 244 258 248 290",
    "M 390 190 C 398 172 406 158 412 148",
    "M 390 192 C 398 226 408 248 418 264",
    "M 232 152 C 224 148 218 150 214 154",
    "M 232 154 C 240 148 248 144 254 144",
    "M 216 238 C 206 242 198 246 192 250",
    "M 216 240 C 224 244 230 246 236 246",
    "M 248 292 C 240 300 232 306 226 310",
    "M 248 294 C 256 300 264 304 270 306",
    "M 412 148 C 408 144 404 142 400 142",
    "M 412 150 C 420 150 424 152 428 156",
    "M 418 264 C 412 268 408 270 404 272",
    "M 418 266 C 426 266 430 268 434 270",
  ];
  return [
    {
      id: "trachea",
      label: "Trachea",
      note: "Cartilage rings keep the windpipe open on the way to the bronchi.",
      accent: CYAN,
      anchor: [320, 44],
      flag: [320, 26],
      shape: (
        <>
          <rect x={302} y={44} width={36} height={108} rx={18} fill={CYAN} fillOpacity={0.08} stroke={CYAN} strokeOpacity={0.55} strokeWidth={2} />
          {/* stacked cartilage rings, the plate's own C-shaped pattern */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={i}
              x1={306}
              y1={62 + i * 14}
              x2={334}
              y2={62 + i * 14}
              stroke={CYAN}
              strokeOpacity={0.42}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </>
      ),
    },
    {
      id: "bronchi",
      label: "Bronchi",
      note: "Two branches that carry air into each lung, then split into bronchioles.",
      accent: MINT,
      anchor: [293, 170],
      flag: [470, 144],
      shape: (
        <>
          {TREE.slice(0, 2).map((d) => (
            <path key={d} d={d} fill="none" stroke={MINT} strokeOpacity={0.6} strokeWidth={9} strokeLinecap="round" />
          ))}
          {TREE.slice(2).map((d) => (
            <path key={d} d={d} fill="none" stroke={MINT} strokeOpacity={0.45} strokeWidth={4.2} strokeLinecap="round" />
          ))}
        </>
      ),
    },
    {
      id: "right-lung",
      label: "Right lung",
      note: "Three lobes, sitting slightly larger than the left to clear the heart.",
      accent: VIOLET,
      anchor: [170, 268],
      flag: [140, 188],
      shape: (
        <>
          <path d={RIGHT_LUNG} fill={VIOLET} fillOpacity={0.09} stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2} />
          {/* the horizontal fissure: superior lobe above, middle lobe below */}
          <path d="M 302 232 C 262 240 222 246 196 250" fill="none" stroke={VIOLET} strokeOpacity={0.4} strokeWidth={1.6} />
          {/* the oblique fissure: middle lobe above, inferior lobe below */}
          <path d="M 300 200 C 268 250 220 300 186 342" fill="none" stroke={VIOLET} strokeOpacity={0.4} strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "left-lung",
      label: "Left lung",
      note: "Two lobes with a cardiac notch cut into the inner edge.",
      accent: VIOLET,
      anchor: [468, 268],
      flag: [520, 188],
      shape: (
        <>
          {/* the notch is cut into the outline itself, not drawn over it */}
          <path d={LEFT_LUNG} fill={VIOLET} fillOpacity={0.09} stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2} />
          {/* one oblique fissure: superior lobe above, inferior lobe below */}
          <path d="M 402 198 C 392 246 386 300 382 342" fill="none" stroke={VIOLET} strokeOpacity={0.4} strokeWidth={1.6} />
        </>
      ),
    },
    {
      id: "alveoli",
      label: "Alveoli",
      note: "Air sacs one cell thick where oxygen crosses into the blood.",
      accent: AMBER,
      anchor: [250, 300],
      flag: [150, 392],
      shape: (
        <>
          {/* a cluster on the end of each inferior bronchiole, not one loose blob */}
          {alveoli(250, 320, 0.9, "right")}
          {alveoli(430, 260, 0.66, "left")}
        </>
      ),
    },
    {
      id: "diaphragm",
      label: "Diaphragm",
      note: "Contracts and flattens to pull air in — the muscle that does the breathing.",
      accent: ROSE,
      anchor: [316, 398],
      flag: [162, 402],
      shape: (
        /* two domes, not one arc: the diaphragm is a pair of hemidiaphragms */
        <path
          d="M 128 384 C 186 356 258 362 316 398 C 374 362 446 356 506 384"
          fill="none"
          stroke={ROSE}
          strokeOpacity={0.65}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ),
    },
  ];
}

/* The kidneys, from Gray's plate 1127: a bean with the lateral border bulging
   and the medial border bitten in by the hilum, where the artery, the vein and
   the ureter all arrive. The left one sits a little lower than the right. */
const KIDNEY: Pt[] = [
  [206, 86], [156, 110], [138, 164], [154, 216], [196, 248], [240, 240],
  [262, 206], [238, 176], [256, 140], [244, 104],
];
const KIDNEY_MIRROR: Pt[] = KIDNEY.map(([x, y]): Pt => [640 - x, y + 8]);

function excretoryParts(): Part[] {
  const beanRight = smooth(KIDNEY);
  const beanLeft = smooth(KIDNEY_MIRROR);
  return [
    {
      id: "right-kidney",
      label: "Right kidney",
      note: "Filters blood into urine; sits slightly lower under the liver.",
      accent: VIOLET,
      anchor: [138, 164],
      flag: [112, 128],
      shape: (
        <>
          <path d={beanRight} fill={VIOLET} fillOpacity={0.09} stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2} />
          {/* the hilum's inner line, and one cortex line inside the border */}
          <path d="M 262 206 C 240 200 232 186 238 176 C 232 166 238 150 256 140" fill="none" stroke={VIOLET} strokeOpacity={0.42} strokeWidth={1.5} />
          <path d="M 196 116 C 176 140 174 196 194 224" fill="none" stroke={VIOLET} strokeOpacity={0.3} strokeWidth={1.5} />
        </>
      ),
    },
    {
      id: "left-kidney",
      label: "Left kidney",
      note: "Mirror twin of the right; together they clear the whole blood volume daily.",
      accent: VIOLET,
      anchor: [502, 172],
      flag: [536, 136],
      shape: (
        <>
          {/* the bean mirrors about the midline, hilum facing left */}
          <path d={beanLeft} fill={VIOLET} fillOpacity={0.09} stroke={VIOLET} strokeOpacity={0.6} strokeWidth={2} />
          <path d="M 378 214 C 400 208 408 194 402 184 C 408 174 402 158 384 148" fill="none" stroke={VIOLET} strokeOpacity={0.42} strokeWidth={1.5} />
          <path d="M 444 124 C 464 148 466 204 446 232" fill="none" stroke={VIOLET} strokeOpacity={0.3} strokeWidth={1.5} />
        </>
      ),
    },
    {
      id: "renal",
      label: "Renal artery and vein",
      note: "The artery brings unfiltered blood in; the vein carries clean blood out.",
      accent: ROSE,
      anchor: [280, 151],
      flag: [320, 82],
      shape: (
        <>
          {/* the artery: a solid tube into the upper lip of each hilum */}
          {["M 314 136 C 292 146 268 156 244 166", "M 326 136 C 348 146 372 156 396 166"].map((d) => (
            <path key={d} d={d} fill="none" stroke={ROSE} strokeOpacity={0.58} strokeWidth={6} strokeLinecap="round" />
          ))}
          {/* the vein: a pale tube with a dotted core, so it never reads as a
              second artery at a glance */}
          {["M 314 194 C 292 198 266 192 242 182", "M 326 194 C 348 198 374 192 398 182"].map((d) => (
            <g key={d}>
              <path d={d} fill="none" stroke={ROSE} strokeOpacity={0.24} strokeWidth={6} strokeLinecap="round" />
              <path d={d} fill="none" stroke={ROSE} strokeOpacity={0.36} strokeWidth={1.3} strokeDasharray="3 4" strokeLinecap="round" />
            </g>
          ))}
        </>
      ),
    },
    {
      id: "ureters",
      label: "Ureters",
      note: "Muscular tubes that push urine from each kidney down to the bladder.",
      accent: CYAN,
      anchor: [236, 295],
      flag: [162, 300],
      shape: (
        <>
          {["M 210 242 C 216 282 248 312 284 330", "M 434 250 C 428 290 396 316 360 332"].map((d) => (
            <path key={d} d={d} fill="none" stroke={CYAN} strokeOpacity={0.55} strokeWidth={6} strokeLinecap="round" />
          ))}
        </>
      ),
    },
    {
      id: "bladder",
      label: "Urinary bladder",
      note: "A stretchy muscular sac that stores urine until it is passed.",
      accent: MINT,
      anchor: [376, 352],
      flag: [452, 380],
      shape: (
        <>
          {/* a sac, not an oval: fuller on the left and leaning right */}
          <path
            d={smooth([[288, 320], [326, 308], [358, 322], [376, 352], [348, 388], [312, 394], [282, 382], [266, 350]])}
            fill={MINT}
            fillOpacity={0.09}
            stroke={MINT}
            strokeOpacity={0.6}
            strokeWidth={2}
          />
          <path d="M 320 316 C 342 326 354 344 352 362" fill="none" stroke={MINT} strokeOpacity={0.38} strokeWidth={1.4} />
          <path d="M 282 344 C 306 336 338 336 362 348" fill="none" stroke={MINT} strokeOpacity={0.3} strokeWidth={1.3} />
        </>
      ),
    },
    {
      id: "urethra",
      label: "Urethra",
      note: "The final tube out of the body, with a sphincter that keeps it closed.",
      accent: AMBER,
      anchor: [320, 406],
      flag: [474, 404],
      shape: (
        <>
          <rect x={307} y={390} width={26} height={26} rx={12} fill={AMBER} fillOpacity={0.08} stroke={AMBER} strokeOpacity={0.6} strokeWidth={2} />
          <path d="M 320 392 L 320 414" fill="none" stroke={AMBER} strokeOpacity={0.32} strokeWidth={1.2} />
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
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export function BiologyVectorLab() {
  const transition = useSpringTransition();
  const theme = useLabTheme();
  const [plate, setPlate] = useState<Plate>("cell");
  const [plant, setPlant] = useState(false);

  const diagrams: Diagram[] = [
    {
      id: "cell",
      label: plant ? "Plant cell" : "Animal cell",
      blurb: plant
        ? "Rigid wall, chloroplasts and one huge vacuole"
        : "Membrane, nucleus, mitochondria and the protein line",
      viewBox: `0 0 ${PLATE_W} ${PLATE_H}`,
      base: cellBase(plant),
      parts: cellParts(plant),
    },
    {
      id: "heart",
      label: "Heart System",
      blurb: "A scanned heart you can turn, label and read",
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
      label: "Respiratory System",
      blurb: "Lungs you can inflate with a deep-breathing slider",
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
      label: "Excretory System",
      blurb: "A kidney you can filter down to the nephrons",
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
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {plate !== "cell" ? (
          /* The three organ systems share one engine and one dark-stage
             presentation. Keying by plate resets the per-organ tools
             (view, cut, labels, isolation) and lets the outgoing organ
             dispose its geometries before the next one is built. */
          <motion.div
            key={`organ-stage-${plate}`}
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transition}
          >
            {plate === "heart" ? (
              <HeartModelViewer label={active.label} blurb={active.blurb} theme={theme} />
            ) : plate === "respiratory" ? (
              <RespiratoryModelViewer label={active.label} blurb={active.blurb} theme={theme} />
            ) : plate === "excretory" ? (
              <ExcretoryModelViewer label={active.label} blurb={active.blurb} theme={theme} />
            ) : (
              <OrganStage
                system={plate}
                label={active.label}
                blurb={active.blurb}
                theme={theme}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`cell-${plant}`}
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transition}
          >
            <VectorDiagram diagram={active} />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default BiologyVectorLab;
