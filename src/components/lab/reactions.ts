/**
 * Reaction workbench data — a curated lab set. Equations use plain ASCII
 * ("H2 + O2 -> 2 H2O"); the UI renders digits as subscripts and "->" as
 * "→". Only reactions that actually occur are listed — unlisted pairs get
 * an honest "no direct reaction" message.
 */

export interface Substance {
  id: string;
  formula: string;
  name: string;
  state: "gas" | "liquid" | "solid" | "aq";
  /** Accent colour used for the substance's visual tile. */
  color: string;
}

export const SUBSTANCES: Substance[] = [
  { id: "h2", formula: "H2", name: "Hydrogen gas", state: "gas", color: "#7fb4c9" },
  { id: "o2", formula: "O2", name: "Oxygen gas", state: "gas", color: "#5aa0b5" },
  { id: "n2", formula: "N2", name: "Nitrogen gas", state: "gas", color: "#6f8fae" },
  { id: "cl2", formula: "Cl2", name: "Chlorine gas", state: "gas", color: "#8fa86a" },
  { id: "co2", formula: "CO2", name: "Carbon dioxide", state: "gas", color: "#7d8f78" },
  { id: "ch4", formula: "CH4", name: "Methane", state: "gas", color: "#8aa0b8" },
  { id: "nh3", formula: "NH3", name: "Ammonia", state: "gas", color: "#8f9bb8" },
  { id: "h2o", formula: "H2O", name: "Water", state: "liquid", color: "#4f7f8a" },
  { id: "h2o2", formula: "H2O2", name: "Hydrogen peroxide", state: "aq", color: "#7fb4d0" },
  { id: "hcl", formula: "HCl", name: "Hydrochloric acid", state: "aq", color: "#4f8a7a" },
  { id: "h2so4", formula: "H2SO4", name: "Sulfuric acid", state: "aq", color: "#3f7d8a" },
  { id: "naoh", formula: "NaOH", name: "Sodium hydroxide", state: "aq", color: "#5f8a7c" },
  { id: "nacl", formula: "NaCl", name: "Sodium chloride", state: "aq", color: "#6a8f9a" },
  { id: "cuso4", formula: "CuSO4", name: "Copper(II) sulfate", state: "aq", color: "#3f7d96" },
  { id: "agno3", formula: "AgNO3", name: "Silver nitrate", state: "aq", color: "#7d8f96" },
  { id: "bacl2", formula: "BaCl2", name: "Barium chloride", state: "aq", color: "#8a9a6a" },
  { id: "na2so4", formula: "Na2SO4", name: "Sodium sulfate", state: "aq", color: "#6a8fa0" },
  { id: "kmno4", formula: "KMnO4", name: "Potassium permanganate", state: "solid", color: "#8a5fa0" },
  { id: "na", formula: "Na", name: "Sodium metal", state: "solid", color: "#c2543f" },
  { id: "mg", formula: "Mg", name: "Magnesium ribbon", state: "solid", color: "#c07a3e" },
  { id: "zn", formula: "Zn", name: "Zinc granules", state: "solid", color: "#9aa5b1" },
  { id: "fe", formula: "Fe", name: "Iron filings", state: "solid", color: "#b0715f" },
  { id: "cu", formula: "Cu", name: "Copper wire", state: "solid", color: "#c48a4f" },
  { id: "c", formula: "C", name: "Carbon (graphite)", state: "solid", color: "#8a8a8a" },
  { id: "cao", formula: "CaO", name: "Quicklime", state: "solid", color: "#b0a68a" },
  { id: "caco3", formula: "CaCO3", name: "Limestone", state: "solid", color: "#a8a08a" },
  { id: "k", formula: "K", name: "Potassium metal", state: "solid", color: "#b0786a" },
  { id: "al", formula: "Al", name: "Aluminium foil", state: "solid", color: "#a8b2bc" },
  { id: "ca", formula: "Ca", name: "Calcium granules", state: "solid", color: "#b8bcc4" },
  { id: "pb", formula: "Pb", name: "Lead shot", state: "solid", color: "#8e94a0" },
  { id: "ki", formula: "KI", name: "Potassium iodide", state: "aq", color: "#7f9ab5" },
  { id: "pbno3", formula: "Pb(NO3)2", name: "Lead(II) nitrate", state: "aq", color: "#8f9aa8" },
  { id: "nabr", formula: "NaBr", name: "Sodium bromide", state: "aq", color: "#8aa8b0" },
  { id: "nahco3", formula: "NaHCO3", name: "Sodium bicarbonate", state: "solid", color: "#c9c4b0" },
  { id: "s", formula: "S", name: "Sulfur powder", state: "solid", color: "#d4a437" },
  { id: "h2s", formula: "H2S", name: "Hydrogen sulfide", state: "gas", color: "#b8a84f" },
  { id: "so2", formula: "SO2", name: "Sulfur dioxide", state: "gas", color: "#a8a878" },
  { id: "fe2o3", formula: "Fe2O3", name: "Iron(III) oxide", state: "solid", color: "#b06050" },
  { id: "na2co3", formula: "Na2CO3", name: "Sodium carbonate", state: "solid", color: "#b8b0a0" },
];

export interface Reaction {
  /** Balanced equation in ASCII form, e.g. "2 H2 + O2 -> 2 H2O". */
  eq: string;
  type: string;
  /** What the learner should notice. */
  note: string;
  /** Textbook energy classification (omitted where ambiguous). */
  energy?: "exo" | "endo";
}

/** Key is "idA|idB" with ids alphabetically sorted. */
export const REACTIONS: Record<string, Reaction> = {
  "h2|o2": {
    eq: "2 H2 + O2 -> 2 H2O",
    type: "Synthesis (combustion)",
    note: "Two volumes of hydrogen snap to one of oxygen — the classic oxy-hydrogen pop test produces water vapour.",
    energy: "exo",
  },
  "na|cl2": {
    eq: "2 Na + Cl2 -> 2 NaCl",
    type: "Synthesis",
    note: "Sodium burns in chlorine with a bright yellow flame, depositing common table salt.",
    energy: "exo",
  },
  "na|h2o": {
    eq: "2 Na + 2 H2O -> 2 NaOH + H2",
    type: "Single displacement",
    note: "Sodium fizzes violently on water, skating on the hydrogen gas it releases.",
    energy: "exo",
  },
  "hcl|na": {
    eq: "2 Na + 2 HCl -> 2 NaCl + H2",
    type: "Single displacement",
    note: "The metal displaces hydrogen from the acid — bubbles of H2 appear at the surface.",
    energy: "exo",
  },
  "hcl|naoh": {
    eq: "HCl + NaOH -> NaCl + H2O",
    type: "Neutralisation",
    note: "Acid and base cancel to salt and water; phenolphthalein would flash from pink to clear at the endpoint.",
    energy: "exo",
  },
  "h2so4|naoh": {
    eq: "H2SO4 + 2 NaOH -> Na2SO4 + 2 H2O",
    type: "Neutralisation",
    note: "Sulfuric acid is diprotic — one mole neutralises two of hydroxide, releasing two waters.",
    energy: "exo",
  },
  "caco3|hcl": {
    eq: "CaCO3 + 2 HCl -> CaCl2 + H2O + CO2",
    type: "Acid + carbonate",
    note: "Limestone effervesces as carbon dioxide bubbles off — limewater turns milky.",
    energy: "exo",
  },
  "caco3|h2so4": {
    eq: "CaCO3 + H2SO4 -> CaSO4 + H2O + CO2",
    type: "Acid + carbonate",
    note: "The reaction slows down quickly because insoluble calcium sulfate coats the limestone.",
  },
  "hcl|nh3": {
    eq: "HCl + NH3 -> NH4Cl",
    type: "Synthesis (acid–base)",
    note: "The two gases meet as a white smoke ring of ammonium chloride.",
    energy: "exo",
  },
  "co2|naoh": {
    eq: "2 NaOH + CO2 -> Na2CO3 + H2O",
    type: "Base + acidic oxide",
    note: "Carbon dioxide is absorbed by the alkali — the same reaction scrubs air in spacecraft.",
    energy: "exo",
  },
  "co2|h2o": {
    eq: "CO2 + H2O -> H2CO3",
    type: "Synthesis",
    note: "Carbonated water: dissolved CO2 forms weak carbonic acid (pH ≈ 4–5).",
  },
  "ch4|o2": {
    eq: "CH4 + 2 O2 -> CO2 + 2 H2O",
    type: "Combustion",
    note: "Complete combustion of methane — the clean blue flame of a Bunsen burner on its air hole.",
    energy: "exo",
  },
  "c|o2": {
    eq: "C + O2 -> CO2",
    type: "Combustion",
    note: "Carbon burns in excess oxygen; with limited air it would instead yield toxic CO.",
    energy: "exo",
  },
  "mg|o2": {
    eq: "2 Mg + O2 -> 2 MgO",
    type: "Combustion",
    note: "Magnesium burns with a blinding white light, leaving powdery white magnesium oxide.",
    energy: "exo",
  },
  "fe|o2": {
    eq: "4 Fe + 3 O2 -> 2 Fe2O3",
    type: "Oxidation",
    note: "Rusting, sped up: fine iron filings burn, forming ferric oxide.",
    energy: "exo",
  },
  "cu|o2": {
    eq: "2 Cu + O2 -> 2 CuO",
    type: "Oxidation",
    note: "Copper tarnishes black as cupric oxide forms on its surface.",
    energy: "exo",
  },
  "na|o2": {
    eq: "4 Na + O2 -> 2 Na2O",
    type: "Oxidation",
    note: "Freshly cut sodium tarnishes instantly in air — the shiny surface dulls to sodium oxide.",
    energy: "exo",
  },
  "cuso4|fe": {
    eq: "Fe + CuSO4 -> FeSO4 + Cu",
    type: "Single displacement",
    note: "Iron is more reactive than copper — the blue solution fades and pink copper plates out.",
  },
  "cuso4|zn": {
    eq: "Zn + CuSO4 -> ZnSO4 + Cu",
    type: "Single displacement",
    note: "Zinc out-competes copper — blue fades as copper metal blooms on the zinc granules.",
    energy: "exo",
  },
  "hcl|mg": {
    eq: "Mg + 2 HCl -> MgCl2 + H2",
    type: "Single displacement",
    note: "Magnesium dissolves briskly, liberating hydrogen from the acid.",
    energy: "exo",
  },
  "hcl|zn": {
    eq: "Zn + 2 HCl -> ZnCl2 + H2",
    type: "Single displacement",
    note: "Zinc fizzes steadily in dilute acid; the gas pops a lighted splint.",
    energy: "exo",
  },
  "agno3|nacl": {
    eq: "AgNO3 + NaCl -> AgCl + NaNO3",
    type: "Double displacement",
    note: "Insoluble silver chloride precipitates as a curdy white solid that darkens in light.",
  },
  "bacl2|na2so4": {
    eq: "BaCl2 + Na2SO4 -> BaSO4 + 2 NaCl",
    type: "Double displacement",
    note: "A dense white precipitate of barium sulfate forms instantly — the classic sulfate test.",
  },
  "h2|n2": {
    eq: "N2 + 3 H2 -> 2 NH3",
    type: "Synthesis (Haber)",
    note: "The Haber process: needs an iron catalyst, ~450 °C and high pressure to run at useful speed. The reaction itself releases heat.",
    energy: "exo",
  },
  "cao|h2o": {
    eq: "CaO + H2O -> Ca(OH)2",
    type: "Synthesis (slaking)",
    note: "Quicklime slakes with a hiss and heat, puffing into calcium hydroxide (slaked lime).",
    energy: "exo",
  },
  "cuso4|naoh": {
    eq: "CuSO4 + 2 NaOH -> Cu(OH)2 + Na2SO4",
    type: "Double displacement",
    note: "A pale-blue gelatinous precipitate of copper hydroxide forms instantly.",
    energy: "exo",
  },
  "fe|hcl": {
    eq: "Fe + 2 HCl -> FeCl2 + H2",
    type: "Single displacement",
    note: "Iron dissolves in dilute acid to a pale-green ferrous chloride solution.",
    energy: "exo",
  },
  "cao|co2": {
    eq: "CaO + CO2 -> CaCO3",
    type: "Synthesis",
    note: "The reverse of lime-burning: quicklime re-absorbs CO2 back into limestone.",
    energy: "exo",
  },
  "h2o2|kmno4": {
    eq: "2 KMnO4 + 3 H2O2 -> 2 MnO2 + 3 O2 + 2 KOH + 2 H2O",
    type: "Redox (catalysed)",
    note: "In neutral solution permanganate is reduced to brown manganese dioxide while peroxide is oxidised to oxygen — the purple colour fades and the liquid turns cloudy.",
  },
  "agno3|ki": {
    eq: "AgNO3 + KI -> AgI + KNO3",
    type: "Double displacement",
    note: "Silver iodide precipitates as a bright yellow solid — the classic halide test.",
  },
  "agno3|nabr": {
    eq: "AgNO3 + NaBr -> AgBr + NaNO3",
    type: "Double displacement",
    note: "Pale-yellow silver bromide precipitates; it darkens on exposure to light — the basis of photographic film.",
  },
  "agno3|zn": {
    eq: "Zn + 2 AgNO3 -> Zn(NO3)2 + 2 Ag",
    type: "Single displacement",
    note: "Zinc displaces silver — a shiny silver 'tree' grows on the zinc granules.",
    energy: "exo",
  },
  "agno3|cu": {
    eq: "Cu + 2 AgNO3 -> Cu(NO3)2 + 2 Ag",
    type: "Single displacement",
    note: "The classic silver tree: copper wire displaces silver ions, leaving a blue copper(II) solution.",
  },
  "al|hcl": {
    eq: "2 Al + 6 HCl -> 2 AlCl3 + 3 H2",
    type: "Single displacement",
    note: "Aluminium dissolves steadily, releasing hydrogen — an oxide skin first slows it down.",
    energy: "exo",
  },
  "al|o2": {
    eq: "4 Al + 3 O2 -> 2 Al2O3",
    type: "Oxidation",
    note: "Aluminium's passivating oxide skin is why foil doesn't rust away — the same film makes the metal corrosion-proof.",
    energy: "exo",
  },
  "ca|h2o": {
    eq: "Ca + 2 H2O -> Ca(OH)2 + H2",
    type: "Single displacement",
    note: "Calcium fizzes steadily in cold water — less violent than sodium, releasing hydrogen and limewater.",
    energy: "exo",
  },
  "ca|o2": {
    eq: "2 Ca + O2 -> 2 CaO",
    type: "Oxidation",
    note: "Calcium burns with a brick-red flame into quicklime.",
    energy: "exo",
  },
  "fe2o3|al": {
    eq: "Fe2O3 + 2 Al -> Al2O3 + 2 Fe",
    type: "Thermite (redox)",
    note: "The thermite reaction: aluminium rips oxygen off iron(III) oxide, releasing molten iron at ~2500 °C.",
    energy: "exo",
  },
  "fe2o3|hcl": {
    eq: "Fe2O3 + 6 HCl -> 2 FeCl3 + 3 H2O",
    type: "Acid + basic oxide",
    note: "Rust dissolves in acid to a yellow ferric chloride solution — the basis of rust removal.",
  },
  "h2s|o2": {
    eq: "2 H2S + 3 O2 -> 2 SO2 + 2 H2O",
    type: "Combustion",
    note: "Hydrogen sulfide burns with a blue flame into pungent sulfur dioxide.",
    energy: "exo",
  },
  "hcl|nahco3": {
    eq: "NaHCO3 + HCl -> NaCl + H2O + CO2",
    type: "Acid + carbonate",
    note: "Baking soda effervesces in acid — the same reaction that makes cakes rise.",
    energy: "exo",
  },
  "hcl|na2co3": {
    eq: "Na2CO3 + 2 HCl -> 2 NaCl + H2O + CO2",
    type: "Acid + carbonate",
    note: "Washing soda fizzes briskly; limewater turns milky from the CO2.",
    energy: "exo",
  },
  "k|cl2": {
    eq: "2 K + Cl2 -> 2 KCl",
    type: "Synthesis",
    note: "Potassium bursts into lilac flame in chlorine gas, depositing potash salt.",
    energy: "exo",
  },
  "k|h2o": {
    eq: "2 K + 2 H2O -> 2 KOH + H2",
    type: "Single displacement",
    note: "Potassium reacts more violently than sodium — the hydrogen ignites in the lilac flame.",
    energy: "exo",
  },
  "k|o2": {
    eq: "4 K + O2 -> 2 K2O",
    type: "Oxidation",
    note: "A freshly cut potassium surface tarnishes within seconds in air.",
    energy: "exo",
  },
  "nahco3|naoh": {
    eq: "NaHCO3 + NaOH -> Na2CO3 + H2O",
    type: "Acid–base",
    note: "The bicarbonate neutralises hydroxide into carbonate — amphoteric HCO₃⁻ acting as an acid.",
  },
  "pbno3|ki": {
    eq: "Pb(NO3)2 + 2 KI -> PbI2 + 2 KNO3",
    type: "Double displacement",
    note: "A glorious golden-yellow precipitate of lead iodide — the 'golden rain' experiment.",
  },
  "pbno3|nacl": {
    eq: "Pb(NO3)2 + 2 NaCl -> PbCl2 + 2 NaNO3",
    type: "Double displacement",
    note: "White lead chloride precipitates; it redissolves in hot water.",
  },
  "pbno3|na2so4": {
    eq: "Pb(NO3)2 + Na2SO4 -> PbSO4 + 2 NaNO3",
    type: "Double displacement",
    note: "Insoluble lead sulfate falls as a dense white solid.",
  },
  "s|o2": {
    eq: "S + O2 -> SO2",
    type: "Combustion",
    note: "Sulfur burns with a blue flame and a choking smell — the ancient 'brimstone'.",
    energy: "exo",
  },
  "so2|naoh": {
    eq: "SO2 + 2 NaOH -> Na2SO3 + H2O",
    type: "Base + acidic oxide",
    note: "Sulfur dioxide, an acidic oxide, is trapped by the alkali as sulfite — a flue-gas scrubbing reaction.",
    energy: "exo",
  },
  "cuso4|mg": {
    eq: "Mg + CuSO4 -> MgSO4 + Cu",
    type: "Single displacement",
    note: "Magnesium displaces copper even faster than iron — the blue solution fades immediately.",
    energy: "exo",
  },
  "h2so4|zn": {
    eq: "Zn + H2SO4 -> ZnSO4 + H2",
    type: "Single displacement",
    note: "Zinc with dilute sulfuric acid — the standard lab preparation of hydrogen.",
    energy: "exo",
  },
  "cao|hcl": {
    eq: "CaO + 2 HCl -> CaCl2 + H2O",
    type: "Acid + basic oxide",
    note: "Quicklime neutralises acid to calcium chloride and water.",
    energy: "exo",
  },
  "na2co3|h2so4": {
    eq: "Na2CO3 + H2SO4 -> Na2SO4 + H2O + CO2",
    type: "Acid + carbonate",
    note: "Washing soda fizzes off carbon dioxide into sodium sulfate.",
    energy: "exo",
  },
};