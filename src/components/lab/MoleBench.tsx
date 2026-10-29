import { Picker } from "@/components/lab/bench-atoms";
import { useStillMotion } from "@/lib/motion";
import { motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * The balancing bench.
 *
 * Balancing an equation is the one chemistry skill that is entirely a puzzle:
 * the formulas are fixed, the only free variables are the numbers in front,
 * and there is exactly one small set of them that conserves every atom. So the
 * bench is built as that puzzle and nothing else — no reaction to run, no
 * animation to watch, just a beam, a ledger and the coefficients.
 *
 * The beam is not decoration. It is driven by the same atom count the ledger
 * prints, so a student who reads only the picture and a student who reads only
 * the table are looking at the same number. When it settles, the equation
 * conserves matter; when it leans, one side is short.
 *
 * The mass check is the second half of the lesson, and it stays locked until
 * the equation balances: a gram calculation on an unbalanced equation is a
 * calculation with no mole ratio, which is exactly the mistake the panel is
 * there to prevent.
 */

type Reaction = {
  id: string;
  name: string;
  note: string;
  left: string[];
  right: string[];
  /** The one solution, left then right. Used only to seed the mass defaults. */
  solution: number[];
};

const REACTIONS: Reaction[] = [
  {
    id: "methane",
    name: "Methane",
    note: "The flame on a gas stove.",
    left: ["CH4", "O2"],
    right: ["CO2", "H2O"],
    solution: [1, 2, 1, 2],
  },
  {
    id: "water",
    name: "Water",
    note: "Two gases, one liquid.",
    left: ["H2", "O2"],
    right: ["H2O"],
    solution: [2, 1, 2],
  },
  {
    id: "rust",
    name: "Rust",
    note: "Iron meeting oxygen, slowly.",
    left: ["Fe", "O2"],
    right: ["Fe2O3"],
    solution: [4, 3, 2],
  },
  {
    id: "thermite",
    name: "Thermite",
    note: "Aluminium takes the oxygen from iron.",
    left: ["Al", "Fe2O3"],
    right: ["Al2O3", "Fe"],
    solution: [2, 1, 1, 2],
  },
];

/** Gram-atomic masses, to the precision a school calculation uses. */
const MASS: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  Na: 22.99,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.085,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  K: 39.098,
  Ca: 40.078,
  Fe: 55.845,
  Cu: 63.546,
  Zn: 65.38,
  Ag: 107.868,
  Ba: 137.327,
  Pb: 207.2,
};

/**
 * Count the atoms in a formula.
 *
 * Handles element counts, nested brackets and their multipliers: `Ca(OH)2` is
 * one calcium, two oxygen and two hydrogen. Anything that is not an element,
 * a digit or a bracket is ignored, so a state symbol left in the data cannot
 * become an atom.
 */
function atomsOf(formula: string): Record<string, number> {
  let at = 0;

  const group = (): Record<string, number> => {
    const out: Record<string, number> = {};
    const add = (symbol: string, count: number) => {
      out[symbol] = (out[symbol] ?? 0) + count;
    };

    while (at < formula.length) {
      const char = formula[at];

      if (char === "(") {
        at += 1;
        const inner = group();
        let multiplier = 0;
        while (at < formula.length && /\d/.test(formula[at])) {
          multiplier = multiplier * 10 + Number(formula[at]);
          at += 1;
        }
        for (const [symbol, count] of Object.entries(inner)) {
          add(symbol, count * (multiplier || 1));
        }
        continue;
      }

      if (char === ")") {
        at += 1;
        return out;
      }

      if (/[A-Z]/.test(char)) {
        let symbol = char;
        at += 1;
        while (at < formula.length && /[a-z]/.test(formula[at])) {
          symbol += formula[at];
          at += 1;
        }
        let count = 0;
        while (at < formula.length && /\d/.test(formula[at])) {
          count = count * 10 + Number(formula[at]);
          at += 1;
        }
        add(symbol, count || 1);
        continue;
      }

      at += 1;
    }

    return out;
  };

  return group();
}

function molarMass(formula: string) {
  const atoms = atomsOf(formula);
  return Object.entries(atoms).reduce(
    (total, [symbol, count]) => total + (MASS[symbol] ?? 0) * count,
    0,
  );
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** A formula with its counts as real subscripts — Fe₂O₃, not Fe2O3. */
function Formula({ text }: { text: string }) {
  const parts = text.match(/[A-Z][a-z]?|\d+|[()]/g) ?? [text];
  return (
    <>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? (
          <sub key={index} className="text-[0.68em] leading-none">
            {part}
          </sub>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function MoleBench() {
  const still = useStillMotion();
  const [reactionId, setReactionId] = useState(REACTIONS[0].id);
  const reaction = REACTIONS.find((entry) => entry.id === reactionId) ?? REACTIONS[0];

  /** All species in reading order: reactants first, then products. */
  const species = useMemo(
    () => [...reaction.left, ...reaction.right],
    [reaction],
  );

  const [coefficients, setCoefficients] = useState<number[]>(() =>
    REACTIONS[0].solution.map(() => 1),
  );

  const [grams, setGrams] = useState<number[]>(() =>
    initialGrams(REACTIONS[0]),
  );

  function initialGrams(target: Reaction) {
    const [first, second] = target.left;
    const firstMass = molarMass(first) * target.solution[0];
    const secondMass = molarMass(second) * target.solution[1];
    return [
      Math.max(1, Math.round(firstMass)),
      Math.max(1, Math.round(secondMass * 0.75)),
    ];
  }

  const chooseReaction = (id: string) => {
    const next = REACTIONS.find((entry) => entry.id === id);
    if (!next) return;
    setReactionId(next.id);
    setCoefficients(next.solution.map(() => 1));
    setGrams(initialGrams(next));
  };

  const nudge = (index: number, delta: number) => {
    setCoefficients((current) =>
      current.map((value, at) =>
        at === index ? clamp(value + delta, 1, 9) : value,
      ),
    );
  };

  const reset = () => setCoefficients(reaction.solution.map(() => 1));

  /* Atom ledger. Elements are ordered by first appearance on the left, which
     is the order the eye reads the equation in. */
  const elements = useMemo(() => {
    const seen: string[] = [];
    for (const formula of species) {
      for (const symbol of Object.keys(atomsOf(formula))) {
        if (!seen.includes(symbol)) seen.push(symbol);
      }
    }
    return seen;
  }, [species]);

  const counts = useMemo(() => {
    const leftCount = reaction.left.length;
    return elements.map((symbol) => ({
      symbol,
      left: reaction.left.reduce(
        (total, formula, index) =>
          total + (atomsOf(formula)[symbol] ?? 0) * coefficients[index],
        0,
      ),
      right: reaction.right.reduce(
        (total, formula, index) =>
          total +
          (atomsOf(formula)[symbol] ?? 0) * coefficients[leftCount + index],
        0,
      ),
    }));
  }, [coefficients, elements, reaction]);

  const balanced = counts.every((entry) => entry.left === entry.right);
  const leftTotal = counts.reduce((total, entry) => total + entry.left, 0);
  const rightTotal = counts.reduce((total, entry) => total + entry.right, 0);

  /* The beam leans by the *fraction* of the imbalance, not the raw count: one
     atom out of four should tip further than one out of forty, and a 1:1
     ratio must sit level whatever the size of the molecule. */
  const imbalance = leftTotal === rightTotal ? 0 : (leftTotal - rightTotal) / Math.max(leftTotal, rightTotal, 1);
  const tilt = -clamp(imbalance * 26, -11, 11);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="apple-lab-micro">Balancing bench</p>
          <h2 className="apple-lab-title mt-1.5 text-xl sm:text-2xl">
            The equation has to weigh the same on both sides
          </h2>
          <p className="apple-lab-note mt-2 max-w-xl">
            Only the numbers in front are yours to change — the formulas are
            fixed. Match every atom, then read what the ratio means in grams.
          </p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[15rem]">
          <Picker
            label="Reaction"
            value={reactionId}
            options={REACTIONS.map((entry) => ({ id: entry.id, label: entry.name }))}
            onChange={chooseReaction}
          />
        </div>
      </div>

      <section className="apple-lab-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="apple-lab-micro">Equation</p>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold"
              style={{
                borderColor: balanced
                  ? "color-mix(in srgb, var(--lab-diagram-mint) 40%, transparent)"
                  : "color-mix(in srgb, var(--lab-diagram-rose) 34%, transparent)",
                color: balanced
                  ? "var(--lab-diagram-mint)"
                  : "var(--lab-diagram-rose)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: balanced
                    ? "var(--lab-diagram-mint)"
                    : "var(--lab-diagram-rose)",
                }}
              />
              {balanced ? "Balanced" : "Not balanced"}
            </span>
            <button
              type="button"
              onClick={reset}
              className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
              aria-label="Reset coefficients"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* The equation, with the coefficient as the control it is. Reactants
            stack on the left and products on the right of one arrow, so the
            two sides of the balance below are spatially the two sides of the
            line above. */}
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2.5">
            {reaction.left.map((formula, index) => (
              <span key={`left-${formula}`} className="flex items-center gap-2">
                <CoefficientRow
                  formula={formula}
                  value={coefficients[index]}
                  onStep={(delta) => nudge(index, delta)}
                  label={`Coefficient for ${formula}`}
                />
                {index < reaction.left.length - 1 ? (
                  <span className="font-display text-[15px] text-[var(--lab-ink-micro)]" aria-hidden>
                    +
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <span className="font-display text-xl text-[var(--lab-ink-dim)]" aria-hidden>
            →
          </span>
          <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-2.5">
            {reaction.right.map((formula, index) => (
              <span key={`right-${formula}`} className="flex items-center gap-2">
                <CoefficientRow
                  formula={formula}
                  value={coefficients[reaction.left.length + index]}
                  onStep={(delta) => nudge(reaction.left.length + index, delta)}
                  label={`Coefficient for ${formula}`}
                />
                {index < reaction.right.length - 1 ? (
                  <span className="font-display text-[15px] text-[var(--lab-ink-micro)]" aria-hidden>
                    +
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-[var(--lab-line-soft)] pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Beam ------------------------------------------------------ */}
          <div>
            <p className="apple-lab-micro">Balance</p>
            <svg
              viewBox="0 0 360 118"
              className="mt-2 w-full max-w-[22rem]"
              role="img"
              aria-label={`Balance beam: ${leftTotal} atoms on the left, ${rightTotal} on the right`}
            >
              <g
                style={{
                  transform: `rotate(${tilt}deg)`,
                  transformOrigin: "180px 34px",
                  transition: still
                    ? "none"
                    : "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <line x1="42" y1="34" x2="318" y2="34" stroke="var(--lab-ink)" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
                {[42, 318].map((x) => (
                  <g key={x}>
                    <line x1={x} y1="34" x2={x} y2="70" stroke="var(--lab-ink)" strokeOpacity="0.3" strokeWidth="1" />
                    <path
                      d={`M ${x - 26} 70 Q ${x} 86 ${x + 26} 70`}
                      fill="none"
                      stroke="var(--lab-ink)"
                      strokeOpacity="0.55"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </g>
              {/* The stand is not part of the beam: it must not lean with it. */}
              <line x1="180" y1="34" x2="180" y2="102" stroke="var(--lab-ink)" strokeOpacity="0.18" strokeWidth="1" />
              <path d="M 156 104 L 180 34 L 204 104" fill="none" stroke="var(--lab-ink)" strokeOpacity="0.22" strokeWidth="1" strokeLinejoin="round" />
              <circle cx="180" cy="34" r="3.4" fill={balanced ? "var(--lab-diagram-mint)" : "var(--lab-ink)"} />
            </svg>
            <div className="mt-1 flex max-w-[22rem] items-center justify-between gap-3 text-[11.5px] text-[var(--lab-ink-dim)]">
              <span>
                <span className="apple-lab-value font-semibold">{leftTotal}</span> atoms left
              </span>
              <span>
                <span className="apple-lab-value font-semibold">{rightTotal}</span> atoms right
              </span>
            </div>
          </div>

          {/* Ledger ---------------------------------------------------- */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="apple-lab-micro">Atom ledger</p>
              <p className="text-[10.5px] text-[var(--lab-ink-micro)]">reactants / products</p>
            </div>
            <table className="mt-2 w-full border-collapse text-[12px]">
              <tbody>
                {counts.map((entry) => {
                  const matches = entry.left === entry.right;
                  return (
                    <tr key={entry.symbol} className="border-b border-[var(--lab-line-soft)] last:border-0">
                      <th scope="row" className="py-2 text-left font-semibold text-[var(--lab-ink)]">
                        {entry.symbol}
                      </th>
                      <td
                        className="py-2 text-right tabular-nums"
                        style={{
                          color: matches ? "var(--lab-ink-dim)" : "var(--lab-diagram-rose)",
                          fontWeight: matches ? 400 : 600,
                        }}
                      >
                        {entry.left}
                      </td>
                      <td
                        className="w-8 py-2 text-center text-[11px]"
                        style={{ color: matches ? "var(--lab-ink-micro)" : "var(--lab-diagram-rose)" }}
                        aria-label={matches ? "equal" : "different"}
                      >
                        {matches ? "=" : "≠"}
                      </td>
                      <td
                        className="py-2 text-right tabular-nums"
                        style={{
                          color: matches ? "var(--lab-ink-dim)" : "var(--lab-diagram-rose)",
                          fontWeight: matches ? 400 : 600,
                        }}
                      >
                        {entry.right}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="apple-lab-note mt-4 text-[11.5px]">
          {balanced
            ? `${reaction.name}: ${equationSummary(reaction, coefficients)}. Every element matches, so the coefficients are the mole ratio of the reaction.`
            : "A coefficient multiplies every atom in the formula. Change one and the ledger moves in more than one row at once."}
        </p>
      </section>

      <MassCheck
        reaction={reaction}
        coefficients={coefficients}
        balanced={balanced}
        grams={grams}
        onGram={(index, value) =>
          setGrams((current) => current.map((entry, at) => (at === index ? value : entry)))
        }
      />

    </div>
  );
}

/* ------------------------------------------------------------------ */

function CoefficientRow({
  formula,
  value,
  onStep,
  label,
}: {
  formula: string;
  value: number;
  onStep: (delta: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center overflow-hidden rounded-lg border border-[var(--lab-line)]"
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="flex h-6 w-6 items-center justify-center text-[var(--lab-ink-dim)] transition-colors hover:bg-[color-mix(in_srgb,var(--lab-ink)_8%,transparent)] hover:text-[var(--lab-ink)] disabled:opacity-30"
          aria-label={`Decrease ${label}`}
          disabled={value <= 1}
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="apple-lab-value w-6 text-center text-[12.5px] font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="flex h-6 w-6 items-center justify-center text-[var(--lab-ink-dim)] transition-colors hover:bg-[color-mix(in_srgb,var(--lab-ink)_8%,transparent)] hover:text-[var(--lab-ink)] disabled:opacity-30"
          aria-label={`Increase ${label}`}
          disabled={value >= 9}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <span className="apple-lab-value font-display text-lg font-semibold sm:text-xl">
        <Formula text={formula} />
      </span>
    </div>
  );
}

/** `2 H₂ + O₂ → 2 H₂O`, as plain text for the summary sentence. */
function equationSummary(reaction: Reaction, coefficients: number[]) {
  const subscript = (formula: string) =>
    formula.replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
  const side = (formulas: string[], offset: number) =>
    formulas
      .map((formula, index) => `${coefficients[offset + index]} ${subscript(formula)}`)
      .join(" + ");
  return `${side(reaction.left, 0)} → ${side(reaction.right, reaction.left.length)}`;
}

/* ------------------------------------------------------------------ */

function MassCheck({
  reaction,
  coefficients,
  balanced,
  grams,
  onGram,
}: {
  reaction: Reaction;
  coefficients: number[];
  balanced: boolean;
  grams: number[];
  onGram: (index: number, value: number) => void;
}) {
  const reactantMasses = reaction.left.map((formula) => molarMass(formula));
  const productMasses = reaction.right.map((formula) => molarMass(formula));

  const moles = grams.map((mass, index) =>
    reactantMasses[index] && Number.isFinite(mass) ? Math.max(0, mass) / reactantMasses[index] : 0,
  );
  /* How many reaction batches each reactant could support on its own. The
     smallest one is the ceiling: that reactant runs out first. */
  const extents = moles.map((value, index) =>
    coefficients[index] ? value / coefficients[index] : 0,
  );
  const extent = balanced ? Math.min(...extents) : 0;
  const limiting = balanced ? extents.indexOf(extent) : -1;

  const products = reaction.right.map((formula, index) => ({
    formula,
    mass: extent * coefficients[reaction.left.length + index] * productMasses[index],
  }));

  const leftover = balanced
    ? reaction.left
        .map((formula, index) => ({
          formula,
          mass:
            index === limiting
              ? 0
              : Math.max(0, (moles[index] - extent * coefficients[index]) * reactantMasses[index]),
        }))
        .filter((entry) => entry.mass > 0.005)
    : [];

  return (
    <section className="apple-lab-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="apple-lab-micro">Mass check</p>
          <h3 className="apple-lab-title mt-1 text-[15px]">
            Grams in, grams out
          </h3>
        </div>
        <p className="max-w-[19rem] text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
          {balanced
            ? "The coefficients are the mole ratio. The first reactant to run out sets how much product can form."
            : "Locked until the equation balances — without coefficients there is no ratio to convert with."}
        </p>
      </div>

      <div
        className="mt-4 grid gap-5 md:grid-cols-2"
        style={{ opacity: balanced ? 1 : 0.45 }}
      >
        <div>
          <p className="apple-lab-micro">Starting masses</p>
          <div className="mt-2 flex flex-col gap-2">
            {reaction.left.map((formula, index) => (
              <label
                key={formula}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--lab-line-soft)] px-3 py-2"
              >
                <span className="apple-lab-value flex items-center gap-2 font-display text-[14px] font-semibold">
                  <Formula text={formula} />
                  <span className="text-[10.5px] font-normal text-[var(--lab-ink-micro)]">
                    M = {reactantMasses[index].toFixed(1)} g/mol
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={Number.isFinite(grams[index]) ? grams[index] : ""}
                    onChange={(event) => onGram(index, Number(event.target.value))}
                    disabled={!balanced}
                    aria-label={`Grams of ${formula}`}
                    className="w-16 rounded-lg border border-[var(--lab-line)] bg-transparent px-2 py-1 text-right text-[12.5px] tabular-nums text-[var(--lab-ink)] outline-none focus:border-[color-mix(in_srgb,var(--lab-ink)_38%,transparent)] disabled:cursor-not-allowed"
                  />
                  <span className="text-[11px] text-[var(--lab-ink-micro)]">g</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="apple-lab-micro">Result</p>
          {balanced ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1"
            >
              {products.map((entry) => (
                <div
                  key={entry.formula}
                  className="flex items-baseline justify-between gap-3 border-b border-[var(--lab-line-soft)] py-2 text-[12px]"
                >
                  <span className="flex items-center gap-1.5 text-[var(--lab-ink-dim)]">
                    Mass of <Formula text={entry.formula} />
                  </span>
                  <span className="apple-lab-value font-semibold">
                    {entry.mass.toFixed(2)} g
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 py-2 text-[12px]">
                <span className="text-[var(--lab-ink-dim)]">Limiting reactant</span>
                <span className="apple-lab-value font-semibold">
                  <Formula text={reaction.left[limiting] ?? "—"} />
                </span>
              </div>
              {leftover.map((entry) => (
                <div
                  key={`leftover-${entry.formula}`}
                  className="flex items-baseline justify-between gap-3 py-2 text-[12px]"
                >
                  <span className="flex items-center gap-1.5 text-[var(--lab-ink-dim)]">
                    Left over <Formula text={entry.formula} />
                  </span>
                  <span className="apple-lab-value font-semibold">
                    {entry.mass.toFixed(2)} g
                  </span>
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="mt-2 flex flex-1 flex-col justify-center rounded-xl border border-dashed border-[var(--lab-line)] px-4 py-6 text-center">
              <p className="text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                Balance the equation to convert grams into moles.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MoleBench;
