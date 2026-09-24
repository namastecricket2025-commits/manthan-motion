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

/** A number in a label reads as short as possible: 2, never 2.0000001. */
function shortNum(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

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

export interface PlotMark {
  x: number;
  y: number;
  label: string;
  /** "point" marks the spot; "x" and "y" mark the intercept on that axis. */
  kind?: "point" | "x" | "y";
}

export interface PlotModel {
  id: string;
  label: string;
  formula: string;
  note: string;
  params: ParameterSpec[];
  branches: PlotBranch[];
  /**
   * The few points that make this curve readable at a glance — the vertex of a
   * parabola, the vertices of an ellipse, the roots of a quadratic. Computed
   * from the parameters so the labels stay true whatever the curve is showing.
   */
  marks?: (params: Record<string, number>) => PlotMark[];
}

export interface Chapter {
  name: string;
  focus: string;
  formulas: string[];
  method: string[];
  /** A classic, board-level example the engine input offers as a hint. */
  example: string;
  /** The plot the canvas pre-loads for this chapter. */
  plot: string;
  /** The rule a step wears when the engine does not name one itself. */
  rule: string;
  /** The cheat-sheet: the exact formulas, theorems and definitions to revise. */
  cheat: CheatEntry[];
}

export type CheatKind = "formula" | "theorem" | "definition";

export interface CheatEntry {
  kind: CheatKind;
  title: string;
  /** LaTeX source, authored so the cheat-sheet is typeset rather than typed. */
  latex: string;
  /** A definition is a sentence, not an expression. */
  note?: string;
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
  marks: (p) => [
    { x: 0, y: p.c, kind: "y", label: `c = ${shortNum(p.c)}` },
    { x: Math.abs(p.m) < 1e-6 ? 0 : -p.c / p.m, y: 0, kind: "x", label: "x-intercept" },
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
  marks: (p) => {
    if (Math.abs(p.a) < 1e-6) return [];
    const vertexX = -p.b / (2 * p.a);
    const vertexY = p.c - (p.b * p.b) / (4 * p.a);
    const out: PlotMark[] = [
      { x: vertexX, y: vertexY, kind: "point", label: "vertex" },
    ];
    const discriminant = p.b * p.b - 4 * p.a * p.c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      out.push(
        { x: (-p.b - root) / (2 * p.a), y: 0, kind: "x", label: "root" },
        { x: (-p.b + root) / (2 * p.a), y: 0, kind: "x", label: "root" },
      );
    }
    return out;
  },
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
  marks: (p) => [
    { x: 0, y: 0, kind: "point", label: "origin" },
    { x: (2 * Math.PI) / p.B, y: 0, kind: "x", label: "one period" },
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
  marks: (p) => [
    { x: p.a, y: 0, kind: "x", label: "a" },
    { x: 0, y: p.b, kind: "y", label: "b" },
    { x: 0, y: 0, kind: "point", label: "centre" },
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
  marks: (p) => [
    { x: p.x0, y: p.x0 * p.x0, kind: "point", label: "point of contact" },
  ],
};

const circleModel: PlotModel = {
  id: "circle",
  label: "Circle",
  formula: "(x − h)² + (y − k)² = r²",
  note: "The centre is (h, k) and r is the radius; every point on the curve sits exactly r from it.",
  params: [
    { key: "r", label: "r (radius)", min: 1, max: 9, step: 0.1, value: 5 },
    { key: "h", label: "h (centre x)", min: -5, max: 5, step: 0.1, value: 0 },
    { key: "k", label: "k (centre y)", min: -5, max: 5, step: 0.1, value: 0 },
  ],
  branches: [
    {
      label: "upper semicircle",
      evaluate: (x, p) => {
        const inner = p.r * p.r - (x - p.h) * (x - p.h);
        return inner < 0 ? null : p.k + Math.sqrt(inner);
      },
    },
    {
      label: "lower semicircle",
      dashed: true,
      evaluate: (x, p) => {
        const inner = p.r * p.r - (x - p.h) * (x - p.h);
        return inner < 0 ? null : p.k - Math.sqrt(inner);
      },
    },
  ],
  marks: (p) => [
    { x: p.h, y: p.k, kind: "point", label: "centre (h, k)" },
    { x: p.h + p.r, y: p.k, kind: "x", label: "radius r" },
  ],
};

const hyperbolaModel: PlotModel = {
  id: "hyperbola",
  label: "Hyperbola",
  formula: "x²/a² − y²/b² = 1",
  note: "The vertices sit at (±a, 0) and the asymptotes are the lines y = ±(b/a)x.",
  params: [
    { key: "a", label: "a (transverse)", min: 0.5, max: 8, step: 0.1, value: 3 },
    { key: "b", label: "b (conjugate)", min: 0.5, max: 8, step: 0.1, value: 2 },
  ],
  branches: [
    {
      label: "upper branch",
      evaluate: (x, p) => {
        const inner = (x * x) / (p.a * p.a) - 1;
        return inner < 0 ? null : p.b * Math.sqrt(inner);
      },
    },
    {
      label: "lower branch",
      dashed: true,
      evaluate: (x, p) => {
        const inner = (x * x) / (p.a * p.a) - 1;
        return inner < 0 ? null : -p.b * Math.sqrt(inner);
      },
    },
  ],
  marks: (p) => [
    { x: p.a, y: 0, kind: "x", label: "vertex a" },
    { x: 0, y: p.b, kind: "y", label: "asymptote" },
  ],
};

const sqrtModel: PlotModel = {
  id: "sqrt",
  label: "Square-root curve",
  formula: "y = k √x",
  note: "The curve starts at the origin, rises fast then flattens: the exponent is a half, not a whole number.",
  params: [{ key: "k", label: "k (stretch)", min: 0.5, max: 3, step: 0.1, value: 1.5 }],
  branches: [{ label: "y = k √x", evaluate: (x, p) => (x < 0 ? null : p.k * Math.sqrt(x)) }],
  marks: (p) => [
    { x: 0, y: 0, kind: "point", label: "origin" },
    { x: 4, y: 2 * p.k, kind: "point", label: "√4 = 2" },
  ],
};

const reciprocalModel: PlotModel = {
  id: "reciprocal",
  label: "Reciprocal of a fraction",
  formula: "y = k / x",
  note: "Dividing by a fraction means multiplying by its reciprocal — the same reason the curve flips through the origin.",
  params: [{ key: "k", label: "k", min: -4, max: 4, step: 0.1, value: 2 }],
  branches: [{ label: "y = k / x", evaluate: (x, p) => (x === 0 ? null : p.k / x) }],
  marks: (p) => [
    { x: 1, y: p.k, kind: "point", label: "1 / 1 = k" },
    { x: 0.5, y: p.k / 0.5, kind: "point", label: "1 / 0.5 = 2k" },
  ],
};

const sequenceModel: PlotModel = {
  id: "sequence",
  label: "AP terms and partial sums",
  formula: "aₙ = a + (n − 1) d",
  note: "The n-th term is a straight line in n; the partial sums curve because Sₙ grows with n².",
  params: [
    { key: "a", label: "a (first term)", min: -6, max: 10, step: 0.5, value: 2 },
    { key: "d", label: "d (common difference)", min: -4, max: 6, step: 0.5, value: 2.5 },
  ],
  branches: [
    { label: "aₙ", evaluate: (x, p) => p.a + (x - 1) * p.d },
    {
      label: "Sₙ",
      dashed: true,
      evaluate: (x, p) => (x <= 0 ? null : (x / 2) * (2 * p.a + (x - 1) * p.d)),
    },
  ],
  marks: (p) => [
    { x: 1, y: p.a, kind: "point", label: "a₁" },
    { x: 5, y: p.a + 4 * p.d, kind: "point", label: "a₅" },
  ],
};

/** Every plot the lab can draw; a chapter names its default by id. */
export const PLOT_MODELS: PlotModel[] = [
  linearModel,
  variationModel,
  quadraticModel,
  trigModel,
  ellipseModel,
  tangentModel,
  circleModel,
  hyperbolaModel,
  sqrtModel,
  reciprocalModel,
  sequenceModel,
];

/** Look up a plot by id, with a safe fallback for a stale curriculum entry. */
export function modelById(id: string, fallback: PlotModel): PlotModel {
  return PLOT_MODELS.find((entry) => entry.id === id) ?? fallback;
}

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
        example: "2/3 + 1/6, and 3/4 ÷ 9/10",
        plot: "reciprocal",
        rule: "LCM of Denominators",
        cheat: [
          { kind: "formula", title: "Addition of fractions", latex: String.raw`\frac{a}{b} + \frac{c}{d} = \frac{ad + bc}{bd}` },
          { kind: "formula", title: "Division flips the divisor", latex: String.raw`\frac{a}{b} \div \frac{c}{d} = \frac{a}{b} \times \frac{d}{c}` },
          { kind: "formula", title: "Equivalent fractions", latex: String.raw`\frac{a}{b} = \frac{a \times k}{b \times k},\quad k \neq 0` },
          { kind: "definition", title: "Rational number", latex: String.raw`q = \frac{p}{r},\ p, r \in \mathbb{Z},\ r \neq 0`, note: "Any number that can be written as a ratio of two integers with a non-zero denominator." },
          { kind: "theorem", title: "Closure under addition", latex: String.raw`\frac{a}{b} + \frac{c}{b} = \frac{a + c}{b}`, note: "A common denominator lets the numerators simply add." },
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
        example: "5x - 7 = 18",
        plot: "linear",
        rule: "Transpose Rule",
        cheat: [
          { kind: "formula", title: "Root of a linear equation", latex: String.raw`ax + b = 0 \;\Rightarrow\; x = -\frac{b}{a}` },
          { kind: "formula", title: "Slope-intercept form", latex: String.raw`y = mx + c` },
          { kind: "theorem", title: "Transposition", latex: String.raw`a + x = b \;\Rightarrow\; x = b - a`, note: "A term moved across the equals sign changes its sign." },
          { kind: "definition", title: "Linear equation", latex: String.raw`ax + b = 0`, note: "The highest power of the variable is one, so the graph is a straight line." },
          { kind: "formula", title: "Verification", latex: String.raw`x = k \;\Rightarrow\; a(k) + b \stackrel{?}{=} 0` },
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
        example: "Solve (x + 3)² = 64",
        plot: "sqrt",
        rule: "Perfect Square Identity",
        cheat: [
          { kind: "formula", title: "Square of a sum", latex: String.raw`(a + b)^2 = a^2 + 2ab + b^2` },
          { kind: "formula", title: "Square of a difference", latex: String.raw`(a - b)^2 = a^2 - 2ab + b^2` },
          { kind: "formula", title: "Product of roots", latex: String.raw`\sqrt{ab} = \sqrt{a}\,\sqrt{b}` },
          { kind: "theorem", title: "Pythagorean triplets", latex: String.raw`(2m,\; m^2 - 1,\; m^2 + 1)`, note: "Generate any primitive triplet from a whole number m greater than 1." },
          { kind: "definition", title: "Perfect square", latex: String.raw`n = k^2,\ k \in \mathbb{Z}`, note: "A whole number that is the square of another whole number." },
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
        example: "Area of a trapezium with a = 6 cm, b = 4 cm, h = 5 cm",
        plot: "circle",
        rule: "Area Formula",
        cheat: [
          { kind: "formula", title: "Trapezium", latex: String.raw`A = \frac{1}{2}(a + b)h` },
          { kind: "formula", title: "Cylinder", latex: String.raw`V = \pi r^2 h, \quad \text{TSA} = 2\pi r(r + h)` },
          { kind: "formula", title: "Cube", latex: String.raw`V = a^3, \quad \text{TSA} = 6a^2` },
          { kind: "formula", title: "Cone", latex: String.raw`V = \frac{1}{3}\pi r^2 h` },
          { kind: "definition", title: "Curved surface area of a cylinder", latex: String.raw`\text{CSA} = 2\pi r h`, note: "The curved surface is the tube; a cylinder has two flat circular faces as well." },
        ],
      },
    ],
    models: [reciprocalModel, linearModel, sqrtModel, circleModel],
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
        example: "Rationalise 1/(√5 − √3)",
        plot: "sqrt",
        rule: "Conjugate Multiplication",
        cheat: [
          { kind: "formula", title: "Conjugate product", latex: String.raw`(\sqrt{a} + \sqrt{b})(\sqrt{a} - \sqrt{b}) = a - b` },
          { kind: "formula", title: "Rationalising a denominator", latex: String.raw`\frac{1}{\sqrt{a} + \sqrt{b}} = \frac{\sqrt{a} - \sqrt{b}}{a - b}` },
          { kind: "formula", title: "Exponent laws", latex: String.raw`a^m \cdot a^n = a^{m+n}, \quad \frac{a^m}{a^n} = a^{m-n}, \quad (a^m)^n = a^{mn}` },
          { kind: "definition", title: "Rational vs irrational", latex: String.raw`\frac{p}{q} \in \mathbb{Q} \quad \text{but} \quad \sqrt{2} \notin \mathbb{Q}`, note: "A rational number is a ratio of integers; an irrational one cannot be written that way however you try." },
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
        example: "Find the remainder when x³ - 3x² + 4 is divided by (x - 2)",
        plot: "quadratic",
        rule: "Remainder Theorem",
        cheat: [
          { kind: "theorem", title: "Remainder theorem", latex: String.raw`p(x) \div (x - a) \text{ leaves remainder } p(a)` },
          { kind: "theorem", title: "Factor theorem", latex: String.raw`(x - a) \text{ is a factor of } p(x) \iff p(a) = 0` },
          { kind: "formula", title: "Cube of a sum", latex: String.raw`(a + b)^3 = a^3 + b^3 + 3ab(a + b)` },
          { kind: "formula", title: "Difference of squares", latex: String.raw`a^2 - b^2 = (a - b)(a + b)` },
          { kind: "definition", title: "Polynomial", latex: String.raw`p(x) = a_nx^n + \cdots + a_1x + a_0`, note: "Every coefficient is a real number and the exponents are whole numbers." },
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
        example: "For 2x + 3y = 12, find all integer solutions",
        plot: "linear",
        rule: "Standard Form",
        cheat: [
          { kind: "formula", title: "General form", latex: String.raw`ax + by + c = 0` },
          { kind: "formula", title: "Slope-intercept form", latex: String.raw`y = mx + c` },
          { kind: "formula", title: "Intercept form", latex: String.raw`\frac{x}{a} + \frac{y}{b} = 1` },
          { kind: "definition", title: "Number of solutions", latex: String.raw`\text{one equation} \Rightarrow \text{infinitely many points}`, note: "A single line of solutions; you need two independent equations to pin down one point." },
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
        example: "Find the distance between (2, -1) and (-3, 4)",
        plot: "circle",
        rule: "Distance Formula",
        cheat: [
          { kind: "formula", title: "Distance between two points", latex: String.raw`d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}` },
          { kind: "formula", title: "Midpoint", latex: String.raw`M = \left(\frac{x_1 + x_2}{2},\ \frac{y_1 + y_2}{2}\right)` },
          { kind: "definition", title: "Quadrants", latex: String.raw`(+,+)\ I \quad (-,+)\ II \quad (-,-)\ III \quad (+,-)\ IV`, note: "The signs of x and y, read anticlockwise from the positive x-axis." },
          { kind: "theorem", title: "Section formula", latex: String.raw`P = \left(\frac{mx_2 + nx_1}{m+n},\ \frac{my_2 + ny_1}{m+n}\right)`, note: "Divides the segment joining (x₁,y₁) and (x₂,y₂) in the ratio m : n." },
        ],
      },
    ],
    models: [quadraticModel, linearModel, circleModel, sqrtModel],
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
        example: "3x² - 5x + 2 = 0",
        plot: "quadratic",
        rule: "Quadratic Formula",
        cheat: [
          { kind: "formula", title: "Quadratic formula", latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}` },
          { kind: "definition", title: "Discriminant", latex: String.raw`D = b^2 - 4ac`, note: "Its sign decides the roots: D greater than 0 gives two distinct real roots, D equal to 0 one repeated root, D less than 0 no real roots." },
          { kind: "theorem", title: "Vieta's formulas", latex: String.raw`\alpha + \beta = -\frac{b}{a}, \qquad \alpha\beta = \frac{c}{a}` },
          { kind: "formula", title: "Vertex and axis", latex: String.raw`x_v = -\frac{b}{2a}, \qquad y_v = c - \frac{b^2}{4a}` },
          { kind: "theorem", title: "Zero-product rule", latex: String.raw`PQ = 0 \Rightarrow P = 0 \ \text{or}\ Q = 0`, note: "The factorised route: solve each factor separately." },
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
        example: "Find a₁₀ when a₁ = 3 and d = 4",
        plot: "sequence",
        rule: "nth-Term Formula",
        cheat: [
          { kind: "formula", title: "nth term", latex: String.raw`a_n = a + (n - 1)d` },
          { kind: "formula", title: "Sum of n terms", latex: String.raw`S_n = \frac{n}{2}\left[2a + (n - 1)d\right]` },
          { kind: "formula", title: "nth term from the sum", latex: String.raw`a_n = S_n - S_{n-1}` },
          { kind: "definition", title: "Arithmetic progression", latex: String.raw`a_{n+1} - a_n = d`, note: "The difference between every term and the one before it is the same constant d." },
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
        example: "If sin θ = 3/5, find cos θ and tan θ",
        plot: "trig",
        rule: "Trigonometric Identity",
        cheat: [
          { kind: "formula", title: "Pythagorean identity", latex: String.raw`\sin^2\theta + \cos^2\theta = 1` },
          { kind: "formula", title: "Reciprocal identity", latex: String.raw`1 + \tan^2\theta = \sec^2\theta` },
          { kind: "formula", title: "Ratio of ratios", latex: String.raw`\tan\theta = \frac{\sin\theta}{\cos\theta}` },
          { kind: "definition", title: "Standard angles", latex: String.raw`0^\circ,\ 30^\circ,\ 45^\circ,\ 60^\circ,\ 90^\circ`, note: "Half the diagonal is 1 over root 2, and the equilateral triangle fixes the 30 and 60 values." },
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
        example: "Area of the triangle with (0,0), (4,3) and (1,5)",
        plot: "circle",
        rule: "Area Formula",
        cheat: [
          { kind: "formula", title: "Distance", latex: String.raw`d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}` },
          { kind: "formula", title: "Section formula", latex: String.raw`\left(\frac{mx_2 + nx_1}{m+n},\ \frac{my_2 + ny_1}{m+n}\right)` },
          { kind: "formula", title: "Area of a triangle", latex: String.raw`\Delta = \frac{1}{2}\left|x_1(y_2 - y_3) + x_2(y_3 - y_1) + x_3(y_1 - y_2)\right|` },
          { kind: "definition", title: "Collinear points", latex: String.raw`\Delta = 0`, note: "Three points lie on one straight line exactly when the determinant of their coordinates is zero." },
        ],
      },
    ],
    models: [quadraticModel, sequenceModel, trigModel, circleModel],
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
        example: "Find the eccentricity of x²/25 + y²/9 = 1",
        plot: "ellipse",
        rule: "Standard Form",
        cheat: [
          { kind: "formula", title: "Circle", latex: String.raw`(x - h)^2 + (y - k)^2 = r^2` },
          { kind: "formula", title: "Ellipse", latex: String.raw`\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1, \qquad c^2 = a^2 - b^2` },
          { kind: "formula", title: "Hyperbola", latex: String.raw`\frac{x^2}{a^2} - \frac{y^2}{b^2} = 1, \qquad e = \frac{c}{a}` },
          { kind: "formula", title: "Parabola", latex: String.raw`y^2 = 4ax \ \Rightarrow\ \text{focus } (a, 0)` },
          { kind: "definition", title: "Eccentricity", latex: String.raw`e = \frac{c}{a}`, note: "The ellipse has e below 1, the parabola exactly 1, the hyperbola above 1; a circle is e equal to 0." },
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
        example: "Distance of (3, -2) from 3x + 4y - 5 = 0",
        plot: "linear",
        rule: "Distance Formula",
        cheat: [
          { kind: "formula", title: "Slope of a line", latex: String.raw`m = \frac{y_2 - y_1}{x_2 - x_1}` },
          { kind: "formula", title: "Point-slope form", latex: String.raw`y - y_1 = m(x - x_1)` },
          { kind: "formula", title: "Two-point form", latex: String.raw`y - y_1 = \frac{y_2 - y_1}{x_2 - x_1}(x - x_1)` },
          { kind: "formula", title: "Distance from a point", latex: String.raw`d = \frac{\left|a x_1 + b y_1 + c\right|}{\sqrt{a^2 + b^2}}` },
          { kind: "definition", title: "Collinearity of three points", latex: String.raw`\frac{y_2 - y_1}{x_2 - x_1} = \frac{y_3 - y_1}{x_3 - x_1}`, note: "Equal slopes from a common point is the quickest test that three points lie on one line." },
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
        example: "Simplify sin 75° using compound angles",
        plot: "trig",
        rule: "Compound Angle Formula",
        cheat: [
          { kind: "formula", title: "Radians and degrees", latex: String.raw`1\text{ radian} = \frac{180^\circ}{\pi}, \qquad \pi \text{ rad} = 180^\circ` },
          { kind: "formula", title: "Sine of a sum", latex: String.raw`\sin(A + B) = \sin A\cos B + \cos A\sin B` },
          { kind: "formula", title: "Double-angle forms", latex: String.raw`\cos 2A = 1 - 2\sin^2 A = 2\cos^2 A - 1` },
          { kind: "definition", title: "Period and fundamental period", latex: String.raw`\sin, \cos: 2\pi \qquad \tan: \pi`, note: "A function is periodic when the graph repeats itself after a fixed interval; the smallest such interval is the fundamental period." },
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
        example: "Differentiate y = 3x² - 5x + 2",
        plot: "tangent",
        rule: "Power Rule",
        cheat: [
          { kind: "definition", title: "Derivative", latex: String.raw`f'(x) = \lim_{h \to 0}\frac{f(x + h) - f(x)}{h}` },
          { kind: "formula", title: "Power rule", latex: String.raw`\frac{d}{dx}\left(x^n\right) = n x^{n-1}` },
          { kind: "formula", title: "Derivative of sine and cosine", latex: String.raw`\frac{d}{dx}\sin x = \cos x, \qquad \frac{d}{dx}\cos x = -\sin x` },
          { kind: "formula", title: "Tangent at a point", latex: String.raw`y - f(a) = f'(a)(x - a)` },
          { kind: "definition", title: "Instantaneous rate of change", latex: String.raw`f'(a) = \lim_{x \to a}\frac{f(x) - f(a)}{x - a}`, note: "The slope of the tangent at a, and the whole meaning of the derivative." },
        ],
      },
    ],
    models: [ellipseModel, hyperbolaModel, circleModel, trigModel, linearModel, tangentModel],
  },
];

export function getGrade(id: GradeId): GradeSpec {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}

/**
 * The two or three relations a student most needs from a chapter — the ones
 * worth memorising. The lab shows these and nothing else, so the cheat-sheet
 * stays something a person reads rather than skims.
 */
export function coreFormulas(chapter: Chapter, count = 3): CheatEntry[] {
  const relations = chapter.cheat.filter((entry) => entry.kind !== "definition");
  return relations.slice(0, count);
}

/** The chapter's key definitions, or its leading relations when it has none. */
export function coreDefinitions(chapter: Chapter, count = 2): CheatEntry[] {
  const definitions = chapter.cheat.filter((entry) => entry.kind === "definition");
  if (definitions.length > 0) return definitions.slice(0, count);
  return coreFormulas(chapter, count);
}

/* ------------------------------------------------------------------ */
/* Equation engine                                                     */
/* ------------------------------------------------------------------ */

export interface Solution {
  headline: string;
  /** The result, stated once, for the final-answer card. */
  answer: string;
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
  let answer: string;

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
    answer = `x₁ = ${num(x1)}, x₂ = ${num(x2)}`;
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
    answer = `x = ${num(x)} (repeated root)`;
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
    answer = `x = ${num(real)} ± ${num(Math.abs(imaginary))}i — no real roots`;
  }

  return {
    headline:
      discriminant > 0
        ? "Two distinct real roots — the curve crosses the x-axis twice."
        : ZERO(discriminant)
          ? "One repeated real root — the curve touches the x-axis."
          : "No real roots — the curve never meets the x-axis.",
    answer,
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
      answer: ZERO(c) ? "Every value of x satisfies it" : "No value of x satisfies it",
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
    answer: `x = ${num(x)}`,
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
    answer: `Amplitude ${num(Math.abs(amplitude))}, period ${num(period)}, phase shift ${num(phase)}`,
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
    answer: `f′(x) = ${num(2 * a2)}x + ${num(a1)}, and the tangent at x = ${num(x0)} is y = ${num(slope)}x + ${num(value - slope * x0)}`,
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
    answer: input.trim()
      ? "Work the chapter's governing formula above with the values in the question."
      : `Type a problem from ${chapter.name} to get a worked answer.`,
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
