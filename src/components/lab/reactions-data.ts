/**
 * Reaction data for the Reactions stage.
 *
 * Each entry carries everything the stage needs: the chips, the balanced
 * equation, and the four-line teaching block (what the reaction is, where you
 * meet it, how it classifies, and its heat sign). The "named" group is real
 * chemistry students actually meet — household, industrial and environmental —
 * while the "types" group stays abstract so the categories stay legible.
 *
 * Nothing here references React or motion: the component imports from this
 * module, keeping the stage layout and the data separately editable.
 */

export type ReactionGroup = "types" | "named";

export interface ReactionPreset {
  /** Stable id — also the react-button run's storage key. */
  id: string;
  /** Row label in the picker. */
  type: string;
  /** The balanced equation, as shown under the stage. */
  label: string;
  /** One-line meaning shown before React is pressed. */
  note: string;
  /** Picker grouping. */
  group: ReactionGroup;
  /** One-line classification, revealed after React. */
  classification: string;
  /** What actually happens, in plain language, revealed after React. */
  explanation: string;
  /** Where the student meets this reaction, revealed after React. */
  realWorld: string;
  /** Heat sign of the reaction, or null when it is not a meaningful distinction. */
  heat: "exothermic" | "endothermic" | null;
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

export const REACTIONS: ReactionPreset[] = [
  /* ---------------- Reaction Types ---------------- */
  {
    id: "synthesis",
    type: "Synthesis",
    label: "2 H₂ + O₂ → 2 H₂O",
    note: "Two elements combine into one compound — the oxy-hydrogen pop test.",
    group: "types",
    classification: "Synthesis (combination) — two or more reactants, one product.",
    explanation:
      "Hydrogen and oxygen gases mix quietly, but a flame sets them off: the bonds inside each gas break and the atoms re-bond into water, releasing a pop of energy.",
    realWorld:
      "Hydrogen fuel cells run cars and buses on exactly this reaction, releasing electricity instead of a flame.",
    heat: "exothermic",
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
    group: "types",
    classification: "Decomposition — one reactant, two or more products.",
    explanation:
      "Hydrogen peroxide breaks its weakest O–O bond first, then the pieces re-bond into water and oxygen gas. Catalase in a wound, or manganese dioxide in a bottle, just speeds it up.",
    realWorld:
      "The fizz on a scraped knee is this exact reaction — blood's catalase decomposes the peroxide before it damages tissue.",
    heat: "exothermic",
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
    group: "types",
    classification: "Single displacement — one element replaces another in a compound.",
    explanation:
      "Zinc gives two electrons to copper(II) ions; the copper ions leave the solution as metal while the zinc dissolves in their place.",
    realWorld:
      "Scrap iron dropped into copper sulfate solution recovers pure copper — the same displacement runs inside every galvanised nail that protects steel.",
    heat: "exothermic",
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
    group: "types",
    classification: "Double displacement (metathesis) — ions exchange partners.",
    explanation:
      "In solution the four ions simply re-pair: Ag⁺ finds Cl⁻ and locks into an insoluble lattice, while Na⁺ and NO₃⁻ stay dissolved as spectators.",
    realWorld:
      "Chloride tests in water labs and old photographic film both read this reaction — film's silver salts darken the same way they precipitate here.",
    heat: null,
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
    note: "Complete combustion of methane — the clean blue Bunsen burner flame.",
    group: "types",
    classification: "Combustion — a fuel oxidises rapidly, releasing heat and light.",
    explanation:
      "Methane's C–H bonds break as oxygen attacks; carbon ends up in carbon dioxide and hydrogen in water, and the rearrangement dumps a lot of energy into the surroundings.",
    realWorld:
      "Every gas stove, water heater and Bunsen burner in a school lab burns methane this way.",
    heat: "exothermic",
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
    group: "types",
    classification: "Acid–base (neutralisation) — H⁺ meets OH⁻ to form water.",
    explanation:
      "The acid's H⁺ and the base's OH⁻ join into water; the leftover Na⁺ and Cl⁻ pair up as the salt. The indicator's colour change marks the exact crossover.",
    realWorld:
      "Antacid tablets neutralise excess stomach acid by the same logic, just with a gentler base.",
    heat: "exothermic",
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
    group: "types",
    classification: "Precipitation (a double displacement where the product is insoluble).",
    explanation:
      "Lead ions and iodide ions meet in the clear solution and build an insoluble yellow solid so fast it showers down; the potassium and nitrate ions never leave the water.",
    realWorld:
      "Water-treatment plants remove heavy metals like lead by precipitating them out with added ions — the same chemistry, scaled to a city's supply.",
    heat: null,
    reactants: [
      { formula: "Pb(NO₃)₂", coefficient: "1", color: rxnColor.acid },
      { formula: "KI", coefficient: "2", color: rxnColor.base },
    ],
    products: [
      { formula: "PbI₂", coefficient: "1", color: rxnColor.metal },
      { formula: "KNO₃", coefficient: "2", color: rxnColor.salt },
    ],
  },

  /* ---------------- Named real-world reactions ---------------- */
  {
    id: "slaked-lime",
    type: "Slaked lime",
    label: "CaO + H₂O → Ca(OH)₂",
    note: "Quicklime meets water and slakes into slaked lime — with heat.",
    group: "named",
    classification: "Synthesis (combination) — calcium oxide and water combine into one hydroxide.",
    explanation:
      "Water attacks the ionic lattice of calcium oxide; the oxide ion takes a proton from water to become hydroxide, and the solid swells and steams as it converts.",
    realWorld:
      "Cement and mortar set on this chemistry, farmers lime acidic soil with it, and whitewash on old walls is the same slaked lime drying back out.",
    heat: "exothermic",
    reactants: [
      { formula: "CaO", coefficient: "1", color: rxnColor.oxide },
      { formula: "H₂O", coefficient: "1", color: rxnColor.acid },
    ],
    products: [{ formula: "Ca(OH)₂", coefficient: "1", color: rxnColor.salt }],
  },
  {
    id: "rusting",
    type: "Rusting of iron",
    label: "4 Fe + 3 O₂ → 2 Fe₂O₃",
    note: "Iron oxidises slowly in moist air — the crumbly red-brown coat.",
    group: "named",
    classification: "Synthesis (oxidation) — a metal combines with oxygen into its oxide.",
    explanation:
      "Iron atoms give electrons to oxygen; the oxide that forms is flaky and porous, so it lets air and water keep reaching fresh metal underneath, unlike aluminium's clinging oxide skin.",
    realWorld:
      "Bridges, railings, car bodies and ships all need paint, oil or galvanising for exactly one reason: this reaction never stops on its own.",
    heat: "exothermic",
    reactants: [
      { formula: "Fe", coefficient: "4", color: rxnColor.metal },
      { formula: "O₂", coefficient: "3", color: rxnColor.acid },
    ],
    products: [{ formula: "Fe₂O₃", coefficient: "2", color: rxnColor.oxide }],
  },
  {
    id: "baking-soda",
    type: "Baking soda + vinegar",
    label: "NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂",
    note: "The classic volcano: baking soda and vinegar foam into carbon dioxide.",
    group: "named",
    classification: "Acid–base (neutralisation) with gas evolution — a double displacement that releases CO₂.",
    explanation:
      "Acetic acid hands a proton to the bicarbonate; the unstable carbonic acid that forms immediately breaks into water and carbon dioxide, and the gas is the fizz.",
    realWorld:
      "Baking powder lifts cakes with the same gas release, and this exact pair unclogs drains and raises the volcano at the science fair.",
    heat: "endothermic",
    reactants: [
      { formula: "NaHCO₃", coefficient: "1", color: rxnColor.base },
      { formula: "CH₃COOH", coefficient: "1", color: rxnColor.acid },
    ],
    products: [
      { formula: "CH₃COONa", coefficient: "1", color: rxnColor.salt },
      { formula: "H₂O", coefficient: "1", color: rxnColor.salt },
      { formula: "CO₂", coefficient: "1", color: rxnColor.gas },
    ],
  },
  {
    id: "photosynthesis",
    type: "Photosynthesis",
    label: "6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂",
    note: "Light-driven synthesis: carbon dioxide and water become glucose and oxygen.",
    group: "named",
    classification: "Synthesis (photochemical) — small molecules build glucose using light energy.",
    explanation:
      "Chlorophyll captures photons and uses that energy to split water; the hydrogen is bolted onto carbon dioxide, carbon by carbon, until the glucose ring closes and oxygen is left over.",
    realWorld:
      "Nearly every food chain starts here — the sugar made in a leaf is the energy a cow or a chemist eats, and the oxygen released is what we breathe.",
    heat: "endothermic",
    reactants: [
      { formula: "CO₂", coefficient: "6", color: rxnColor.oxide },
      { formula: "H₂O", coefficient: "6", color: rxnColor.acid },
    ],
    products: [
      { formula: "C₆H₁₂O₆", coefficient: "1", color: rxnColor.salt },
      { formula: "O₂", coefficient: "6", color: rxnColor.gas },
    ],
  },
  {
    id: "respiration",
    type: "Respiration",
    label: "C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O",
    note: "Photosynthesis run backwards: glucose burns gently inside your cells.",
    group: "named",
    classification: "Combustion (oxidation) — a controlled, enzyme-paced burn of glucose.",
    explanation:
      "Cells unpack glucose stepwise, stripping its electrons onto oxygen; carbon leaves as carbon dioxide and hydrogen as water, and each small step banks usable energy as ATP instead of flame-heat.",
    realWorld:
      "This is happening in every cell of your body right now — it is why you eat, why you breathe out CO₂, and why muscles warm up during exercise.",
    heat: "exothermic",
    reactants: [
      { formula: "C₆H₁₂O₆", coefficient: "1", color: rxnColor.salt },
      { formula: "O₂", coefficient: "6", color: rxnColor.acid },
    ],
    products: [
      { formula: "CO₂", coefficient: "6", color: rxnColor.oxide },
      { formula: "H₂O", coefficient: "6", color: rxnColor.salt },
    ],
  },
  {
    id: "limestone",
    type: "Limestone decomposition",
    label: "CaCO₃ → CaO + CO₂",
    note: "Limestone roasted in a kiln breaks into quicklime and carbon dioxide.",
    group: "named",
    classification: "Decomposition (thermal) — heat alone splits one compound into two.",
    explanation:
      "Around 900 °C the calcium–carbonate bond gives up: the lattice sheds carbon dioxide gas and collapses into calcium oxide, the white quicklime the kiln empties out.",
    realWorld:
      "The entire cement industry starts with this roasting; lime kilns have run the same reaction since the Romans made mortar.",
    heat: "endothermic",
    reactants: [{ formula: "CaCO₃", coefficient: "1", color: rxnColor.oxide }],
    products: [
      { formula: "CaO", coefficient: "1", color: rxnColor.oxide },
      { formula: "CO₂", coefficient: "1", color: rxnColor.gas },
    ],
  },
  {
    id: "acid-spill",
    type: "Neutralising an acid spill",
    label: "H₂SO₄ + 2 NaOH → Na₂SO₄ + 2 H₂O",
    note: "Spilled sulfuric acid is brought to salt and water with sodium hydroxide.",
    group: "named",
    classification: "Acid–base (neutralisation) — acid and base cancel exactly.",
    explanation:
      "Each sodium hydroxide donates an OH⁻ that mops up one H⁺ from the sulfuric acid; done in two rounds, the acid's bite is gone and only neutral sodium sulfate solution remains.",
    realWorld:
      "Lab spills are mopped up this way — weak base first, never bare hands — and the same stoichiometry sets the dose in industrial wastewater scrubbers.",
    heat: "exothermic",
    reactants: [
      { formula: "H₂SO₄", coefficient: "1", color: rxnColor.acid },
      { formula: "NaOH", coefficient: "2", color: rxnColor.base },
    ],
    products: [
      { formula: "Na₂SO₄", coefficient: "1", color: rxnColor.salt },
      { formula: "H₂O", coefficient: "2", color: rxnColor.salt },
    ],
  },
  {
    id: "silver-mirror",
    type: "Photographic silver reaction",
    label: "2 AgNO₃ + Cu → Cu(NO₃)₂ + 2 Ag",
    note: "Copper wire dipped in silver nitrate grows a glittering silver tree.",
    group: "named",
    classification: "Single displacement — copper displaces silver from its salt.",
    explanation:
      "Copper atoms dissolve by handing electrons to silver ions, which plate onto the wire as metallic silver crystals; the solution slowly turns blue with copper(II) nitrate.",
    realWorld:
      "Old photographic film depended on silver's chemistry, silver-plating jewellery runs the same ion transfer, and this classic demo grows a 'silver tree' on copper wire in a beaker.",
    heat: "exothermic",
    reactants: [
      { formula: "AgNO₃", coefficient: "2", color: rxnColor.acid },
      { formula: "Cu", coefficient: "1", color: rxnColor.metal },
    ],
    products: [
      { formula: "Cu(NO₃)₂", coefficient: "1", color: rxnColor.salt },
      { formula: "Ag", coefficient: "2", color: rxnColor.metal },
    ],
  },
  {
    id: "thermite",
    type: "Thermite",
    label: "2 Al + Fe₂O₃ → Al₂O₃ + 2 Fe",
    note: "Aluminum rips oxygen off iron(III) oxide in a violent aluminothermic flare.",
    group: "named",
    classification: "Single displacement (oxidation–reduction) — a more reactive metal steals the oxygen.",
    explanation:
      "Once ignited past its activation barrier, aluminium strips the oxygen from iron oxide; the freed iron lands as white-hot droplets and aluminium oxide smoke takes their place.",
    realWorld:
      "Rail crews weld train tracks with thermite on site, and it was used to cut steel in demolition and metalworking long before plasma torches.",
    heat: "exothermic",
    reactants: [
      { formula: "Al", coefficient: "2", color: rxnColor.metal },
      { formula: "Fe₂O₃", coefficient: "1", color: rxnColor.oxide },
    ],
    products: [
      { formula: "Al₂O₃", coefficient: "1", color: rxnColor.oxide },
      { formula: "Fe", coefficient: "2", color: rxnColor.metal },
    ],
  },
  {
    id: "burning-magnesium",
    type: "Burning magnesium",
    label: "2 Mg + O₂ → 2 MgO",
    note: "The blinding white ribbon — the classic synthesis demo of the school lab.",
    group: "named",
    classification: "Synthesis (oxidation) — a metal combines directly with oxygen.",
    explanation:
      "Ignition supplies the activation energy; after that, magnesium gives electrons to oxygen so readily that the reaction sustains itself in a fierce white flame, building magnesium oxide ash.",
    realWorld:
      "Once used in flash photography and flares for the same reason it dazzles in class — it burns hot, bright, and even underwater-friendly fireworks use it.",
    heat: "exothermic",
    reactants: [
      { formula: "Mg", coefficient: "2", color: rxnColor.metal },
      { formula: "O₂", coefficient: "1", color: rxnColor.acid },
    ],
    products: [{ formula: "MgO", coefficient: "2", color: rxnColor.oxide }],
  },
  {
    id: "chlorine-peroxide",
    type: "Chlorine + hydrogen peroxide",
    label: "H₂O₂ + Cl₂ → 2 HCl + O₂",
    note: "Two oxidisers collide — the peroxide wins the oxygen, chlorine settles as acid.",
    group: "named",
    classification: "Single displacement (redox) — oxygen is displaced from peroxide by chlorine.",
    explanation:
      "Chlorine oxidises the peroxide's oxygen–oxygen bond: the peroxide releases its oxygen as gas while chlorine drops to chloride, which pairs with the freed hydrogen as hydrochloric acid.",
    realWorld:
      "Why you never mix bleach and other cleaners: oxidising cleaners like peroxide and hypochlorite fight each other and can release hot acidic or chlorine fumes.",
    heat: "exothermic",
    reactants: [
      { formula: "H₂O₂", coefficient: "1", color: rxnColor.acid },
      { formula: "Cl₂", coefficient: "1", color: rxnColor.gas },
    ],
    products: [
      { formula: "HCl", coefficient: "2", color: rxnColor.acid },
      { formula: "O₂", coefficient: "1", color: rxnColor.gas },
    ],
  },
  {
    id: "electrolysis-water",
    type: "Electrolysis of water",
    label: "2 H₂O → 2 H₂ + O₂",
    note: "Electric current splits water into two pops of hydrogen and one of oxygen.",
    group: "named",
    classification: "Decomposition (electrolytic) — electricity, not heat, breaks the compound.",
    explanation:
      "The current pulls water apart at the electrodes: hydrogen gathers at the cathode and oxygen at the anode, in a strict two-to-one volume ratio that reveals water's formula.",
    realWorld:
      "Hydrogen fuel made from surplus renewable electricity, and the classic Hofmann voltameter demonstration in school labs, both split water exactly like this.",
    heat: "endothermic",
    reactants: [{ formula: "H₂O", coefficient: "2", color: rxnColor.salt }],
    products: [
      { formula: "H₂", coefficient: "2", color: rxnColor.gas },
      { formula: "O₂", coefficient: "1", color: rxnColor.acid },
    ],
  },
];
