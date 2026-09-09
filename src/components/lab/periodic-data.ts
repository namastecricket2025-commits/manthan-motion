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

/** Well-known group names for the 18 columns (empty for transition-metal
 * columns where no single common name exists). */
export const GROUP_NAMES: (string | null)[] = [
  null, // 1-indexed placeholder
  "Alkali metals",
  "Alkaline earth metals",
  null, // scandium group
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  "Boron group",
  "Carbon group",
  "Pnictogens",
  "Chalcogens",
  "Halogens",
  "Noble gases",
];

/** Electrons per principal quantum number shell (n = 1, 2, 3, …), derived
 * from the Aufbau configuration — used for Bohr-style diagrams. */
export function shellsFor(z: number): number[] {
  const shells: number[] = [];
  let remaining = z;
  for (const [orbital, capacity] of AUFBAU) {
    if (remaining <= 0) break;
    const n = Number(orbital[0]);
    const count = Math.min(capacity, remaining);
    shells[n - 1] = (shells[n - 1] ?? 0) + count;
    remaining -= count;
  }
  return shells.filter((s) => s !== undefined && s > 0);
}

/** Block letter (s/p/d/f) of the element's outermost subshell. */
export function blockFor(z: number): string {
  let remaining = z;
  let last = "s";
  for (const [orbital, capacity] of AUFBAU) {
    if (remaining <= 0) break;
    const count = Math.min(capacity, remaining);
    remaining -= count;
    if (count > 0) last = orbital[1];
  }
  return last;
}

/** Period (row) and group (column) as printed on the periodic table.
 * f-block elements report their group as null (they sit in the floating
 * rows below the main grid). */
export function periodGroupOf(n: number): { period: number; group: number | null } {
  const pos = gridPos(n);
  // lanthanides (row 9) sit in period 6, actinides (row 10) in period 7
  if (pos.row >= 9) return { period: pos.row - 3, group: null };
  return { period: pos.row, group: pos.col };
}

/* ============================================================
   Physical property tables — density (formatted with unit),
   melting/boiling point in °C, Pauling electronegativity and
   discovery year. Values marked null are honestly unknown or
   not measured (mostly superheavy synthetics). Year 0 means
   "known since antiquity".
   ============================================================ */

export interface Physical {
  density: string | null;
  mp: number | null;
  bp: number | null;
  en: number | null;
  year: number | null;
}

/** Atomic number → physical properties. */
export const PHYS: Record<number, Physical> = {
  1: { density: "0.0899 g/L", mp: -259.1, bp: -252.9, en: 2.2, year: 1766 },
  2: { density: "0.1785 g/L", mp: -272.2, bp: -268.9, en: null, year: 1868 },
  3: { density: "0.534 g/cm³", mp: 180.5, bp: 1342, en: 0.98, year: 1817 },
  4: { density: "1.85 g/cm³", mp: 1287, bp: 2470, en: 1.57, year: 1798 },
  5: { density: "2.34 g/cm³", mp: 2076, bp: 3927, en: 2.04, year: 1808 },
  6: { density: "2.27 g/cm³", mp: 3550, bp: 4027, en: 2.55, year: 0 },
  7: { density: "1.251 g/L", mp: -210.1, bp: -195.8, en: 3.04, year: 1772 },
  8: { density: "1.429 g/L", mp: -218.8, bp: -183, en: 3.44, year: 1774 },
  9: { density: "1.696 g/L", mp: -219.7, bp: -188.1, en: 3.98, year: 1886 },
  10: { density: "0.900 g/L", mp: -248.6, bp: -246.1, en: null, year: 1898 },
  11: { density: "0.968 g/cm³", mp: 97.8, bp: 883, en: 0.93, year: 1807 },
  12: { density: "1.738 g/cm³", mp: 650, bp: 1091, en: 1.31, year: 1755 },
  13: { density: "2.70 g/cm³", mp: 660.3, bp: 2470, en: 1.61, year: 1825 },
  14: { density: "2.33 g/cm³", mp: 1414, bp: 3265, en: 1.9, year: 1824 },
  15: { density: "1.82 g/cm³", mp: 44.1, bp: 280.5, en: 2.19, year: 1669 },
  16: { density: "2.07 g/cm³", mp: 115.2, bp: 444.7, en: 2.58, year: 0 },
  17: { density: "3.20 g/L", mp: -101.5, bp: -34, en: 3.16, year: 1774 },
  18: { density: "1.784 g/L", mp: -189.3, bp: -185.8, en: null, year: 1894 },
  19: { density: "0.862 g/cm³", mp: 63.4, bp: 759, en: 0.82, year: 1807 },
  20: { density: "1.55 g/cm³", mp: 842, bp: 1484, en: 1, year: 1808 },
  21: { density: "2.99 g/cm³", mp: 1541, bp: 2836, en: 1.36, year: 1879 },
  22: { density: "4.51 g/cm³", mp: 1668, bp: 3287, en: 1.54, year: 1791 },
  23: { density: "6.0 g/cm³", mp: 1910, bp: 3407, en: 1.63, year: 1801 },
  24: { density: "7.19 g/cm³", mp: 1907, bp: 2671, en: 1.66, year: 1797 },
  25: { density: "7.21 g/cm³", mp: 1246, bp: 2061, en: 1.55, year: 1774 },
  26: { density: "7.87 g/cm³", mp: 1538, bp: 2861, en: 1.83, year: 0 },
  27: { density: "8.90 g/cm³", mp: 1495, bp: 2927, en: 1.88, year: 1735 },
  28: { density: "8.91 g/cm³", mp: 1455, bp: 2913, en: 1.91, year: 1751 },
  29: { density: "8.96 g/cm³", mp: 1084.6, bp: 2562, en: 1.9, year: 0 },
  30: { density: "7.13 g/cm³", mp: 419.5, bp: 907, en: 1.65, year: 1746 },
  31: { density: "5.91 g/cm³", mp: 29.8, bp: 2204, en: 1.81, year: 1875 },
  32: { density: "5.32 g/cm³", mp: 938.3, bp: 2833, en: 2.01, year: 1886 },
  33: { density: "5.73 g/cm³", mp: 817, bp: 614, en: 2.18, year: 0 },
  34: { density: "4.81 g/cm³", mp: 221, bp: 685, en: 2.55, year: 1817 },
  35: { density: "3.12 g/cm³", mp: -7.2, bp: 58.8, en: 2.96, year: 1826 },
  36: { density: "3.75 g/L", mp: -157.4, bp: -153.4, en: 3, year: 1898 },
  37: { density: "1.53 g/cm³", mp: 39.3, bp: 688, en: 0.82, year: 1861 },
  38: { density: "2.64 g/cm³", mp: 777, bp: 1382, en: 0.95, year: 1790 },
  39: { density: "4.47 g/cm³", mp: 1526, bp: 3345, en: 1.22, year: 1794 },
  40: { density: "6.52 g/cm³", mp: 1855, bp: 4409, en: 1.33, year: 1789 },
  41: { density: "8.57 g/cm³", mp: 2477, bp: 4744, en: 1.6, year: 1801 },
  42: { density: "10.28 g/cm³", mp: 2623, bp: 4639, en: 2.16, year: 1778 },
  43: { density: "11.0 g/cm³", mp: 2157, bp: 4265, en: 1.9, year: 1937 },
  44: { density: "12.37 g/cm³", mp: 2334, bp: 4150, en: 2.2, year: 1844 },
  45: { density: "12.41 g/cm³", mp: 1964, bp: 3695, en: 2.28, year: 1803 },
  46: { density: "12.02 g/cm³", mp: 1554.9, bp: 2963, en: 2.2, year: 1803 },
  47: { density: "10.49 g/cm³", mp: 961.8, bp: 2162, en: 1.93, year: 0 },
  48: { density: "8.65 g/cm³", mp: 321.1, bp: 767, en: 1.69, year: 1817 },
  49: { density: "7.31 g/cm³", mp: 156.6, bp: 2072, en: 1.78, year: 1863 },
  50: { density: "7.31 g/cm³", mp: 231.9, bp: 2602, en: 1.96, year: 0 },
  51: { density: "6.68 g/cm³", mp: 630.6, bp: 1587, en: 2.05, year: 0 },
  52: { density: "6.24 g/cm³", mp: 449.5, bp: 988, en: 2.1, year: 1782 },
  53: { density: "4.93 g/cm³", mp: 113.7, bp: 184.3, en: 2.66, year: 1811 },
  54: { density: "5.90 g/L", mp: -111.8, bp: -108.1, en: 2.6, year: 1898 },
  55: { density: "1.93 g/cm³", mp: 28.5, bp: 671, en: 0.79, year: 1860 },
  56: { density: "3.51 g/cm³", mp: 727, bp: 1897, en: 0.89, year: 1808 },
  57: { density: "6.15 g/cm³", mp: 920, bp: 3464, en: 1.1, year: 1839 },
  58: { density: "6.77 g/cm³", mp: 795, bp: 3443, en: 1.12, year: 1803 },
  59: { density: "6.77 g/cm³", mp: 935, bp: 3520, en: 1.13, year: 1885 },
  60: { density: "7.01 g/cm³", mp: 1024, bp: 3074, en: 1.14, year: 1885 },
  61: { density: "7.26 g/cm³", mp: 1042, bp: 3000, en: 1.13, year: 1945 },
  62: { density: "7.52 g/cm³", mp: 1072, bp: 1794, en: 1.17, year: 1879 },
  63: { density: "5.24 g/cm³", mp: 826, bp: 1529, en: 1.2, year: 1901 },
  64: { density: "7.90 g/cm³", mp: 1312, bp: 3273, en: 1.2, year: 1880 },
  65: { density: "8.23 g/cm³", mp: 1356, bp: 3230, en: 1.2, year: 1843 },
  66: { density: "8.55 g/cm³", mp: 1412, bp: 2567, en: 1.22, year: 1886 },
  67: { density: "8.80 g/cm³", mp: 1474, bp: 2700, en: 1.23, year: 1878 },
  68: { density: "9.07 g/cm³", mp: 1529, bp: 2868, en: 1.24, year: 1843 },
  69: { density: "9.32 g/cm³", mp: 1545, bp: 1950, en: 1.25, year: 1879 },
  70: { density: "6.90 g/cm³", mp: 824, bp: 1196, en: 1.1, year: 1878 },
  71: { density: "9.84 g/cm³", mp: 1652, bp: 3402, en: 1.27, year: 1907 },
  72: { density: "13.31 g/cm³", mp: 2233, bp: 4603, en: 1.3, year: 1923 },
  73: { density: "16.69 g/cm³", mp: 3017, bp: 5458, en: 1.5, year: 1802 },
  74: { density: "19.25 g/cm³", mp: 3422, bp: 5555, en: 2.36, year: 1783 },
  75: { density: "21.02 g/cm³", mp: 3186, bp: 5596, en: 1.9, year: 1925 },
  76: { density: "22.59 g/cm³", mp: 3033, bp: 5012, en: 2.2, year: 1803 },
  77: { density: "22.56 g/cm³", mp: 2446, bp: 4428, en: 2.2, year: 1803 },
  78: { density: "21.45 g/cm³", mp: 1768.3, bp: 3825, en: 2.28, year: 1735 },
  79: { density: "19.32 g/cm³", mp: 1064.2, bp: 2856, en: 2.54, year: 0 },
  80: { density: "13.53 g/cm³", mp: -38.8, bp: 356.7, en: 2, year: 0 },
  81: { density: "11.85 g/cm³", mp: 304, bp: 1473, en: 1.62, year: 1861 },
  82: { density: "11.34 g/cm³", mp: 327.5, bp: 1749, en: 2.33, year: 0 },
  83: { density: "9.79 g/cm³", mp: 271.4, bp: 1564, en: 2.02, year: 1753 },
  84: { density: "9.20 g/cm³", mp: 254, bp: 962, en: 2, year: 1898 },
  85: { density: "7 g/cm³ (est.)", mp: 302, bp: 337, en: 2.2, year: 1940 },
  86: { density: "9.73 g/L", mp: -71, bp: -61.7, en: null, year: 1900 },
  87: { density: null, mp: 27, bp: 677, en: 0.7, year: 1939 },
  88: { density: "5.5 g/cm³", mp: 700, bp: 1737, en: 0.9, year: 1898 },
  89: { density: "10.07 g/cm³", mp: 1050, bp: 3200, en: 1.1, year: 1899 },
  90: { density: "11.72 g/cm³", mp: 1750, bp: 4788, en: 1.3, year: 1829 },
  91: { density: "15.37 g/cm³", mp: 1568, bp: 4027, en: 1.5, year: 1913 },
  92: { density: "19.1 g/cm³", mp: 1132.2, bp: 4131, en: 1.38, year: 1789 },
  93: { density: "20.45 g/cm³", mp: 639, bp: 4174, en: 1.36, year: 1940 },
  94: { density: "19.84 g/cm³", mp: 639.9, bp: 3228, en: 1.28, year: 1940 },
  95: { density: "13.69 g/cm³", mp: 1176, bp: 2607, en: 1.13, year: 1944 },
  96: { density: "13.51 g/cm³", mp: 1340, bp: 3110, en: 1.28, year: 1944 },
  97: { density: "14.78 g/cm³", mp: 986, bp: 2627, en: 1.3, year: 1949 },
  98: { density: "15.1 g/cm³", mp: 900, bp: 1472, en: 1.3, year: 1950 },
  99: { density: "8.84 g/cm³", mp: 860, bp: null, en: 1.3, year: 1952 },
  100: { density: null, mp: 1527, bp: null, en: 1.3, year: 1952 },
  101: { density: null, mp: null, bp: null, en: 1.3, year: 1955 },
  102: { density: null, mp: null, bp: null, en: 1.3, year: 1958 },
  103: { density: null, mp: null, bp: null, en: 1.3, year: 1961 },
  104: { density: null, mp: null, bp: null, en: null, year: 1964 },
  105: { density: null, mp: null, bp: null, en: null, year: 1967 },
  106: { density: null, mp: null, bp: null, en: null, year: 1974 },
  107: { density: null, mp: null, bp: null, en: null, year: 1981 },
  108: { density: null, mp: null, bp: null, en: null, year: 1984 },
  109: { density: null, mp: null, bp: null, en: null, year: 1982 },
  110: { density: null, mp: null, bp: null, en: null, year: 1994 },
  111: { density: null, mp: null, bp: null, en: null, year: 1994 },
  112: { density: null, mp: null, bp: null, en: null, year: 1996 },
  113: { density: null, mp: null, bp: null, en: null, year: 2003 },
  114: { density: null, mp: null, bp: null, en: null, year: 1998 },
  115: { density: null, mp: null, bp: null, en: null, year: 2003 },
  116: { density: null, mp: null, bp: null, en: null, year: 2000 },
  117: { density: null, mp: null, bp: null, en: null, year: 2010 },
  118: { density: null, mp: null, bp: null, en: null, year: 2002 },
};

/** Short "where you meet it" notes for common elements (honest, no invention). */
export const USES: Record<number, string> = {
  1: "Fuel cells, ammonia synthesis, rocket fuel — the lightest element.",
  2: "Balloons, MRI cryogenics, deep-sea breathing mixtures.",
  3: "Rechargeable battery cathodes — the lightest metal.",
  6: "All life's backbone; diamond, graphite, graphene and coal are all carbon.",
  7: "78% of air; fixed into fertilisers by the Haber process.",
  8: "The breath of life — supports combustion and respiration.",
  11: "Table salt, soap making; a violent reaction with water.",
  12: "Light alloys (aircraft), flares, chlorophyll's central atom.",
  13: "Foil, cans, aircraft frames — the most abundant metal in Earth's crust.",
  14: "Computer chips, glass, solar cells — the semiconductor of the digital age.",
  15: "Match heads, fertilisers, DNA's backbone.",
  16: "Vulcanised rubber, sulfuric acid, gunpowder's yellow powder.",
  17: "Water purification, PVC, bleach.",
  19: "Fertilisers (potash), the 'K' in NPK.",
  20: "Bones and teeth, cement, limestone.",
  22: "Aerospace alloys, white paint pigment, medical implants.",
  26: "Steel, haemoglobin's oxygen-carrying core, Earth's most common metal.",
  29: "Electrical wiring, brass/bronze, coins — excellent conductor.",
  30: "Galvanising steel, brass, sunscreen (ZnO).",
  47: "Jewellery, photography, mirrors, electronics.",
  53: "Antiseptics, thyroid hormones, X-ray contrast.",
  79: "Currency, jewellery, electronics — the most malleable metal.",
  80: "Thermometers (historically), fluorescent lamps, dental amalgams.",
  82: "Batteries, radiation shielding, plumbing (historically).",
  92: "Nuclear fuel, armour, glass colouring.",
};

/** Physical property lookup that always returns a record. */
export function physFor(n: number): Physical {
  return PHYS[n] ?? { density: null, mp: null, bp: null, en: null, year: null };
}