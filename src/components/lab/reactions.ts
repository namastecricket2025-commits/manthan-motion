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
}

export const SUBSTANCES: Substance[] = [
  { id: "h2", formula: "H2", name: "Hydrogen gas", state: "gas" },
  { id: "o2", formula: "O2", name: "Oxygen gas", state: "gas" },
  { id: "n2", formula: "N2", name: "Nitrogen gas", state: "gas" },
  { id: "cl2", formula: "Cl2", name: "Chlorine gas", state: "gas" },
  { id: "co2", formula: "CO2", name: "Carbon dioxide", state: "gas" },
  { id: "ch4", formula: "CH4", name: "Methane", state: "gas" },
  { id: "nh3", formula: "NH3", name: "Ammonia", state: "gas" },
  { id: "h2o", formula: "H2O", name: "Water", state: "liquid" },
  { id: "hcl", formula: "HCl", name: "Hydrochloric acid", state: "aq" },
  { id: "naoh", formula: "NaOH", name: "Sodium hydroxide", state: "aq" },
  { id: "nacl", formula: "NaCl", name: "Sodium chloride", state: "aq" },
  { id: "cuso4", formula: "CuSO4", name: "Copper(II) sulfate", state: "aq" },
  { id: "agno3", formula: "AgNO3", name: "Silver nitrate", state: "aq" },
  { id: "na", formula: "Na", name: "Sodium metal", state: "solid" },
  { id: "mg", formula: "Mg", name: "Magnesium ribbon", state: "solid" },
  { id: "fe", formula: "Fe", name: "Iron filings", state: "solid" },
  { id: "cu", formula: "Cu", name: "Copper wire", state: "solid" },
  { id: "c", formula: "C", name: "Carbon (graphite)", state: "solid" },
  { id: "cao", formula: "CaO", name: "Quicklime", state: "solid" },
  { id: "caco3", formula: "CaCO3", name: "Limestone", state: "solid" },
];

export interface Reaction {
  /** Balanced equation in ASCII form, e.g. "2 H2 + O2 -> 2 H2O". */
  eq: string;
  type: string;
  /** What the learner should notice. */
  note: string;
}

/** Key is "idA|idB" with ids alphabetically sorted. */
export const REACTIONS: Record<string, Reaction> = {
  "h2|o2": {
    eq: "2 H2 + O2 -> 2 H2O",
    type: "Synthesis (combustion)",
    note: "Two volumes of hydrogen snap to one of oxygen — the classic oxy-hydrogen pop test produces water vapour.",
  },
  "na|cl2": {
    eq: "2 Na + Cl2 -> 2 NaCl",
    type: "Synthesis",
    note: "Sodium burns in chlorine with a bright yellow flame, depositing common table salt.",
  },
  "na|h2o": {
    eq: "2 Na + 2 H2O -> 2 NaOH + H2",
    type: "Single displacement",
    note: "Sodium fizzes violently on water, skating on the hydrogen gas it releases.",
  },
  "hcl|na": {
    eq: "2 Na + 2 HCl -> 2 NaCl + H2",
    type: "Single displacement",
    note: "The metal displaces hydrogen from the acid — bubbles of H2 appear at the surface.",
  },
  "hcl|naoh": {
    eq: "HCl + NaOH -> NaCl + H2O",
    type: "Neutralisation",
    note: "Acid and base cancel to salt and water; phenolphthalein would flash from pink to clear at the endpoint.",
  },
  "caco3|hcl": {
    eq: "CaCO3 + 2 HCl -> CaCl2 + H2O + CO2",
    type: "Acid + carbonate",
    note: "Limestone effervesces as carbon dioxide bubbles off — limewater turns milky.",
  },
  "hcl|nh3": {
    eq: "HCl + NH3 -> NH4Cl",
    type: "Synthesis (acid–base)",
    note: "The two gases meet as a white smoke ring of ammonium chloride.",
  },
  "co2|naoh": {
    eq: "2 NaOH + CO2 -> Na2CO3 + H2O",
    type: "Base + acidic oxide",
    note: "Carbon dioxide is absorbed by the alkali — the same reaction scrubs air in spacecraft.",
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
  },
  "c|o2": {
    eq: "C + O2 -> CO2",
    type: "Combustion",
    note: "Carbon burns in excess oxygen; with limited air it would instead yield toxic CO.",
  },
  "mg|o2": {
    eq: "2 Mg + 2 O2 -> 2 MgO",
    type: "Combustion",
    note: "Magnesium burns with a blinding white light, leaving powdery white magnesium oxide.",
  },
  "fe|o2": {
    eq: "4 Fe + 3 O2 -> 2 Fe2O3",
    type: "Oxidation",
    note: "Rusting, sped up: fine iron filings burn, forming ferric oxide.",
  },
  "cu|o2": {
    eq: "2 Cu + O2 -> 2 CuO",
    type: "Oxidation",
    note: "Copper tarnishes black as cupric oxide forms on its surface.",
  },
  "cuso4|fe": {
    eq: "Fe + CuSO4 -> FeSO4 + Cu",
    type: "Single displacement",
    note: "Iron is more reactive than copper — the blue solution fades and pink copper plates out.",
  },
  "hcl|mg": {
    eq: "Mg + 2 HCl -> MgCl2 + H2",
    type: "Single displacement",
    note: "Magnesium dissolves briskly, liberating hydrogen from the acid.",
  },
  "agno3|nacl": {
    eq: "AgNO3 + NaCl -> AgCl + NaNO3",
    type: "Double displacement",
    note: "Insoluble silver chloride precipitates as a curdy white solid that darkens in light.",
  },
  "h2|n2": {
    eq: "N2 + 3 H2 -> 2 NH3",
    type: "Synthesis (Haber)",
    note: "The Haber process: needs an iron catalyst, ~450 °C and high pressure to run at useful speed.",
  },
  "cao|h2o": {
    eq: "CaO + H2O -> Ca(OH)2",
    type: "Synthesis (slaking)",
    note: "Quicklime slakes with a hiss and heat, puffing into calcium hydroxide (slaked lime).",
  },
  "cuso4|naoh": {
    eq: "CuSO4 + 2 NaOH -> Cu(OH)2 + Na2SO4",
    type: "Double displacement",
    note: "A pale-blue gelatinous precipitate of copper hydroxide forms instantly.",
  },
  "fe|hcl": {
    eq: "Fe + 2 HCl -> FeCl2 + H2",
    type: "Single displacement",
    note: "Iron dissolves in dilute acid to a pale-green ferrous chloride solution.",
  },
  "cao|co2": {
    eq: "CaO + CO2 -> CaCO3",
    type: "Synthesis",
    note: "The reverse of lime-burning: quicklime re-absorbs CO2 back into limestone.",
  },
};