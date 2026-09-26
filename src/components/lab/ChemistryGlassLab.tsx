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
import { useSpringTransition, useStillMotion, useStagger, viewVariants } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Chemistry — a frosted periodic table, a live Bohr model, a titration bench
 * and a reaction stage, in four sub-tabs.
 *
 * The periodic table is a glass grid: each tile carries a 1px border tinted by
 * its category, and selecting an element morphs the tile's identity into the
 * detail panel via a shared layout id. The Bohr model draws the real electron
 * grouping (Aufbau per principal shell) with each shell orbiting continuously
 * on its own CSS timeline — slower the further out it sits.
 *
 * The bench carries its own light/dark toggle (`data-lab-theme` on this root)
 * so the four tabs can be read in daylight without touching the site theme or
 * the Physics and Biology rooms.
 */

/* ---- Sub-tab model -------------------------------------------------- */

type SubTab = "table" | "bohr" | "titration" | "reactions";

const SUBTABS: Array<{ id: SubTab; label: string }> = [
  { id: "table", label: "Periodic Table" },
  { id: "bohr", label: "Atomic Models" },
  { id: "titration", label: "Titration" },
  { id: "reactions", label: "Reactions" },
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
      /* The tile's identity is the shared layout element the detail panel
         morphs out of, so this is where the layout id lives. */
      layoutId={`element-${element.n}`}
      onClick={() => onSelect(element.n)}
      aria-label={`${element.name}, atomic number ${element.n}`}
      aria-pressed={isSelected}
      data-selected={isSelected}
      whileHover={{ scale: 1.06 }}
      transition={transition}
      className="apple-lab-tile h-[52px] w-full min-w-0 !gap-0.5 !justify-between !items-stretch px-[3px] py-[3px] text-left"
      style={{
        borderColor: isSelected ? tint(color, "cc") : tint(color, faint ? "30" : "59"),
        boxShadow: isSelected ? `0 0 22px -6px ${tint(color, "aa")}` : "none",
        opacity: faint ? 0.24 : 1,
      }}
    >
      <span
        className="w-full truncate text-[8.5px] font-medium leading-none"
        style={{ color: "var(--lab-ink-micro)" }}
      >
        {element.n}
      </span>
      <span
        className="flex w-full items-center justify-center truncate text-[14.5px] font-bold leading-none"
        style={{ color: "var(--lab-ink)" }}
      >
        {element.sym}
      </span>
      <span className="hidden w-full truncate text-[8px] leading-none md:block" style={{ color: "var(--lab-ink-dim)" }}>
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
    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Periodic table</p>
            <h3 className="apple-lab-title mt-1 text-lg">118 elements, one glass grid</h3>
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

        {/* Category legend doubles as a highlight switch. */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => (
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

        <div className="apple-lab-scroll mt-4 overflow-x-auto pb-1">
          <div className="min-w-[760px]">
            {rows.slice(0, 7).map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="mb-1 flex gap-1">
                {row.map((element, columnIndex) =>
                  element ? (
                    renderTile(element)
                  ) : (
                    <span key={`gap-${rowIndex}-${columnIndex}`} className="h-[52px] w-full" />
                  ),
                )}
              </div>
            ))}
            <div className="mb-1 flex gap-1">
              <span className="apple-lab-micro flex h-6 items-center truncate">f-block</span>
            </div>
            {/* The f-block rows keep all 18 columns (the first two are
                spacers) so the tiles stay aligned with the main grid. */}
            {rows.slice(8).map((row, rowIndex) => (
              <div key={`frow-${rowIndex}`} className="mb-1 flex gap-1">
                {row.map((element, columnIndex) =>
                  element ? (
                    renderTile(element)
                  ) : (
                    <span key={`fgap-${rowIndex}-${columnIndex}`} className="h-[52px] w-full" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="apple-lab-note mt-3">
          Search and category highlights dim the rest of the table rather than
          removing it — a periodic table that keeps its shape teaches the
          layout, and nothing jumps under your pointer.
        </p>
      </div>

      {/* Detail panel. The header tile shares its layout identity with the
          tile in the grid, so the selection *morphs* into this panel. */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        {selectedElement ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                layout
                layoutId={`element-${selectedElement.n}`}
                transition={panelTransition}
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
              </motion.div>
              <div className="min-w-0">
                <p className="apple-lab-micro truncate">{selectedElement.cat}</p>
                <h3 className="apple-lab-title mt-1 truncate text-xl">{selectedElement.name}</h3>
                <p className="apple-lab-note mt-0.5 truncate">
                  {selectedElement.mass} u · {PHASE_LABEL[selectedElement.phase]}
                </p>
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

            {/* Mini Bohr — the real shells, inline under the facts. */}
            <div className="apple-lab-card flex min-w-0 items-center gap-4 px-3 py-3">
              <div className="w-[124px] shrink-0">
                <BohrDiagram element={selectedElement} size={124} theme={theme} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="apple-lab-micro">Electron shells</p>
                <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
                  {shellsFor(selectedElement.n)
                    .map((count, index) => `${SHELL_LETTERS[index] ?? index + 1}·${count}`)
                    .join("  ")}
                </p>
                <p className="apple-lab-note mt-1.5">
                  Every ring turns on its own CSS timeline — slower the further
                  out it sits. Open Atomic Models for the labelled version.
                </p>
              </div>
            </div>

            {USES[selectedElement.n] ? (
              <div className="apple-lab-card min-w-0 px-3 py-3">
                <p className="apple-lab-micro">Where you meet it</p>
                <p className="apple-lab-note mt-1.5">{USES[selectedElement.n]}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
            <p className="apple-lab-title text-base">Pick an element</p>
            <p className="apple-lab-note max-w-xs">
              Tap any tile and it grows into this panel — mass, phase, the exact
              electron shells and a live Bohr model.
            </p>
          </div>
        )}
      </div>

      {/* Group names, so the columns mean something. */}
      <div className="apple-lab-panel apple-lab-glass min-w-0 xl:col-span-2">
        <p className="apple-lab-micro">Named groups</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GROUP_NAMES.map((name, index) =>
            name ? (
              <motion.span
                key={name}
                variants={viewVariants}
                initial="hidden"
                animate="visible"
                transition={{ ...panelTransition, delay: index * 0.02 }}
                className="apple-lab-chip !max-w-full"
              >
                <span className="apple-lab-value whitespace-nowrap text-[11px] font-semibold">
                  Group {index}
                </span>
                <span className="truncate">{name}</span>
              </motion.span>
            ) : null,
          )}
        </div>
        <AnimatePresence>
          {selectedElement && (
            <motion.p
              key="footnote"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={panelTransition}
              className="apple-lab-note mt-3"
            >
              Electron configurations are derived from the Aufbau filling order,
              so chromium and copper show the textbook ordering rather than
              their half-filled-d anomalies.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-tab 2 — Atomic Models (large labelled Bohr + switcher)
   ============================================================ */

function AtomicModelsTab({ theme }: { theme: "light" | "dark" }) {
  const [z, setZ] = useState(6);
  const element = ELEMENTS.find((el) => el.n === z) ?? ELEMENTS[0];
  const shells = useMemo(() => shellsFor(z), [z]);
  const transition = useSpringTransition();
  const stagger = useStagger(0.07);
  const catColor = theme === "light" ? CAT_COLORS[element.cat].onLight : CAT_COLORS[element.cat].on;
  const quickColor = (cat: Category) =>
    theme === "light" ? CAT_COLORS[cat].onLight : CAT_COLORS[cat].on;

  const shortlist = useMemo(
    () =>
      [1, 2, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18, 19, 20, 26, 29, 30, 47, 53, 79, 80, 82, 92].map(
        (n) => ELEMENTS.find((el) => el.n === n)!,
      ),
    [],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Atomic models</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              {element.name} — {shells.length} shell{shells.length === 1 ? "" : "s"}
            </h3>
          </div>
          <label className="apple-lab-card flex items-center gap-2 px-3 py-2">
            <span className="apple-lab-micro">Element</span>
            <select
              value={z}
              onChange={(event) => setZ(Number(event.target.value))}
              aria-label="Choose an element"
              className="max-w-[150px] cursor-pointer bg-transparent text-[12.5px] font-medium text-[var(--lab-ink)] outline-none"
            >
              {ELEMENTS.map((el) => (
                <option key={el.n} value={el.n}>
                  {el.n} — {el.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mx-auto w-full max-w-[420px] py-2">
          <BohrDiagram element={element} size={420} theme={theme} labeled />
        </div>

        <p className="apple-lab-note mt-2 text-center">
          Shells fill in Aufbau order (1s → 2s → 2p → …), grouped per principal
          shell — the Bohr picture students draw first, with the real counts.
        </p>
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
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / ((index + 1) * 10)) * 100}%` }}
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

        <div className="mt-4">
          <p className="apple-lab-micro">Quick switch</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shortlist.map((el) => {
              const active = el.n === z;
              return (
                <button
                  key={el.n}
                  type="button"
                  onClick={() => setZ(el.n)}
                  aria-pressed={active}
                  className="apple-lab-btn !px-2.5 !py-1.5 !text-[11.5px]"
                  style={{
                    borderColor: active
                      ? tint(quickColor(el.cat), "99")
                      : tint(quickColor(el.cat), "3d"),
                    background: active ? tint(quickColor(el.cat), "22") : undefined,
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: quickColor(el.cat) }}
                  />
                  {el.sym}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-tab 3 — Titration bench (decorative but believable)
   ============================================================ */

const INDICATOR_STOPS: Array<{ upTo: number; ph: number; name: string; color: string }> = [
  { upTo: 8, ph: 1.2, name: "strongly acidic", color: "#e04a3a" },
  { upTo: 16, ph: 3.1, name: "acidic", color: "#e07b30" },
  { upTo: 23.2, ph: 5.4, name: "weakly acidic", color: "#e0b83a" },
  { upTo: 24.4, ph: 7.0, name: "neutralising", color: "#58b06a" },
  { upTo: 24.9, ph: 8.3, name: "just alkaline", color: "#3f9ad0" },
  { upTo: 26, ph: 10.2, name: "alkaline", color: "#7a5fd0" },
  { upTo: 40, ph: 12.3, name: "strongly alkaline", color: "#9a4fd0" },
];

function solutionAt(volume: number) {
  const stop =
    INDICATOR_STOPS.find((entry) => volume < entry.upTo) ??
    INDICATOR_STOPS[INDICATOR_STOPS.length - 1];
  return stop;
}

function TitrationTab() {
  const transition = useSpringTransition();
  const still = useStillMotion();
  const [rate, setRate] = useState(2);
  const [running, setRunning] = useState(true);
  const [volume, setVolume] = useState(0);

  // Every second, 0.5 mL lands in the flask and every readout follows it.
  useEffect(() => {
    if (!running || still) return;
    const id = window.setInterval(() => {
      setVolume((v) => (v >= 40 ? v : v + 0.5));
    }, 1001);
    return () => window.clearInterval(id);
  }, [running, still]);

  const stop = solutionAt(volume);
  const atEndpoint = volume >= 24.9;
  const fillFraction = Math.min(1, volume / 40);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      {/* The bench */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Titration bench</p>
            <h3 className="apple-lab-title mt-1 text-lg">
              NaOH into HCl — universal indicator
            </h3>
          </div>
          <button type="button" className="apple-lab-btn" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause drip" : "Resume drip"}
          </button>
        </div>

        <svg viewBox="0 0 300 340" className="mx-auto mt-2 h-[340px] w-full max-w-[340px]" role="img" aria-label="Animated titration: a burette dripping into a flask">
          {/* Stand */}
          <line x1="52" y1="18" x2="52" y2="322" stroke="rgba(128,128,128,0.4)" strokeWidth="3" strokeLinecap="round" />
          <line x1="52" y1="30" x2="248" y2="30" stroke="rgba(128,128,128,0.4)" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="322" x2="66" y2="322" stroke="rgba(128,128,128,0.4)" strokeWidth="3" strokeLinecap="round" />

          {/* Burette */}
          <rect x="180" y="34" width="14" height="196" rx="7" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />
          {/* Titrant level inside the burette (50 mL total) — the burette
              holds plain base; the colour story happens in the flask. */}
          <motion.rect
            x="181.5"
            width="11"
            rx="5"
            fill="#7d8fa8"
            opacity="0.7"
            animate={{ y: 36 + (188 * volume) / 50, height: Math.max(2, 188 - (188 * volume) / 50) }}
            transition={transition}
          />
          {/* Burette graduations */}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={i}
              x1="180"
              y1={50 + i * 20}
              x2={i % 2 === 0 ? 194 : 190}
              y2={50 + i * 20}
              stroke="rgba(128,128,128,0.4)"
              strokeWidth="1"
            />
          ))}
          {/* Stopcock + tip */}
          <rect x="176" y="230" width="22" height="12" rx="4" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />
          <path d="M183 242 L191 242 L189 268 L185 268 Z" fill="var(--lab-fill)" stroke="rgba(128,128,128,0.45)" />

          {/* Falling drops — two beats per cycle for a believable rhythm */}
          {running && !still ? (
            <>
              <circle className="apple-lab-drop" cx="187" cy="272" r="3" fill="#7d8fa8" style={{ ["--drop-duration" as string]: `${Math.max(0.5, 2.2 / rate)}s` }} />
              <circle
                className="apple-lab-drop"
                cx="187"
                cy="272"
                r="2.6"
                fill="#7d8fa8"
                style={{
                  ["--drop-duration" as string]: `${Math.max(0.5, 2.2 / rate)}s`,
                  animationDelay: `${Math.max(0.25, 1.1 / rate)}s`,
                  opacity: 0,
                }}
              />
            </>
          ) : null}

          {/* Flask (Erlenmeyer) */}
          <path
            d="M160 292 L160 268 L172 258 L172 244 L202 244 L202 258 L214 268 L214 292 Q214 316 187 316 Q160 316 160 292 Z"
            fill="var(--lab-fill)"
            stroke="rgba(128,128,128,0.5)"
          />
          {/* Solution body — rises and recolours as base is added */}
          <motion.path
            d={`
              M ${162 + 10 * (1 - fillFraction)} ${314 - 52 * fillFraction}
              L ${214 - 10 * (1 - fillFraction)} ${314 - 52 * fillFraction}
              L 214 290 Q 214 314 187 314 Q 160 314 160 290 Z
            `}
            animate={{
              d: `
                M ${162 + 10 * (1 - fillFraction)} ${314 - 52 * fillFraction}
                L ${214 - 10 * (1 - fillFraction)} ${314 - 52 * fillFraction}
                L 214 290 Q 214 314 187 314 Q 160 314 160 290 Z
              `,
              fill: stop.color,
            }}
            transition={transition}
            opacity="0.85"
          />
          {/* Meniscus highlight on the solution surface */}
          <motion.ellipse
            cx="187"
            cy={314 - 52 * fillFraction}
            rx={20 - 8 * (1 - fillFraction)}
            ry="2.4"
            fill="#ffffff"
            opacity="0.35"
            animate={{ cy: 314 - 52 * fillFraction, rx: 20 - 8 * (1 - fillFraction) }}
            transition={transition}
          />
          {/* Splash on impact */}
          {running && !still ? (
            <motion.g
              animate={{ opacity: [0.5, 0.15, 0.5], scale: [1, 1.12, 1] }}
              transition={{ duration: Math.max(0.5, 2.2 / rate), repeat: Infinity }}
              style={{ transformBox: "view-box", transformOrigin: "187px " + (314 - 52 * fillFraction) + "px" }}
            >
              <ellipse cx="187" cy={314 - 52 * fillFraction} rx="9" ry="1.8" fill={stop.color} />
            </motion.g>
          ) : null}
        </svg>

        <div className="mt-1">
          <label className="apple-lab-card flex flex-col gap-2 px-3 py-3">
            <span className="flex items-center justify-between">
              <span className="apple-lab-micro">Drip rate</span>
              <span className="apple-lab-value text-[12px] font-semibold">{rate}×</span>
            </span>
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.5}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className="apple-lab-range"
              aria-label="Drip rate"
            />
          </label>
        </div>
        <button
          type="button"
          className="apple-lab-btn mt-3 w-full justify-center"
          onClick={() => setVolume(0)}
        >
          Reset bench
        </button>
      </div>

      {/* Live readouts */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-col gap-3">
          <div className="apple-lab-card px-4 py-3.5">
            <p className="apple-lab-micro">Volume added</p>
            <p className="apple-lab-value mt-1 text-2xl font-bold tabular-nums">
              {volume.toFixed(1)} <span className="text-[13px] font-medium text-[var(--lab-ink-dim)]">mL</span>
            </p>
          </div>
          <div className="apple-lab-card px-4 py-3.5">
            <p className="apple-lab-micro">pH of flask solution</p>
            <p className="apple-lab-value mt-1 text-2xl font-bold tabular-nums">
              {stop.ph.toFixed(1)}
            </p>
          </div>
          <div className="apple-lab-card flex items-center gap-3 px-4 py-3.5">
            <span
              className="h-9 w-9 shrink-0 rounded-full border border-white/20 shadow-inner"
              style={{ background: stop.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="apple-lab-micro">Indicator</p>
              <p className="apple-lab-value mt-0.5 truncate text-[13.5px] font-semibold">
                {stop.name}
              </p>
            </div>
          </div>
          <div className="apple-lab-card px-4 py-3.5">
            <p className="apple-lab-micro">Status</p>
            <p className="apple-lab-note mt-1">
              {atEndpoint
                ? "Past the endpoint — the flask has swung to violet and pH is climbing steeply. Reset to run it again."
                : volume >= 24.4
                  ? "Right at the endpoint — the last acid is neutralised and the colour is swinging from green to blue."
                  : volume >= 23.2
                    ? "Approaching the endpoint — the final mL cross yellow, green and blue fastest."
                    : "Base is neutralising the acid; pH creeps up slowly until the endpoint nears."}
            </p>
          </div>
          <p className="apple-lab-note">
            A decorative bench, not a simulator: the numbers are chosen to move
            together believably — the burette drains, the flask fills and the
            colour sweeps red → yellow → green → violet as pH crosses 7 at
            25 mL of 0.1 M NaOH against 25 mL of 0.1 M HCl.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-tab 4 — Reactions stage
   ============================================================ */

interface ReactionPreset {
  id: string;
  type: string;
  label: string;
  note: string;
  reactants: Array<{ formula: string; coefficient: string; color: string }>;
  products: Array<{ formula: string; coefficient: string; color: string }>;
}

const rxnColor = {
  acid: "#2aa8c4",
  base: "#8a6df0",
  metal: "#d9b13b",
  salt: "#2fb380",
  gas: "#e06278",
  oxide: "#9aa3b2",
} as const;

const REACTION_PRESETS: ReactionPreset[] = [
  {
    id: "synthesis",
    type: "Synthesis",
    label: "2 H₂ + O₂ → 2 H₂O",
    note: "Two elements combine into one compound — the oxy-hydrogen pop test.",
    reactants: [
      { formula: "H₂", coefficient: "2", color: rxnColor.gas },
      { formula: "O₂", coefficient: "1", color: rxnColor.acid },
    ],
    products: [{ formula: "H₂O", coefficient: "2", color: rxnColor.salt }],
  },
  {
    id: "decomposition",
    type: "Decomposition",
    label: "2 H₂O₂ → 2 H₂O + O₂",
    note: "One compound breaks apart into simpler ones — peroxide slowly self-decomposes.",
    reactants: [{ formula: "H₂O₂", coefficient: "2", color: rxnColor.acid }],
    products: [
      { formula: "H₂O", coefficient: "2", color: rxnColor.salt },
      { formula: "O₂", coefficient: "1", color: rxnColor.gas },
    ],
  },
  {
    id: "single",
    type: "Single displacement",
    label: "Zn + CuSO₄ → ZnSO₄ + Cu",
    note: "Zinc out-competes copper — the blue solution fades as copper plates out.",
    reactants: [
      { formula: "Zn", coefficient: "1", color: rxnColor.metal },
      { formula: "CuSO₄", coefficient: "1", color: rxnColor.acid },
    ],
    products: [
      { formula: "ZnSO₄", coefficient: "1", color: rxnColor.salt },
      { formula: "Cu", coefficient: "1", color: rxnColor.metal },
    ],
  },
  {
    id: "double",
    type: "Double displacement",
    label: "AgNO₃ + NaCl → AgCl + NaNO₃",
    note: "Ions swap partners — curdy white silver chloride precipitates.",
    reactants: [
      { formula: "AgNO₃", coefficient: "1", color: rxnColor.acid },
      { formula: "NaCl", coefficient: "1", color: rxnColor.base },
    ],
    products: [
      { formula: "AgCl", coefficient: "1", color: rxnColor.oxide },
      { formula: "NaNO₃", coefficient: "1", color: rxnColor.salt },
    ],
  },
  {
    id: "combustion",
    type: "Combustion",
    label: "CH₄ + 2 O₂ → CO₂ + 2 H₂O",
    note: "Complete combustion of methane — the clean blue Bunsen flame.",
    reactants: [
      { formula: "CH₄", coefficient: "1", color: rxnColor.gas },
      { formula: "O₂", coefficient: "2", color: rxnColor.acid },
    ],
    products: [
      { formula: "CO₂", coefficient: "1", color: rxnColor.oxide },
      { formula: "H₂O", coefficient: "2", color: rxnColor.salt },
    ],
  },
  {
    id: "acid-base",
    type: "Acid–base (neutralisation)",
    label: "HCl + NaOH → NaCl + H₂O",
    note: "Acid and base cancel to salt and water — the reaction behind every titration.",
    reactants: [
      { formula: "HCl", coefficient: "1", color: rxnColor.acid },
      { formula: "NaOH", coefficient: "1", color: rxnColor.base },
    ],
    products: [
      { formula: "NaCl", coefficient: "1", color: rxnColor.salt },
      { formula: "H₂O", coefficient: "1", color: rxnColor.salt },
    ],
  },
  {
    id: "precipitation",
    type: "Precipitation",
    label: "Pb(NO₃)₂ + 2 KI → PbI₂ + 2 KNO₃",
    note: "The 'golden rain': brilliant yellow lead iodide falls out of solution.",
    reactants: [
      { formula: "Pb(NO₃)₂", coefficient: "1", color: rxnColor.acid },
      { formula: "KI", coefficient: "2", color: rxnColor.base },
    ],
    products: [
      { formula: "PbI₂", coefficient: "1", color: rxnColor.metal },
      { formula: "KNO₃", coefficient: "2", color: rxnColor.salt },
    ],
  },
];

function MoleculeChip({
  item,
  state = "docked",
  dimmed = false,
}: {
  item: { formula: string; coefficient: string; color: string };
  state?: "docked" | "flying" | "arrived";
  dimmed?: boolean;
}) {
  const transition = useSpringTransition();
  return (
    <motion.div
      layout
      transition={transition}
      initial={false}
      animate={
        state === "flying"
          ? { opacity: 0.35, scale: 0.82, filter: "blur(1.5px)" }
          : state === "arrived"
            ? { opacity: 1, scale: [0.86, 1], filter: "blur(0px)" }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      style={dimmed ? { opacity: 0.45, filter: "saturate(0.4)" } : undefined}
      className="flex shrink-0 items-center gap-1.5"
    >
      <span className="apple-lab-value text-[12px] font-semibold">{item.coefficient}</span>
      <span
        className="rounded-xl border px-3 py-2 text-[14px] font-bold"
        style={{
          borderColor: tint(item.color, "88"),
          background: tint(item.color, "1f"),
          color: item.color,
        }}
      >
        {item.formula}
      </span>
    </motion.div>
  );
}

function ReactionsTab() {
  const transition = useSpringTransition();
  const still = useStillMotion();
  const [presetId, setPresetId] = useState(REACTION_PRESETS[0].id);
  const [runKey, setRunKey] = useState(0); // bump per React click to replay the product entrance
  const [flashKey, setFlashKey] = useState(0);
  const [flashVisible, setFlashVisible] = useState(false);
  const preset = REACTION_PRESETS.find((entry) => entry.id === presetId) ?? REACTION_PRESETS[0];

  /* One run per click: products remount (their entrance replays), the energy
     chip flashes once, and reactants dim — never a loop. */
  const react = () => {
    setRunKey((k) => k + 1);
    setFlashKey((k) => k + 1);
    setFlashVisible(true);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* Stage */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apple-lab-micro">Reactions stage</p>
            <h3 className="apple-lab-title mt-1 truncate text-lg">{preset.type}</h3>
          </div>
          <button type="button" className="apple-lab-btn" onClick={react}>
            React ▸
          </button>
        </div>

        {/* Reactants → products, one shared-layout morph per run */}
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2.5">
            {preset.reactants.map((item, index) => (
              <MoleculeChip
                key={`r-${index}`}
                item={item}
                dimmed={runKey > 0}
              />
            ))}
            <span className="apple-lab-title px-1 text-xl text-[var(--lab-ink-dim)]">→</span>
            {preset.products.map((item, index) => (
              <MoleculeChip key={`p-${runKey}-${index}`} item={item} state={runKey > 0 ? "arrived" : "docked"} dimmed={false} />
            ))}
          </div>

          {/* One energy flash per React click — a beat, not a loop. */}
          <div className="flex h-10 w-full items-center justify-center overflow-hidden">
            <AnimatePresence>
              {flashVisible ? (
                <motion.span
                  key={`flash-${flashKey}`}
                  initial={{ opacity: 0, scaleX: 0.4 }}
                  animate={{ opacity: [0, 1, 1, 0], scaleX: [0.6, 1, 1, 1] }}
                  exit={{ opacity: 0 }}
                  transition={
                    still
                      ? { duration: 0.4, times: [0, 0.5, 0.9, 1] }
                      : { duration: 1.6, times: [0, 0.2, 0.6, 1] }
                  }
                  onAnimationComplete={() => setFlashVisible(false)}
                  className="apple-lab-chip"
                  style={{ borderColor: "rgba(224,98,120,0.55)" }}
                >
                  ⚡ bonds break, bonds form — atoms are conserved
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="apple-lab-card w-full max-w-xl px-4 py-3 text-center">
            <p className="apple-lab-micro">Balanced equation</p>
            <p className="apple-lab-value mt-1 break-words text-[15px] font-bold">
              {preset.label}
            </p>
          </div>

          <p className="apple-lab-note max-w-xl text-center">{preset.note}</p>
        </div>

        <p className="apple-lab-note mt-5">
          Press <span className="apple-lab-value font-semibold">React</span> and
          the mixture crosses the arrow: coefficients stay fixed because atoms
          are never created or destroyed — only rearranged.
        </p>
      </div>

      {/* Reaction picker */}
      <div className="apple-lab-panel apple-lab-glass min-w-0">
        <p className="apple-lab-micro">Pick a reaction type</p>
        <div className="mt-3 flex flex-col gap-2">
          {REACTION_PRESETS.map((entry) => {
            const active = entry.id === presetId;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setPresetId(entry.id);
                  setRunKey(0);
                  setFlashVisible(false);
                }}
                aria-pressed={active}
                className="apple-lab-card flex min-w-0 items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors"
                style={{
                  borderColor: active ? "rgba(167,139,250,0.5)" : undefined,
                  background: active ? "rgba(167,139,250,0.09)" : undefined,
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[var(--lab-ink)]">
                    {entry.type}
                  </span>
                  <span className="apple-lab-note mt-0.5 block truncate">{entry.label}</span>
                </span>
                {active ? (
                  <motion.span
                    layoutId="reaction-picked"
                    className="h-2 w-2 shrink-0 rounded-full bg-[#a78bfa]"
                    transition={transition}
                  />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--lab-line)]" />
                )}
              </button>
            );
          })}
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
  const [selected, setSelected] = useState<number | null>(6);
  const [labTheme, setLabTheme] = useState<"dark" | "light" | null>(null);
  const transition = useSpringTransition();
  const stagger = useStagger(0.05);

  /* The bench carries its own theme: the toggle decides, dark by default so
     the chemistry room matches the lab's dark canvas until switched. */
  const theme = labTheme ?? "dark";

  return (
    <div data-lab-theme={theme} className="rounded-[28px] pb-6">
      {/* Sub-tab rail + bench theme toggle. */}
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

        <button
          type="button"
          className="apple-lab-btn !px-3 !py-2 !text-[12px]"
          onClick={() => setLabTheme(theme === "dark" ? "light" : "dark")}
          aria-label={`Switch chemistry bench to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {theme === "dark" ? "Light bench" : "Dark bench"}
          </span>
        </button>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ChemistryGlassLab;
