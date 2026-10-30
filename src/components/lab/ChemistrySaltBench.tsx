import { useMemo, useState } from "react";
import { Check, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { Picker, Questions } from "@/components/lab/bench-atoms";
import { ShareSetup, useBenchPreset } from "@/components/lab/practical/preset";

/**
 * Qualitative salt analysis.
 *
 * The Class 11 and 12 chemistry practical is not a reaction to watch; it is a
 * sequence of tests whose observations narrow the cation and the anion down.
 * This bench gives the student the tests and their real observations, then asks
 * for the inference. It will not name the salt until both ions are right — the
 * whole practical is the reasoning from observation to ion.
 */

type SaltId = "copper" | "iron" | "zinc" | "calcium" | "ammonium";
type TestId = "hcl" | "naoh" | "nh4oh" | "bacl2" | "agno3" | "flame";

const TESTS: Array<{ id: TestId; label: string; reagent: string }> = [
  { id: "hcl", label: "Dilute HCl", reagent: "A few drops of dilute hydrochloric acid" },
  { id: "naoh", label: "NaOH", reagent: "Sodium hydroxide solution, drop by drop, then in excess" },
  { id: "nh4oh", label: "NH₄OH", reagent: "Ammonium hydroxide, drop by drop, then in excess" },
  { id: "bacl2", label: "BaCl₂", reagent: "Barium chloride solution, acidified with dilute HCl" },
  { id: "agno3", label: "AgNO₃", reagent: "Silver nitrate solution, then excess ammonium hydroxide" },
  { id: "flame", label: "Flame test", reagent: "A little of the salt on a clean nichrome wire" },
];

const CATIONS = ["Cu²⁺", "Fe²⁺", "Zn²⁺", "Ca²⁺", "NH₄⁺"];
const ANIONS = ["SO₄²⁻", "CO₃²⁻", "Cl⁻"];

type Salt = {
  id: SaltId;
  name: string;
  formula: string;
  colour: string;
  cation: string;
  anion: string;
  observation: Record<TestId, string>;
  note: string;
};

const SALTS: Salt[] = [
  {
    id: "copper",
    name: "Copper sulphate",
    formula: "CuSO₄·5H₂O",
    colour: "Blue crystalline",
    cation: "Cu²⁺",
    anion: "SO₄²⁻",
    observation: {
      hcl: "No gas. The blue solution stays clear.",
      naoh: "A pale blue precipitate of Cu(OH)₂ forms; it does not dissolve in excess NaOH.",
      nh4oh: "A pale blue precipitate forms first, then dissolves in excess to a deep blue solution.",
      bacl2: "A white precipitate of BaSO₄ forms and does not dissolve in dilute HCl.",
      agno3: "No curdy precipitate.",
      flame: "A green-blue flame, characteristic of copper.",
    },
    note:
      "The deep blue solution in excess ammonia is the confirmatory test for copper: [Cu(NH₃)₄]²⁺.",
  },
  {
    id: "iron",
    name: "Ferrous sulphate",
    formula: "FeSO₄·7H₂O",
    colour: "Pale green crystalline",
    cation: "Fe²⁺",
    anion: "SO₄²⁻",
    observation: {
      hcl: "No gas. The pale green solution stays clear.",
      naoh: "A dirty green precipitate of Fe(OH)₂ forms; it is insoluble in excess NaOH.",
      nh4oh: "A green precipitate forms and stays insoluble in excess.",
      bacl2: "A white precipitate of BaSO₄ forms, insoluble in dilute HCl.",
      agno3: "No curdy precipitate.",
      flame: "No characteristic flame colour.",
    },
    note:
      "Ferrous salts oxidise in air; a brown tinge at the surface is Fe³⁺, and it changes the NaOH result.",
  },
  {
    id: "zinc",
    name: "Zinc sulphate",
    formula: "ZnSO₄·7H₂O",
    colour: "White crystalline",
    cation: "Zn²⁺",
    anion: "SO₄²⁻",
    observation: {
      hcl: "No gas. The solution stays colourless.",
      naoh: "A white gelatinous precipitate of Zn(OH)₂ forms, which dissolves in excess NaOH.",
      nh4oh: "A white precipitate forms, which dissolves in excess ammonium hydroxide.",
      bacl2: "A white precipitate of BaSO₄ forms, insoluble in dilute HCl.",
      agno3: "No curdy precipitate.",
      flame: "No characteristic flame colour.",
    },
    note:
      "Zinc hydroxide is amphoteric: it dissolves in both excess NaOH and excess ammonia, which separates it from copper and iron.",
  },
  {
    id: "calcium",
    name: "Calcium carbonate",
    formula: "CaCO₃",
    colour: "White powder",
    cation: "Ca²⁺",
    anion: "CO₃²⁻",
    observation: {
      hcl: "Brisk effervescence; the gas turns lime water milky, so it is CO₂.",
      naoh: "A white precipitate of Ca(OH)₂ forms; it is only sparingly soluble.",
      nh4oh: "No precipitate at this concentration.",
      bacl2: "A white precipitate of BaCO₃ forms, which dissolves in dilute HCl with effervescence.",
      agno3: "No curdy precipitate.",
      flame: "A brick-red flame, characteristic of calcium.",
    },
    note:
      "Carbonate is confirmed by the gas, not by the precipitate: CO₂ turns lime water milky and the milkiness clears in excess gas.",
  },
  {
    id: "ammonium",
    name: "Ammonium chloride",
    formula: "NH₄Cl",
    colour: "White crystalline",
    cation: "NH₄⁺",
    anion: "Cl⁻",
    observation: {
      hcl: "No visible change.",
      naoh: "Warm gently: a pungent gas evolves that turns moist red litmus blue — ammonia.",
      nh4oh: "No precipitate.",
      bacl2: "No precipitate.",
      agno3: "A curdy white precipitate of AgCl forms, soluble in excess ammonium hydroxide.",
      flame: "No characteristic flame colour.",
    },
    note:
      "Ammonium salts are confirmed by the gas test, not by a precipitate: NH₃ is the only common gas that turns red litmus blue.",
  },
];

export function ChemistrySaltBench() {
  const { preset, task } = useBenchPreset<{ salt?: SaltId }>();
  const initial = SALTS.find((salt) => salt.id === preset?.salt) ?? SALTS[0];

  const [saltId, setSaltId] = useState<SaltId>(initial.id);
  const [run, setRun] = useState<Record<string, boolean>>({});
  const [cation, setCation] = useState("");
  const [anion, setAnion] = useState("");
  const [verdict, setVerdict] = useState<"idle" | "right" | "wrong">("idle");

  const salt = useMemo(() => SALTS.find((entry) => entry.id === saltId) ?? SALTS[0], [saltId]);
  const testsRun = TESTS.filter((test) => run[test.id]).length;

  const chooseSalt = (next: SaltId) => {
    setSaltId(next);
    setRun({});
    setCation("");
    setAnion("");
    setVerdict("idle");
  };

  const check = () => {
    if (!cation || !anion) {
      setVerdict("wrong");
      return;
    }
    setVerdict(cation === salt.cation && anion === salt.anion ? "right" : "wrong");
  };

  return (
    <div className="flex flex-col gap-4">
      {task ? (
        <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
          <span className="apple-lab-micro">Task</span>
          <p className="mt-0.5 text-[var(--lab-ink)]">{task}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="apple-lab-card flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="apple-lab-micro">Unknown salt</p>
              <p className="apple-lab-value mt-1 text-[15px] font-semibold">
                Sample {SALTS.findIndex((entry) => entry.id === salt.id) + 1} · {salt.colour}
              </p>
            </div>
            <Picker
              label="Sample"
              value={saltId}
              options={SALTS.map((entry, index) => ({ id: entry.id, label: `Sample ${index + 1}` }))}
              onChange={chooseSalt}
            />
          </div>

          <div>
            <p className="apple-lab-micro">Run a test</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TESTS.map((test) => (
                <button
                  key={test.id}
                  type="button"
                  className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                  onClick={() => {
                    setRun((current) => ({ ...current, [test.id]: true }));
                    setVerdict("idle");
                  }}
                >
                  {test.label}
                </button>
              ))}
              {testsRun > 0 ? (
                <button
                  type="button"
                  className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
                  onClick={() => {
                    setRun({});
                    setVerdict("idle");
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear observations
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {TESTS.filter((test) => run[test.id]).map((test) => (
              <div
                key={test.id}
                className="rounded-lg border border-[var(--lab-line)] px-3 py-2"
              >
                <p className="apple-lab-micro">{test.reagent}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--lab-ink)]">
                  {salt.observation[test.id]}
                </p>
              </div>
            ))}
            {testsRun === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                Run the tests you would run at the bench. Each observation
                removes some possibilities; the inference comes after the
                observations, never before them.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="apple-lab-card flex flex-col gap-3 p-3.5">
            <p className="apple-lab-micro">Inference</p>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Cation</span>
              <select
                value={cation}
                onChange={(event) => {
                  setCation(event.target.value);
                  setVerdict("idle");
                }}
                className="salt-select rounded-lg border border-[var(--lab-line)] bg-transparent px-2 py-1.5 text-[12px] text-[var(--lab-ink)] outline-none"
              >
                <option value="">Choose the cation</option>
                {CATIONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Anion</span>
              <select
                value={anion}
                onChange={(event) => {
                  setAnion(event.target.value);
                  setVerdict("idle");
                }}
                className="salt-select rounded-lg border border-[var(--lab-line)] bg-transparent px-2 py-1.5 text-[12px] text-[var(--lab-ink)] outline-none"
              >
                <option value="">Choose the anion</option>
                {ANIONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={check}>
              <Check className="h-3.5 w-3.5" />
              Check inference
            </button>

            {verdict === "right" ? (
              <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--lab-ink)]">
                  <FlaskConical className="h-3.5 w-3.5 text-[var(--lab-diagram-mint)]" />
                  {salt.name} · {salt.formula}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  {salt.note}
                </p>
              </div>
            ) : verdict === "wrong" ? (
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-[var(--lab-diagram-rose)]" />
                Not both ions yet. Run another test — a precipitate that dissolves
                in excess, or a gas that changes litmus, carries the answer.
              </p>
            ) : null}
          </div>

          <div className="apple-lab-card px-3 py-2.5">
            <p className="apple-lab-micro">Bench discipline</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
              Fresh test tube for each reagent. A precipitate that reappears
              after dissolving is usually contamination, not chemistry.
            </p>
          </div>

          <ShareSetup subject="chemistry" bench="salts" preset={{ salt: salt.id }} />
        </aside>
      </div>

      <Questions
        items={[
          {
            q: "Why does the carbonate test use lime water?",
            a: "The gas must be identified, not assumed. CO₂ turns lime water milky by forming CaCO₃, and clears it again in excess CO₂ as calcium bicarbonate.",
          },
          {
            q: "Why add dilute HCl before BaCl₂?",
            a: "Acid dissolves carbonates and sulphites, which also give white precipitates. Acidified BaCl₂ isolates the barium sulphate that could only come from sulphate.",
          },
        ]}
      />
    </div>
  );
}

export default ChemistrySaltBench;
