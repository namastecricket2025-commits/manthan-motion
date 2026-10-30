import type { GradeId } from "@/components/mathlab/mathlab";

/**
 * The Find-the-error bank.
 *
 * Every item is a real worked solution with exactly one line corrupted. The
 * surrounding lines are correct, so the only way to find the fault is to check
 * each move — which is the skill this drill exists to build. Items are written
 * for the class that meets the topic, and the arithmetic has been checked line
 * by line; no item depends on a model call.
 */

export type HuntItem = {
  id: string;
  grade: GradeId;
  topic: string;
  prompt: string;
  steps: string[];
  /** Index into `steps` of the corrupted line. */
  wrongIndex: number;
  /** Why that line is wrong, and what it should say. */
  reason: string;
};

export const HUNT_ITEMS: HuntItem[] = [
  {
    id: "g8-linear",
    grade: "8",
    topic: "Linear equations",
    prompt: "Solve 3x + 5 = 20.",
    steps: ["3x + 5 = 20", "3x = 20 + 5", "3x = 25", "x = 25/3"],
    wrongIndex: 1,
    reason:
      "Taking 5 to the other side subtracts it, it does not add it. The line should read 3x = 20 − 5 = 15, which gives x = 5.",
  },
  {
    id: "g8-ratio",
    grade: "8",
    topic: "Ratio and proportion",
    prompt: "Divide ₹60 between two students in the ratio 2 : 3.",
    steps: [
      "Total parts = 2 + 3 = 6",
      "One part = ₹60 ÷ 6 = ₹10",
      "Shares = 2 × ₹10 = ₹20 and 3 × ₹10 = ₹30",
    ],
    wrongIndex: 0,
    reason:
      "The parts are 2 + 3 = 5, not 6. With 5 parts each part is ₹12, so the shares are ₹24 and ₹36 — and they do add to ₹60.",
  },
  {
    id: "g9-factor",
    grade: "9",
    topic: "Factorisation",
    prompt: "Factorise x² − 5x + 6.",
    steps: [
      "We need two numbers with product 6 and sum −5.",
      "−1 and −6 multiply to 6 and add to −5.",
      "So x² − 5x + 6 = (x − 1)(x − 6).",
    ],
    wrongIndex: 1,
    reason:
      "−1 and −6 multiply to 6 but add to −7. The numbers must be −2 and −3, so the factorisation is (x − 2)(x − 3).",
  },
  {
    id: "g9-cylinder",
    grade: "9",
    topic: "Surface areas",
    prompt: "Find the curved surface area of a cylinder with radius 7 cm and height 10 cm.",
    steps: [
      "Curved surface area = 2πr²",
      "= 2 × 22/7 × 7²",
      "= 2 × 22 × 7 = 308 cm²",
    ],
    wrongIndex: 0,
    reason:
      "The curved surface unwraps into a rectangle, so it is 2πrh — not 2πr², which is the area of two circular ends. The correct value is 2 × 22/7 × 7 × 10 = 440 cm².",
  },
  {
    id: "g9-power",
    grade: "9",
    topic: "Laws of exponents",
    prompt: "Simplify (x²)³.",
    steps: ["(x²)³ means x² · x² · x²", "= x^(2 + 3)", "= x⁵"],
    wrongIndex: 1,
    reason:
      "A power raised to a power multiplies the exponents, it does not add them: (x²)³ = x^(2×3) = x⁶. Adding is the rule for multiplying powers of the same base.",
  },
  {
    id: "g10-quadratic",
    grade: "10",
    topic: "Quadratic equations",
    prompt: "Solve x² − 5x + 6 = 0 using the quadratic formula.",
    steps: [
      "a = 1, b = −5, c = 6",
      "D = b² + 4ac = 25 + 24 = 49",
      "x = (5 ± 7) / 2",
      "x = 6 or x = −1",
    ],
    wrongIndex: 1,
    reason:
      "The discriminant is b² − 4ac, not b² + 4ac. Here D = 25 − 24 = 1, so x = (5 ± 1)/2 = 3 or 2.",
  },
  {
    id: "g10-ap",
    grade: "10",
    topic: "Arithmetic progressions",
    prompt: "Find the 5th term of an AP with first term 2 and common difference 3.",
    steps: ["aₙ = a + (n − 1)d", "a₅ = 2 + 5 × 3", "= 2 + 15 = 17"],
    wrongIndex: 1,
    reason:
      "The formula uses (n − 1)d, so the multiplier is 4, not 5: a₅ = 2 + 4 × 3 = 14. The 5th term is four steps after the first.",
  },
  {
    id: "g10-trig",
    grade: "10",
    topic: "Trigonometric ratios",
    prompt: "Evaluate sin 30° + cos 60°.",
    steps: ["sin 30° = √3/2 and cos 60° = 1/2", "Sum = (√3 + 1)/2"],
    wrongIndex: 0,
    reason:
      "The standard values are the other way round: sin 30° = 1/2 and cos 60° = 1/2. The sum is 1.",
  },
  {
    id: "g11-derivative",
    grade: "11",
    topic: "Derivatives",
    prompt: "Find the derivative of x³ at x = 2.",
    steps: ["d/dx (x³) = 3x²", "At x = 2: 3 × 2 = 6"],
    wrongIndex: 1,
    reason:
      "Substituting x = 2 into 3x² means squaring first: 3 × 2² = 3 × 4 = 12, not 3 × 2 = 6.",
  },
  {
    id: "g11-series",
    grade: "11",
    topic: "Sequences and series",
    prompt: "Find the sum of the first 10 natural numbers using Sₙ = n/2 [2a + (n − 1)d].",
    steps: [
      "a = 1, d = 1, n = 10",
      "S₁₀ = 10 [2 × 1 + 9 × 1]",
      "= 10 × 11 = 110",
    ],
    wrongIndex: 1,
    reason:
      "The n/2 factor was dropped: S₁₀ = 10/2 [2 + 9] = 5 × 11 = 55. The formula is n/2 times the bracket, not n times it.",
  },
  {
    id: "g12-integral",
    grade: "12",
    topic: "Definite integrals",
    prompt: "Evaluate ∫₀² 3x² dx.",
    steps: ["∫ 3x² dx = 3x³", "Evaluate from 0 to 2: 3 × 2³ − 3 × 0³", "= 24 − 0 = 24"],
    wrongIndex: 0,
    reason:
      "The antiderivative of x² is x³/3, so ∫3x² dx = x³ — the 3 and the ⅓ cancel. The correct value is 2³ − 0³ = 8.",
  },
  {
    id: "g12-parts",
    grade: "12",
    topic: "Integration by parts",
    prompt: "Evaluate ∫ x eˣ dx.",
    steps: [
      "Use ∫ u dv = uv − ∫ v du.",
      "Take u = x and dv = eˣ dx, so du = dx and v = eˣ.",
      "∫ x eˣ dx = x eˣ + ∫ eˣ dx",
      "= x eˣ + eˣ + C",
    ],
    wrongIndex: 2,
    reason:
      "The formula subtracts the second integral: uv − ∫v du, so the line should be x eˣ − ∫ eˣ dx = x eˣ − eˣ + C.",
  },
];

/** The drills a given class can actually sit. */
export function huntItemsFor(grade: GradeId | string): HuntItem[] {
  const gradeId = String(grade);
  const pool = HUNT_ITEMS.filter((item) => item.grade === gradeId);
  return pool.length ? pool : HUNT_ITEMS;
}
