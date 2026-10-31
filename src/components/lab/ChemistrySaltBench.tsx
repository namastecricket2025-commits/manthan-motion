import { useMemo, useState } from "react";
import { Check, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Picker, Questions } from "@/components/lab/bench-atoms";
import { ShareSetup, useBenchPreset } from "@/components/lab/practical/preset";
import { useRecorder } from "@/components/lab/practical/useRecorder";

/**
 * Qualitative salt analysis.
 *
 * The Class 11 and 12 chemistry practical is not a reaction to watch; it is a
 * sequence of tests whose observations narrow the cation and the anion down.
 * This bench gives the student the tests and their real observations, then asks
 * for the inference. It will not name the salt until both ions are right — the
 * whole practical is the reasoning from observation to ion.
 */

type SaltId =
  | "copper"
  | "iron"
  | "zinc"
  | "calcium"
  | "ammonium"
  | "calcium-chloride"
  | "ammonium-sulphate"
  | "zinc-carbonate"
  | "lead-nitrate"
  | "barium-chloride"
  | "magnesium-sulphate"
  | "sodium-carbonate"
  | "potassium-nitrate";
type TestId = "hcl" | "naoh" | "nh4oh" | "bacl2" | "agno3" | "flame" | "heat" | "water";

const TESTS: Array<{ id: TestId; label: string; reagent: string; group: "anion" | "cation" | "physical" }> = [
  { id: "hcl", label: "Dilute HCl", reagent: "A few drops of dilute hydrochloric acid", group: "anion" },
  { id: "bacl2", label: "BaCl₂", reagent: "Barium chloride solution, acidified with dilute HCl", group: "anion" },
  { id: "agno3", label: "AgNO₃", reagent: "Silver nitrate solution, then excess ammonium hydroxide", group: "anion" },
  { id: "naoh", label: "NaOH", reagent: "Sodium hydroxide solution, drop by drop, then in excess", group: "cation" },
  { id: "nh4oh", label: "NH₄OH", reagent: "Ammonium hydroxide, drop by drop, then in excess", group: "cation" },
  { id: "flame", label: "Flame test", reagent: "A little of the salt on a clean nichrome wire", group: "cation" },
  { id: "heat", label: "Dry heating", reagent: "A small amount heated gently in a dry test tube", group: "physical" },
  { id: "water", label: "Solubility", reagent: "A little salt shaken with distilled water", group: "physical" },
];

const TEST_GROUPS: Array<{ id: "anion" | "cation" | "physical"; label: string }> = [
  { id: "anion", label: "Tests for the anion" },
  { id: "cation", label: "Tests for the cation" },
  { id: "physical", label: "Physical checks" },
];

const CATIONS = ["Cu²⁺", "Fe²⁺", "Zn²⁺", "Ca²⁺", "NH₄⁺", "Pb²⁺", "Ba²⁺", "Mg²⁺", "Na⁺", "K⁺"];
const ANIONS = ["SO₄²⁻", "CO₃²⁻", "Cl⁻", "NO₃⁻"];

/* A small, honest swatch: the colours a student would actually see in the
   sample bottle, not a decorative gradient. */
const SALT_SWATCH: Record<SaltId, string> = {
  copper: "#6d9ebd",
  iron: "#95aa8f",
  zinc: "#e8e4da",
  calcium: "#f0ede5",
  ammonium: "#f4f1e8",
  "calcium-chloride": "#f2efe6",
  "ammonium-sulphate": "#f4f1e8",
  "zinc-carbonate": "#eeeae0",
  "lead-nitrate": "#f1efe8",
  "barium-chloride": "#f2efe6",
  "magnesium-sulphate": "#f4f1e8",
  "sodium-carbonate": "#f1eee5",
  "potassium-nitrate": "#f4f1e8",
};

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
      heat: "The blue crystals turn white as water is driven off; strong heating leaves black copper(II) oxide.",
      water: "Dissolves readily to a clear blue solution.",
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
      heat: "The green crystals lose water and turn white; strong heating gives reddish-brown iron(III) oxide and sulphur dioxide.",
      water: "Dissolves to a pale green solution that slowly turns brown in air.",
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
      heat: "The white crystals lose water; strong heating leaves white zinc oxide and sulphur dioxide.",
      water: "Dissolves to a colourless solution.",
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
      heat: "Decomposes to white calcium oxide and carbon dioxide; the gas turns lime water milky.",
      water: "Insoluble — a white powder sinks and the water stays clear.",
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
      heat: "Sublimes as white fumes and gives a sharp smell of ammonia; no residue is left.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Ammonium salts are confirmed by the gas test, not by a precipitate: NH₃ is the only common gas that turns red litmus blue.",
  },
  {
    id: "calcium-chloride",
    name: "Calcium chloride",
    formula: "CaCl₂",
    colour: "White crystalline",
    cation: "Ca²⁺",
    anion: "Cl⁻",
    observation: {
      hcl: "No gas; the salt simply dissolves.",
      naoh: "A white precipitate of Ca(OH)₂ forms; it is only sparingly soluble in excess.",
      nh4oh: "No precipitate at this concentration.",
      bacl2: "No precipitate — no sulphate present.",
      agno3: "A curdy white precipitate of AgCl forms, soluble in excess ammonium hydroxide.",
      flame: "A brick-red flame, characteristic of calcium.",
      heat: "No decomposition at ordinary flame temperature; the salt may lose absorbed water.",
      water: "Very soluble; the tube warms as it dissolves.",
    },
    note:
      "Calcium gives the brick-red flame and a white hydroxide; the curdy AgCl then identifies the chloride half. Both are needed.",
  },
  {
    id: "ammonium-sulphate",
    name: "Ammonium sulphate",
    formula: "(NH₄)₂SO₄",
    colour: "White crystalline",
    cation: "NH₄⁺",
    anion: "SO₄²⁻",
    observation: {
      hcl: "No visible change.",
      naoh: "Warm gently: a pungent gas evolves that turns moist red litmus blue — ammonia.",
      nh4oh: "No precipitate.",
      bacl2: "A white precipitate of BaSO₄ forms and does not dissolve in dilute HCl.",
      agno3: "No curdy precipitate.",
      flame: "No characteristic flame colour.",
      heat: "Decomposes with a smell of ammonia; a white residue remains.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Two different tests are needed: NaOH proves ammonium by the gas, acidified BaCl₂ proves sulphate by the insoluble precipitate.",
  },
  {
    id: "zinc-carbonate",
    name: "Zinc carbonate",
    formula: "ZnCO₃",
    colour: "White powder",
    cation: "Zn²⁺",
    anion: "CO₃²⁻",
    observation: {
      hcl: "Brisk effervescence; the gas turns lime water milky, so it is CO₂.",
      naoh: "A white gelatinous precipitate of Zn(OH)₂ forms, which dissolves in excess NaOH.",
      nh4oh: "A white precipitate forms, which dissolves in excess ammonium hydroxide.",
      bacl2: "A white precipitate of BaCO₃ forms, which dissolves in dilute HCl with effervescence.",
      agno3: "No curdy precipitate.",
      flame: "No characteristic flame colour.",
      heat: "Turns yellow while hot and white again on cooling, giving off CO₂; this is the ZnO residue.",
      water: "Insoluble — a white powder sinks and the water stays clear.",
    },
    note:
      "The carbonate is proved by CO₂, and the zinc by the hydroxide that dissolves in both excess NaOH and excess ammonia — amphoteric, unlike copper or iron.",
  },
  {
    id: "lead-nitrate",
    name: "Lead nitrate",
    formula: "Pb(NO₃)₂",
    colour: "White crystalline",
    cation: "Pb²⁺",
    anion: "NO₃⁻",
    observation: {
      hcl: "A white precipitate of PbCl₂ forms; it dissolves when the tube is warmed and reappears on cooling.",
      naoh: "A white precipitate of Pb(OH)₂ forms, which dissolves in excess NaOH as plumbite.",
      nh4oh: "A white precipitate forms and stays insoluble in excess ammonia.",
      bacl2: "No precipitate — no sulphate present.",
      agno3: "No curdy chloride precipitate; nitrate does not give AgCl here.",
      flame: "No reliable characteristic flame colour.",
      heat: "Decrepitates and gives brown nitrogen dioxide fumes; a yellow lead oxide residue remains.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Lead chloride is the useful confirmation: it is sparingly soluble cold and dissolves in hot water, which separates lead from barium and calcium.",
  },
  {
    id: "barium-chloride",
    name: "Barium chloride",
    formula: "BaCl₂·2H₂O",
    colour: "White crystalline",
    cation: "Ba²⁺",
    anion: "Cl⁻",
    observation: {
      hcl: "No gas; the salt dissolves.",
      naoh: "A white precipitate of Ba(OH)₂ forms; it is only sparingly soluble.",
      nh4oh: "No precipitate.",
      bacl2: "No new precipitate — the salt already contains barium.",
      agno3: "A curdy white precipitate of AgCl forms, soluble in excess ammonium hydroxide.",
      flame: "An apple-green flame, characteristic of barium.",
      heat: "No decomposition at ordinary flame temperature; water of crystallisation may be lost.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Barium gives the apple-green flame and the chloride gives curdy AgCl. The flame colour is the quickest way to separate barium from calcium.",
  },
  {
    id: "magnesium-sulphate",
    name: "Magnesium sulphate",
    formula: "MgSO₄·7H₂O",
    colour: "White crystalline",
    cation: "Mg²⁺",
    anion: "SO₄²⁻",
    observation: {
      hcl: "No gas; the solution stays colourless.",
      naoh: "A white precipitate of Mg(OH)₂ forms and does not dissolve in excess NaOH.",
      nh4oh: "A white precipitate forms, only slightly soluble in excess.",
      bacl2: "A white precipitate of BaSO₄ forms, insoluble in dilute HCl.",
      agno3: "No curdy precipitate.",
      flame: "No characteristic flame colour.",
      heat: "Loses water of crystallisation and turns anhydrous white; no gas is evolved.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Magnesium hydroxide is insoluble in excess NaOH, unlike zinc hydroxide. That difference is the clean separation between the two white hydroxides.",
  },
  {
    id: "sodium-carbonate",
    name: "Sodium carbonate",
    formula: "Na₂CO₃·10H₂O",
    colour: "White powder",
    cation: "Na⁺",
    anion: "CO₃²⁻",
    observation: {
      hcl: "Brisk effervescence; the gas turns lime water milky, so it is CO₂.",
      naoh: "No precipitate; sodium hydroxide is soluble.",
      nh4oh: "No precipitate.",
      bacl2: "A white precipitate of BaCO₃ forms, which dissolves in dilute HCl with effervescence.",
      agno3: "A pale yellow precipitate of silver carbonate forms, soluble in dilute nitric acid.",
      flame: "A golden-yellow flame, characteristic of sodium.",
      heat: "The decahydrate loses water and becomes a white powder; the anhydrous salt is stable.",
      water: "Dissolves readily; the solution is alkaline.",
    },
    note:
      "Sodium's golden-yellow flame is unmistakable, but the carbonate still has to be proved by CO₂ — the flame only identifies the cation.",
  },
  {
    id: "potassium-nitrate",
    name: "Potassium nitrate",
    formula: "KNO₃",
    colour: "White crystalline",
    cation: "K⁺",
    anion: "NO₃⁻",
    observation: {
      hcl: "No visible change.",
      naoh: "No precipitate; potassium hydroxide is soluble.",
      nh4oh: "No precipitate.",
      bacl2: "No precipitate.",
      agno3: "No curdy precipitate.",
      flame: "A lilac flame; sodium contamination can add yellow.",
      heat: "Melts and gives off oxygen; a glowing splint relights in the gas.",
      water: "Dissolves readily to a colourless solution.",
    },
    note:
      "Nitrate is confirmed by the brown NO₂ from lead nitrate or by the oxygen from heating potassium nitrate; a flame colour alone cannot prove the anion.",
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
  const recorder = useRecorder();

  const salt = useMemo(() => SALTS.find((entry) => entry.id === saltId) ?? SALTS[0], [saltId]);
  const testsRun = TESTS.filter((test) => run[test.id]).length;

  const chooseSalt = (next: SaltId) => {
    setSaltId(next);
    setRun({});
    setCation("");
    setAnion("");
    setVerdict("idle");
    recorder.reset();
  };

  const check = () => {
    if (!cation || !anion) {
      setVerdict("wrong");
      return;
    }
    setVerdict(cation === salt.cation && anion === salt.anion ? "right" : "wrong");
  };

  const recordResult = () => {
    const sample = SALTS.findIndex((entry) => entry.id === salt.id) + 1;
    void recorder.record("chemistry", `Salt analysis · Sample ${sample}`, [
      { label: "Tests run", value: testsRun },
      { label: "Correct inference", value: 1 },
    ]);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
              <p className="apple-lab-value mt-1 flex items-center gap-2 text-[15px] font-semibold">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--lab-line)]"
                  style={{ background: SALT_SWATCH[salt.id] }}
                  aria-hidden="true"
                />
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
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Cation</span>
              <ChoiceSelect
                variant="lab"
                value={cation}
                onChange={(next) => {
                  setCation(next);
                  setVerdict("idle");
                }}
                ariaLabel="Cation"
                placeholder="Choose the cation"
                options={CATIONS.map((entry) => ({ value: entry, label: entry }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Anion</span>
              <ChoiceSelect
                variant="lab"
                value={anion}
                onChange={(next) => {
                  setAnion(next);
                  setVerdict("idle");
                }}
                ariaLabel="Anion"
                placeholder="Choose the anion"
                options={ANIONS.map((entry) => ({ value: entry, label: entry }))}
              />
            </div>
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
                <div className="mt-2 flex flex-col gap-1 border-t border-[var(--lab-line-soft)] pt-2 text-[11px] text-[var(--lab-ink-dim)]">
                  <p><span className="text-[var(--lab-ink)]">Appearance:</span> {salt.colour}</p>
                  <p><span className="text-[var(--lab-ink)]">Ions:</span> {salt.cation}, {salt.anion}</p>
                  <p><span className="text-[var(--lab-ink)]">In water:</span> {salt.observation.water}</p>
                </div>
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]"
                  onClick={recordResult}
                  disabled={recorder.state === "saving" || recorder.state === "done"}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  {recorder.state === "done" ? "Result recorded" : recorder.state === "saving" ? "Recording…" : "Record result"}
                </button>
                {recorder.message ? (
                  <span className="text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">{recorder.message}</span>
                ) : null}
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

      {/* `min-w-0` on the details and the grid is load-bearing: a details
          element is a flex child, so its default `min-width:auto` lets the
          two-column example grid push the whole centred page wider than the
          viewport. Opening the library then scrolled the shell sideways. */}
      <details className="apple-lab-card min-w-0 overflow-hidden px-3 py-2.5">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-[var(--lab-ink)]">
          Salt library · {SALTS.length} examples
        </summary>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
          Open a sample after you have made your inference. These are the same
          salts used in the bench; the unknown above is one of them.
        </p>
        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
          {SALTS.map((entry, index) => (
            <div key={entry.id} className="min-w-0 rounded-lg border border-[var(--lab-line-soft)] px-2.5 py-2">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--lab-ink)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--lab-line)]"
                  style={{ background: SALT_SWATCH[entry.id] }}
                  aria-hidden="true"
                />
                {index + 1}. {entry.name}
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-[var(--lab-ink-dim)]">
                {entry.formula} · {entry.cation} / {entry.anion}
              </p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                {entry.colour}. {entry.note}
              </p>
            </div>
          ))}
        </div>
      </details>

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
