import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Droplets, FlaskConical, LayoutGrid, Search, X } from "lucide-react";
import { gsap } from "gsap";
import Atom3D from "./Atom3D";
import ReactionBench from "./ReactionBench";
import Titration from "./Titration";
import { SPRING } from "./use-canvas";
import { CAT_COLOR, ELEMENTS, GROUP_NAMES, USES, configFor, gridPos, periodGroupOf, physFor, shellsFor } from "./periodic-data";
import type { Category, ElementData, Phase } from "./periodic-data";

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

const PHASE_DOT: Record<Phase, string> = {
  solid: "bg-slate-400",
  liquid: "bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.9)]",
  gas: "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]",
  synthetic: "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.9)]",
};

const PHASE_LABEL: Record<Phase, string> = {
  solid: "Solid",
  liquid: "Liquid",
  gas: "Gas",
  synthetic: "Synthetic",
};

/** GSAP-powered number that counts up when it mounts/updates. */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: to,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.v)}${suffix}`;
      },
    });
    return () => {
      tween.kill();
    };
  }, [to, suffix]);
  return <span ref={ref}>0</span>;
}

/* ---------------- cells (memoised — no re-animation on hover) ---------------- */
const ElementCell = memo(function ElementCell({
  el,
  dimmed,
  selected,
  onEnter,
  onLeave,
  onClick,
}: {
  el: ElementData;
  dimmed: boolean;
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const color = CAT_COLOR[el.cat];
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`relative flex min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1.5 text-center transition-all duration-200 ${
        dimmed
          ? "opacity-15"
          : "hover:z-10 hover:scale-[1.18] hover:shadow-[0_0_18px_rgba(255,59,92,0.35)]"
      }`}
      style={{
        borderColor: selected ? "#ff3b5c" : `${color}55`,
        background: selected
          ? "linear-gradient(160deg, rgba(255,59,92,0.22), rgba(255,59,92,0.06))"
          : `linear-gradient(160deg, ${color}26, ${color}0d)`,
        boxShadow: selected ? "0 0 18px rgba(255,59,92,0.35)" : "none",
        cursor: "pointer",
      }}
    >
      <span className="absolute left-0.5 top-0.5 text-[8px] leading-none text-slate-500">{el.n}</span>
      <span className={`absolute right-0.5 top-0.5 h-1 w-1 rounded-full ${PHASE_DOT[el.phase]}`} title={PHASE_LABEL[el.phase]} />
      <span
        className="font-display text-[13px] font-bold leading-tight sm:text-sm"
        style={{
          color: "var(--lab-cell-ink)",
          textShadow: selected ? "0 0 8px rgba(255,59,92,0.8)" : "none",
        }}
      >
        {el.sym}
      </span>
      <span className="hidden text-[7px] leading-tight text-slate-500 md:block">{el.name}</span>
    </button>
  );
});

/* ---------------- immersive profile ---------------- */
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
  const ph = physFor(el.n);
  const color = CAT_COLOR[el.cat];
  const outer = shells[shells.length - 1] ?? 0;
  const useNote = USES[el.n];

  const rows = [
    { k: "Atomic mass", v: `${el.mass} u` },
    { k: "Density", v: ph.density ?? "—" },
    { k: "Melting point", v: ph.mp !== null ? `${ph.mp.toLocaleString()} °C` : "—" },
    { k: "Boiling point", v: ph.bp !== null ? `${ph.bp.toLocaleString()} °C` : "—" },
    { k: "Electronegativity", v: ph.en !== null ? ph.en.toFixed(2) : "—" },
    { k: "Period / group", v: pg.group ? `${pg.period} / ${pg.group}` : `${pg.period} (f-block)` },
    { k: "Block", v: shells.length ? `outer shell · ${outer} e⁻` : "—" },
    { k: "Discovered", v: ph.year === null ? "—" : ph.year === 0 ? "Antiquity" : String(ph.year) },
  ];

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
            <p className="text-[11px] text-slate-400">
              {CAT_LABEL[el.cat]} · {el.phase === "synthetic" ? "synthetic" : `${el.phase} at STP`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onNav(-1)} className="lab-btn !px-2" aria-label="Previous element">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onNav(1)} className="lab-btn !px-2" aria-label="Next element">
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rows.map((r) => (
            <div key={r.k} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <p className="lab-label">{r.k}</p>
              <p className="lab-value mt-1 text-[12.5px]">{r.v}</p>
            </div>
          ))}
        </div>

        {useNote && (
          <div className="rounded-xl border border-[#ff3b5c]/25 bg-[#ff3b5c]/5 p-3">
            <p className="lab-label mb-1 text-[#ff647c]">Where you meet it</p>
            <p className="text-[12px] leading-relaxed text-slate-300">{useNote}</p>
          </div>
        )}

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
          textbook ordering approximates. Density and phase are at STP; values shown as "—" are not
          reliably measured (mostly superheavy synthetics).
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
        <span className="text-[10px] text-slate-500">{idx + 1} / 118 · navigate with the arrows</span>
        <span className="lab-chip">drag · scroll · right-drag</span>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
export default function ChemistryWorkspace() {
  const [tab, setTab] = useState<ChemTab>("table");
  const [selected, setSelected] = useState<ElementData | null>(null);
  const [hover, setHover] = useState<{ group: number | null; family: string | null } | null>(null);
  const [orbitals, setOrbitals] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");

  const isDimmed = useCallback(
    (el: ElementData) => {
      if (hover) {
        if (hover.group !== null) {
          if (periodGroupOf(el.n).group !== hover.group) return true;
        } else if (hover.family === "lanthanide" && el.cat !== "lanthanide") return true;
        else if (hover.family === "actinide" && el.cat !== "actinide") return true;
      }
      if (catFilter !== "all" && el.cat !== catFilter) return true;
      const q = query.trim().toLowerCase();
      if (q && !el.name.toLowerCase().includes(q) && !el.sym.toLowerCase().includes(q)) return true;
      return false;
    },
    [hover, catFilter, query],
  );

  const onHoverEl = useCallback((el: ElementData) => {
    const pg = periodGroupOf(el.n);
    if (pg.group !== null) setHover({ group: pg.group, family: null });
    else setHover({ group: null, family: el.cat === "lanthanide" ? "lanthanide" : "actinide" });
  }, []);

  const onLeaveEl = useCallback(() => setHover(null), []);

  const navSelected = (dir: 1 | -1) => {
    setSelected((cur) => {
      if (!cur) return cur;
      const i = ELEMENTS.findIndex((e) => e.n === cur.n);
      const next = ELEMENTS[Math.min(ELEMENTS.length - 1, Math.max(0, i + dir))];
      return next ?? cur;
    });
  };

  const groupChip =
    hover?.group ? GROUP_NAMES[hover.group] : hover?.family === "lanthanide" ? "Lanthanide series" : hover?.family === "actinide" ? "Actinide series" : null;

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

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of ELEMENTS) counts[el.cat] = (counts[el.cat] ?? 0) + 1;
    return counts;
  }, []);

  const phaseCounts = useMemo(() => {
    let solid = 0;
    let liquid = 0;
    let gas = 0;
    for (const el of ELEMENTS) {
      if (el.phase === "solid") solid++;
      else if (el.phase === "liquid") liquid++;
      else gas++;
    }
    return { solid, liquid, gas };
  }, []);

  const renderCell = (el: ElementData, key: string) => (
    <ElementCell
      key={key}
      el={el}
      dimmed={isDimmed(el)}
      selected={selected?.n === el.n}
      onClick={() => {
        setSelected(el);
        setOrbitals(false);
      }}
      onEnter={() => onHoverEl(el)}
      onLeave={onLeaveEl}
    />
  );

  const table = (
    <div className="min-w-0 transition-all duration-500">
      {/* header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or symbol…"
            className="lab-search"
            style={{ width: 190 }}
          />
        </div>
      </div>

      {/* stats bar */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="lab-stat">
          <p className="lab-label">Elements</p>
          <p className="lab-value mt-1 text-sm text-[#ff647c]">
            <CountUp to={ELEMENTS.length} />
          </p>
        </div>
        <div className="lab-stat">
          <p className="lab-label">Categories</p>
          <p className="lab-value mt-1 text-sm"><CountUp to={Object.keys(CAT_LABEL).length} /></p>
        </div>
        <div className="lab-stat">
          <p className="lab-label">Naturally found</p>
          <p className="lab-value mt-1 text-sm">
            <CountUp to={90} suffix="%" />
          </p>
        </div>
        <div className="lab-stat">
          <p className="lab-label">States at STP</p>
          <p className="lab-value mt-1 text-[12px] leading-tight">
            <span className="text-emerald-300">{phaseCounts.solid} solid</span> · <span className="text-cyan-300">{phaseCounts.liquid} liquid</span> · <span className="text-amber-300">{phaseCounts.gas} gas</span>
          </p>
        </div>
      </div>

      {/* category filter */}
      <div className="lab-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCatFilter("all")}
          className={`lab-chip shrink-0 !cursor-pointer ${catFilter === "all" ? "!border-[#ff3b5c]/60 !text-[#ff647c]" : ""}`}
        >
          All
        </button>
        {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCatFilter(catFilter === c ? "all" : c)}
            className={`lab-chip shrink-0 !cursor-pointer ${catFilter === c ? "!border-[#ff3b5c]/60 !text-[#ff647c]" : ""}`}
            style={catFilter === c ? undefined : { ["--tile-c" as string]: CAT_COLOR[c] }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CAT_COLOR[c] }} />
            {CAT_LABEL[c]}
            <span className="text-slate-500">{catCounts[c]}</span>
          </button>
        ))}
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
                renderCell(el, `r${ri}-${el.n}`)
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
          {cells.lanth.map((el, ci) => (el ? renderCell(el, `l${el.n}`) : <div key={`l${ci}`} />))}
          <div className="col-span-18 h-1" />
          <div className="col-span-1" />
          <div className="col-span-1 flex items-center justify-center">
            <span className="rotate-180 text-[8px] tracking-wider text-slate-500" style={{ writingMode: "vertical-rl" }}>
              89–103
            </span>
          </div>
          {cells.act.map((el, ci) => (el ? renderCell(el, `a${el.n}`) : <div key={`a${ci}`} />))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLOR[c] }} />
            {CAT_LABEL[c]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-2 w-2 rounded-full border border-slate-500" />
          phase dot: <span className="bg-emerald-400/80">gas</span> · <span className="bg-cyan-400/80">liquid</span> · <span className="bg-slate-400/80">solid</span> · <span className="bg-amber-400/80">synthetic</span>
        </span>
      </div>
    </div>
  );

  return (
    <div className="lab-col">
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
            className="lab-col"
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
                    className="hidden h-[600px] lg:block"
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