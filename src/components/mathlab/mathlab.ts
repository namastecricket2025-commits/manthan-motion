/**
 * Math Lab curriculum and equation engine.
 *
 * Everything the lab knows lives here: the four grade tracks, the chapters
 * with the governing formulas each one is examined on, the plottable models
 * the graphing canvas renders, and a small symbolic solver that turns a typed
 * equation into the four structured blocks the right pane shows.
 *
 * The solver is deliberately narrow and honest: it recognises linear and
 * quadratic equations, trigonometric traces and a first derivative, and for
 * anything else it falls back to the selected chapter's governing formulas
 * rather than inventing an answer.
 */

export type GradeId = "8" | "9" | "10" | "11";

export interface ParameterSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface PlotBranch {
  label: string;
  /** `null` means the branch has no real value there and the path breaks. */
  evaluate: (x: number, params: Record<string, number>) => number | null;
  dashed?: boolean;
}

export interface PlotModel {
  id: string;
  label: string;
  formula: string;
  note: string;
  params: ParameterSpec[];
  branches: PlotBranch[];
}

export interface Chapter {
  name: string;
  focus: string;
  formulas: string[];
  method: string[];
}

export interface GradeSpec {
  id: GradeId;
  label: string;
  level: string;
  blurb: string;
  /** Grade 10 and 11 need the full Prime suite; 8 and 9 run on basic graphs. */
  advanced: boolean;
  chapters: Chapter[];
  models: PlotModel[];
}

/* ------------------------------------------------------------------ */
/* Plottable models                                                    */
/* ------------------------------------------------------------------ */

const linearModel: PlotModel = {
  id: "linear",
  label: "Linear equation",
  formula: "y = m x + c",
  note: "Slope m sets the steepness, intercept c lifts the line.",
  params: [
    { key: "m", label: "m (slope)", min: -3, max: 3, step: 0.1, value: 1 },
    { key: "c", label: "c (intercept)", min: -6, max: 6, step: 0.1, value: 0 },
  ],
  branches: [
    { label: "y = m x + c", evaluate: (x, p) => p.m * x + p.c },
  ],
};

const variationModel: PlotModel = {
  id: "variation",
  label: "Direct variation",
  formula: "y = k x",
  note: "k is the constant of proportionality — the line always passes through the origin.",
  params: [{ key: "k", label: "k", min: -4, max: 4, step: 0.1, value: 2 }],
  branches: [{ label: "y = k x", evaluate: (x, p) => p.k * x }],
};

const quadraticModel: PlotModel = {
  id: "quadratic",
  label: "Quadratic function",
  formula: "y = a x² + b x + c",
  note: "The discriminant b² − 4ac decides how many times the curve crosses the x-axis.",
  params: [
    { key: "a", label: "a", min: -2, max: 2, step: 0.1, value: 1 },
    { key: "b", label: "b", min: -6, max: 6, step: 0.1, value: 0 },
    { key: "c", label: "c", min: -8, max: 8, step: 0.1, value: -4 },
  ],
  branches: [
    {
      label: "y = a x² + b x + c",
      evaluate: (x, p) => p.a * x * x + p.b * x + p.c,
    },
  ],
};

const trigModel: PlotModel = {
  id: "trig",
  label: "Trigonometric path",
  formula: "y = A sin(B x + C)",
  note: "Amplitude |A|, period 2π/|B|, phase shift −C/B and range [−|A|, |A|].",
  params: [
    { key: "A", label: "A (amplitude)", min: -4, max: 4, step: 0.1, value: 2 },
    { key: "B", label: "B (frequency)", min: 0.2, max: 4, step: 0.1, value: 1 },
    { key: "C", label: "C (phase)", min: -6, max: 6, step: 0.1, value: 1 },
  ],
  branches: [
    { label: "y = A sin(B x + C)", evaluate: (x, p) => p.A * Math.sin(p.B * x + p.C) },
  ],
};

const ellipseModel: PlotModel = {
  id: "ellipse",
  label: "Ellipse",
  formula: "x² / a² + y² / b² = 1",
  note: "The major axis spans 2a and the minor axis 2b; c² = a² − b² locates the foci.",
  params: [
    { key: "a", label: "a (semi-major)", min: 1, max: 9, step: 0.1, value: 6 },
    { key: "b", label: "b (semi-minor)", min: 0.5, max: 9, step: 0.1, value: 3.5 },
  ],
  branches: [
    {
      label: "upper branch",
      evaluate: (x, p) => {
        const inner = 1 - (x * x) / (p.a * p.a);
        return inner < 0 ? null : p.b * Math.sqrt(inner);
      },
    },
    {
      label: "lower branch",
      dashed: true,
      evaluate: (x, p) => {
        const inner = 1 - (x * x) / (p.a * p.a);
        return inner < 0 ? null : -p.b * Math.sqrt(inner);
      },
    },
  ],
};

const tangentModel: PlotModel = {
  id: "tangent",
  label: "Derivative tangent",
  formula: "y = x², tangent at x₀",
  note: "The tangent's slope is dy/dx = 2x₀, so the line touches the curve exactly once.",
  params: [{ key: "x0", label: "x₀ (point of contact)", min: -4, max: 4, step: 0.1, value: 1 }],
  branches: [
    { label: "y = x²", evaluate: (x) => x * x },
    {
      label: "tangent",
      dashed: true,
      evaluate: (x, p) => 2 * p.x0 * (x - p.x0) + p.x0 * p.x0,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Grade tracks                                                        */
/* ------------------------------------------------------------------ */

export const GRADES: GradeSpec[] = [
  {
    id: "8",
    label: "Class 8",
    level: "Foundation",
    blurb: "Expressions, linear equations in one variable, squares, roots and mensuration.",
    advanced: false,
    chapters: [
      {
        name: "Rational Numbers",
        focus: "Operations on fractions and the properties they obey.",
        formulas: [
          "a/b + c/d = (a·d + b·c) / (b·d)",
          "a/b ÷ c/d = a/b × d/c",
          "a/b = (a × k) / (b × k) — equivalent fractions",
        ],
        method: [
          "Bring both terms to a common denominator before adding or subtracting.",
          "Multiply by the reciprocal to divide, then reduce with the HCF.",
        ],
      },
      {
        name: "Linear Equations in One Variable",
        focus: "Isolate the variable, then verify by substitution.",
        formulas: [
          "a x + b = 0 ⇒ x = −b / a",
          "Transposition: move a term across by changing its sign",
          "Verification: substitute the root back into the original equation",
        ],
        method: [
          "Collect every variable term on one side and every constant on the other.",
          "Divide by the coefficient of x, then substitute the root back to confirm.",
        ],
      },
      {
        name: "Squares and Square Roots",
        focus: "Perfect squares, roots and the identities behind quick expansion.",
        formulas: [
          "(a + b)² = a² + 2ab + b²",
          "√(a·b) = √a · √b",
          "Pythagorean triplet: (2m, m² − 1, m² + 1)",
        ],
        method: [
          "Pair the digits from the right and use the long-division method for roots.",
          "Check the identity by expanding both sides term by term.",
        ],
      },
      {
        name: "Mensuration",
        focus: "Areas and volumes of the standard plane and solid figures.",
        formulas: [
          "Area of a trapezium = ½ (a + b) h",
          "Volume of a cylinder = π r² h",
          "Total surface area of a cube = 6 a²",
        ],
        method: [
          "Write down every given dimension with its unit before choosing a formula.",
          "Keep units consistent, then convert the final answer to the asked unit.",
        ],
      },
    ],
    models: [linearModel, variationModel],
  },
  {
    id: "9",
    label: "Class 9",
    level: "Foundation",
    blurb: "Number systems, polynomials, two-variable equations and coordinate geometry.",
    advanced: false,
    chapters: [
      {
        name: "Number Systems",
        focus: "Rational and irrational numbers, and rationalising denominators.",
        formulas: [
          "(√a + √b)(√a − √b) = a − b",
          "1 / (√a + √b) = (√a − √b) / (a − b)",
          "a^m · a^n = a^(m + n)",
        ],
        method: [
          "Multiply numerator and denominator by the conjugate to clear a root.",
          "Apply the exponent laws before any numerical substitution.",
        ],
      },
      {
        name: "Polynomials",
        focus: "Remainder and factor theorems, and the algebraic identities.",
        formulas: [
          "Remainder theorem: p(x) ÷ (x − a) leaves p(a)",
          "(x − a) is a factor ⇔ p(a) = 0",
          "(a + b)³ = a³ + b³ + 3ab(a + b)",
        ],
        method: [
          "Substitute the zero of the divisor to evaluate the remainder directly.",
          "Factorise, then test each candidate root with the factor theorem.",
        ],
      },
      {
        name: "Linear Equations in Two Variables",
        focus: "Straight lines as equations, and how many solutions they admit.",
        formulas: [
          "a x + b y + c = 0",
          "A single two-variable equation has infinitely many solutions",
          "The graph of a linear equation is always a straight line",
        ],
        method: [
          "Express y in terms of x, then plot two convenient points.",
          "Verify each solution by substituting the pair back into the equation.",
        ],
      },
      {
        name: "Coordinate Geometry",
        focus: "Plotting points and reading the Cartesian plane.",
        formulas: [
          "Distance = √((x₂ − x₁)² + (y₂ − y₁)²)",
          "Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2)",
          "Signs of (x, y) decide the quadrant",
        ],
        method: [
          "Mark the axes and scale before plotting any point.",
          "Subtract coordinates consistently — the order inside each bracket must match.",
        ],
      },
    ],
    models: [linearModel, variationModel],
  },
  {
    id: "10",
    label: "Class 10",
    level: "Board year",
    blurb: "Quadratic equations, progressions, trigonometry and coordinate geometry.",
    advanced: true,
    chapters: [
      {
        name: "Quadratic Equations",
        focus: "Roots, the discriminant and the shape of the parabola.",
        formulas: [
          "x = (−b ± √(b² − 4ac)) / 2a",
          "Discriminant D = b² − 4ac",
          "Sum of roots = −b/a, product of roots = c/a",
        ],
        method: [
          "Write the equation in standard form a x² + b x + c = 0 and read off a, b, c.",
          "Evaluate the discriminant; its sign tells you whether the roots are real and distinct.",
        ],
      },
      {
        name: "Arithmetic Progressions",
        focus: "Common difference, the nth term and the sum of n terms.",
        formulas: [
          "aₙ = a + (n − 1) d",
          "Sₙ = n/2 [2a + (n − 1) d]",
          "aₙ = Sₙ − Sₙ₋₁",
        ],
        method: [
          "Find the common difference, then substitute into the nth-term formula.",
          "For a sum question, decide whether aₙ or Sₙ is actually being asked for.",
        ],
      },
      {
        name: "Introduction to Trigonometry",
        focus: "Ratios, identities and the standard angles.",
        formulas: [
          "sin²θ + cos²θ = 1",
          "tan θ = sin θ / cos θ",
          "1 + tan²θ = sec²θ",
        ],
        method: [
          "Convert every ratio into sin and cos before simplifying.",
          "Verify the identity by working on the more complicated side only.",
        ],
      },
      {
        name: "Coordinate Geometry",
        focus: "Distance, section formula and area on the Cartesian plane.",
        formulas: [
          "Distance = √((x₂ − x₁)² + (y₂ − y₁)²)",
          "Section formula: ((m x₂ + n x₁)/(m + n), (m y₂ + n y₁)/(m + n))",
          "Area of a triangle = ½ |x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|",
        ],
        method: [
          "Label the points (x₁, y₁), (x₂, y₂), (x₃, y₃) before substituting.",
          "Keep the modulus until the final line so a sign slip cannot distort the area.",
        ],
      },
    ],
    models: [quadraticModel, trigModel],
  },
  {
    id: "11",
    label: "Class 11",
    level: "Senior secondary",
    blurb: "Conic sections, straight lines, trigonometric functions and calculus.",
    advanced: true,
    chapters: [
      {
        name: "Conic Sections",
        focus: "Circles, parabolas, ellipses and hyperbolas in standard form.",
        formulas: [
          "Circle: (x − h)² + (y − k)² = r²",
          "Ellipse: x²/a² + y²/b² = 1, with c² = a² − b²",
          "Hyperbola: x²/a² − y²/b² = 1",
        ],
        method: [
          "Reduce the equation to standard form by completing the square.",
          "Read a, b and the centre straight off the standard form before sketching.",
        ],
      },
      {
        name: "Straight Lines",
        focus: "Slope, the several forms of a line, and distance from a point.",
        formulas: [
          "Slope m = (y₂ − y₁) / (x₂ − x₁)",
          "Point-slope form: y − y₁ = m (x − x₁)",
          "Distance from a point = |a x₁ + b y₁ + c| / √(a² + b²)",
        ],
        method: [
          "Find the slope first; every other form follows from it.",
          "For a distance, substitute the point into the line with the modulus in place.",
        ],
      },
      {
        name: "Trigonometric Functions",
        focus: "Radians, periodicity and the compound-angle formulae.",
        formulas: [
          "1 radian = 180°/π",
          "sin(A ± B) = sin A cos B ± cos A sin B",
          "cos 2A = 1 − 2 sin²A",
        ],
        method: [
          "Move to radians before any calculus-style manipulation.",
          "Expand compound angles, then collect like trigonometric terms.",
        ],
      },
      {
        name: "Limits and Derivatives",
        focus: "The limit definition and the power rule.",
        formulas: [
          "f′(x) = lim(h→0) [f(x + h) − f(x)] / h",
          "d/dx (xⁿ) = n xⁿ⁻¹",
          "d/dx (sin x) = cos x,  d/dx (cos x) = −sin x",
        ],
        method: [
          "Apply the power rule term by term before substituting a value.",
          "For a tangent, evaluate the derivative at the point to get its slope.",
        ],
      },
    ],
    models: [ellipseModel, tangentModel],
  },
];

export function getGrade(id: GradeId): GradeSpec {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}

/* ------------------------------------------------------------------ */
/* Equation engine                                                     */
/* ------------------------------------------------------------------ */

export interface Solution {
  headline: string;
  given: string[];
  formulas: string[];
  steps: string[];
  verification: string[];
}

/** Trim floating-point noise so roots read as exact where they are exact. */
function num(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
}

const ZERO = (value: number) => Math.abs(value) < 1e-9;

interface Polynomial {
  a2: number;
  a1: number;
  a0: number;
}

function coefficient(raw: string): number {
  if (raw === "" || raw === "+") return 1;
  if (raw === "-") return -1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Parses "3x^2 - x + 5" (and the ² glyph) into a quadratic's coefficients. */
function parsePolynomial(input: string): Polynomial | null {
  const cleaned = input
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/\*/g, "");
  if (!cleaned) return null;

  const terms = cleaned.replace(/-/g, "+-").split("+").filter(Boolean);
  let a2 = 0;
  let a1 = 0;
  let a0 = 0;

  for (const term of terms) {
    let match: RegExpMatchArray | null;
    if ((match = term.match(/^(-?\d*\.?\d*)x\^2$/))) {
      a2 += coefficient(match[1]);
    } else if ((match = term.match(/^(-?\d*\.?\d*)x$/))) {
      a1 += coefficient(match[1]);
    } else if ((match = term.match(/^(-?\d*\.?\d*)$/))) {
      a0 += coefficient(match[1]);
    } else {
      return null;
    }
  }

  if ([a2, a1, a0].some((value) => Number.isNaN(value))) return null;
  return { a2, a1, a0 };
}

function quadraticSolution(a: number, b: number, c: number): Solution {
  const discriminant = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = c - (b * b) / (4 * a);

  const given = [
    `Standard form a x² + b x + c = 0 with a = ${num(a)}, b = ${num(b)}, c = ${num(c)}.`,
    `Discriminant D = b² − 4ac = ${num(b * b)} − ${num(4 * a * c)} = ${num(discriminant)}.`,
    `Axis of symmetry at x = −b / 2a = ${num(vertexX)}.`,
  ];

  const formulas = [
    "x = (−b ± √(b² − 4ac)) / 2a",
    "D = b² − 4ac decides the nature of the roots",
    "Vertex = (−b/2a, c − b²/4a)",
  ];

  const steps: string[] = [
    `Rewrite the equation in standard form and read off a = ${num(a)}, b = ${num(b)}, c = ${num(c)}.`,
    `Compute the discriminant: D = (${num(b)})² − 4(${num(a)})(${num(c)}) = ${num(discriminant)}.`,
  ];

  const verification: string[] = [];

  if (discriminant > 0) {
    const root = Math.sqrt(discriminant);
    const x1 = (-b - root) / (2 * a);
    const x2 = (-b + root) / (2 * a);
    steps.push(
      `Since D > 0 the roots are real and distinct: x = (${num(-b)} ± √${num(discriminant)}) / ${num(2 * a)}.`,
      `x₁ = ${num(x1)} and x₂ = ${num(x2)}.`,
      `The parabola meets the x-axis at (${num(x1)}, 0) and (${num(x2)}, 0).`,
    );
    verification.push(
      `Substitute x₁: a x₁² + b x₁ + c = ${num(a * x1 * x1 + b * x1 + c)} — expected 0.`,
      `Substitute x₂: a x₂² + b x₂ + c = ${num(a * x2 * x2 + b * x2 + c)} — expected 0.`,
      `Sum of roots −b/a = ${num(-b / a)} and product c/a = ${num(c / a)} both match.`,
    );
  } else if (ZERO(discriminant)) {
    const x = vertexX;
    steps.push(
      "Since D = 0 the two roots coincide: x = −b / 2a.",
      `The repeated root is x = ${num(x)}.`,
      `The vertex sits on the x-axis at (${num(x)}, 0), so the curve just touches it.`,
    );
    verification.push(
      `Substitute x = ${num(x)}: ${num(a * x * x + b * x + c)} — expected 0.`,
    );
  } else {
    const real = -b / (2 * a);
    const imaginary = Math.sqrt(-discriminant) / (2 * a);
    steps.push(
      "Since D < 0 the roots are not real, so the curve never crosses the x-axis.",
      `The roots are complex: x = ${num(real)} ± ${num(Math.abs(imaginary))}i.`,
      `The curve still has a real vertex at (${num(vertexX)}, ${num(vertexY)}).`,
    );
    verification.push(
      `Substitute x = ${num(real)}: real part of a x² + b x + c is ${num(a * real * real + b * real + c)} and the imaginary part cancels.`,
      "A negative discriminant is confirmed by the curve sitting entirely on one side of the x-axis.",
    );
  }

  return {
    headline:
      discriminant > 0
        ? "Two distinct real roots — the curve crosses the x-axis twice."
        : ZERO(discriminant)
          ? "One repeated real root — the curve touches the x-axis."
          : "No real roots — the curve never meets the x-axis.",
    given,
    formulas,
    steps,
    verification,
  };
}

function linearSolution(m: number, c: number): Solution {
  if (ZERO(m)) {
    return {
      headline:
        ZERO(c)
          ? "Every value of x satisfies this equation — it is an identity."
          : "No value of x satisfies this equation — it is a contradiction.",
      given: [`m = ${num(m)}, c = ${num(c)}`],
      formulas: ["m x + c = 0 ⇒ x = −c / m"],
      steps: [
        "Collect the variable term on one side and the constant on the other.",
        ZERO(c)
          ? "The variable cancels out and both sides are identical."
          : "The variable cancels out and leaves a false statement.",
      ],
      verification: [
        "Substituting any x returns the same constant on both sides, which confirms the conclusion.",
      ],
    };
  }

  const x = -c / m;
  return {
    headline: `A single root at x = ${num(x)}.`,
    given: [`Standard form m x + c = 0 with m = ${num(m)}, c = ${num(c)}.`],
    formulas: ["m x + c = 0 ⇒ x = −c / m", "The graph is a straight line of slope m"],
    steps: [
      `Transpose the constant: ${num(m)} x = ${num(-c)}.`,
      `Divide by the coefficient of x: x = ${num(-c)} / ${num(m)} = ${num(x)}.`,
      `The line crosses the x-axis at (${num(x)}, 0).`,
    ],
    verification: [
      `Substitute x = ${num(x)}: ${num(m)}(${num(x)}) + ${num(c)} = ${num(m * x + c)} — expected 0.`,
    ],
  };
}

function trigSolution(input: string): Solution {
  const match = input.match(/(-?\d*\.?\d*)\s*(sin|cos|tan)\s*\(?\s*(-?\d*\.?\d*)\s*x?\s*([+-]\s*\d*\.?\d*)?/i);
  const amplitude = match ? coefficient(match[1] || "1") : 1;
  const fn = match?.[2]?.toLowerCase() ?? "sin";
  const frequency = match ? coefficient(match[3] || "1") : 1;
  const shift = match?.[4] ? coefficient(match[4].replace(/\s+/g, "")) : 0;
  const safeFrequency = ZERO(frequency) ? 1 : frequency;
  const period = (2 * Math.PI) / Math.abs(safeFrequency);
  const phase = -shift / safeFrequency;

  return {
    headline: `Amplitude ${num(Math.abs(amplitude))}, period ${num(period)}, phase shift ${num(phase)}.`,
    given: [
      `Model y = A ${fn}(B x + C) with A = ${num(amplitude)}, B = ${num(safeFrequency)}, C = ${num(shift)}.`,
      `Radians are assumed unless the question states degrees.`,
    ],
    formulas: [
      "Amplitude = |A|",
      "Period = 2π / |B|",
      "Phase shift = −C / B, range = [−|A|, |A|]",
    ],
    steps: [
      `Amplitude is |A| = ${num(Math.abs(amplitude))}, so the curve oscillates between ${num(-Math.abs(amplitude))} and ${num(Math.abs(amplitude))}.`,
      `Period is 2π / |B| = ${num(period)}, so one full wave completes every ${num(period)} radians.`,
      `Phase shift is −C / B = ${num(phase)}: the standard ${fn} curve is shifted by that much along the x-axis.`,
      `Mark the five key points at 0, ${num(period / 4)}, ${num(period / 2)}, ${num((3 * period) / 4)} and ${num(period)} to sketch one full cycle.`,
    ],
    verification: [
      `At x = ${num(phase)} the argument B x + C is 0, so y = ${num(amplitude * Math.sin(0))} for sin and the curve starts its cycle there.`,
      `The range [−${num(Math.abs(amplitude))}, ${num(Math.abs(amplitude))}] matches the plotted curve exactly.`,
    ],
  };
}

function derivativeSolution(input: string, polynomial: Polynomial): Solution {
  const body = input.replace(/^.*?=/, "").trim();
  const parsed = parsePolynomial(body) ?? polynomial;
  const { a2, a1, a0 } = parsed;
  const x0 = 1;
  const derivative = (x: number) => 2 * a2 * x + a1;
  const slope = derivative(x0);
  const value = a2 * x0 * x0 + a1 * x0 + a0;

  return {
    headline: `Slope at x = ${num(x0)} is ${num(slope)}; tangent: y = ${num(slope)}x + ${num(value - slope * x0)}.`,
    given: [
      `f(x) = ${num(a2)}x² + ${num(a1)}x + ${num(a0)}`,
      `Point of contact x₀ = ${num(x0)}, so f(x₀) = ${num(value)}.`,
    ],
    formulas: [
      "d/dx (xⁿ) = n xⁿ⁻¹",
      "Tangent at x₀: y = f′(x₀)(x − x₀) + f(x₀)",
      "The derivative is the instantaneous rate of change, i.e. the slope of the tangent",
    ],
    steps: [
      "Differentiate term by term with the power rule; constants vanish because their rate of change is zero.",
      `f′(x) = 2(${num(a2)})x + ${num(a1)} = ${num(2 * a2)}x + ${num(a1)}.`,
      `At x₀ = ${num(x0)} the slope is f′(x₀) = ${num(slope)}.`,
      `The tangent therefore passes through (${num(x0)}, ${num(value)}) with slope ${num(slope)}: y = ${num(slope)}(x − ${num(x0)}) + ${num(value)}.`,
    ],
    verification: [
      `The tangent shares exactly one point with the curve: substitute x = ${num(x0)} and both give y = ${num(value)}.`,
      `Second derivative f″(x) = ${num(2 * a2)} is constant, so the slope changes at a steady rate.`,
    ],
  };
}

function fallbackSolution(grade: GradeSpec, chapter: Chapter, input: string): Solution {
  return {
    headline: `${chapter.name} — worked framework for the question as typed.`,
    given: [
      `Grade: ${grade.label} (${grade.level}).`,
      `Chapter: ${chapter.name} — ${chapter.focus}`,
      input.trim()
        ? `Question as entered: ${input.trim()}`
        : "No equation detected yet; the framework below applies to the selected chapter.",
    ],
    formulas: chapter.formulas,
    steps: [
      ...chapter.method,
      "Substitute the given values into the governing formula, keeping units attached throughout.",
      "Solve the resulting algebraic expression for the unknown, then round only in the final line.",
    ],
    verification: [
      "Substitute the answer back into the original relation and confirm both sides match.",
      `Check that the result is dimensionally and numerically sensible for ${chapter.name}.`,
    ],
  };
}

/**
 * Turn a typed equation into the four structured blocks the right pane shows.
 * Recognises linear and quadratic equations, trigonometric traces and a first
 * derivative; anything else falls back to the selected chapter's framework.
 */
export function solveEquation(raw: string, grade: GradeSpec, chapter: Chapter): Solution {
  const input = raw.trim();
  if (!input) return fallbackSolution(grade, chapter, input);

  const normalized = input.replace(/\s+/g, "").replace(/−/g, "-").replace(/²/g, "^2");

  // Derivative / tangent questions first: they can also contain a quadratic.
  if (/d\/dx|derivative|differentiate|tangent|slope/i.test(input)) {
    const body = normalized.replace(/^.*?=/, "");
    const parsed = parsePolynomial(body);
    if (parsed && (parsed.a2 !== 0 || parsed.a1 !== 0)) {
      return derivativeSolution(input, parsed);
    }
  }

  if (/sin|cos|tan/i.test(input) && /x/i.test(input)) {
    return trigSolution(input);
  }

  // Equation form — move everything to the left-hand side.
  if (normalized.includes("=")) {
    const [left, right] = normalized.split("=");
    const l = parsePolynomial(left);
    const r = parsePolynomial(right ?? "0");
    if (l && r) {
      const a2 = l.a2 - r.a2;
      const a1 = l.a1 - r.a1;
      const a0 = l.a0 - r.a0;
      if (!ZERO(a2)) return quadraticSolution(a2, a1, a0);
      if (!ZERO(a1)) return linearSolution(a1, a0);
      return fallbackSolution(grade, chapter, input);
    }
    return fallbackSolution(grade, chapter, input);
  }

  const single = parsePolynomial(normalized);
  if (single) {
    if (!ZERO(single.a2)) return quadraticSolution(single.a2, single.a1, single.a0);
    if (!ZERO(single.a1)) return linearSolution(single.a1, single.a0);
  }

  return fallbackSolution(grade, chapter, input);
}

/**
 * Framework for a dropped document.
 *
 * The document is not parsed here — this pane solves what the student types,
 * and a dropped file has no text extraction behind it yet. So the framework is
 * the selected chapter's, with the document recorded by name; the wording says
 * exactly that instead of claiming to have read the file.
 */
export function documentSolution(
  fileName: string,
  grade: GradeSpec,
  chapter: Chapter,
): Solution {
  const base = fallbackSolution(grade, chapter, "");
  return {
    ...base,
    headline: `${chapter.name} framework, matched to ${fileName}.`,
    given: [
      `Document added: ${fileName} (not parsed — type the equation to solve it).`,
      `Grade: ${grade.label} (${grade.level}).`,
      `Chapter: ${chapter.name} — ${chapter.focus}`,
    ],
  };
}

/** The four blocks, in the order a student reads them. */
export const SOLUTION_BLOCKS = [
  { key: "given", title: "Given Data" },
  { key: "formulas", title: "Governing Formulas" },
  { key: "steps", title: "Step-by-Step Breakdown" },
  { key: "verification", title: "Final Verification" },
] as const;
