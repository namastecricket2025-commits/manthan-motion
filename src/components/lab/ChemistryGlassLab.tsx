import {
  configFor,
  ELEMENTS,
  gridPos,
  GROUP_NAMES,
  periodGroupOf,
  physFor,
  shellsFor,
  USES,
  type Category,
  type ElementData,
} from "@/components/lab/periodic-data";
import Atom3D from "@/components/lab/Atom3D";
import MoleBench from "@/components/lab/MoleBench";
import { Questions, type BenchQuestion } from "@/components/lab/bench-atoms";
import { LabPicker, type LabPickerOption } from "@/components/lab/lab-picker";
import { useLabTheme } from "@/components/lab/lab-theme";
import { REACTIONS, SUBSTANCES, type Reaction, type Substance } from "@/components/lab/reactions";
import { useSpringTransition, useStillMotion, useStagger, viewVariants } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";

/**
 * Chemistry — a frosted periodic table, a live Bohr model, a titration bench,
 * a reaction stage and a balancing bench, in five sub-tabs.
 *
 * The periodic table is a glass grid: each tile carries a 1px border tinted by
 * its category, all 18 groups share the panel's width, and selecting an element
 * grows a profile column in from the right that pushes the table across. The
 * Bohr model draws the ground-state electron grouping (exceptions included)
 * with each shell orbiting on its own CSS timeline.
 *
 * The bench carries its own light/dark toggle (`data-lab-theme` on this root,
 * the same switch Physics and Biology use) so the four tabs can be read in
 * daylight without touching the site theme or the other two rooms.
 */

/* ---- Sub-tab model -------------------------------------------------- */

type SubTab = "table" | "bohr" | "titration" | "reactions" | "balance";

const SUBTABS: Array<{ id: SubTab; label: string }> = [
  { id: "table", label: "Periodic Table" },
  { id: "bohr", label: "Atomic Models" },
  { id: "titration", label: "Titration" },
  { id: "reactions", label: "Reactions" },
  { id: "balance", label: "Balancing" },
];

/* ---- Category colours ------------------------------------------------
   Distinct, deuteranopia-safe hues spaced around the wheel, each checked
   against both canvases: "on" (toward white) for dark mode, "onLight" for
   the daylight bench. Legend dots, tile borders and diagrams all read from
   this one map, so they can never disagree. */

interface CatColor {
  on: string;
  onLight: string;
}

const CAT_COLORS: Record<Category, CatColor> = {
  alkali: { on: "#e05b45", onLight: "#c03e2a" }, // red-orange
  alkaline: { on: "#e08a2e", onLight: "#b06a14" }, // amber
  transition: { on: "#d9b13b", onLight: "#9a7c10" }, // yellow
  "post-transition": { on: "#8fc24a", onLight: "#5c8f1c" }, // lime green
  metalloid: { on: "#2fb380", onLight: "#0f8a5e" }, // emerald
  nonmetal: { on: "#2aa8c4", onLight: "#0a7f9b" }, // cyan
  halogen: { on: "#3e8ce0", onLight: "#1f66b8" }, // blue
  "noble gas": { on: "#8a6df0", onLight: "#6847d6" }, // violet
  lanthanide: { on: "#d95fb0", onLight: "#b03a8a" }, // magenta
  actinide: { on: "#e06278", onLight: "#ba3d55" }, // rose
  synthetic: { on: "#9aa3b2", onLight: "#687182" }, // slate grey
};

const tint = (hex: string, alpha: string) => `${hex}${alpha}`;

const CATEGORIES = Object.keys(CAT_COLORS) as Category[];

const PHASE_LABEL: Record<string, string> = {
  solid: "Solid at STP",
  liquid: "Liquid at STP",
  gas: "Gas at STP",
  synthetic: "Synthetic",
};

const SHELL_LETTERS = ["K", "L", "M", "N", "O", "P", "Q"];

/* ---- Shared primitives ------------------------------------------------ */

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-lab-card flex min-w-0 flex-col justify-between gap-1 px-3 py-2.5">
      <p className="apple-lab-micro truncate" title={label}>
        {label}
      </p>
      <p className="apple-lab-value truncate text-[13px] font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   Bohr model — nucleus + real Aufbau shells, each ring rotating
   on its own CSS timeline (outer rings slower). Used both as the
   mini inline diagram in the detail panel and, scaled up with
   labels and a per-shell readout, as the "Atomic Models" tab.
   ============================================================ */

function BohrDiagram({
  element,
  size,
  theme,
  labeled = false,
}: {
  element: ElementData;
  size: number;
  theme: "light" | "dark";
  labeled?: boolean;
}) {
  const transition = useSpringTransition();
  const stagger = useStagger(0.09);
  const shells = useMemo(() => shellsFor(element.n), [element.n]);
  const [focused, setFocused] = useState<number | null>(null);
  const color = theme === "light" ? CAT_COLORS[element.cat].onLight : CAT_COLORS[element.cat].on;

  const center = size / 2;
  const nucleus = size * 0.082;
  const shellRadius = (index: number) =>
    nucleus + (center - nucleus - 4) * ((index + 1) / shells.length);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Bohr model of ${element.name} with ${shells.length} electron shells`}
    >
      <circle
        cx={center}
        cy={center}
        r={center - 2}
        fill="none"
        stroke="rgba(128,128,128,0.14)"
      />
      <motion.circle
        cx={center}
        cy={center}
        r={nucleus}
        fill={tint(color, "33")}
        stroke={tint(color, "99")}
        strokeWidth={1}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition}
        style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
      />
      <text
        x={center}
        y={center - 1}
        fontSize={nucleus * 0.62}
        fontWeight={700}
        fill="var(--lab-ink)"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {element.sym}
      </text>
      {labeled && (
        <text
          x={center}
          y={center + nucleus * 0.68}
          fontSize={nucleus * 0.3}
          fill="var(--lab-ink-dim)"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {element.n} p⁺ · {element.n} e⁻
        </text>
      )}

      {shells.map((count, index) => {
        const radius = shellRadius(index);
        const duration = 14 + index * 8;
        return (
          <motion.g
            key={`shell-${index}`}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...transition, delay: stagger(index) }}
            style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
            onMouseEnter={() => setFocused(index)}
            onMouseLeave={() => setFocused(null)}
          >              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={
                  focused === index
                    ? tint(color, "cc")
                    : theme === "light"
                      ? "rgba(26,25,36,0.26)"
                      : "rgba(255,255,255,0.16)"
                }
                strokeWidth={focused === index ? 1.4 : 1}
                strokeDasharray="3 7"
              />
            {labeled && (
              <text
                x={center}
                y={center - radius - 4}
                fontSize={10}
                fontWeight={600}
                fill="var(--lab-ink-micro)"
                textAnchor="middle"
              >
                {SHELL_LETTERS[index] ?? index + 1}
              </text>
            )}
            {/* The shell orbits continuously; the stagger above is only its
                entrance, so nothing here re-mounts while it turns. */}
            <g
              className="apple-lab-orbit"
              style={{
                ["--orbit-duration" as string]: `${duration}s`,
                ["--orbit-delay" as string]: `${index * 0.4}s`,
              }}
            >
              {Array.from({ length: count }, (_, electron) => {
                const angle = (electron / count) * Math.PI * 2;
                return (
                  <circle
                    key={electron}
                    cx={center + Math.cos(angle) * radius}
                    cy={center + Math.sin(angle) * radius}
                    r={Math.max(2.1, size * 0.011)}
                    fill={focused === index ? (theme === "light" ? "#241f36" : "#ffffff") : tint(color, "ee")}
                  />
                );
              })}
            </g>
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------
   The other three atomic models.

   A tab called "Atomic Models" that shows one model is a picture, not a
   lesson: the structure on screen has to change when the model does, or the
   switcher is decoration. Each drawing is the same element seen through a
   different experiment —

     Bohr        quantised shells, electrons orbiting on fixed rings
     Rutherford  the scattering result: most alpha particles pass straight
                 through, a few bend hard, one comes back
     Quantum     no path at all: probability density around the nucleus
     Lewis       only the valence electrons, as dots on four sides
   ------------------------------------------------------------ */

type AtomModel = "bohr" | "rutherford" | "quantum" | "lewis";

const ATOM_MODELS: Array<{
  id: AtomModel;
  label: string;
  /** Year the model was put forward — the part of the theory exams ask for by name. */
  year: string;
  who: string;
  note: string;
  /** What the diagram beside this definition is actually showing, in words. */
  shows: string;
}> = [
  {
    id: "bohr",
    label: "Bohr",
    year: "1913",
    who: "Niels Bohr",
    note: "Electrons travel in fixed shells. Each ring is one principal quantum number n, and the count per shell is the ground-state configuration.",
    shows: "the nucleus with the electrons sitting on their shells K, L, M …, counted from the ground-state configuration.",
  },
  {
    id: "rutherford",
    label: "Rutherford",
    year: "1911",
    who: "Ernest Rutherford",
    note: "The gold-foil result: most alpha particles pass straight through empty space, a few are deflected, and a rare one bounces back off the dense nucleus.",
    shows: "alpha particles meeting a tiny, dense nucleus — most pass straight through, a few bend, one comes back.",
  },
  {
    id: "quantum",
    label: "Quantum",
    year: "1926",
    who: "Erwin Schrödinger",
    note: "An electron has no path here — the dots are probability density. Denser regions are where the electron is more likely to be found.",
    shows: "a probability cloud around the nucleus: no orbit, only the places the electron is likely to be.",
  },
  {
    id: "lewis",
    label: "Lewis",
    year: "1916",
    who: "Gilbert N. Lewis",
    note: "Only the valence shell is drawn. The dots are the electrons available for bonding, arranged in pairs on four sides of the symbol.",
    shows: "the element symbol ringed by valence electrons drawn in pairs, the way a bond is written down.",
  },
];

/** Deterministic pseudo-random: the cloud must not reshuffle on every render. */
function seeded(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function RutherfordDiagram({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  const c = size / 2;
  const transition = useSpringTransition();
  /* Three families of track: straight through, bent, and the one that comes
     back. The angles are drawn, not simulated — the point is the shape. */
  const tracks = [
    { y: -0.62, bend: 0.02, out: 0.6 },
    { y: -0.34, bend: 0.08, out: 0.42 },
    { y: -0.1, bend: 0.42, out: -0.2 },
    { y: 0.18, bend: -0.5, out: 0.34 },
    { y: 0.46, bend: -0.1, out: 0.52 },
    { y: 0.7, bend: 0.03, out: 0.66 },
  ];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label="Rutherford scattering diagram">
      <circle cx={c} cy={c} r={c - 2} fill="none" stroke="rgba(128,128,128,0.12)" />
      {tracks.map((track, index) => {
        const startY = c + track.y * c * 0.8;
        const endY = c + (track.y + track.out) * c * 0.5;
        const controlY = c + (track.y - track.bend) * c * 1.5;
        return (
          <motion.path
            key={index}
            d={`M 4 ${startY} Q ${c * 0.55} ${controlY} ${c} ${c} T ${size - 4} ${endY}`}
            fill="none"
            stroke={index === 2 || index === 3 ? color : "rgba(148,163,184,0.55)"}
            strokeWidth={index === 2 || index === 3 ? 1.6 : 1.1}
            strokeDasharray="4 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ ...transition, delay: index * 0.08 }}
          />
        );
      })}
      {/* the nucleus: 1/10000 of the atom, drawn honestly large so it is visible */}
      <circle cx={c} cy={c} r={size * 0.035} fill={tint(color, "66")} stroke={tint(color, "ee")} strokeWidth={1.2} />
      <circle cx={c} cy={c} r={size * 0.012} fill={tint(color, "ff")} />
      <text x={c} y={c + size * 0.14} fontSize={size * 0.032} fill="var(--lab-ink-micro)" textAnchor="middle">
        dense nucleus
      </text>
    </svg>
  );
}

function QuantumDiagram({
  size,
  color,
  z,
}: {
  size: number;
  color: string;
  z: number;
}) {
  const c = size / 2;
  const rand = seeded(z * 97 + 13);
  const inner = Array.from({ length: 90 }, () => {
    const r = Math.pow(rand(), 0.55) * size * 0.16;
    const theta = rand() * Math.PI * 2;
    return { x: c + Math.cos(theta) * r, y: c + Math.sin(theta) * r };
  });
  const lobes = Array.from({ length: 3 }, (_, axis) =>
    Array.from({ length: 54 }, () => {
      const t = rand() * Math.PI * 2;
      const u = (rand() - 0.5) * 2;
      const spread = size * 0.2;
      const major = Math.cos(t) * spread * 1.55 * Math.sign(axis % 2 === 0 ? 1 : -1);
      return {
        x: c + (axis === 0 ? major : axis === 1 ? 0 : Math.sin(t) * spread) + u * size * 0.02,
        y: c + (axis === 1 ? major : axis === 2 ? 0 : Math.sin(t) * spread) + u * size * 0.02,
      };
    }),
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label="Quantum probability cloud">
      <circle cx={c} cy={c} r={c - 2} fill="none" stroke="rgba(128,128,128,0.12)" />
      {/* s-orbital: spherical density */}
      <motion.circle
        cx={c}
        cy={c}
        r={size * 0.17}
        fill={tint(color, "14")}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
      />
      {inner.map((dot, index) => (
        <circle key={`s${index}`} cx={dot.x} cy={dot.y} r={size * 0.0045} fill={tint(color, "aa")} />
      ))}
      {lobes.map((lobe, axis) =>
        lobe.map((dot, index) => (
          <circle
            key={`p${axis}-${index}`}
            cx={dot.x}
            cy={dot.y}
            r={size * 0.004}
            fill={tint(color, "88")}
          />
        )),
      )}
      <circle cx={c} cy={c} r={size * 0.012} fill="var(--lab-ink)" />
      <text x={c} y={size - 10} fontSize={size * 0.03} fill="var(--lab-ink-micro)" textAnchor="middle">
        1s² + 2p⁶ probability density
      </text>
    </svg>
  );
}

function LewisDiagram({
  size,
  color,
  symbol,
  valence,
}: {
  size: number;
  color: string;
  symbol: string;
  valence: number;
}) {
  const c = size / 2;
  const shown = Math.min(8, valence);
  const transition = useSpringTransition();
  /* Dots go on one at a time, sides in the order a Lewis structure is taught: */
  const sides: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 8; i += 1) {
    const side = Math.floor(i / 2);
    const pair = i % 2;
    const offset = size * 0.085;
    const gap = size * 0.032;
    const step = (pair === 0 ? -1 : 1) * gap;
    if (side === 0) sides.push({ x: c + step, y: c - offset });
    else if (side === 1) sides.push({ x: c + offset, y: c + step });
    else if (side === 2) sides.push({ x: c + step, y: c + offset });
    else sides.push({ x: c - offset, y: c + step });
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label={`Lewis dot structure of ${symbol} with ${shown} valence electrons`}>
      <circle cx={c} cy={c} r={c - 2} fill="none" stroke="rgba(128,128,128,0.12)" />
      <text
        x={c}
        y={c}
        fontSize={size * 0.2}
        fontWeight={700}
        fill="var(--lab-ink)"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {symbol}
      </text>
      {sides.slice(0, shown).map((dot, index) => (
        <motion.circle
          key={index}
          cx={dot.x}
          cy={dot.y}
          r={size * 0.016}
          fill={tint(color, "ee")}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...transition, delay: index * 0.05 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
      <text x={c} y={size - 12} fontSize={size * 0.032} fill="var(--lab-ink-micro)" textAnchor="middle">
        {shown} valence electron{shown === 1 ? "" : "s"} · pairs form bonds
      </text>
    </svg>
  );
}

/* ============================================================
   Sub-tab 1 — periodic table + morphing detail panel
   ============================================================ */

function ElementTile({
  element,
  color,
  isSelected,
  faint,
  onSelect,
}: {
  element: ElementData;
  color: string;
  isSelected: boolean;
  faint: boolean;
  onSelect: (n: number) => void;
}) {
  const transition = useSpringTransition();
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(element.n)}
      aria-label={`${element.name}, atomic number ${element.n}`}
      aria-pressed={isSelected}
      whileHover={{ scale: 1.1, zIndex: 5 }}
      transition={transition}
      /* The tile is fluid, not fixed: all 18 columns share the panel's width so
         the whole table is on screen at once, whether the element panel is
         open or not. Height and type shrink only enough to keep the symbol
         legible at the narrowest open-panel width. */
      className="apple-lab-tile h-[40px] w-full min-w-0 !gap-0 !justify-between !items-stretch px-[2px] py-[2px] text-left sm:h-[42px] xl:h-[48px]"
      style={{
        borderColor: isSelected ? "var(--lab-ink)" : tint(color, faint ? "30" : "59"),
        background: isSelected ? "color-mix(in srgb, var(--lab-ink) 14%, transparent)" : undefined,
        opacity: faint ? 0.24 : 1,
      }}
    >
      <span
        className="w-full truncate text-[7.5px] font-medium leading-none"
        style={{ color: "var(--lab-ink-micro)" }}
      >
        {element.n}
      </span>
      <span
        className="flex w-full items-center justify-center truncate text-[11.5px] font-bold leading-none xl:text-[13px]"
        style={{ color: "var(--lab-ink)" }}
      >
        {element.sym}
      </span>
      <span
        className="hidden w-full truncate text-[7.5px] leading-none xl:block"
        style={{ color: "var(--lab-ink-dim)" }}
      >
        {element.name}
      </span>
    </motion.button>
  );
}

function LegendButton({
  category,
  color,
  active,
  dimmed,
  onEnter,
  onLeave,
  onToggle,
}: {
  category: string;
  color: string;
  active: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onToggle}
      aria-pressed={active}
      className="apple-lab-chip !py-1 transition-opacity"
      style={{
        borderColor: active ? tint(color, "aa") : tint(color, "3d"),
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ background: color }}
      />
      <span className="truncate">{category === "post-transition" ? "post-transition metal" : category}</span>
    </button>
  );
}

function PeriodicTableTab({
  selected,
  onSelect,
  theme,
}: {
  selected: number | null;
  onSelect: (n: number | null) => void;
  theme: "light" | "dark";
}) {
  const [hoverCategory, setHoverCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const light = theme === "light";

  const shownCategories = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const element of ELEMENTS) {
      counts.set(element.cat, (counts.get(element.cat) ?? 0) + 1);
    }
    return CATEGORIES.filter((category) => (counts.get(category) ?? 0) > 0);
  }, []);

  const rows = useMemo(() => {
    const grid: (ElementData | null)[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 18 }, () => null),
    );
    for (const element of ELEMENTS) {
      const { row, col } = gridPos(element.n);
      grid[row - 1][col - 1] = element;
    }
    return grid;
  }, []);

  const selectedElement =
    selected === null ? null : ELEMENTS.find((el) => el.n === selected) ?? null;
  const panelTransition = useSpringTransition();

  /* Drag-to-pan: on a phone the 18-column grid is wider than the screen, so the
     table is grabbed and dragged sideways instead of forcing a scrollbar. The
     browser's own touch pan handles fingers; this adds the same gesture to a
     mouse and swallows the click that would otherwise open a tile mid-drag. */
  const panRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, x: 0, left: 0, moved: false });
  const startPan = (event: React.PointerEvent) => {
    const el = panRef.current;
    if (!el || event.pointerType !== "mouse" || el.scrollWidth <= el.clientWidth + 1) return;
    drag.current = { active: true, x: event.clientX, left: el.scrollLeft, moved: false };
  };
  const movePan = (event: React.PointerEvent) => {
    const el = panRef.current;
    if (!el || !drag.current.active) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    el.scrollLeft = drag.current.left - dx;
  };
  const endPan = () => {
    drag.current.active = false;
  };
  const guardClick = (event: React.MouseEvent) => {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  };

  const needle = query.trim().toLowerCase();
  const dimmed = (element: ElementData) => {
    if (needle) {
      return (
        !element.name.toLowerCase().includes(needle) &&
        !element.sym.toLowerCase().includes(needle)
      );
    }
    return hoverCategory !== null && element.cat !== hoverCategory;
  };

  const colorOf = (element: ElementData) =>
    light ? CAT_COLORS[element.cat].onLight : CAT_COLORS[element.cat].on;

  const renderTile = (element: ElementData) => (
    <ElementTile
      key={element.n}
      element={element}
      color={colorOf(element)}
      isSelected={element.n === selected}
      faint={dimmed(element)}
      onSelect={onSelect}
    />
  );

  return (
    <div className="lab-element-split" data-open={selectedElement ? "1" : "0"}>
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Periodic table</p>
            <h3 className="apple-lab-title mt-1 text-lg">118 elements, in their real groups</h3>
          </div>
          <label className="apple-lab-card flex items-center gap-2 px-3 py-2">
            <span className="apple-lab-micro">Find</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="name or symbol"
              aria-label="Search elements by name or symbol"
              className="w-32 bg-transparent text-[12.5px] text-[var(--lab-ink)] outline-none placeholder:text-[var(--lab-ink-micro)]"
            />
          </label>
        </div>

        {/* Category legend doubles as a highlight switch. A category with no
            elements ("synthetic" used to hold the superheavies) is not listed:
            a legend that promises eleven colours and shows ten is noise. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shownCategories.map((category) => (
            <LegendButton
              key={category}
              category={category}
              color={light ? CAT_COLORS[category].onLight : CAT_COLORS[category].on}
              active={hoverCategory === category}
              dimmed={hoverCategory !== null && hoverCategory !== category}
              onEnter={() => setHoverCategory(category)}
              onLeave={() => setHoverCategory(null)}
              onToggle={() =>
                setHoverCategory((current) => (current === category ? null : category))
              }
            />
          ))}
        </div>

        {/* The whole table fits the panel: every row is a flex line of 18
            equal tracks, so opening the profile narrows the tiles instead of
            hiding the right-hand groups behind a scrollbar. On a phone the
            grid keeps a readable minimum width and is panned by dragging. */}
        <div
          ref={panRef}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerLeave={endPan}
          onClickCapture={guardClick}
          className="lab-pan mt-4 cursor-grab pb-1 active:cursor-grabbing"
        >
          <div className="min-w-[600px] lg:min-w-0">
            <div className="mb-1 flex gap-[3px]">
              {Array.from({ length: 18 }, (_, index) => (
                <span
                  key={index}
                  title={GROUP_NAMES[index + 1] ?? `Group ${index + 1}`}
                  className="flex-1 text-center text-[7.5px] font-semibold tracking-wide text-[var(--lab-ink-micro)]"
                >
                  {index + 1}
                </span>
              ))}
            </div>
            {rows.slice(0, 7).map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="mb-[3px] flex gap-[3px]">
                {row.map((element, columnIndex) => {
                  if (element) return renderTile(element);
                  /* Group 3 holds the f-block by reference, exactly as a
                     printed table does — the row is not an empty hole. */
                  if (columnIndex === 2 && (rowIndex === 5 || rowIndex === 6)) {
                    const series = rowIndex === 5 ? 57 : 89;
                    return (
                      <button
                        key={`series-${rowIndex}`}
                        type="button"
                        onClick={() => onSelect(series)}
                        title={rowIndex === 5 ? "Lanthanides 57–71" : "Actinides 89–103"}
                        className="apple-lab-tile h-[40px] w-full min-w-0 !justify-center !border-dashed px-0 text-center sm:h-[42px] xl:h-[48px]"
                        style={{ borderColor: "var(--lab-line)" }}
                      >
                        <span className="text-[7px] leading-none text-[var(--lab-ink-micro)]">
                          {rowIndex === 5 ? "57–71" : "89–103"}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <span
                      key={`gap-${rowIndex}-${columnIndex}`}
                      className="h-[36px] w-full sm:h-[42px] xl:h-[48px]"
                    />
                  );
                })}
              </div>
            ))}
            <div className="mb-[3px] mt-2 flex gap-[3px] text-[8px] leading-none text-[var(--lab-ink-micro)]">
              <span className="apple-lab-micro !text-[8px]">f-block</span>
              <span>57–71 lanthanides · 89–103 actinides</span>
            </div>
            {/* The f-block rows keep all 18 columns (the first two are
                spacers) so the tiles stay aligned with the main grid. */}
            {rows.slice(8).map((row, rowIndex) => (
              <div key={`frow-${rowIndex}`} className="mb-[3px] flex gap-[3px]">
                {row.map((element, columnIndex) =>
                  element ? (
                    renderTile(element)
                  ) : (
                    <span
                      key={`fgap-${rowIndex}-${columnIndex}`}
                      className="h-[36px] w-full sm:h-[42px] xl:h-[48px]"
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <span className="apple-lab-chip mt-3 !py-0.5 !text-[10px] lg:hidden">
          drag to pan
        </span>
      </div>

      {/* Element profile. On a desktop it grows in from the right as its own
          column, pushing the table and narrowing the tiles, so the whole table
          is still readable while the panel is open. Closing gives the table
          its full width back. */}
      {selectedElement && (
        <motion.div
          key="element-profile"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={panelTransition}
          className="min-w-0 overflow-hidden lg:pl-5"
        >
          <div className="apple-lab-panel apple-lab-glass w-full min-w-0 lg:w-[352px]">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border"
                    style={{
                      borderColor: tint(colorOf(selectedElement), "bb"),
                      background: tint(colorOf(selectedElement), "26"),
                    }}
                  >
                    <span className="text-[17px] font-bold leading-none text-[var(--lab-ink)]">
                      {selectedElement.sym}
                    </span>
                    <span className="mt-1 text-[9px] leading-none text-[var(--lab-ink-dim)]">
                      {selectedElement.n}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="apple-lab-micro truncate">{selectedElement.cat}</p>
                    <h3 className="apple-lab-title mt-1 truncate text-xl">{selectedElement.name}</h3>
                    <p className="apple-lab-note mt-0.5 truncate">
                      {selectedElement.mass} u · {PHASE_LABEL[selectedElement.phase]}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const index = ELEMENTS.findIndex((el) => el.n === selectedElement.n);
                        onSelect(ELEMENTS[Math.max(0, index - 1)].n);
                      }}
                      className="apple-lab-btn !px-1.5 !py-1.5"
                      aria-label="Previous element"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const index = ELEMENTS.findIndex((el) => el.n === selectedElement.n);
                        onSelect(ELEMENTS[Math.min(ELEMENTS.length - 1, index + 1)].n);
                      }}
                      className="apple-lab-btn !px-1.5 !py-1.5"
                      aria-label="Next element"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(null)}
                      className="apple-lab-btn !px-1.5 !py-1.5"
                      aria-label="Close element profile"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

            <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3">
              <FactCard
                label="Period / group"
                value={`${
                  periodGroupOf(selectedElement.n).period
                } / ${periodGroupOf(selectedElement.n).group ?? "f-block"}`}
              />
              <FactCard label="Density" value={physFor(selectedElement.n).density ?? "not measured"} />
              <FactCard
                label="Melting point"
                value={
                  physFor(selectedElement.n).mp === null
                    ? "not measured"
                    : `${physFor(selectedElement.n).mp} °C`
                }
              />
              <FactCard
                label="Boiling point"
                value={
                  physFor(selectedElement.n).bp === null
                    ? "not measured"
                    : `${physFor(selectedElement.n).bp} °C`
                }
              />
              <FactCard
                label="Electronegativity"
                value={
                  physFor(selectedElement.n).en === null
                    ? "not measured"
                    : physFor(selectedElement.n).en!.toFixed(2)
                }
              />
              <FactCard
                label="Discovered"
                value={
                  physFor(selectedElement.n).year === null
                    ? "unknown"
                    : physFor(selectedElement.n).year === 0
                      ? "antiquity"
                      : String(physFor(selectedElement.n).year)
                }
              />
            </div>

            {/* The atom itself, in three dimensions and draggable — the shells
                read out beneath it. It is not badged "3D": the pointer changes
                and the model answers the drag, which is the whole label. The
                canvas gets the card's full width so every ring and its glow is
                inside the frame instead of being cropped by a narrow column. */}
            <div className="apple-lab-card flex min-w-0 flex-col gap-3 px-3 py-3">
              <div className="mx-auto w-full max-w-[210px]" title="Drag to rotate · scroll to zoom">
                <Atom3D
                  z={selectedElement.n}
                  shells={shellsFor(selectedElement.n)}
                  symbol={selectedElement.sym}
                  orbitals={false}
                  compact
                />
              </div>
              <div className="min-w-0">
                <p className="apple-lab-micro">Electron shells</p>
                <p className="apple-lab-value mt-1 break-words text-[12.5px] leading-relaxed">
                  {shellsFor(selectedElement.n)
                    .map((count, index) => `${SHELL_LETTERS[index] ?? index + 1}·${count}`)
                    .join("  ")}
                </p>

              </div>
            </div>

                <div className="apple-lab-card min-w-0 px-3 py-3">
                  <p className="apple-lab-micro">Ground-state configuration</p>
                  <p className="apple-lab-value mt-1 break-words text-[11.5px] leading-relaxed">
                    {configFor(selectedElement.n)}
                  </p>

                </div>

                {USES[selectedElement.n] ? (
                  <div className="apple-lab-card min-w-0 px-3 py-3">
                    <p className="apple-lab-micro">Where you meet it</p>
                    <p className="apple-lab-note mt-1.5">{USES[selectedElement.n]}</p>
                  </div>
                ) : null}
              </div>
            </div>
        </motion.div>
      )}
    </div>
  );
}

/* ============================================================
   Sub-tab 2 — Atomic Models (large labelled Bohr + switcher)
   ============================================================ */

function AtomicModelsTab({ theme }: { theme: "light" | "dark" }) {
  const [z, setZ] = useState(6);
  const [model, setModel] = useState<AtomModel>("bohr");
  const element = ELEMENTS.find((el) => el.n === z) ?? ELEMENTS[0];
  /* All 118 elements, grouped by period and tinted by category, so the picker
     can be searched by name, symbol or number instead of scrolled. */
  const elementOptions: LabPickerOption[] = useMemo(
    () =>
      ELEMENTS.map((el) => ({
        value: String(el.n),
        label: el.name,
        meta: String(el.n),
        badge: el.sym,
        color: theme === "light" ? CAT_COLORS[el.cat].onLight : CAT_COLORS[el.cat].on,
        group: `Period ${periodGroupOf(el.n).period}`,
      })),
    [theme],
  );
  const shells = useMemo(() => shellsFor(z), [z]);
  const transition = useSpringTransition();
  const stagger = useStagger(0.07);
  const catColor = theme === "light" ? CAT_COLORS[element.cat].onLight : CAT_COLORS[element.cat].on;
  const valence = shells[shells.length - 1] ?? 0;
  const activeModel = ATOM_MODELS.find((entry) => entry.id === model) ?? ATOM_MODELS[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Atomic models</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {element.name} — {activeModel.label} model
            </h3>
          </div>
          <LabPicker
            label="Element"
            value={String(z)}
            options={elementOptions}
            onChange={(next) => setZ(Number(next))}
            searchPlaceholder="Search an element…"
            className="w-[13.5rem] shrink-0"
          />
        </div>

        {/* The model switcher. Four buttons, not a dropdown: the point of the
            tab is comparing the structures, and a menu hides three of them. */}
        <div className="apple-lab-tabrail mt-3 flex w-full" role="tablist" aria-label="Atomic model">
          {ATOM_MODELS.map((entry) => {
            const active = entry.id === model;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                className="apple-lab-subtab flex-1 whitespace-nowrap"
                onClick={() => setModel(entry.id)}
              >
                {active && (
                  <motion.span
                    layoutId="atom-model-pill"
                    className="apple-lab-pill"
                    transition={transition}
                  />
                )}
                <span className="relative z-10">{entry.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative mx-auto w-full max-w-[420px] py-2 lg:max-w-[460px] xl:max-w-[500px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${model}-${z}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {model === "bohr" && <BohrDiagram element={element} size={420} theme={theme} labeled />}
              {model === "rutherford" && (
                <RutherfordDiagram size={420} color={catColor} />
              )}
              {model === "quantum" && (
                <QuantumDiagram size={420} color={catColor} z={z} />
              )}
              {model === "lewis" && (
                <LewisDiagram size={420} color={catColor} symbol={element.sym} valence={valence} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* The right column. One model at a time: the definition here is the one
          whose drawing is on the left, and it swaps with the drawing. Listing
          all four at once made the switch read as a colour change on a list
          that never moved; the other definitions are one tab away, which is
          the point of having the tabs. */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="apple-lab-panel apple-lab-glass min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Model theory</p>
            <span className="apple-lab-chip !py-0.5 !text-[10px]">
              {activeModel.label} model
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={model}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transition}
              className="mt-3 min-w-0"
            >
              <div
                className="apple-lab-card min-w-0 px-3.5 py-3"
                style={{ borderColor: tint(catColor, "66") }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="apple-lab-title text-[15px]">{activeModel.label} model</p>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: catColor }}
                  >
                    {activeModel.year}
                  </span>
                </div>
                <p className="apple-lab-micro mt-1">{activeModel.who}</p>
                <p className="apple-lab-value mt-2.5 text-[12.5px] leading-relaxed">
                  {activeModel.note}
                </p>
              </div>

              <p className="apple-lab-note mt-3">
                <span className="font-semibold">In the drawing: </span>
                {activeModel.shows}
              </p>
            </motion.div>
          </AnimatePresence>

          <p className="apple-lab-micro mt-3">Switch the model for its definition</p>
        </div>

        <div className="apple-lab-panel apple-lab-glass min-w-0">
          <p className="apple-lab-micro">Shell occupancy</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {shells.map((count, index) => (
              <motion.div
                key={`shell-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: stagger(index) }}
                className="apple-lab-card px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="apple-lab-micro">
                    Shell {SHELL_LETTERS[index] ?? index + 1} (n = {index + 1})
                  </span>
                  <span className="apple-lab-value shrink-0 text-[14px] font-semibold">
                    {count} e⁻
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lab-line)]">
                  {/* The bar is occupancy against the shell's real capacity,
                      2n² — 2, 8, 18, 32. The old divisor (10, 20, 30, 40)
                      left even a noble gas reading half empty. */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / (2 * (index + 1) ** 2)) * 100}%` }}
                    transition={transition}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${tint(catColor, "66")}, ${tint(catColor, "cc")})`,
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="apple-lab-card mt-3 px-3 py-2.5">
            <p className="apple-lab-micro">Ground-state configuration</p>
            <p className="apple-lab-value mt-1 break-words text-[12.5px] leading-relaxed">
              {configFor(z)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-tab 3 — Titration bench

   A real monoprotic/diprotic neutralisation model, not a colour script: the
   flask holds a known volume and concentration, the burette delivers a chosen
   titrant, and pH comes out of the amounts actually present. Strong/weak and
   mono/di-protic behave differently, the equivalence volume moves when the
   concentrations move, and the indicator is a separate choice with its own
   transition range so the two can disagree — which is the whole lesson.
   ============================================================ */

type TitrantKind = "strong-acid" | "weak-acid" | "strong-base";

interface Titrant {
  id: string;
  formula: string;
  name: string;
  kind: TitrantKind;
  /** Equivalents of H⁺ or OH⁻ delivered per formula unit. */
  protons: number;
  pKa?: number;
  /** The second dissociation of a diprotic strong acid (H₂SO₄, pKa₂ ≈ 1.99). */
  pKa2?: number;
}

const ANALYTES: Titrant[] = [
  { id: "hcl", formula: "HCl", name: "Hydrochloric acid", kind: "strong-acid", protons: 1 },
  { id: "hno3", formula: "HNO₃", name: "Nitric acid", kind: "strong-acid", protons: 1 },
  { id: "h2so4", formula: "H₂SO₄", name: "Sulfuric acid", kind: "strong-acid", protons: 2, pKa2: 1.99 },
  { id: "ch3cooh", formula: "CH₃COOH", name: "Acetic acid", kind: "weak-acid", protons: 1, pKa: 4.76 },
  { id: "naoh", formula: "NaOH", name: "Sodium hydroxide", kind: "strong-base", protons: 1 },
  { id: "koh", formula: "KOH", name: "Potassium hydroxide", kind: "strong-base", protons: 1 },
];

const TITRANTS: Titrant[] = [
  { id: "naoh", formula: "NaOH", name: "Sodium hydroxide", kind: "strong-base", protons: 1 },
  { id: "koh", formula: "KOH", name: "Potassium hydroxide", kind: "strong-base", protons: 1 },
  { id: "hcl", formula: "HCl", name: "Hydrochloric acid", kind: "strong-acid", protons: 1 },
  { id: "h2so4", formula: "H₂SO₄", name: "Sulfuric acid", kind: "strong-acid", protons: 2, pKa2: 1.99 },
  { id: "ch3cooh", formula: "CH₃COOH", name: "Acetic acid", kind: "weak-acid", protons: 1, pKa: 4.76 },
];

const TITRATION_V0 = 25;
const BURETTE_ML = 50;
const clampPH = (value: number, low = 0, high = 14) => Math.min(high, Math.max(low, value));

/**
 * Exact pH of a weak-acid / strong-base mixture from mass and charge balance.
 *
 * `acidTotal` is the analytical concentration of the weak acid (HA + A⁻) and
 * `strongBase` the concentration of the strong-base cation. Solving
 *
 *   [Na⁺] + [H⁺] = [A⁻] + [OH⁻],   [A⁻] = C·Ka/(H⁺ + Ka)
 *
 * by bisection keeps the whole curve smooth — including the first drops, where
 * the textbook buffer formula alone would dive below the pure-acid pH.
 */
function weakPairPH(acidTotal: number, strongBase: number, pKa: number): number {
  const ka = 10 ** -pKa;
  const kw = 1e-14;
  let low = 0;
  let high = 14;
  for (let step = 0; step < 70; step++) {
    const mid = (low + high) / 2;
    const h = 10 ** -mid;
    const anion = (acidTotal * ka) / (h + ka);
    const excess = strongBase + h - anion - kw / h;
    if (excess > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * pH of a diprotic acid against a strong base, from the full charge balance.
 *
 * H₂SO₄ is not two equally strong protons. The first is effectively complete,
 * the second has pKa₂ ≈ 1.99, so the real curve has a small step at half the
 * equivalence volume before the main jump at the second equivalence. Solving
 *
 *   [H⁺] + [B⁺] = [OH⁻] + [HSO₄⁻] + 2[SO₄²⁻]
 *
 * with the two acid fractions keeps both steps instead of averaging them into
 * one. `pKa1 = −3` is the “first proton is strong” limit: Ka₁ = 1000 makes the
 * undissociated acid vanish at any pH a titration visits.
 */
function diproticPH(
  acidTotal: number,
  strongBase: number,
  pKa2: number,
  pKa1 = -3,
): number {
  const k1 = 10 ** -pKa1;
  const k2 = 10 ** -pKa2;
  const kw = 1e-14;
  let low = 0;
  let high = 14;
  for (let step = 0; step < 90; step++) {
    const mid = (low + high) / 2;
    const h = 10 ** -mid;
    const denom = h * h + k1 * h + k1 * k2;
    const acidMinus = (acidTotal * k1 * h) / denom;
    const acid2Minus = (acidTotal * k1 * k2) / denom;
    const residual =
      h + strongBase - kw / h - acidMinus - 2 * acid2Minus;
    if (residual > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * pH of the flask after `volume` mL of titrant.
 *
 * Acid in the flask is neutralised by a base (and vice versa), so only the
 * opposite kind is offered in the burette. Weak acids are solved exactly, so
 * the buffer plateau and the basic equivalence point both fall out of the
 * same equation instead of being stitched together from special cases.
 */
export function phAt(
  volume: number,
  analyte: Titrant,
  titrant: Titrant,
  c0: number,
  ct: number,
  v0 = TITRATION_V0,
): number {
  const V = v0 + volume;
  const nAnalyte = c0 * v0 * analyte.protons;
  const nTitrant = ct * volume * titrant.protons;

  /* Sulfuric acid, on either side of the bench: two protons, two strengths. */
  if (analyte.kind === "strong-acid" && analyte.pKa2 !== undefined) {
    return diproticPH(
      (c0 * v0) / V,
      (ct * volume * titrant.protons) / V,
      analyte.pKa2,
    );
  }
  if (titrant.kind === "strong-acid" && titrant.pKa2 !== undefined) {
    return diproticPH(
      (ct * volume) / V,
      (c0 * v0 * analyte.protons) / V,
      titrant.pKa2,
    );
  }

  if (analyte.kind === "weak-acid") {
    return weakPairPH(nAnalyte / V, nTitrant / V, analyte.pKa!);
  }
  if (titrant.kind === "weak-acid") {
    return weakPairPH(nTitrant / V, nAnalyte / V, titrant.pKa!);
  }

  /* Strong acid with strong base: closed form on whichever is in excess. */
  if (analyte.kind === "strong-acid") {
    const excessAcid = nAnalyte - nTitrant;
    if (Math.abs(excessAcid) <= 1e-12) return 7;
    if (excessAcid > 0) return -Math.log10(excessAcid / V);
    return 14 + Math.log10(-excessAcid / V);
  }

  const excessBase = nAnalyte - nTitrant;
  if (Math.abs(excessBase) <= 1e-12) return 7;
  if (excessBase > 0) return 14 + Math.log10(excessBase / V);
  return -Math.log10(-excessBase / V);
}

interface Indicator {
  id: string;
  label: string;
  range: string;
  low: string;
  high: string;
  lowName: string;
  highName: string;
  from: number;
  to: number;
}

const INDICATORS: Indicator[] = [
  {
    id: "pp",
    label: "Phenolphthalein",
    range: "8.2 – 10.0",
    low: "#dfeaec",
    high: "#e0559b",
    lowName: "colourless",
    highName: "magenta",
    from: 8.2,
    to: 10,
  },
  {
    id: "mo",
    label: "Methyl orange",
    range: "3.1 – 4.4",
    low: "#d23b32",
    high: "#e2b23a",
    lowName: "red",
    highName: "yellow",
    from: 3.1,
    to: 4.4,
  },
  {
    id: "btb",
    label: "Bromothymol blue",
    range: "6.0 – 7.6",
    low: "#c8b63a",
    high: "#2f7fd0",
    lowName: "yellow",
    highName: "blue",
    from: 6,
    to: 7.6,
  },
];

const TITRATION_QUESTIONS: BenchQuestion[] = [
  {
    q: "Why is the equivalence point not at pH 7?",
    a: "Only a strong acid neutralised by a strong base leaves a neutral salt. A weak acid leaves its conjugate base, which takes H⁺ from water and pulls the equivalence point up (acetate sits near 8.7); a weak base leaves an acidic salt. Equivalence is about moles, not about pH 7.",
  },
  {
    q: "Why is the curve almost flat before the jump?",
    a: "A weak acid and its own salt form a buffer: added OH⁻ is consumed by HA instead of building up, so [H⁺] barely moves. At half the equivalence volume pH equals pKa — that is where the plateau is flattest.",
  },
  {
    q: "Why does one drop matter near the end?",
    a: "The buffer is used up and there is no excess left to absorb the next addition. One drop is about 0.005 mmol, yet the volume it enters is only ~25–50 mL, so pH can move several units in a single drop. Real titrations slow to dropwise there, with constant swirling.",
  },
  {
    q: "What does the indicator actually tell you?",
    a: "Only that the pH crossed its own transition range. A good indicator's range brackets the equivalence pH, so the colour change lands within a drop of it; methyl orange (3.1–4.4) changes long before an acetate endpoint, which is why it is the wrong choice here.",
  },
];

function mixHex(from: string, to: string, t: number) {
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

function indicatorLook(indicator: Indicator, pH: number) {
  const t = clampPH((pH - indicator.from) / (indicator.to - indicator.from), 0, 1);
  return {
    t,
    color: mixHex(indicator.low, indicator.high, t),
    label:
      t <= 0.04 ? indicator.lowName : t >= 0.96 ? indicator.highName : "mid-transition",
  };
}

/* Flask outline (250 mL Erlenmeyer). The liquid is clipped to this same path,
   so the solution sits on the real base of the flask instead of floating above
   a separate curve of its own. */
const FLASK_D =
  "M 172 272 L 172 300 L 138 360 Q 132 371 136 383 L 141 402 Q 147 414 160 414 L 212 414 Q 225 414 231 402 L 236 383 Q 240 371 234 360 L 200 300 L 200 272 Z";

function TitrationTab() {
  const still = useStillMotion();
  const transition = useSpringTransition();
  const [analyteId, setAnalyteId] = useState("hcl");
  const [titrantId, setTitrantId] = useState("naoh");
  const [indicatorId, setIndicatorId] = useState("pp");
  const [c0, setC0] = useState(0.1);
  const [ct, setCt] = useState(0.1);
  /* The pipette volume is part of the experiment, not a constant of the room:
     10, 25 or 50 mL changes the moles in the flask, and with them the volume
     of titrant needed — at fixed concentrations, doubling V₀ doubles V_eq. */
  const [flaskVolume, setFlaskVolume] = useState(TITRATION_V0);
  const [rate, setRate] = useState(1.5);
  const [running, setRunning] = useState(true);
  const [volume, setVolume] = useState(0);

  const analyte = ANALYTES.find((entry) => entry.id === analyteId) ?? ANALYTES[0];
  const acidInFlask = analyte.kind !== "strong-base";
  /* Only the opposite kind can titrate the flask: acid into base or base into
     acid. Offering acetic acid as a titrant for HCl would be nonsense, so the
     list is filtered rather than allowed to produce a fake curve. */
  const titrantOptions = TITRANTS.filter((entry) =>
    acidInFlask ? entry.kind === "strong-base" : entry.kind !== "strong-base",
  );
  /* The two benches are picked with the lab's own dropdown; acids read warm and
     bases cool, the same way the flasks in the drawing are tinted. */
  const benchOptions = (entries: Titrant[]): LabPickerOption[] =>
    entries.map((entry) => ({
      value: entry.id,
      label: entry.name,
      badge: entry.formula,
      color: entry.kind.includes("acid") ? "#e08a2e" : "#2aa8c4",
    }));
  const analyteOptions = benchOptions(ANALYTES);
  const titrantPickerOptions = benchOptions(titrantOptions);
  const titrant = titrantOptions.find((entry) => entry.id === titrantId) ?? titrantOptions[0];
  const indicator = INDICATORS.find((entry) => entry.id === indicatorId) ?? INDICATORS[0];

  const eqVolume = (c0 * flaskVolume * analyte.protons) / (ct * titrant.protons);
  const beyondBurette = eqVolume > BURETTE_ML;
  const ph = phAt(volume, analyte, titrant, c0, ct, flaskVolume);
  const eqPH = phAt(eqVolume, analyte, titrant, c0, ct, flaskVolume);
  const look = indicatorLook(indicator, ph);
  const fill = Math.min(1, (flaskVolume + volume) / (flaskVolume + BURETTE_ML));
  /* Surface height inside the flask. It only ever depends on the volume, so it
     rises by exactly the amount delivered — no spring overshoot, no bob. */
  const surface = 408 - 84 * fill;
  const atMax = volume >= BURETTE_ML - 0.05;

  /* The drip is integrated every frame instead of stepping once a second, so
     the burette level, the flask level and the pH all move together. */
  useEffect(() => {
    if (!running || still) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      setVolume((value) => Math.min(BURETTE_ML, value + 0.62 * rate * dt));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, rate, still]);

  const reset = () => {
    setVolume(0);
    setRunning(true);
  };

  const selectAnalyte = (id: string) => {
    const next = ANALYTES.find((entry) => entry.id === id) ?? ANALYTES[0];
    setAnalyteId(next.id);
    setTitrantId(next.kind === "strong-base" ? "hcl" : "naoh");
    setVolume(0);
  };

  const curve = useMemo(() => {
    const points: string[] = [];
    for (let millilitres = 0; millilitres <= BURETTE_ML; millilitres += 0.25) {
      const x = 34 + (millilitres / BURETTE_ML) * 312;
      const y =
        146 -
        (clampPH(phAt(millilitres, analyte, titrant, c0, ct, flaskVolume)) / 14) * 126;
      points.push(`${millilitres === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return points.join(" ");
  }, [analyte, titrant, c0, ct, flaskVolume]);

  const pointX = 34 + (volume / BURETTE_ML) * 312;
  const pointY = 146 - (clampPH(ph) / 14) * 126;
  const eqX = 34 + (Math.min(BURETTE_ML, eqVolume) / BURETTE_ML) * 312;

  const weakBuffer =
    analyte.kind === "weak-acid" && volume > 0.1 && volume < eqVolume - 0.1;
  const nearEquivalence = Math.abs(volume - eqVolume) < 0.15;
  const status = atMax
    ? "Burette empty — refill to run the titration again."
    : nearEquivalence
      ? `At equivalence — ${eqVolume.toFixed(1)} mL delivered and the flask sits at pH ${eqPH.toFixed(2)}.`
      : volume < eqVolume
        ? weakBuffer
          ? "Buffer region — the weak acid and its conjugate base resist the pH change, so the curve is almost flat."
          : acidInFlask
            ? "Before equivalence — excess acid keeps the flask acidic, and the curve barely lifts."
            : "Before equivalence — excess base keeps the flask basic, and the curve barely falls."
        : `Past equivalence — excess ${titrant.formula} now controls the pH.`;

  const indicatorGap =
    eqPH < indicator.from
      ? { side: "below", gap: indicator.from - eqPH, when: "after" }
      : eqPH > indicator.to
        ? { side: "above", gap: eqPH - indicator.to, when: "before" }
        : null;
  const indicatorNote = indicatorGap
    ? `The equivalence pH (${eqPH.toFixed(2)}) is ${indicatorGap.gap.toFixed(1)} units ${indicatorGap.side} the ${indicator.label} window (${indicator.range}), so the colour change arrives ${indicatorGap.when} the true end point.`
    : `The equivalence pH (${eqPH.toFixed(2)}) sits inside the ${indicator.label} window (${indicator.range}) — the colour change marks the end point.`;

  const dropDuration = Math.max(0.32, 0.9 / rate);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      {/* The bench */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Titration bench</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {titrant.formula} into {analyte.formula} — {indicator.label}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: running ? "#7dd3fc" : "var(--lab-ink-micro)" }}
              />
              {atMax ? "burette empty" : running ? "dripping" : "paused"}
            </span>
            <button
              type="button"
              onClick={() => setRunning((value) => !value)}
              className={`apple-lab-btn ${
                running ? "apple-lab-btn--stop" : "apple-lab-btn--run"
              } !px-3 !py-2`}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{running ? "Pause" : "Resume"}</span>
            </button>
            <button type="button" onClick={reset} className="apple-lab-btn !px-3 !py-2">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refill</span>
            </button>
          </div>
        </div>

        <svg
          viewBox="0 0 300 430"
          className="mx-auto mt-2 h-[380px] w-full max-w-[330px] sm:h-[400px]"
          role="img"
          aria-label={`A burette of ${titrant.name} dripping into a flask of ${analyte.name}`}
        >
          <defs>
            <linearGradient id="titration-glass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(148,163,184,0.18)" />
              <stop offset="45%" stopColor="rgba(226,232,240,0.06)" />
              <stop offset="100%" stopColor="rgba(148,163,184,0.2)" />
            </linearGradient>
            <clipPath id="titration-flask">
              <path d={FLASK_D} />
            </clipPath>
            {/* The drop itself: a bright bead with a wet highlight, so it is
                visible against the grey glass it falls in front of. */}
            <radialGradient id="titration-drop" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#f4fbff" />
              <stop offset="45%" stopColor="#b9dcf2" />
              <stop offset="100%" stopColor="#6f8ba6" />
            </radialGradient>
          </defs>

          {/* Stand and clamp */}
          <line x1="40" y1="18" x2="40" y2="412" stroke="rgba(128,128,128,0.45)" strokeWidth="3" strokeLinecap="round" />
          <line x1="22" y1="412" x2="112" y2="412" stroke="rgba(128,128,128,0.45)" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="112" x2="170" y2="112" stroke="rgba(128,128,128,0.4)" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="160" y="106" width="30" height="11" rx="4" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />

          {/* Burette: 0 mL at the top, 50 mL at the bottom */}
          <rect x="176" y="34" width="20" height="198" rx="7" fill="url(#titration-glass)" stroke="rgba(148,163,184,0.5)" />
          <rect
            x="178"
            y={38 + (volume / BURETTE_ML) * 190}
            width="16"
            height={Math.max(0, 190 - (volume / BURETTE_ML) * 190)}
            rx="5"
            fill="#7d8fa8"
            opacity="0.55"
          />
          <line
            x1="176"
            y1={38 + (volume / BURETTE_ML) * 190}
            x2="196"
            y2={38 + (volume / BURETTE_ML) * 190}
            stroke="rgba(226,232,240,0.6)"
            strokeWidth="1.2"
          />
          {Array.from({ length: 11 }, (_, index) => {
            const y = 40 + index * 19;
            return (
              <g key={index}>
                <line
                  x1="196"
                  y1={y}
                  x2={index % 2 === 0 ? 205 : 200}
                  y2={y}
                  stroke="rgba(148,163,184,0.55)"
                />
                <text x="209" y={y + 3} fontSize="7.5" fill="rgba(148,163,184,0.85)" fontFamily="monospace">
                  {index * 5}
                </text>
              </g>
            );
          })}

          {/* Stopcock and tip */}
          <rect x="169" y="232" width="34" height="14" rx="5" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />
          <motion.g
            animate={{ rotate: running && !atMax ? 0 : -78 }}
            transition={transition}
            style={{ transformBox: "view-box", transformOrigin: "186px 239px" }}
          >
            <circle cx="186" cy="239" r="8" fill="var(--lab-canvas)" stroke="var(--lab-ink)" opacity="0.9" />
            <line x1="186" y1="239" x2="186" y2="251" stroke="var(--lab-ink)" strokeWidth="2.5" strokeLinecap="round" />
          </motion.g>
          <path d="M180 246 L192 246 L189 264 L183 264 Z" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />

          {/* Flask glass, then the clipped liquid inside it */}
          <path d={FLASK_D} fill="rgba(148,163,184,0.07)" />
          <g clipPath="url(#titration-flask)">
            {/* The level is written straight from the delivered volume, not
                tweened: there is nothing to overshoot, so it cannot bob. Only
                the indicator colour fades. */}
            <rect
              x="110"
              y={surface}
              width="152"
              height={430 - surface}
              fill={look.color}
              opacity="0.78"
              style={{ transition: "fill 300ms linear" }}
            />
          </g>
          <path d={FLASK_D} fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="1.6" />
          <ellipse cx="186" cy="272" rx="14" ry="3.4" fill="none" stroke="rgba(148,163,184,0.55)" strokeWidth="1.4" />
          <ellipse cx="186" cy={surface} rx="28" ry="2.2" fill="#ffffff" opacity="0.3" />

          {/* The drip, drawn as the liquid itself rather than as a hint.

              A thin thread leaves the stopcock tip and beads of titrant fall
              from it all the way to the surface, where each one lands inside
              the flask and rings out. It runs whenever the burette is open,
              including under Motionless Mode: this is the apparatus working,
              not a decoration, so switching it off would leave a bench that
              silently claims to be dripping with nothing moving. */}
          {running && !atMax ? (
            <>
              <line
                x1="186"
                y1="264"
                x2="186"
                y2={surface}
                stroke={look.color}
                strokeWidth="1.2"
                opacity="0.45"
              />
              <motion.circle
                cx="186"
                cy="266"
                fill="#d9efff"
                animate={{ r: [2.4, 4, 2.4], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: dropDuration, repeat: Infinity, ease: "easeInOut" }}
              />
              {[0, 1, 2].map((drop) => (
                <motion.circle
                  key={drop}
                  cx="186"
                  fill="url(#titration-drop)"
                  initial={{ cy: 268, opacity: 0, r: 3 }}
                  animate={{
                    // Four keyframes for every channel: `times` below has four
                    // entries and Motion requires them to line up.
                    cy: [268, 276, Math.max(280, surface - 8), surface - 2],
                    opacity: [0, 1, 1, 0],
                    r: [3, 4.6, 4.6, 3.2],
                  }}
                  transition={{
                    duration: Math.max(0.55, dropDuration),
                    repeat: Infinity,
                    repeatDelay: 0,
                    delay: (drop * Math.max(0.55, dropDuration)) / 3,
                    ease: [0.45, 0, 0.9, 0.55],
                    times: [0, 0.12, 0.86, 1],
                  }}
                  style={{ filter: "drop-shadow(0 0 5px rgba(190, 228, 255, 0.75))" }}
                />
              ))}
              {[0, 1, 2].map((ring) => (
                <motion.ellipse
                  key={`ring-${ring}`}
                  cx="186"
                  ry="3"
                  fill="none"
                  stroke={look.color}
                  strokeWidth="1.6"
                  animate={{ cy: surface, rx: [3, 20], opacity: [0.75, 0] }}
                  transition={{
                    duration: Math.max(0.55, dropDuration),
                    repeat: Infinity,
                    delay: Math.max(0.55, dropDuration) * (0.3 + ring * 0.33),
                    ease: "easeOut",
                  }}
                />
              ))}
            </>
          ) : null}
        </svg>

        {/* What is in the flask and what is being added. Same picker as the
            element list — a native menu here would be the one control in the
            room that belongs to the operating system. */}
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <LabPicker
            label="In the flask"
            value={analyte.id}
            options={analyteOptions}
            onChange={selectAnalyte}
          />
          <LabPicker
            label="In the burette"
            value={titrant.id}
            options={titrantPickerOptions}
            onChange={(next) => {
              setTitrantId(next);
              setVolume(0);
            }}
          />
        </div>

        <div className="mt-3">
          <p className="apple-lab-micro">Indicator</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {INDICATORS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setIndicatorId(entry.id)}
                data-active={entry.id === indicator.id}
                className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: entry.high }} />
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="apple-lab-micro mr-1">Flask volume</span>
          {[10, 25, 50].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFlaskVolume(value);
                setVolume(0);
              }}
              data-active={flaskVolume === value}
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
            >
              {value} mL
            </button>
          ))}
          <span className="ml-auto text-[10.5px] text-[var(--lab-ink-micro)]">
            V₀ = {flaskVolume} mL
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="apple-lab-card block px-3 py-2.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="apple-lab-micro">Flask concentration</span>
              <span className="apple-lab-value text-[12px] font-semibold">{c0.toFixed(2)} M</span>
            </span>
            <input
              type="range"
              className="apple-lab-range mt-1"
              min={0.02}
              max={0.4}
              step={0.01}
              value={c0}
              onChange={(event) => {
                setC0(Number(event.target.value));
                setVolume(0);
              }}
            />
          </label>
          <label className="apple-lab-card block px-3 py-2.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="apple-lab-micro">Burette concentration</span>
              <span className="apple-lab-value text-[12px] font-semibold">{ct.toFixed(2)} M</span>
            </span>
            <input
              type="range"
              className="apple-lab-range mt-1"
              min={0.02}
              max={0.4}
              step={0.01}
              value={ct}
              onChange={(event) => {
                setCt(Number(event.target.value));
                setVolume(0);
              }}
            />
          </label>
        </div>

        <label className="apple-lab-card mt-3 block px-3 py-2.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="apple-lab-micro">Drip rate</span>
            <span className="apple-lab-value text-[12px] font-semibold">{rate.toFixed(1)}×</span>
          </span>
          <input
            type="range"
            className="apple-lab-range mt-1"
            min={0.5}
            max={6}
            step={0.5}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
          />
        </label>
      </div>

      {/* Readouts + the curve they trace */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Titrant added", value: `${volume.toFixed(1)} mL` },
            { label: "pH of flask", value: ph.toFixed(2) },
            { label: "Equivalence", value: `${eqVolume.toFixed(1)} mL` },
            { label: "Indicator colour", value: look.label },
          ].map((item) => (
            <div key={item.label} className="apple-lab-card px-3 py-2.5">
              <p className="apple-lab-micro">{item.label}</p>
              <p className="apple-lab-value mt-1 text-[14px] font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="apple-lab-micro">pH against volume</p>
            <span className="apple-lab-chip !py-0.5 !text-[10px]">
              {beyondBurette ? "end point beyond 50 mL" : `endpoint pH ${eqPH.toFixed(2)}`}
            </span>
          </div>
          <svg
            viewBox="0 0 360 180"
            className="mt-2 h-[190px] w-full"
            role="img"
            aria-label={`Titration curve for ${analyte.formula} against ${titrant.formula}`}
          >
            {[0, 2, 4, 6, 8, 10, 12, 14].map((value) => {
              const y = 146 - (value / 14) * 126;
              return (
                <g key={value}>
                  <line x1="30" y1={y} x2="350" y2={y} stroke="rgba(148,163,184,0.12)" />
                  <text x="24" y={y + 3} fontSize="7.5" textAnchor="end" fill="rgba(148,163,184,0.75)" fontFamily="monospace">
                    {value}
                  </text>
                </g>
              );
            })}
            {[0, 10, 20, 30, 40, 50].map((value) => {
              const x = 34 + (value / BURETTE_ML) * 312;
              return (
                <g key={value}>
                  <line x1={x} y1="12" x2={x} y2="146" stroke="rgba(148,163,184,0.08)" />
                  <text x={x} y="162" fontSize="7.5" textAnchor="middle" fill="rgba(148,163,184,0.75)" fontFamily="monospace">
                    {value}
                  </text>
                </g>
              );
            })}
            <line x1="30" y1="146" x2="350" y2="146" stroke="rgba(148,163,184,0.3)" />
            <line x1="30" y1="12" x2="30" y2="146" stroke="rgba(148,163,184,0.3)" />
            <text x="190" y="176" fontSize="8" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontFamily="monospace">
              titrant / mL
            </text>

            {!beyondBurette ? (
              <line
                x1={eqX}
                y1="12"
                x2={eqX}
                y2="146"
                stroke="rgba(148,163,184,0.42)"
                strokeDasharray="4 5"
              />
            ) : null}
            <path d={curve} fill="none" stroke="var(--lab-ink)" strokeWidth="1.7" opacity="0.75" />
            <path
              d={curve}
              fill="none"
              stroke="var(--lab-ink)"
              strokeWidth="2.4"
              strokeDasharray="1000"
              strokeDashoffset={1000 - 1000 * Math.min(1, volume / BURETTE_ML)}
            />
            <circle cx={pointX} cy={pointY} r="4" fill="var(--lab-ink)" />
            <circle cx={pointX} cy={pointY} r="7.5" fill="none" stroke="var(--lab-ink)" opacity="0.35" />
          </svg>
        </div>

        <div className="apple-lab-card mt-3 px-3 py-2.5">
          <p className="apple-lab-micro">What is happening</p>
          <p className="apple-lab-note mt-1">{status}</p>
        </div>
        {analyte.id === "h2so4" || titrant.id === "h2so4" ? (
          <p className="apple-lab-note mt-2 px-1">
            H₂SO₄ gives up its protons in stages: the first completely, the
            second only partly (pKa₂ 1.99). So the first equivalence is only an
            inflection, not a jump — the second proton starts leaving at once,
            and the single sharp jump is the second equivalence. Even that salt
            is slightly basic (pH ≈ 7.3), because SO₄²⁻ is a weak base.
          </p>
        ) : null}
        <div className="apple-lab-card mt-2 px-3 py-2.5">
          <p className="apple-lab-micro">{indicator.label} · {indicator.range}</p>
          <p className="apple-lab-note mt-1">{indicatorNote}</p>
        </div>

        <Questions items={TITRATION_QUESTIONS} columns={1} className="mt-4" />
      </div>
    </div>
  );
}

/* ============================================================
   Sub-tab 4 — Reactions builder

   Two reactant slots and a shelf of 39 real reagents. Drag a reagent into a
   slot (or tap it to load the first free one) and the bench looks the pair up
   in a curated reaction table: a balanced equation, a classification and an
   honest "these two do not react" when there is no entry. Selection is ink on
   glass — the lab has no violet accent left to leak into a highlight.
   ============================================================ */

interface ReagentTerm {
  coefficient: string;
  formula: string;
}

function splitSide(side: string): ReagentTerm[] {
  return side
    .split("+")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => {
      const match = term.match(/^(\d+)\s+(.+)$/);
      return match
        ? { coefficient: match[1], formula: match[2] }
        : { coefficient: "1", formula: term };
    });
}

/** Digits inside a formula become true subscripts (H2O → H₂O). */
function Formula({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(/(\d+)/).map((chunk, index) =>
        /^\d+$/.test(chunk) ? (
          <sub key={index} className="text-[0.72em]">
            {chunk}
          </sub>
        ) : (
          <span key={index}>{chunk}</span>
        ),
      )}
    </span>
  );
}

function Equation({ eq }: { eq: string }) {
  const [left, right] = eq.split("->");
  return (
    <span className="apple-lab-value inline-flex flex-wrap items-center justify-center gap-x-1.5 text-[14px] font-bold leading-relaxed">
      {splitSide(left ?? "").map((term, index) => (
        <span key={`left-${index}`} className="inline-flex items-baseline gap-1">
          {index > 0 ? <span className="text-[var(--lab-ink-micro)]">+</span> : null}
          {term.coefficient !== "1" ? (
            <span className="text-[11px] text-[var(--lab-ink-dim)]">{term.coefficient}</span>
          ) : null}
          <Formula text={term.formula} />
        </span>
      ))}
      <span className="px-1 text-[var(--lab-ink-micro)]">→</span>
      {splitSide(right ?? "").map((term, index) => (
        <span key={`right-${index}`} className="inline-flex items-baseline gap-1">
          {index > 0 ? <span className="text-[var(--lab-ink-micro)]">+</span> : null}
          {term.coefficient !== "1" ? (
            <span className="text-[11px] text-[var(--lab-ink-dim)]">{term.coefficient}</span>
          ) : null}
          <Formula text={term.formula} />
        </span>
      ))}
    </span>
  );
}

const SHELF_GROUPS: Array<{ id: string; label: string; ids: string[] }> = [
  {
    id: "metals",
    label: "Metals & elements",
    ids: ["na", "k", "ca", "mg", "al", "zn", "fe", "cu", "pb", "c", "s"],
  },
  {
    id: "acids",
    label: "Acids, bases & oxides",
    ids: ["hcl", "h2so4", "naoh", "nh3", "cao", "fe2o3", "nahco3", "na2co3", "caco3"],
  },
  {
    id: "solutions",
    label: "Salt solutions",
    ids: ["h2o", "h2o2", "nacl", "cuso4", "agno3", "bacl2", "na2so4", "ki", "pbno3", "nabr", "kmno4"],
  },
  {
    id: "gases",
    label: "Gases",
    ids: ["h2", "o2", "n2", "cl2", "co2", "ch4", "h2s", "so2"],
  },
];

function ReactionsTab() {
  const transition = useSpringTransition();
  const still = useStillMotion();
  const [slotA, setSlotA] = useState<Substance | null>(null);
  const [slotB, setSlotB] = useState<Substance | null>(null);
  const [over, setOver] = useState<"a" | "b" | null>(null);
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [flash, setFlash] = useState(false);

  const pairKey = slotA && slotB ? [slotA.id, slotB.id].sort().join("|") : null;
  const reaction: Reaction | undefined = pairKey ? REACTIONS[pairKey] : undefined;
  const products = useMemo(
    () => (reaction ? splitSide(reaction.eq.split("->")[1] ?? "") : []),
    [reaction],
  );

  const load = (slot: "a" | "b", substance: Substance) => {
    setFlash(false);
    setRunKey(0);
    if (slot === "a") {
      setSlotB((current) => (current?.id === substance.id ? null : current));
      setSlotA(substance);
    } else {
      setSlotA((current) => (current?.id === substance.id ? null : current));
      setSlotB(substance);
    }
  };

  /** Tap-to-fill: the next free slot, then the second slot. */
  const pick = (substance: Substance) => {
    if (!slotA) return load("a", substance);
    if (!slotB && slotA.id !== substance.id) return load("b", substance);
    load("b", substance);
  };

  const clearSlot = (slot: "a" | "b") => {
    if (slot === "a") setSlotA(null);
    else setSlotB(null);
    setRunKey(0);
    setFlash(false);
  };

  const dropZone = (slot: "a" | "b") => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(slot);
    },
    onDragLeave: () => setOver((current) => (current === slot ? null : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(null);
      const substance = SUBSTANCES.find((entry) => entry.id === event.dataTransfer.getData("text/plain"));
      if (substance) load(slot, substance);
    },
  });

  const needle = query.trim().toLowerCase();
  const groupIds = group === "all" ? null : SHELF_GROUPS.find((entry) => entry.id === group)?.ids ?? null;
  const shelf = SUBSTANCES.filter((substance) => {
    if (groupIds && !groupIds.includes(substance.id)) return false;
    if (!needle) return true;
    return (
      substance.name.toLowerCase().includes(needle) ||
      substance.formula.toLowerCase().includes(needle)
    );
  });

  const suggestions = slotA
    ? Object.keys(REACTIONS)
        .filter((key) => key.split("|").includes(slotA.id))
        .map((key) => key.split("|").find((id) => id !== slotA.id))
        .filter((id): id is string => Boolean(id) && id !== slotB?.id)
        .slice(0, 4)
        .map((id) => SUBSTANCES.find((entry) => entry.id === id))
        .filter((entry): entry is Substance => Boolean(entry))
    : [];

  const canReact = Boolean(reaction);

  const renderSlot = (id: "a" | "b", label: string, substance: Substance | null) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div
        {...dropZone(id)}
        className="flex h-[86px] w-full items-center justify-center rounded-2xl border p-2.5 transition-colors"
        style={{
          borderColor: over === id ? "var(--lab-ink)" : "var(--lab-line)",
          borderStyle: substance ? "solid" : "dashed",
          background:
            over === id
              ? "color-mix(in srgb, var(--lab-ink) 7%, transparent)"
              : substance
                ? tint(substance.color, "18")
                : "transparent",
        }}
      >
        {substance ? (
          <div className="flex w-full min-w-0 items-center gap-2.5">
            <span
              className="h-9 w-9 shrink-0 rounded-lg border"
              style={{
                borderColor: tint(substance.color, "88"),
                background: tint(substance.color, "33"),
              }}
            />
            <div className="min-w-0 flex-1">
              <Formula
                text={substance.formula}
                className="block text-[18px] font-bold leading-tight text-[var(--lab-ink)]"
              />
              <p className="truncate text-[10.5px] leading-tight text-[var(--lab-ink-dim)]">
                {substance.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => clearSlot(id)}
              aria-label={`Clear ${label}`}                      className="lab-hover-ink rounded-full p-1 text-[var(--lab-ink-dim)] transition-colors hover:text-[var(--lab-ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="px-2 text-center text-[10.5px] leading-relaxed text-[var(--lab-ink-micro)]">
            Drop a reagent here
            <br />
            or tap one on the shelf
          </p>
        )}
      </div>
      <span className="apple-lab-micro text-center">{label}</span>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* The bench */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Reactions builder</p>
            <h3 className="apple-lab-title mt-1 truncate text-lg">
              {reaction ? reaction.type : "Load two reagents"}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!canReact) return;
                setRunKey((value) => value + 1);
                setFlash(true);
              }}
              disabled={!canReact}
              className="apple-lab-btn apple-lab-btn--run !px-3.5 !py-2"
            >
              React ▸
            </button>
            <button
              type="button"
              onClick={() => {
                clearSlot("a");
                clearSlot("b");
              }}
              className="apple-lab-btn !px-3 !py-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        {/* Two drop slots. Drag a reagent from the shelf, or tap one. */}
        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {renderSlot("a", "Reactant A", slotA)}
          <span className="self-center text-lg leading-none text-[var(--lab-ink-micro)]">+</span>
          {renderSlot("b", "Reactant B", slotB)}
        </div>

        {/* What the pair does, before the animation runs. */}
        <div className="mt-4">
          {slotA && slotB ? (
            reaction ? (
              <div className="flex flex-col items-center gap-3">
                <div className="apple-lab-card w-full px-3 py-3 text-center">
                  <p className="apple-lab-micro">Balanced equation</p>
                  <div className="mt-1.5">
                    <Equation eq={reaction.eq} />
                  </div>
                </div>

                <div className="flex min-h-8 flex-wrap items-center justify-center gap-2">
                  {products.map((product, index) => (
                    <motion.span
                      key={`${runKey}-${index}-${product.formula}`}
                      initial={runKey > 0 ? { opacity: 0, scale: 0.82, y: 8 } : false}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ ...transition, delay: still ? 0 : index * 0.08 }}
                      className="inline-flex items-baseline gap-1 rounded-xl border border-[var(--lab-line)] px-2.5 py-1.5"
                      style={{ background: "color-mix(in srgb, var(--lab-ink) 5%, transparent)" }}
                    >
                      {product.coefficient !== "1" ? (
                        <span className="text-[10px] text-[var(--lab-ink-dim)]">{product.coefficient}</span>
                      ) : null}
                      <Formula text={product.formula} className="apple-lab-value text-[13.5px] font-bold" />
                    </motion.span>
                  ))}
                  <AnimatePresence>
                    {flash ? (
                      <motion.span
                        key={`flash-${runKey}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 1] }}
                        transition={{
                          duration: still ? 0.4 : 1.6,
                          times: [0, 0.2, 0.7, 1],
                          type: "tween",
                        }}
                        onAnimationComplete={() => setFlash(false)}
                        className="apple-lab-chip"
                        style={{ borderColor: "rgba(224,98,120,0.45)", color: "#e06278" }}
                      >
                        ⚡ bonds break, bonds form — atoms are conserved
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="w-full">
                  <p className="apple-lab-micro">Classification</p>
                  <p className="apple-lab-value mt-1 text-[13px] font-semibold">{reaction.type}</p>
                  <p className="apple-lab-note mt-2 leading-relaxed">{reaction.note}</p>
                  {reaction.energy ? (
                    <span
                      className="apple-lab-chip mt-2 inline-flex items-center gap-1.5"
                      style={{
                        borderColor:
                          reaction.energy === "exo"
                            ? "rgba(224,98,120,0.45)"
                            : "rgba(42,168,196,0.45)",
                        color: reaction.energy === "exo" ? "#e06278" : "#2aa8c4",
                      }}
                    >
                      {reaction.energy === "exo"
                        ? "↑ exothermic — heat released"
                        : "↓ endothermic — heat absorbed"}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="apple-lab-card px-3.5 py-3">
                <p className="apple-lab-value text-[13px] font-semibold">No direct reaction</p>
                <p className="apple-lab-note mt-1.5 leading-relaxed">
                  {slotA.name} and {slotB.name} do not react under bench
                  conditions. A reaction is not invented just because two
                  substances are on the bench — swap one of them for a partner
                  from the list below.
                </p>
                {suggestions.length > 0 ? (
                  <div className="mt-2.5">
                    <p className="apple-lab-micro">Partners that do react with {slotA.formula}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {suggestions.map((partner) => (
                        <button
                          key={partner.id}
                          type="button"
                          onClick={() => load("b", partner)}
                          className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                        >
                          <Formula text={partner.formula} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <div className="flex min-h-[145px] flex-col items-center justify-center gap-2 text-center">
              <p className="apple-lab-title text-base">Build a reaction</p>
              <p className="apple-lab-note max-w-sm">
                Drag one reagent into each slot. The bench looks the pair up and
                shows the balanced equation before you run it.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Reagent shelf */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="apple-lab-micro">Reagent shelf</p>
            <p className="apple-lab-note mt-1 text-[11px]">
              {SUBSTANCES.length} substances · drag into a slot, or tap to load
              the next one.
            </p>
          </div>
          <label className="apple-lab-card flex items-center gap-2 px-2.5 py-1.5">
            <span className="apple-lab-micro">Find</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="name or formula"
              aria-label="Search reagents"
              className="w-24 bg-transparent text-[11.5px] text-[var(--lab-ink)] outline-none placeholder:text-[var(--lab-ink-micro)]"
            />
          </label>
        </div>

        <div className="lab-pan mt-2.5 flex gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setGroup("all")}
            data-active={group === "all"}
            className="apple-lab-btn shrink-0 !px-2.5 !py-1 !text-[10.5px]"
          >
            All
          </button>
          {SHELF_GROUPS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setGroup(group === entry.id ? "all" : entry.id)}
              data-active={group === entry.id}
              className="apple-lab-btn shrink-0 !px-2.5 !py-1 !text-[10.5px]"
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 overflow-y-auto pr-1 apple-lab-scroll">
          {shelf.map((substance) => {
            const active = slotA?.id === substance.id || slotB?.id === substance.id;
            return (
              <button
                key={substance.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", substance.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => pick(substance)}
                aria-pressed={active}
                title={`${substance.name} · ${substance.state}`}
                className="apple-lab-tile flex h-[62px] min-w-0 flex-col items-start justify-between px-2 py-1.5 text-left"
                style={{
                  borderColor: active ? "var(--lab-ink)" : tint(substance.color, "55"),
                  background: active
                    ? "color-mix(in srgb, var(--lab-ink) 12%, transparent)"
                    : tint(substance.color, "14"),
                }}
              >
                <span className="text-[7.5px] uppercase tracking-widest text-[var(--lab-ink-micro)]">
                  {substance.state}
                </span>
                <Formula
                  text={substance.formula}
                  className="text-[14px] font-bold leading-none text-[var(--lab-ink)]"
                />
                <span className="w-full truncate text-[8px] leading-none text-[var(--lab-ink-dim)]">
                  {substance.name}
                </span>
              </button>
            );
          })}
          {shelf.length === 0 ? (
            <p className="apple-lab-note col-span-3 py-6 text-center text-[11px]">
              No reagent matches “{query}”.
            </p>
          ) : null}
        </div>

      </div>
    </div>
  );
}

/* ============================================================
   The bench — sub-tab rail + scoped light/dark
   ============================================================ */

export function ChemistryGlassLab() {
  const [tab, setTab] = useState<SubTab>("table");
  const [selected, setSelected] = useState<number | null>(null);
  const theme = useLabTheme();
  const transition = useSpringTransition();
  const stagger = useStagger(0.05);

  return (
    <div data-lab-theme={theme} className="rounded-[28px] pb-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="apple-lab-tabrail" role="tablist" aria-label="Chemistry sections">
          {SUBTABS.map((entry) => {
            const isActive = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="apple-lab-subtab"
                onClick={() => setTab(entry.id)}
              >
                {isActive && (
                  <motion.span
                    layoutId="chem-subtab-pill"
                    className="apple-lab-pill"
                    transition={transition}
                  />
                )}
                <span className="relative z-10">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab cross-fade — the same AnimatePresence "wait" pattern the
          subject rail uses, so the swap keeps the lab's one motion system. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          variants={viewVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ ...transition, delay: stagger(0) }}
        >
          {tab === "table" && (
            <PeriodicTableTab selected={selected} onSelect={setSelected} theme={theme} />
          )}
          {tab === "bohr" && <AtomicModelsTab theme={theme} />}
          {tab === "titration" && <TitrationTab />}
          {tab === "reactions" && <ReactionsTab />}
          {tab === "balance" && <MoleBench />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ChemistryGlassLab;
