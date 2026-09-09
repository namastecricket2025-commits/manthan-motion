import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Droplets, FlaskConical, LayoutGrid, X } from "lucide-react";
import Atom3D from "./Atom3D";
import ReactionBench from "./ReactionBench";
import Titration from "./Titration";
import { SPRING } from "./use-canvas";
import { CAT_COLOR, ELEMENTS, GROUP_NAMES, configFor, gridPos, periodGroupOf, shellsFor } from "./periodic-data";
import type { Category, ElementData } from "./periodic-data";

type ChemTab = "table" | "bench" | "titration";

const CAT_LABEL: Record<Category, string> = {
  alkali: "Alkali metal",
  alkaline: "Alkaline earth",
  transition: "Transition metal",
  "post-transition": "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Non-metal",
  halogen: "Halogen",
  "noble gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
  synthetic: "Synthetic",
};

function ElementCell({
  el,
  dimmed,
  selected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  el: ElementData;
  dimmed: boolean;
  selected: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const color = CAT_COLOR[el.cat];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: dimmed ? 0.22 : 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileHover={{ scale: dimmed ? 1 : 1.18, zIndex: 5 }}
      className="relative flex min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1.5 text-center transition-shadow"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        borderColor: selected ? "#ff3b5c" : `${color}55`,
        background: selected
          ? "linear-gradient(160deg, rgba(255,59,92,0.22), rgba(255,59,92,0.06))"
          : `linear-gradient(160deg, ${color}26, ${color}0d)`,
        boxShadow: selected ? "0 0 18px rgba(255,59,92,0.35)" : "none",
        cursor: "pointer",
      }}
    >
      <span className="text-[8px] leading-none text-slate-400">{el.n}</span>
      <span
        className="font-display text-[13px] font-bold leading-tight sm:text-sm"
        style={{ color: selected ? "#fff" : "#e2e8f0", textShadow: selected ? "0 0 8px rgba(255,59,92,0.8)" : "none" }}
      >
        {el.sym}
      </span>
      <span className="hidden text-[7px] leading-tight text-slate-400 md:block">{el.name}</span>
    </motion.button>
  );
}

function ElementProfile({
  el,
  orbitals,
  setOrbitals,
  onClose,
  onNav,
}: {
  el: ElementData;
  orbitals: boolean;
  setOrbitals: (v: boolean) => void;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
}) {
  const idx = ELEMENTS.findIndex((e) => e.n === el.n);
  const shells = useMemo(() => shellsFor(el.n), [el.n]);
  const pg = periodGroupOf(el.n);
  const color = CAT_COLOR[el.cat];
  const outer = shells[shells.length - 1] ?? 0;

  return (
    <div className="lab-glass-deep flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 flex-col items-center justify-center rounded-xl border"
            style={{ borderColor: `${color}77`, background: `linear-gradient(160deg, ${color}33, ${color}11)` }}
          >
            <span className="text-[9px] text-slate-400">{el.n}</span>
            <span className="font-display text-lg font-bold text-white">{el.sym}</span>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">{el.name}</h3>
            <p className="text-[11px] text-slate-400">{CAT_LABEL[el.cat]} · {el.phase === "synthetic" ? "synthetic" : `${el.phase} at STP`}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onNav(-1)} className="lab-btn !px-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onNav(1)} className="lab-btn !px-2">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="lab-btn !px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="lab-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* 3D atom */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="lab-label">Interactive 3D atom — {el.name}</p>
            <button
              type="button"
              onClick={() => setOrbitals(!orbitals)}
              className="lab-btn"
              style={orbitals ? { borderColor: "rgba(255,59,92,0.5)", color: "#fff", background: "rgba(255,59,92,0.12)" } : undefined}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${orbitals ? "bg-[#ff3b5c] shadow-[0_0_6px_rgba(255,59,92,0.9)]" : "bg-slate-600"}`} />
              3D quantum orbitals
            </button>
          </div>
          <Atom3D z={el.n} shells={shells} symbol={el.sym} orbitals={orbitals} />
        </div>

        {/* properties */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { k: "Atomic mass", v: `${el.mass} u` },
            { k: "Period / group", v: pg.group ? `${pg.period} / ${pg.group}` : `${pg.period} (f-block)` },
            { k: "Block", v: shells.length ? `outer shell · ${outer} e⁻` : "—" },
          ].map((r) => (
            <div key={r.k} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <p className="lab-label">{r.k}</p>
              <p className="lab-value mt-1 text-[13px]">{r.v}</p>
            </div>
          ))}
        </div>

        {/* shells */}
        <div>
          <p className="lab-label mb-1.5">Electron shells (K, L, M, …)</p>
          <div className="flex flex-wrap gap-1.5">
            {shells.map((c, i) => (
              <span key={i} className="lab-chip">
                {String.fromCharCode(75 + i)}: <span className="lab-value text-slate-200">{c}</span>
              </span>
            ))}
          </div>
        </div>

        {/* configuration */}
        <div>
          <p className="lab-label mb-1.5">Ground-state configuration</p>
          <code className="lab-value block rounded-xl border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed">
            {configFor(el.n)}
          </code>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          Configuration follows the Aufbau filling order (1s, 2s, 2p, 3s, 3p, 4s, 3d …) — for
          chromium and copper the real ground state has a half/full-filled d-subshell, which this
          textbook ordering approximates.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
        <span className="text-[10px] text-slate-500">{idx + 1} / 118 · navigate with the arrows</span>
        <span className="lab-chip">drag · scroll · right-drag</span>
      </div>
    </div>
  );
}

export default function ChemistryWorkspace() {
  const [tab, setTab] = useState<ChemTab>("table");
  const [selected, setSelected] = useState<ElementData | null>(null);
  const [hover, setHover] = useState<{ group: number | null; family: string | null } | null>(null);
  const [orbitals, setOrbitals] = useState(false);

  const isDimmed = (el: ElementData) => {
    if (!hover) return false;
    if (hover.group !== null) return periodGroupOf(el.n).group !== hover.group;
    if (hover.family) {
      if (hover.family === "lanthanide") return el.cat !== "lanthanide";
      if (hover.family === "actinide") return el.cat !== "actinide";
    }
    return false;
  };

  const onHoverEl = (el: ElementData) => {
    const pg = periodGroupOf(el.n);
    if (pg.group !== null) setHover({ group: pg.group, family: null });
    else setHover({ group: null, family: el.cat === "lanthanide" ? "lanthanide" : "actinide" });
  };

  const navSelected = (dir: 1 | -1) => {
    setSelected((cur) => {
      if (!cur) return cur;
      const i = ELEMENTS.findIndex((e) => e.n === cur.n);
      const next = ELEMENTS[Math.min(ELEMENTS.length - 1, Math.max(0, i + dir))];
      return next ?? cur;
    });
  };

  const groupChip = hover?.group ? GROUP_NAMES[hover.group] : hover?.family === "lanthanide" ? "Lanthanide series" : hover?.family === "actinide" ? "Actinide series" : null;

  // cells per row for the main grid
  const cells = useMemo(() => {
    const rows: (ElementData | null)[][] = [];
    for (let r = 1; r <= 7; r++) {
      const row: (ElementData | null)[] = [];
      for (let c = 1; c <= 18; c++) {
        const el = ELEMENTS.find((e) => {
          const p = gridPos(e.n);
          return p.row === r && p.col === c;
        });
        row.push(el ?? null);
      }
      rows.push(row);
    }
    const lanth: (ElementData | null)[] = [];
    const act: (ElementData | null)[] = [];
    for (let c = 1; c <= 18; c++) {
      lanth.push(ELEMENTS.find((e) => gridPos(e.n).row === 9 && gridPos(e.n).col === c) ?? null);
      act.push(ELEMENTS.find((e) => gridPos(e.n).row === 10 && gridPos(e.n).col === c) ?? null);
    }
    return { rows, lanth, act };
  }, []);

  const table = (
    <div className="min-w-0 transition-all duration-500">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-100">Periodic table</p>
          <p className="text-[11px] text-slate-500">
            {hover && groupChip ? (
              <span className="text-[#ff647c]">{groupChip} highlighted</span>
            ) : (
              "Hover a group · click an element for its 3D profile"
            )}
          </p>
        </div>
        <span className="lab-chip hidden sm:inline-flex">118 elements · real data</span>
      </div>

      <div className="lab-scroll overflow-x-auto pb-2">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(18, minmax(34px, 1fr))", minWidth: 760 }}>
          {/* group numbers */}
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="pb-0.5 text-center">
              <span className="text-[8px] text-slate-600">{i + 1}</span>
            </div>
          ))}
          {cells.rows.map((row, ri) =>
            row.map((el, ci) =>
              el ? (
                <div key={el.n}>
                  <ElementCell
                    el={el}
                    dimmed={isDimmed(el)}
                    selected={selected?.n === el.n}
                    onClick={() => {
                      setSelected(el);
                      setOrbitals(false);
                    }}
                    onMouseEnter={() => onHoverEl(el)}
                    onMouseLeave={() => setHover(null)}
                  />
                </div>
              ) : (
                <div key={`${ri}-${ci}`} />
              ),
            ),
          )}
          {/* f-block spacer + rows */}
          <div className="col-span-18 h-3" />
          <div className="col-span-1" />
          <div className="col-span-1 flex items-center justify-center">
            <span className="rotate-180 text-[8px] tracking-wider text-slate-500" style={{ writingMode: "vertical-rl" }}>
              57–71
            </span>
          </div>
          {cells.lanth.map((el, ci) =>
            el ? (
              <div key={el.n}>
                <ElementCell el={el} dimmed={isDimmed(el)} selected={selected?.n === el.n} onClick={() => setSelected(el)} onMouseEnter={() => onHoverEl(el)} onMouseLeave={() => setHover(null)} />
              </div>
            ) : (
              <div key={`l${ci}`} />
            ),
          )}
          <div className="col-span-18 h-1" />
          <div className="col-span-1" />
          <div className="col-span-1 flex items-center justify-center">
            <span className="rotate-180 text-[8px] tracking-wider text-slate-500" style={{ writingMode: "vertical-rl" }}>
              89–103
            </span>
          </div>
          {cells.act.map((el, ci) =>
            el ? (
              <div key={el.n}>
                <ElementCell el={el} dimmed={isDimmed(el)} selected={selected?.n === el.n} onClick={() => setSelected(el)} onMouseEnter={() => onHoverEl(el)} onMouseLeave={() => setHover(null)} />
              </div>
            ) : (
              <div key={`a${ci}`} />
            ),
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* sub-tabs */}
      <div className="lab-tabs">
        {(
          [
            { key: "table", label: "Periodic table", icon: LayoutGrid },
            { key: "bench", label: "Reaction bench", icon: FlaskConical },
            { key: "titration", label: "Titration", icon: Droplets },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="lab-tab">
              {active && <motion.span layoutId="chem-sub-pill" className="lab-pill" transition={SPRING} />}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#ff647c]" : "text-slate-500"}`} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "table" && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className={selected ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]" : ""}>
              {table}

              {/* desktop: morph-in side panel */}
              <AnimatePresence>
                {selected && (
                  <motion.aside
                    key="desk-profile"
                    initial={{ opacity: 0, x: 48, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.98 }}
                    transition={SPRING}
                    className="hidden h-[560px] lg:block"
                  >
                    <ElementProfile el={selected} orbitals={orbitals} setOrbitals={setOrbitals} onClose={() => setSelected(null)} onNav={navSelected} />
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>

            {/* mobile: immersive overlay */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  key="mobile-profile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md lg:hidden"
                  onClick={() => setSelected(null)}
                >
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={SPRING}
                    className="absolute inset-2 rounded-2xl sm:inset-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ElementProfile el={selected} orbitals={orbitals} setOrbitals={setOrbitals} onClose={() => setSelected(null)} onNav={navSelected} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === "bench" && (
          <motion.div
            key="bench"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <ReactionBench />
          </motion.div>
        )}

        {tab === "titration" && (
          <motion.div
            key="titration"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <Titration />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}