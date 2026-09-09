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
    note: "The Haber process: needs an iron catalyst, ~450 °C and high pressure to run at useful speed.",
    energy: "endo",
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
    eq: "2 KMnO4 + 5 H2O2 + 3 H2SO4 -> 2 MnSO4 + K2SO4 + 8 H2O + 5 O2",
    type: "Redox (catalysed)",
    note: "Purple permanganate is reduced to pale Mn²⁺ while peroxide is oxidised to oxygen — the 'purple → colourless' fade.",
  },
  "h2o2|h2o": {
    eq: "2 H2O2 -> 2 H2O + O2",
    type: "Disproportionation",
    note: "Peroxide slowly self-decomposes; manganese dioxide or light speeds it up — the oxygen relights a glowing splint.",
  },
};