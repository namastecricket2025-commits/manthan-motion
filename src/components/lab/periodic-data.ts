/**
 * Periodic table data — atomic number, symbol, name, standard atomic weight,
 * category and phase at STP (or "synthetic" for man-made elements).
 * Electron configurations are derived from the Aufbau filling order at
 * runtime (see configFor), so they stay consistent with atomic number.
 */

export type Category =
  | "alkali"
  | "alkaline"
  | "transition"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble gas"
  | "lanthanide"
  | "actinide"
  | "synthetic";

export type Phase = "solid" | "liquid" | "gas" | "synthetic";

export interface ElementData {
  n: number;
  sym: string;
  name: string;
  mass: string;
  cat: Category;
  phase: Phase;
}

/** n, sym, name, mass, category, phase */
export const ELEMENTS: ElementData[] = [
  { n: 1, sym: "H", name: "Hydrogen", mass: "1.008", cat: "nonmetal", phase: "gas" },
  { n: 2, sym: "He", name: "Helium", mass: "4.0026", cat: "noble gas", phase: "gas" },
  { n: 3, sym: "Li", name: "Lithium", mass: "6.94", cat: "alkali", phase: "solid" },
  { n: 4, sym: "Be", name: "Beryllium", mass: "9.0122", cat: "alkaline", phase: "solid" },
  { n: 5, sym: "B", name: "Boron", mass: "10.81", cat: "metalloid", phase: "solid" },
  { n: 6, sym: "C", name: "Carbon", mass: "12.011", cat: "nonmetal", phase: "solid" },
  { n: 7, sym: "N", name: "Nitrogen", mass: "14.007", cat: "nonmetal", phase: "gas" },
  { n: 8, sym: "O", name: "Oxygen", mass: "15.999", cat: "nonmetal", phase: "gas" },
  { n: 9, sym: "F", name: "Fluorine", mass: "18.998", cat: "halogen", phase: "gas" },
  { n: 10, sym: "Ne", name: "Neon", mass: "20.180", cat: "noble gas", phase: "gas" },
  { n: 11, sym: "Na", name: "Sodium", mass: "22.990", cat: "alkali", phase: "solid" },
  { n: 12, sym: "Mg", name: "Magnesium", mass: "24.305", cat: "alkaline", phase: "solid" },
  { n: 13, sym: "Al", name: "Aluminium", mass: "26.982", cat: "post-transition", phase: "solid" },
  { n: 14, sym: "Si", name: "Silicon", mass: "28.085", cat: "metalloid", phase: "solid" },
  { n: 15, sym: "P", name: "Phosphorus", mass: "30.974", cat: "nonmetal", phase: "solid" },
  { n: 16, sym: "S", name: "Sulfur", mass: "32.06", cat: "nonmetal", phase: "solid" },
  { n: 17, sym: "Cl", name: "Chlorine", mass: "35.45", cat: "halogen", phase: "gas" },
  { n: 18, sym: "Ar", name: "Argon", mass: "39.948", cat: "noble gas", phase: "gas" },
  { n: 19, sym: "K", name: "Potassium", mass: "39.098", cat: "alkali", phase: "solid" },
  { n: 20, sym: "Ca", name: "Calcium", mass: "40.078", cat: "alkaline", phase: "solid" },
  { n: 21, sym: "Sc", name: "Scandium", mass: "44.956", cat: "transition", phase: "solid" },
  { n: 22, sym: "Ti", name: "Titanium", mass: "47.867", cat: "transition", phase: "solid" },
  { n: 23, sym: "V", name: "Vanadium", mass: "50.942", cat: "transition", phase: "solid" },
  { n: 24, sym: "Cr", name: "Chromium", mass: "51.996", cat: "transition", phase: "solid" },
  { n: 25, sym: "Mn", name: "Manganese", mass: "54.938", cat: "transition", phase: "solid" },
  { n: 26, sym: "Fe", name: "Iron", mass: "55.845", cat: "transition", phase: "solid" },
  { n: 27, sym: "Co", name: "Cobalt", mass: "58.933", cat: "transition", phase: "solid" },
  { n: 28, sym: "Ni", name: "Nickel", mass: "58.693", cat: "transition", phase: "solid" },
  { n: 29, sym: "Cu", name: "Copper", mass: "63.546", cat: "transition", phase: "solid" },
  { n: 30, sym: "Zn", name: "Zinc", mass: "65.38", cat: "transition", phase: "solid" },
  { n: 31, sym: "Ga", name: "Gallium", mass: "69.723", cat: "post-transition", phase: "solid" },
  { n: 32, sym: "Ge", name: "Germanium", mass: "72.630", cat: "metalloid", phase: "solid" },
  { n: 33, sym: "As", name: "Arsenic", mass: "74.922", cat: "metalloid", phase: "solid" },
  { n: 34, sym: "Se", name: "Selenium", mass: "78.971", cat: "nonmetal", phase: "solid" },
  { n: 35, sym: "Br", name: "Bromine", mass: "79.904", cat: "halogen", phase: "liquid" },
  { n: 36, sym: "Kr", name: "Krypton", mass: "83.798", cat: "noble gas", phase: "gas" },
  { n: 37, sym: "Rb", name: "Rubidium", mass: "85.468", cat: "alkali", phase: "solid" },
  { n: 38, sym: "Sr", name: "Strontium", mass: "87.62", cat: "alkaline", phase: "solid" },
  { n: 39, sym: "Y", name: "Yttrium", mass: "88.906", cat: "transition", phase: "solid" },
  { n: 40, sym: "Zr", name: "Zirconium", mass: "91.224", cat: "transition", phase: "solid" },
  { n: 41, sym: "Nb", name: "Niobium", mass: "92.906", cat: "transition", phase: "solid" },
  { n: 42, sym: "Mo", name: "Molybdenum", mass: "95.95", cat: "transition", phase: "solid" },
  { n: 43, sym: "Tc", name: "Technetium", mass: "98", cat: "transition", phase: "solid" },
  { n: 44, sym: "Ru", name: "Ruthenium", mass: "101.07", cat: "transition", phase: "solid" },
  { n: 45, sym: "Rh", name: "Rhodium", mass: "102.91", cat: "transition", phase: "solid" },
  { n: 46, sym: "Pd", name: "Palladium", mass: "106.42", cat: "transition", phase: "solid" },
  { n: 47, sym: "Ag", name: "Silver", mass: "107.87", cat: "transition", phase: "solid" },
  { n: 48, sym: "Cd", name: "Cadmium", mass: "112.41", cat: "transition", phase: "solid" },
  { n: 49, sym: "In", name: "Indium", mass: "114.82", cat: "post-transition", phase: "solid" },
  { n: 50, sym: "Sn", name: "Tin", mass: "118.71", cat: "post-transition", phase: "solid" },
  { n: 51, sym: "Sb", name: "Antimony", mass: "121.76", cat: "metalloid", phase: "solid" },
  { n: 52, sym: "Te", name: "Tellurium", mass: "127.60", cat: "metalloid", phase: "solid" },
  { n: 53, sym: "I", name: "Iodine", mass: "126.90", cat: "halogen", phase: "solid" },
  { n: 54, sym: "Xe", name: "Xenon", mass: "131.29", cat: "noble gas", phase: "gas" },
  { n: 55, sym: "Cs", name: "Caesium", mass: "132.91", cat: "alkali", phase: "solid" },
  { n: 56, sym: "Ba", name: "Barium", mass: "137.33", cat: "alkaline", phase: "solid" },
  { n: 57, sym: "La", name: "Lanthanum", mass: "138.91", cat: "lanthanide", phase: "solid" },
  { n: 58, sym: "Ce", name: "Cerium", mass: "140.12", cat: "lanthanide", phase: "solid" },
  { n: 59, sym: "Pr", name: "Praseodymium", mass: "140.91", cat: "lanthanide", phase: "solid" },
  { n: 60, sym: "Nd", name: "Neodymium", mass: "144.24", cat: "lanthanide", phase: "solid" },
  { n: 61, sym: "Pm", name: "Promethium", mass: "145", cat: "lanthanide", phase: "solid" },
  { n: 62, sym: "Sm", name: "Samarium", mass: "150.36", cat: "lanthanide", phase: "solid" },
  { n: 63, sym: "Eu", name: "Europium", mass: "151.96", cat: "lanthanide", phase: "solid" },
  { n: 64, sym: "Gd", name: "Gadolinium", mass: "157.25", cat: "lanthanide", phase: "solid" },
  { n: 65, sym: "Tb", name: "Terbium", mass: "158.93", cat: "lanthanide", phase: "solid" },
  { n: 66, sym: "Dy", name: "Dysprosium", mass: "162.50", cat: "lanthanide", phase: "solid" },
  { n: 67, sym: "Ho", name: "Holmium", mass: "164.93", cat: "lanthanide", phase: "solid" },
  { n: 68, sym: "Er", name: "Erbium", mass: "167.26", cat: "lanthanide", phase: "solid" },
  { n: 69, sym: "Tm", name: "Thulium", mass: "168.93", cat: "lanthanide", phase: "solid" },
  { n: 70, sym: "Yb", name: "Ytterbium", mass: "173.05", cat: "lanthanide", phase: "solid" },
  { n: 71, sym: "Lu", name: "Lutetium", mass: "174.97", cat: "lanthanide", phase: "solid" },
  { n: 72, sym: "Hf", name: "Hafnium", mass: "178.49", cat: "transition", phase: "solid" },
  { n: 73, sym: "Ta", name: "Tantalum", mass: "180.95", cat: "transition", phase: "solid" },
  { n: 74, sym: "W", name: "Tungsten", mass: "183.84", cat: "transition", phase: "solid" },
  { n: 75, sym: "Re", name: "Rhenium", mass: "186.21", cat: "transition", phase: "solid" },
  { n: 76, sym: "Os", name: "Osmium", mass: "190.23", cat: "transition", phase: "solid" },
  { n: 77, sym: "Ir", name: "Iridium", mass: "192.22", cat: "transition", phase: "solid" },
  { n: 78, sym: "Pt", name: "Platinum", mass: "195.08", cat: "transition", phase: "solid" },
  { n: 79, sym: "Au", name: "Gold", mass: "196.97", cat: "transition", phase: "solid" },
  { n: 80, sym: "Hg", name: "Mercury", mass: "200.59", cat: "transition", phase: "liquid" },
  { n: 81, sym: "Tl", name: "Thallium", mass: "204.38", cat: "post-transition", phase: "solid" },
  { n: 82, sym: "Pb", name: "Lead", mass: "207.2", cat: "post-transition", phase: "solid" },
  { n: 83, sym: "Bi", name: "Bismuth", mass: "208.98", cat: "post-transition", phase: "solid" },
  { n: 84, sym: "Po", name: "Polonium", mass: "209", cat: "metalloid", phase: "solid" },
  { n: 85, sym: "At", name: "Astatine", mass: "210", cat: "halogen", phase: "solid" },
  { n: 86, sym: "Rn", name: "Radon", mass: "222", cat: "noble gas", phase: "gas" },
  { n: 87, sym: "Fr", name: "Francium", mass: "223", cat: "alkali", phase: "solid" },
  { n: 88, sym: "Ra", name: "Radium", mass: "226", cat: "alkaline", phase: "solid" },
  { n: 89, sym: "Ac", name: "Actinium", mass: "227", cat: "actinide", phase: "solid" },
  { n: 90, sym: "Th", name: "Thorium", mass: "232.04", cat: "actinide", phase: "solid" },
  { n: 91, sym: "Pa", name: "Protactinium", mass: "231.04", cat: "actinide", phase: "solid" },
  { n: 92, sym: "U", name: "Uranium", mass: "238.03", cat: "actinide", phase: "solid" },
  { n: 93, sym: "Np", name: "Neptunium", mass: "237", cat: "actinide", phase: "solid" },
  { n: 94, sym: "Pu", name: "Plutonium", mass: "244", cat: "actinide", phase: "solid" },
  { n: 95, sym: "Am", name: "Americium", mass: "243", cat: "actinide", phase: "solid" },
  { n: 96, sym: "Cm", name: "Curium", mass: "247", cat: "actinide", phase: "solid" },
  { n: 97, sym: "Bk", name: "Berkelium", mass: "247", cat: "actinide", phase: "solid" },
  { n: 98, sym: "Cf", name: "Californium", mass: "251", cat: "actinide", phase: "solid" },
  { n: 99, sym: "Es", name: "Einsteinium", mass: "252", cat: "actinide", phase: "solid" },
  { n: 100, sym: "Fm", name: "Fermium", mass: "257", cat: "actinide", phase: "solid" },
  { n: 101, sym: "Md", name: "Mendelevium", mass: "258", cat: "actinide", phase: "solid" },
  { n: 102, sym: "No", name: "Nobelium", mass: "259", cat: "actinide", phase: "solid" },
  { n: 103, sym: "Lr", name: "Lawrencium", mass: "266", cat: "actinide", phase: "solid" },
  { n: 104, sym: "Rf", name: "Rutherfordium", mass: "267", cat: "synthetic", phase: "synthetic" },
  { n: 105, sym: "Db", name: "Dubnium", mass: "268", cat: "synthetic", phase: "synthetic" },
  { n: 106, sym: "Sg", name: "Seaborgium", mass: "269", cat: "synthetic", phase: "synthetic" },
  { n: 107, sym: "Bh", name: "Bohrium", mass: "270", cat: "synthetic", phase: "synthetic" },
  { n: 108, sym: "Hs", name: "Hassium", mass: "277", cat: "synthetic", phase: "synthetic" },
  { n: 109, sym: "Mt", name: "Meitnerium", mass: "278", cat: "synthetic", phase: "synthetic" },
  { n: 110, sym: "Ds", name: "Darmstadtium", mass: "281", cat: "synthetic", phase: "synthetic" },
  { n: 111, sym: "Rg", name: "Roentgenium", mass: "282", cat: "synthetic", phase: "synthetic" },
  { n: 112, sym: "Cn", name: "Copernicium", mass: "285", cat: "synthetic", phase: "synthetic" },
  { n: 113, sym: "Nh", name: "Nihonium", mass: "286", cat: "synthetic", phase: "synthetic" },
  { n: 114, sym: "Fl", name: "Flerovium", mass: "289", cat: "synthetic", phase: "synthetic" },
  { n: 115, sym: "Mc", name: "Moscovium", mass: "290", cat: "synthetic", phase: "synthetic" },
  { n: 116, sym: "Lv", name: "Livermorium", mass: "293", cat: "synthetic", phase: "synthetic" },
  { n: 117, sym: "Ts", name: "Tennessine", mass: "294", cat: "synthetic", phase: "synthetic" },
  { n: 118, sym: "Og", name: "Oganesson", mass: "294", cat: "synthetic", phase: "synthetic" },
];

/** Subshell filling order (Aufbau) — capacities per subshell. */
const AUFBAU: [string, number][] = [
  ["1s", 2], ["2s", 2], ["2p", 6], ["3s", 2], ["3p", 6],
  ["4s", 2], ["3d", 10], ["4p", 6], ["5s", 2], ["4d", 10],
  ["5p", 6], ["6s", 2], ["4f", 14], ["5d", 10], ["6p", 6],
  ["7s", 2], ["5f", 14], ["6d", 10], ["7p", 6],
];

/** Ground-state electron configuration from atomic number (Aufbau order). */
export function configFor(z: number): string {
  let remaining = z;
  const parts: string[] = [];
  for (const [orbital, capacity] of AUFBAU) {
    if (remaining <= 0) break;
    const count = Math.min(capacity, remaining);
    parts.push(`${orbital}${count}`);
    remaining -= count;
  }
  return parts.join(" ");
}

/** Grid position within the 18-column periodic layout (main rows 1–7). */
export function gridPos(n: number): { row: number; col: number } {
  if (n === 1) return { row: 1, col: 1 };
  if (n === 2) return { row: 1, col: 18 };
  if (n <= 10) return { row: 2, col: n - 2 };
  if (n <= 18) return { row: 3, col: n - 10 };
  if (n <= 36) return { row: 4, col: n - 18 };
  if (n <= 54) return { row: 5, col: n - 36 };
  if (n <= 56) return { row: 6, col: n - 54 };
  if (n <= 71) return { row: 9, col: n - 54 }; // lanthanides, below
  if (n <= 86) return { row: 6, col: n - 68 };
  if (n <= 88) return { row: 7, col: n - 86 };
  if (n <= 103) return { row: 10, col: n - 86 }; // actinides, below
  return { row: 7, col: n - 100 };
}

/** Category → muted brand-harmonised colour for cells and chips. */
export const CAT_COLOR: Record<Category, string> = {
  alkali: "#c2543f",
  alkaline: "#c07a3e",
  transition: "#9d6b5e",
  "post-transition": "#8a7a52",
  metalloid: "#77864f",
  nonmetal: "#4f7f8a",
  halogen: "#3f7d96",
  "noble gas": "#77699b",
  lanthanide: "#5f8076",
  actinide: "#8a5f57",
  synthetic: "#6f6a6a",
};