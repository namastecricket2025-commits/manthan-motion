import {
  CAT_COLOR,
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
import { useSpringTransition, useStagger, viewVariants } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

/**
 * Chemistry — a frosted periodic table and an interactive Bohr model.
 *
 * The table is a glass grid: each tile carries only a 1px border tinted by its
 * category (plus a whisper of the same colour in its glow), never an opaque
 * neon block. Selecting an element does not open a popup — the tile's identity
 * is a shared layout element, so it *scales up into* the detail panel while
 * the slot it left behind fades out.
 *
 * The Bohr model draws the real electron grouping (Aufbau per principal shell)
 * with each shell orbiting continuously on its own CSS timeline, and the
 * shells arriving in a short stagger when an element is chosen.
 */

const PHASE_LABEL: Record<string, string> = {
  solid: "Solid at STP",
  liquid: "Liquid at STP",
  gas: "Gas at STP",
  synthetic: "Synthetic",
};

const CATEGORIES = Object.keys(CAT_COLOR) as Category[];

/** 24% tint for a resting border, 55% for an active one. */
const tint = (hex: string, alpha: string) => `${hex}${alpha}`;

function shellRadius(index: number) {
  return 44 + index * 23;
}

function BohrModel({ element }: { element: ElementData }) {
  const transition = useSpringTransition();
  const stagger = useStagger(0.09);
  const shells = useMemo(() => shellsFor(element.n), [element.n]);
  const [focused, setFocused] = useState<number | null>(null);
  const color = CAT_COLOR[element.cat];
  const LETTERS = ["K", "L", "M", "N", "O", "P", "Q"];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,300px)_1fr]">
      <svg
        viewBox="0 0 320 320"
        className="h-[280px] w-full"
        role="img"
        aria-label={`Bohr model of ${element.name} with ${shells.length} electron shells`}
      >
        <circle cx={160} cy={160} r={150} fill="none" stroke="rgba(255,255,255,0.05)" />
        <motion.circle
          cx={160}
          cy={160}
          r={26}
          fill={tint(color, "33")}
          stroke={tint(color, "88")}
          strokeWidth={1}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transition}
          style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
        />
        <text x={160} y={156} fontSize={15} fontWeight={700} fill="rgba(255,255,255,0.92)" textAnchor="middle">
          {element.sym}
        </text>
        <text x={160} y={172} fontSize={9.5} fill="rgba(255,255,255,0.66)" textAnchor="middle">
          Z {element.n}
        </text>

        {shells.map((count, index) => {
          const radius = shellRadius(index);
          const duration = 14 + index * 7;
          return (
            <motion.g
              key={`shell-${index}`}
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...transition, delay: stagger(index) }}
              style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
              onMouseEnter={() => setFocused(index)}
              onMouseLeave={() => setFocused(null)}
            >
              <circle
                cx={160}
                cy={160}
                r={radius}
                fill="none"
                stroke={focused === index ? tint(color, "aa") : "rgba(255,255,255,0.12)"}
                strokeWidth={focused === index ? 1.4 : 1}
                strokeDasharray="3 7"
              />
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
                      cx={160 + Math.cos(angle) * radius}
                      cy={160 + Math.sin(angle) * radius}
                      r={3.4}
                      fill={focused === index ? "#ffffff" : tint(color, "ee")}
                    />
                  );
                })}
              </g>
            </motion.g>
          );
        })}
      </svg>

      <div className="flex flex-col gap-3">
        <p className="apple-lab-micro">Electron grouping</p>
        <ul className="flex flex-wrap gap-2">
          {shells.map((count, index) => (
            <motion.li
              key={`label-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: stagger(index) }}
              className="apple-lab-card flex min-w-[76px] flex-col gap-0.5 px-3 py-2"
              onMouseEnter={() => setFocused(index)}
              onMouseLeave={() => setFocused(null)}
            >
              <span className="apple-lab-micro">Shell {LETTERS[index] ?? index + 1}</span>
              <span className="apple-lab-value text-[15px] font-semibold">{count} e-</span>
            </motion.li>
          ))}
        </ul>
        <p className="apple-lab-note">
          {focused === null
            ? "Hover a ring or a shell card to isolate that energy level. Each ring turns on its own timeline, slower the further out it sits."
            : `Shell ${LETTERS[focused] ?? focused + 1} carries ${shells[focused]} electrons — ${shells[focused]} of the ${element.n} in a neutral ${element.name} atom.`}
        </p>
        <div className="apple-lab-card px-3 py-2.5">
          <p className="apple-lab-micro">Ground-state configuration</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">{configFor(element.n)}</p>
        </div>
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-lab-card px-3 py-2.5">
      <p className="apple-lab-micro">{label}</p>
      <p className="apple-lab-value mt-1 text-[13px] font-semibold">{value}</p>
    </div>
  );
}

export function ChemistryGlassLab() {
  const transition = useSpringTransition();
  const [selected, setSelected] = useState<number | null>(6);
  const [hoverCategory, setHoverCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");

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

  const selectedElement = selected === null ? null : ELEMENTS.find((el) => el.n === selected) ?? null;

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

  const renderTile = (element: ElementData) => {
    const color = CAT_COLOR[element.cat];
    const isSelected = element.n === selected;
    const faint = dimmed(element);
    return (
      <motion.button
        key={element.n}
        type="button"
        /* The tile's identity is the shared layout element the detail panel
           morphs out of, so this is where the layout id lives. */
        layoutId={`element-${element.n}`}
        onClick={() => setSelected(element.n)}
        aria-label={`${element.name}, atomic number ${element.n}`}
        aria-pressed={isSelected}
        whileHover={{ scale: 1.05 }}
        transition={transition}
        className="apple-lab-tile h-11 w-full"
        style={{
          borderColor: isSelected ? tint(color, "aa") : tint(color, hoverCategory === element.cat ? "77" : "44"),
          boxShadow: isSelected
            ? `0 0 22px -6px ${tint(color, "aa")}`
            : hoverCategory === element.cat
              ? `0 0 18px -8px ${tint(color, "88")}`
              : "none",
          opacity: faint ? 0.28 : isSelected ? 0.42 : 1,
        }}
      >
        <span className="text-[9px] leading-none" style={{ color: "rgba(255,255,255,0.58)" }}>
          {element.n}
        </span>
        <span className="text-[12.5px] font-semibold leading-none" style={{ color: "rgba(255,255,255,0.92)" }}>
          {element.sym}
        </span>
        <span className="hidden max-w-full truncate px-0.5 text-[8.5px] leading-none md:block" style={{ color: "rgba(255,255,255,0.6)" }}>
          {element.name}
        </span>
      </motion.button>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="apple-lab-micro">Periodic table</p>
            <h3 className="apple-lab-title mt-1 text-lg">118 elements, one glass grid</h3>
          </div>
          <label className="apple-lab-card flex items-center gap-2 px-3 py-2">
            <span className="apple-lab-micro">Find</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="name or symbol"
              className="w-32 bg-transparent text-[12.5px] text-[var(--lab-ink)] outline-none placeholder:text-[rgba(255,255,255,0.42)]"
            />
          </label>
        </div>

        {/* Category legend doubles as a highlight switch. */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onMouseEnter={() => setHoverCategory(category)}
              onMouseLeave={() => setHoverCategory(null)}
              onClick={() =>
                setHoverCategory((current) => (current === category ? null : category))
              }
              className="apple-lab-chip !py-1"
              style={{
                borderColor: tint(CAT_COLOR[category], hoverCategory === category ? "99" : "3d"),
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: CAT_COLOR[category] }}
              />
              {category === "post-transition" ? "post-transition metal" : category}
            </button>
          ))}
        </div>

        <div className="apple-lab-scroll mt-4 overflow-x-auto pb-1">
          <div className="min-w-[720px]">
            {rows.slice(0, 7).map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="mb-1 flex gap-1">
                {row.map((element, columnIndex) =>
                  element ? (
                    renderTile(element)
                  ) : (
                    <span key={`gap-${rowIndex}-${columnIndex}`} className="h-11 w-full" />
                  ),
                )}
              </div>
            ))}
            <div className="mb-1 flex gap-1">
              <span className="apple-lab-micro flex h-6 items-center">f-block</span>
            </div>
            {/* The f-block rows keep all 18 columns (the first two are
                spacers) so the tiles stay aligned with the main grid. */}
            {rows.slice(8).map((row, rowIndex) => (
              <div key={`frow-${rowIndex}`} className="mb-1 flex gap-1">
                {row.map((element, columnIndex) =>
                  element ? (
                    renderTile(element)
                  ) : (
                    <span key={`fgap-${rowIndex}-${columnIndex}`} className="h-11 w-full" />
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
      <div className="apple-lab-panel apple-lab-glass">
        {selectedElement ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                layout
                layoutId={`element-${selectedElement.n}`}
                transition={transition}
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border"
                style={{
                  borderColor: tint(CAT_COLOR[selectedElement.cat], "aa"),
                  background: tint(CAT_COLOR[selectedElement.cat], "2e"),
                }}
              >
                <span className="text-[15px] font-bold leading-none text-[var(--lab-ink)]">
                  {selectedElement.sym}
                </span>
                <span className="mt-1 text-[9px] leading-none text-[var(--lab-ink-dim)]">
                  {selectedElement.n}
                </span>
              </motion.div>
              <div className="min-w-0">
                <p className="apple-lab-micro">{selectedElement.cat}</p>
                <h3 className="apple-lab-title mt-1 truncate text-xl">{selectedElement.name}</h3>
                <p className="apple-lab-note mt-0.5">
                  {selectedElement.mass} u · {PHASE_LABEL[selectedElement.phase]}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <FactRow label="Period / group" value={`${periodGroupOf(selectedElement.n).period} / ${periodGroupOf(selectedElement.n).group ?? "f-block"}`} />
              <FactRow label="Density" value={physFor(selectedElement.n).density ?? "not measured"} />
              <FactRow
                label="Melting point"
                value={
                  physFor(selectedElement.n).mp === null
                    ? "not measured"
                    : `${physFor(selectedElement.n).mp} °C`
                }
              />
              <FactRow
                label="Boiling point"
                value={
                  physFor(selectedElement.n).bp === null
                    ? "not measured"
                    : `${physFor(selectedElement.n).bp} °C`
                }
              />
              <FactRow
                label="Electronegativity"
                value={
                  physFor(selectedElement.n).en === null
                    ? "not measured"
                    : physFor(selectedElement.n).en!.toFixed(2)
                }
              />
              <FactRow
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

            <BohrModel element={selectedElement} />

            {USES[selectedElement.n] ? (
              <div className="apple-lab-card px-3 py-3">
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
      <div className="apple-lab-panel apple-lab-glass lg:col-span-2">
        <p className="apple-lab-micro">Named groups</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GROUP_NAMES.map((name, index) =>
            name ? (
              <motion.span
                key={name}
                variants={viewVariants}
                initial="hidden"
                animate="visible"
                transition={{ ...transition, delay: index * 0.02 }}
                className="apple-lab-chip"
              >
                <span className="apple-lab-value text-[11px] font-semibold">Group {index}</span>
                {name}
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
              transition={transition}
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

export default ChemistryGlassLab;
