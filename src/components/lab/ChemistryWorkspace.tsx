import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Beaker, FlaskConical, Sigma } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  CAT_COLOR,
  configFor,
  ELEMENTS,
  gridPos,
  type ElementData,
} from "./periodic-data";
import { REACTIONS, SUBSTANCES } from "./reactions";

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
      // Digits after a letter or bracket are subscripts (H2, Ca(OH)2);
      // leading coefficients ("2 H2") stay full-size.
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

/* ------------------------------------------------------------------ */
/* Periodic table                                                      */
/* ------------------------------------------------------------------ */

function PeriodicTable({ onPick, selected }: { onPick: (el: ElementData) => void; selected: number | null }) {
  const main = ELEMENTS.filter((el) => gridPos(el.n).row <= 7);
  const lanth = ELEMENTS.filter((el) => gridPos(el.n).row === 9);
  const actin = ELEMENTS.filter((el) => gridPos(el.n).row === 10);

  const Cell = ({ el }: { el: ElementData }) => {
    const color = CAT_COLOR[el.cat];
    const active = selected === el.n;
    return (
      <button
        type="button"
        onClick={() => onPick(el)}
        style={{ gridRow: gridPos(el.n).row, gridColumn: gridPos(el.n).col }}
        className={
          "group relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border text-center transition-all duration-150 " +
          (active
            ? "z-10 scale-110 border-[var(--signal)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--signal)_35%,transparent)]"
            : "border-transparent hover:z-10 hover:scale-110 hover:border-[var(--signal)]")
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
        <Row label="Mass" value={`${el.mass} u`} />
        <Row label="Category" value={el.cat} dot={color} />
        <Row label="Phase (STP)" value={phase.label} dot={phase.color} />
        <div className="mt-1 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_4%,transparent)] px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
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

  const subName = (id: string) =>
    SUBSTANCES.find((s) => s.id === id)?.formula ?? id;

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <FlaskConical className="h-4 w-4 text-[var(--signal)]" />
            Reaction workbench
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Pick two substances and press React — a balanced equation appears.
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_7%,transparent)] px-5 py-5">
              <p className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                <Fmt text={subName(a)} />
              </p>
              <span className="text-text-dim">+</span>
              <p className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                <Fmt text={subName(b)} />
              </p>
              <span className="text-[var(--signal)]">→</span>
              <p className="font-display text-lg font-bold tracking-tight text-[var(--signal)] sm:text-xl">
                <Fmt text={result.eq.split("->")[1]?.trim() ?? result.eq} />
              </p>
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
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--card-border)] px-5 py-5 text-sm text-text-dim">
            <Sigma className="h-5 w-5 shrink-0" />
            <p>
              No spontaneous reaction between{" "}
              <span className="font-semibold text-foreground">
                <Fmt text={subName(a)} />
              </span>{" "}
              and{" "}
              <span className="font-semibold text-foreground">
                <Fmt text={subName(b)} />
              </span>{" "}
              in this lab set. Try a metal with an acid, or hydrogen with oxygen.
            </p>
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
            Tap an element for its distilled profile — mass, configuration and phase.
          </p>
        </header>
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
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