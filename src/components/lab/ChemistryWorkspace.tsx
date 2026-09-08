import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Atom, Beaker, FlaskConical, Layers, Sigma } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  blockFor,
  CAT_COLOR,
  configFor,
  ELEMENTS,
  gridPos,
  GROUP_NAMES,
  periodGroupOf,
  shellsFor,
  type ElementData,
} from "./periodic-data";
import { REACTIONS, SUBSTANCES, type Substance } from "./reactions";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Renders "2 H2 + O2 -> 2 H2O" with proper subscripts and an arrow. */
function Fmt({ text }: { text: string }) {
  const tokens = text.match(/(\d+)|([^\d]+)/g) ?? [];
  const out: ReactNode[] = [];
  let prev = "";
  tokens.forEach((tok, i) => {
    if (/^\d+$/.test(tok)) {
      out.push(
        prev !== "" && /[A-Za-z)]/.test(prev) ? (
          <sub key={i} className="text-[0.72em]">
            {tok}
          </sub>
        ) : (
          <span key={i}>{tok}</span>
        ),
      );
    } else {
      out.push(<span key={i}>{tok}</span>);
      prev = tok[tok.length - 1] ?? "";
    }
  });
  return <>{out}</>;
}

const PHASE_LABEL: Record<ElementData["phase"], { label: string; color: string }> = {
  solid: { label: "Solid", color: "#8a7a52" },
  liquid: { label: "Liquid", color: "#4f7f8a" },
  gas: { label: "Gas", color: "#3f7d96" },
  synthetic: { label: "Synthetic", color: "#6f6a6a" },
};

/** Bohr-style shell diagram — nucleus + electron rings. */
function BohrDiagram({ el, size = 210 }: { el: ElementData; size?: number }) {
  const shells = shellsFor(el.n);
  const color = CAT_COLOR[el.cat];
  const c = size / 2;
  const nucleusR = el.n > 20 ? 17 : 14;
  const ringBase = nucleusR + 14;
  const ringStep = Math.min(26, (size / 2 - ringBase - 8) / Math.max(1, shells.length - 1) || 24);
  const total = shells.reduce((a, b) => a + b, 0);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full">
      {/* soft glow behind the atom */}
      <circle cx={c} cy={c} r={c * 0.9} fill={color} opacity="0.06" />
      {shells.map((count, i) => {
        const r = ringBase + i * ringStep;
        const dots: { x: number; y: number }[] = [];
        for (let k = 0; k < count; k++) {
          // golden-angle spacing + per-index offset keeps dots off each other
          const a = (k * 2.39996 + i * 0.7) * Math.PI;
          dots.push({ x: c + r * Math.cos(a), y: c + r * Math.sin(a) });
        }
        return (
          <g key={i}>
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="color-mix(in srgb, var(--text-dim) 35%, transparent)"
              strokeWidth="1"
              strokeDasharray={i === shells.length - 1 ? "none" : "3 4"}
            />
            {dots.map((d, k) => (
              <circle
                key={k}
                cx={d.x}
                cy={d.y}
                r={total > 40 ? 2.6 : 3.2}
                fill={color}
                opacity={0.9}
              />
            ))}
          </g>
        );
      })}
      {/* nucleus */}
      <circle cx={c} cy={c} r={nucleusR} fill="color-mix(in srgb, var(--text-main) 14%, transparent)" stroke={color} strokeWidth="1.5" />
      <text
        x={c}
        y={c + 4}
        textAnchor="middle"
        fontSize={el.n > 40 ? 12 : 14}
        fontWeight="700"
        fill="var(--text-main)"
      >
        {el.sym}
      </text>
      <text x={c} y={c + nucleusR + 12} textAnchor="middle" fontSize="8" fill="var(--text-dim)">
        {el.n} p⁺
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Periodic table                                                      */
/* ------------------------------------------------------------------ */

function PeriodicTable({ onPick, selected }: { onPick: (el: ElementData) => void; selected: number | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const main = ELEMENTS.filter((el) => gridPos(el.n).row <= 7);
  const lanth = ELEMENTS.filter((el) => gridPos(el.n).row === 9);
  const actin = ELEMENTS.filter((el) => gridPos(el.n).row === 10);

  const hoverEl = hovered !== null ? ELEMENTS.find((e) => e.n === hovered) ?? null : null;
  const hoverPos = hoverEl ? gridPos(hoverEl.n) : null;
  const hoverIsF = hoverPos !== null && hoverPos.row >= 9;

  // column highlight: same group column (or same f-block family)
  const inGroup = (el: ElementData) => {
    if (!hoverPos || !hoverEl) return false;
    const pos = gridPos(el.n);
    if (hoverIsF) return pos.row >= 9 && el.cat === hoverEl.cat;
    return pos.row <= 7 && pos.col === hoverPos.col;
  };

  const hoverGroupName =
    hoverEl && hoverPos
      ? hoverIsF
        ? hoverEl.cat === "lanthanide"
          ? "Lanthanides (4f block)"
          : "Actinides (5f block)"
        : `Group ${hoverPos.col}${GROUP_NAMES[hoverPos.col] ? ` — ${GROUP_NAMES[hoverPos.col]}` : ""}`
      : null;

  const Cell = ({ el }: { el: ElementData }) => {
    const color = CAT_COLOR[el.cat];
    const active = selected === el.n;
    const dimmed = hovered !== null && !inGroup(el);
    return (
      <button
        type="button"
        onClick={() => onPick(el)}
        onPointerEnter={() => setHovered(el.n)}
        onPointerLeave={() => setHovered(null)}
        style={{ gridRow: gridPos(el.n).row, gridColumn: gridPos(el.n).col }}
        className={
          "group relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border text-center transition-all duration-150 " +
          (active
            ? "z-10 scale-110 border-[var(--signal)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--signal)_35%,transparent)]"
            : hovered === el.n
              ? "z-10 scale-110 border-[var(--signal)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--signal)_28%,transparent)]"
              : inGroup(el) && hovered !== null
                ? "border-[var(--signal)]/60"
                : "border-transparent") +
          (dimmed ? " opacity-30" : "")
        }
      >
        <span
          className="absolute inset-0 rounded-lg opacity-70 transition-opacity group-hover:opacity-90"
          style={{ background: `color-mix(in srgb, ${color} 20%, transparent)` }}
        />
        <span className="relative text-[9px] font-semibold leading-none text-text-dim">
          {el.n}
        </span>
        <span
          className="relative mt-0.5 font-display text-[13px] font-bold leading-none sm:text-sm"
          style={{ color }}
        >
          {el.sym}
        </span>
      </button>
    );
  };

  return (
    <div className="overflow-x-auto pb-2">
      {/* group strip */}
      <div className="mb-2 flex min-w-[840px] items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="text-[9px] font-semibold uppercase tracking-wider text-text-dim">
              P{i + 1}
            </span>
          ))}
          <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-text-dim">f</span>
        </div>
        {hoverGroupName ? (
          <span className="rounded-full border border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] px-3 py-1 text-[10px] font-semibold text-foreground">
            {hoverGroupName} — hover highlights the whole group
          </span>
        ) : (
          <span className="text-[10px] font-medium text-text-dim">
            Hover any element to highlight its group
          </span>
        )}
      </div>

      <div
        className="grid min-w-[840px] gap-1"
        style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}
      >
        {main.map((el) => (
          <Cell key={el.n} el={el} />
        ))}
      </div>

      {/* f-block rows */}
      <div className="mt-1.5 flex min-w-[840px] items-center gap-1">
        <span className="w-8 shrink-0 pr-1 text-right text-[9px] font-semibold uppercase tracking-wider text-text-dim">
          57–71
        </span>
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {lanth.map((el) => (
            <Cell key={el.n} el={el} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex min-w-[840px] items-center gap-1">
        <span className="w-8 shrink-0 pr-1 text-right text-[9px] font-semibold uppercase tracking-wider text-text-dim">
          89–103
        </span>
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {actin.map((el) => (
            <Cell key={el.n} el={el} />
          ))}
        </div>
      </div>

      {/* category legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--card-border)] pt-3">
        {Object.entries(CAT_COLOR).map(([cat, color]) => (
          <span key={cat} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-text-dim">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

function ElementCard({ el }: { el: ElementData | null }) {
  if (!el) {
    return (
      <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--card-border)] p-6 text-center">
        <Sigma className="h-6 w-6 text-text-dim" />
        <p className="text-sm font-medium text-text-dim">
          Tap any element to open its profile card
        </p>
      </div>
    );
  }
  const color = CAT_COLOR[el.cat];
  const phase = PHASE_LABEL[el.phase];
  const shells = shellsFor(el.n);
  const pg = periodGroupOf(el.n);
  const outer = shells[shells.length - 1] ?? 0;
  const block = blockFor(el.n);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--card-border)]">
      <div
        className="relative flex items-center justify-between px-5 py-4"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            Atomic No. {el.n}
          </p>
          <p className="mt-0.5 font-display text-2xl font-bold tracking-tight text-foreground">
            {el.name}
          </p>
        </div>
        <span
          className="font-display text-6xl font-bold leading-none"
          style={{ color }}
        >
          {el.sym}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-5 text-sm">
        {/* Bohr diagram */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_3%,transparent)] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            <Atom className="h-3 w-3" />
            Shell model
          </p>
          <div className="mx-auto mt-1 max-w-[190px]">
            <BohrDiagram el={el} />
          </div>
          <p className="mt-1 text-center font-mono text-[10.5px] text-text-dim">
            K{shells[0] ? `(${shells[0]})` : ""}
            {shells.slice(1).map((s, i) => ` · L${i + 1}(${s})`).join("")}
          </p>
        </div>

        <Row label="Mass" value={`${el.mass} u`} />
        <Row label="Category" value={el.cat} dot={color} />
        <Row label="Phase (STP)" value={phase.label} dot={phase.color} />
        <Row label="Period / Group" value={pg.group !== null ? `${pg.period} / ${pg.group}` : `${pg.period} (f-block)`} />
        <Row label="Block" value={block} />
        <Row label="Outer-shell e⁻" value={`${outer}`} />

        <div className="mt-1 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_4%,transparent)] px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            <Layers className="h-3 w-3" />
            Electron configuration
          </p>
          <p className="mt-1 font-mono text-[12.5px] leading-relaxed text-foreground">
            {configFor(el.n)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-text-dim">{label}</span>
      <span className="inline-flex items-center gap-2 text-right text-[13px] font-semibold text-foreground">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reaction workbench                                                  */
/* ------------------------------------------------------------------ */

/** A substance "logo" tile — coloured square with the formula inside. */
function SubstanceTile({
  formula,
  name,
  color,
  coeff,
  product,
  size = "md",
}: {
  formula: string;
  name: string;
  color: string;
  coeff?: string;
  product?: boolean;
  size?: "md" | "sm";
}) {
  const dim = size === "md" ? "h-16 w-16" : "h-11 w-11";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {coeff && coeff !== "1" && (
          <span className="absolute -left-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-[var(--card-border)]">
            {coeff}
          </span>
        )}
        <div
          className={`${dim} flex items-center justify-center rounded-2xl border font-display font-bold shadow-lg transition-transform duration-300`}
          style={{
            borderColor: `color-mix(in srgb, ${color} 70%, transparent)`,
            background: `linear-gradient(160deg, color-mix(in srgb, ${color} 26%, transparent), color-mix(in srgb, ${color} 8%, transparent))`,
            color: product ? "var(--signal)" : color,
            fontSize: size === "md" ? 19 : 14,
            boxShadow: `0 6px 22px -8px color-mix(in srgb, ${color} 55%, transparent)`,
          }}
        >
          <Fmt text={formula} />
        </div>
      </div>
      <span className="max-w-20 text-center text-[9px] font-medium leading-tight text-text-dim">
        {name}
      </span>
    </div>
  );
}

function ReactionWorkbench() {
  const [a, setA] = useState<string>("h2");
  const [b, setB] = useState<string>("o2");
  const [result, setResult] = useState<{ eq: string; type: string; note: string } | null>(null);
  const [miss, setMiss] = useState(false);

  const react = () => {
    setMiss(false);
    const key = [a, b].sort().join("|");
    const r = REACTIONS[key];
    if (r) {
      setResult(r);
    } else {
      setResult(null);
      setMiss(true);
    }
  };

  const sub = (id: string) => SUBSTANCES.find((s) => s.id === id) ?? SUBSTANCES[0];

  // parse products of the balanced equation into [coeff, formula] pairs
  const products = useMemo(() => {
    if (!result) return [] as { coeff: string; formula: string }[];
    const rhs = result.eq.split("->")[1]?.trim() ?? "";
    return rhs.split("+").map((part) => {
      const t = part.trim();
      const m = t.match(/^(\d+)\s+(.+)$/);
      return m ? { coeff: m[1], formula: m[2] } : { coeff: "1", formula: t };
    });
  }, [result]);

  const subA = sub(a);
  const subB = sub(b);

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <FlaskConical className="h-4 w-4 text-[var(--signal)]" />
            Reaction workbench
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Pick two substances from the shelf and press React — a balanced equation appears.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={a} onValueChange={setA}>
            <SelectTrigger className="w-36 rounded-full border-[var(--card-border)] bg-transparent sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSTANCES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.formula} · {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="font-display text-sm font-bold text-text-dim">+</span>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger className="w-36 rounded-full border-[var(--card-border)] bg-transparent sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSTANCES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.formula} · {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="gap-1.5 rounded-full bg-[var(--signal)] text-[var(--primary-foreground)] hover:bg-[var(--signal)]/90"
            onClick={react}
          >
            <Beaker className="h-4 w-4" />
            React
          </Button>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {result ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-2xl border border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_7%,transparent)] px-5 py-6">
              <SubstanceTile formula={subA.formula} name={subA.name} color={subA.color} />
              <span className="font-display text-lg font-bold text-text-dim">+</span>
              <SubstanceTile formula={subB.formula} name={subB.name} color={subB.color} />
              <span className="font-display text-xl font-bold text-[var(--signal)]">→</span>
              {products.map((p, i) => (
                <div key={i} className="flex items-center gap-x-4">
                  <SubstanceTile
                    formula={p.formula}
                    name={p.formula}
                    color="#e0323a"
                    coeff={p.coeff}
                    product
                  />
                  {i < products.length - 1 && (
                    <span className="font-display text-base font-bold text-text-dim">+</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="glass-chip w-fit px-3 py-1 text-[11px] font-semibold text-[var(--signal)]">
                {result.type}
              </span>
              <p className="text-xs leading-relaxed text-text-dim sm:text-[13px]">
                {result.note}
              </p>
            </div>
            <p className="border-t border-[var(--card-border)] pt-3 font-mono text-[12.5px] leading-relaxed text-text-dim">
              <Fmt text={result.eq} />
            </p>
          </div>
        ) : miss ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--card-border)] px-5 py-6 sm:flex-row sm:justify-center sm:gap-5">
            <div className="flex items-center gap-3">
              <SubstanceTile formula={subA.formula} name={subA.name} color={subA.color} size="sm" />
              <span className="font-display text-sm font-bold text-text-dim">+</span>
              <SubstanceTile formula={subB.formula} name={subB.name} color={subB.color} size="sm" />
            </div>
            <div className="max-w-md text-sm leading-relaxed text-text-dim">
              <Sigma className="mb-1 h-5 w-5 text-text-dim" />
              No spontaneous reaction between{" "}
              <span className="font-semibold text-foreground">
                <Fmt text={subA.formula} />
              </span>{" "}
              and{" "}
              <span className="font-semibold text-foreground">
                <Fmt text={subB.formula} />
              </span>{" "}
              in this lab set. Try a metal with an acid, or hydrogen with oxygen.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--card-border)] px-5 py-5 text-sm text-text-dim">
            <Beaker className="h-5 w-5 shrink-0 text-[var(--signal)]" />
            <p>
              Ready when you are — press{" "}
              <span className="font-semibold text-foreground">React</span> to run the
              simulation.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default function ChemistryWorkspace() {
  const [selected, setSelected] = useState<ElementData | null>(null);
  const el = useMemo(
    () => (selected ? ELEMENTS.find((e) => e.n === selected.n) ?? null : null),
    [selected],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-panel overflow-hidden">
        <header className="border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Sigma className="h-4 w-4 text-[var(--signal)]" />
            Periodic table
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Hover an element to spotlight its group — tap it for the shell model and full profile.
          </p>
        </header>
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
          <PeriodicTable onPick={setSelected} selected={el?.n ?? null} />
          <div className="lg:sticky lg:top-24">
            <ElementCard el={el} />
          </div>
        </div>
      </section>
      <ReactionWorkbench />
    </div>
  );
}