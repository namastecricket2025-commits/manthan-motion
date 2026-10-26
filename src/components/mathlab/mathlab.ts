/**
 * Math Lab curriculum and equation engine.
 *
 * Everything the lab knows lives here: the five grade tracks, the chapters
 * with the governing formulas each one is examined on, the plottable models
 * the graphing canvas renders, and a small symbolic solver that turns a typed
 * equation into the four structured blocks the right pane shows.
 *
 * The solver is deliberately narrow and honest: it recognises linear and
 * quadratic equations, trigonometric traces and a first derivative, and for
 * anything else it falls back to the selected chapter's governing formulas
 * rather than inventing an answer.
 */

export type GradeId = "8" | "9" | "10" | "11" | "12";

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
  /** Grades 10 to 12 need the full Prime suite; 8 and 9 run on basic graphs. */
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

/**
 * A chapter written from the board's own formula list.
 *
 * The CBSE list is long, and every entry needs the same seven fields. Writing
 * them out by hand invites the sheet and the chapter drifting apart, so the
 * cheat sheet is built from the same LaTeX the formulas come from: one source,
 * two renderings.
 */
function boardChapter(spec: {
  name: string;
  focus: string;
  formulas: string[];
  latex: [string, string][];
  method: [string, string];
  example: string;
  plot: string;
  rule: string;
}): Chapter {
  return {
    name: spec.name,
    focus: spec.focus,
    formulas: spec.formulas,
    method: [...spec.method],
    example: spec.example,
    plot: spec.plot,
    rule: spec.rule,
    cheat: [
      ...spec.latex.map(([title, latex]) => ({ kind: "formula" as const, title, latex })),
      { kind: "definition", title: "What this chapter is really asking", latex: spec.latex[0][1], note: spec.focus },
    ],
  };
}

/** The rest of the CBSE Class 9 syllabus, in the board's order. */
const CBSE_9: Chapter[] = [
  boardChapter({
    name: "Introduction to Euclid's Geometry",
    focus: "Axioms, postulates and what counts as a proof.",
    formulas: [
      "Things equal to the same thing are equal to one another",
      "The whole is greater than the part",
      "Through two distinct points there is exactly one line",
    ],
    latex: [
      ["Axiom 1", String.raw`a = c,\ b = c \;\Rightarrow\; a = b`],
      ["Axiom 5", String.raw`\text{whole} > \text{part}`],
      ["Unique line", String.raw`A \neq B \;\Rightarrow\; \overleftrightarrow{AB}\ \text{is unique}`],
    ],
    method: [
      "Name the axiom or postulate you are using before you use it.",
      "Keep every statement in the two-column form: claim, then reason.",
    ],
    example: "Show that two distinct lines cannot have more than one point in common",
    plot: "linear",
    rule: "Euclid's Axioms",
  }),
  boardChapter({
    name: "Lines and Angles",
    focus: "Angle pairs on a transversal and the angle sum of a triangle.",
    formulas: [
      "Linear pair: a + b = 180°",
      "Vertically opposite angles are equal",
      "Angle sum of a triangle = 180°",
    ],
    latex: [
      ["Linear pair", String.raw`\angle a + \angle b = 180^\circ`],
      ["Vertically opposite", String.raw`\angle 1 = \angle 3`],
      ["Angle sum", String.raw`\angle A + \angle B + \angle C = 180^\circ`],
      ["Exterior angle", String.raw`\angle ACD = \angle A + \angle B`],
    ],
    method: [
      "Mark the parallel pair and the transversal first; every relation follows from those two.",
      "State which pair you used — alternate, corresponding or co-interior — so the reason is visible.",
    ],
    example: "Two parallel lines cut by a transversal: one angle is 65°, find the rest",
    plot: "linear",
    rule: "Parallel Line Theorems",
  }),
  boardChapter({
    name: "Triangles",
    focus: "Congruence rules and the inequalities a triangle must obey.",
    formulas: [
      "SAS, ASA, SSS and RHS congruence",
      "Angles opposite equal sides are equal",
      "Sum of any two sides > the third side",
    ],
    latex: [
      ["Congruence", String.raw`\triangle ABC \cong \triangle PQR`],
      ["Isosceles base angles", String.raw`AB = AC \;\Rightarrow\; \angle B = \angle C`],
      ["Triangle inequality", String.raw`AB + BC > AC`],
    ],
    method: [
      "Write the correspondence in the right order — the letters carry the proof.",
      "Quote the rule (SAS, ASA, SSS, RHS) after the three facts, never before.",
    ],
    example: "In triangles ABC and PQR, AB = PQ, BC = QR and ∠B = ∠Q — prove congruence",
    plot: "linear",
    rule: "Congruence Criteria",
  }),
  boardChapter({
    name: "Quadrilaterals",
    focus: "Parallelogram properties and the midpoint theorem.",
    formulas: [
      "Sum of interior angles of a quadrilateral = 360°",
      "Diagonals of a parallelogram bisect each other",
      "Midpoint theorem: the segment joining midpoints is parallel to the third side and half of it",
    ],
    latex: [
      ["Angle sum", String.raw`\angle A + \angle B + \angle C + \angle D = 360^\circ`],
      ["Parallelogram", String.raw`\text{diagonals bisect each other}`],
      ["Midpoint theorem", String.raw`DE \parallel BC,\quad DE = \tfrac{1}{2}BC`],
    ],
    method: [
      "Draw the diagonal: it turns every quadrilateral problem into two triangles.",
      "Mark the given equal sides first, then chase the angles they force.",
    ],
    example: "Prove that the diagonals of a rectangle are equal",
    plot: "linear",
    rule: "Parallelogram Properties",
  }),
  boardChapter({
    name: "Circles",
    focus: "Chords, arcs, cyclic quadrilaterals and the angle in a semicircle.",
    formulas: [
      "Angle at the centre = 2 × angle at the circumference",
      "Angle in a semicircle = 90°",
      "Opposite angles of a cyclic quadrilateral add to 180°",
    ],
    latex: [
      ["Angle at the centre", String.raw`\angle AOB = 2\angle ACB`],
      ["Semicircle", String.raw`\angle APB = 90^\circ`],
      ["Cyclic quadrilateral", String.raw`\angle A + \angle C = 180^\circ`],
      ["Perpendicular from centre", String.raw`OM \perp AB \;\Rightarrow\; AM = MB`],
    ],
    method: [
      "Join the centre to the points you were given — the radius is the only free construction.",
      "Look for a diameter before anything else; it hands you a right angle.",
    ],
    example: "A chord of length 16 cm is 6 cm from the centre — find the radius",
    plot: "circle",
    rule: "Circle Theorems",
  }),
  boardChapter({
    name: "Heron's Formula",
    focus: "Area of any triangle from its three sides, and the quadrilateral split.",
    formulas: [
      "s = (a + b + c) / 2",
      "Area = √(s(s − a)(s − b)(s − c))",
      "Quadrilateral area = sum of the two triangles on its diagonal",
    ],
    latex: [
      ["Semi-perimeter", String.raw`s = \frac{a + b + c}{2}`],
      ["Heron's formula", String.raw`A = \sqrt{s(s-a)(s-b)(s-c)}`],
      ["Equilateral triangle", String.raw`A = \frac{\sqrt{3}}{4}a^2`],
    ],
    method: [
      "Compute the semi-perimeter first and keep it exact — rounding early changes the area.",
      "For a quadrilateral, draw a diagonal and add the two triangle areas.",
    ],
    example: "Find the area of a triangle with sides 13 cm, 14 cm and 15 cm",
    plot: "sqrt",
    rule: "Heron's Formula",
  }),
  boardChapter({
    name: "Surface Areas and Volumes",
    focus: "Right circular cones, spheres and cylinders, and combinations of them.",
    formulas: [
      "CSA of a cone = π r l, where l = √(r² + h²)",
      "Volume of a sphere = (4/3) π r³",
      "Volume of a cylinder = π r² h",
    ],
    latex: [
      ["Cone slant height", String.raw`l = \sqrt{r^2 + h^2}`],
      ["Cone CSA", String.raw`\text{CSA} = \pi r l`],
      ["Sphere volume", String.raw`V = \frac{4}{3}\pi r^3`],
      ["Hemisphere TSA", String.raw`\text{TSA} = 3\pi r^2`],
    ],
    method: [
      "Decide which surfaces are actually exposed before adding any area.",
      "Keep π symbolic until the last line, then substitute 22/7 or 3.14 as the question says.",
    ],
    example: "A cone has radius 7 cm and height 24 cm — find its slant height and CSA",
    plot: "circle",
    rule: "Mensuration Formulas",
  }),
  boardChapter({
    name: "Statistics",
    focus: "Reading data, and the mean, median and mode of grouped data.",
    formulas: [
      "Mean = Σ fᵢxᵢ / Σ fᵢ",
      "Median class = the class where the cumulative frequency passes n/2",
      "Mode = the value with the highest frequency",
    ],
    latex: [
      ["Mean", String.raw`\bar{x} = \frac{\sum f_i x_i}{\sum f_i}`],
      ["Median", String.raw`M = l + \frac{\frac{n}{2} - cf}{f} \times h`],
      ["Mode", String.raw`Z = l + \frac{f_1 - f_0}{2f_1 - f_0 - f_2} \times h`],
    ],
    method: [
      "Build the frequency table with class marks and cumulative frequency before any formula.",
      "Check which measure the question asks for; mean, median and mode are not interchangeable.",
    ],
    example: "Find the mean of the classes 0-10, 10-20, 20-30 with frequencies 4, 6, 10",
    plot: "sequence",
    rule: "Measures of Central Tendency",
  }),
];

/** The rest of the CBSE Class 10 syllabus, in the board's order. */
const CBSE_10: Chapter[] = [
  boardChapter({
    name: "Real Numbers",
    focus: "Euclid's lemma, the fundamental theorem of arithmetic and irrationality.",
    formulas: [
      "HCF × LCM = product of the two numbers",
      "Every composite number is a unique product of primes",
      "√2, √3, √5 are irrational",
    ],
    latex: [
      ["HCF and LCM", String.raw`\text{HCF}(a,b) \times \text{LCM}(a,b) = a \times b`],
      ["Prime factorisation", String.raw`n = p_1^{a_1} p_2^{a_2} \cdots p_k^{a_k}`],
      ["Terminating decimal", String.raw`\frac{p}{q}\ \text{terminates} \iff q = 2^m 5^n`],
    ],
    method: [
      "Factorise into primes first; HCF is the smallest power of each shared prime.",
      "For irrationality, assume the opposite and reach a contradiction about divisibility.",
    ],
    example: "Find the HCF and LCM of 96 and 404",
    plot: "sqrt",
    rule: "Fundamental Theorem of Arithmetic",
  }),
  boardChapter({
    name: "Polynomials",
    focus: "Zeroes and the coefficients that produce them.",
    formulas: [
      "Sum of zeroes = −b/a",
      "Product of zeroes = c/a",
      "A quadratic with given zeroes: k(x² − (sum)x + product)",
    ],
    latex: [
      ["Sum of zeroes", String.raw`\alpha + \beta = -\frac{b}{a}`],
      ["Product of zeroes", String.raw`\alpha\beta = \frac{c}{a}`],
      ["Cubic relations", String.raw`\alpha + \beta + \gamma = -\frac{b}{a},\quad \alpha\beta\gamma = -\frac{d}{a}`],
    ],
    method: [
      "Read a, b, c off the polynomial only after writing it in standard form.",
      "Use the sum and product to build the polynomial instead of solving for each zero.",
    ],
    example: "Find a quadratic polynomial whose zeroes are 3 and −2",
    plot: "quadratic",
    rule: "Relationship Between Zeroes and Coefficients",
  }),
  boardChapter({
    name: "Pair of Linear Equations in Two Variables",
    focus: "Consistency, and solving by substitution, elimination or cross-multiplication.",
    formulas: [
      "Unique solution: a₁/a₂ ≠ b₁/b₂",
      "Infinitely many: a₁/a₂ = b₁/b₂ = c₁/c₂",
      "No solution: a₁/a₂ = b₁/b₂ ≠ c₁/c₂",
    ],
    latex: [
      ["Unique solution", String.raw`\frac{a_1}{a_2} \neq \frac{b_1}{b_2}`],
      ["Infinite solutions", String.raw`\frac{a_1}{a_2} = \frac{b_1}{b_2} = \frac{c_1}{c_2}`],
      ["No solution", String.raw`\frac{a_1}{a_2} = \frac{b_1}{b_2} \neq \frac{c_1}{c_2}`],
    ],
    method: [
      "Compare the ratios before solving — the question often only asks which case it is.",
      "In word problems, define both variables in one line and write two equations from the two facts.",
    ],
    example: "2x + 3y = 11 and 2x − 4y = −24 — solve by elimination",
    plot: "linear",
    rule: "Consistency Conditions",
  }),
  boardChapter({
    name: "Triangles",
    focus: "Similarity criteria and the basic proportionality theorem.",
    formulas: [
      "Basic proportionality: DE ∥ BC ⇒ AD/DB = AE/EC",
      "AAA, SSS and SAS similarity",
      "Areas of similar triangles are in the ratio of the squares of corresponding sides",
    ],
    latex: [
      ["Basic proportionality", String.raw`\frac{AD}{DB} = \frac{AE}{EC}`],
      ["Area ratio", String.raw`\frac{\triangle ABC}{\triangle PQR} = \left(\frac{AB}{PQ}\right)^2`],
      ["Pythagoras", String.raw`AC^2 = AB^2 + BC^2`],
    ],
    method: [
      "Mark the equal angles before writing the similarity; the correspondence decides every ratio.",
      "Write the similarity statement in matching order, then take ratios from it.",
    ],
    example: "In triangle ABC, DE ∥ BC with AD = 3 cm, DB = 5 cm and AE = 4.5 cm — find EC",
    plot: "linear",
    rule: "Similarity Criteria",
  }),
  boardChapter({
    name: "Some Applications of Trigonometry",
    focus: "Heights and distances: angle of elevation and depression.",
    formulas: [
      "tan θ = opposite / adjacent",
      "Angle of elevation is measured upward from the horizontal",
      "Angle of depression is measured downward from the horizontal",
    ],
    latex: [
      ["Tangent", String.raw`\tan\theta = \frac{\text{opposite}}{\text{adjacent}}`],
      ["Height from shadow", String.raw`h = d\tan\theta`],
      ["Two-angle tower", String.raw`h = \frac{d}{\cot\alpha - \cot\beta}`],
    ],
    method: [
      "Draw the horizontal, the vertical and the line of sight; label the known angle at the observer.",
      "Pick tan whenever the unknown is a height or a distance and no hypotenuse is involved.",
    ],
    example: "A tower casts a 30 m shadow when the sun's elevation is 30° — find its height",
    plot: "trig",
    rule: "Heights and Distances",
  }),
  boardChapter({
    name: "Circles",
    focus: "Tangents, the radius-tangent angle and equal tangent lengths.",
    formulas: [
      "A tangent is perpendicular to the radius at the point of contact",
      "Tangents from an external point are equal in length",
      "The angle between two tangents = 180° − angle at the centre",
    ],
    latex: [
      ["Radius and tangent", String.raw`OP \perp AB`],
      ["Equal tangents", String.raw`PA = PB`],
      ["Angle between tangents", String.raw`\angle APB = 180^\circ - \angle AOB`],
    ],
    method: [
      "Draw the radius to the point of contact first — it creates the right angle the proof needs.",
      "For two tangents, join the external point to the centre to get two congruent triangles.",
    ],
    example: "A tangent PQ at Q to a circle of radius 5 cm meets a line through O at P with OP = 13 cm — find PQ",
    plot: "circle",
    rule: "Tangent Theorems",
  }),
  boardChapter({
    name: "Areas Related to Circles",
    focus: "Sectors, segments and the length of an arc.",
    formulas: [
      "Area of a sector = (θ/360) π r²",
      "Length of an arc = (θ/360) 2π r",
      "Area of a segment = sector − triangle",
    ],
    latex: [
      ["Sector area", String.raw`A = \frac{\theta}{360^\circ}\pi r^2`],
      ["Arc length", String.raw`l = \frac{\theta}{360^\circ} 2\pi r`],
      ["Segment area", String.raw`A = \frac{\theta}{360^\circ}\pi r^2 - \frac{1}{2}r^2\sin\theta`],
    ],
    method: [
      "Decide whether the answer is a sector (pie slice) or a segment (slice minus triangle).",
      "Convert the angle to a fraction of 360° before multiplying; it keeps the units honest.",
    ],
    example: "Find the area of a sector of radius 6 cm with a 60° angle",
    plot: "circle",
    rule: "Sector and Segment Formulas",
  }),
  boardChapter({
    name: "Surface Areas and Volumes",
    focus: "Combinations of solids: cylinders, cones, spheres and frustums.",
    formulas: [
      "Frustum volume = (1/3) π h (r₁² + r₁r₂ + r₂²)",
      "Sphere volume = (4/3) π r³",
      "Total surface area counts only the surfaces you can touch",
    ],
    latex: [
      ["Frustum volume", String.raw`V = \frac{1}{3}\pi h (r_1^2 + r_1 r_2 + r_2^2)`],
      ["Frustum slant", String.raw`l = \sqrt{h^2 + (r_1 - r_2)^2}`],
      ["Sphere", String.raw`V = \frac{4}{3}\pi r^3,\quad A = 4\pi r^2`],
    ],
    method: [
      "Split the object into the solids it is made of and add only the exposed surfaces.",
      "Watch for a hollow: subtract the inner volume, not the inner area.",
    ],
    example: "A cylindrical vessel of radius 7 cm holds a hemisphere — find the total volume",
    plot: "circle",
    rule: "Combination of Solids",
  }),
  boardChapter({
    name: "Statistics",
    focus: "Mean, median and mode of grouped data, and the cumulative curve.",
    formulas: [
      "Mean = Σ fᵢxᵢ / Σ fᵢ",
      "Median = l + ((n/2 − cf)/f) h",
      "Mode = l + ((f₁ − f₀)/(2f₁ − f₀ − f₂)) h",
    ],
    latex: [
      ["Mean", String.raw`\bar{x} = \frac{\sum f_i x_i}{\sum f_i}`],
      ["Median", String.raw`M = l + \frac{\frac{n}{2} - cf}{f}h`],
      ["Mode", String.raw`Z = l + \frac{f_1 - f_0}{2f_1 - f_0 - f_2}h`],
    ],
    method: [
      "Write the table with class marks and cumulative frequency before choosing a formula.",
      "Identify the modal class by frequency, the median class by n/2 — they are often different.",
    ],
    example: "Find the median of the classes 0-10 to 40-50 with frequencies 5, 8, 15, 12, 10",
    plot: "sequence",
    rule: "Grouped Data Formulas",
  }),
  boardChapter({
    name: "Probability",
    focus: "Theoretical probability, complementary events and dice-and-card questions.",
    formulas: [
      "P(E) = favourable outcomes / total outcomes",
      "P(E) + P(not E) = 1",
      "0 ≤ P(E) ≤ 1",
    ],
    latex: [
      ["Probability", String.raw`P(E) = \frac{n(E)}{n(S)}`],
      ["Complement", String.raw`P(\bar{E}) = 1 - P(E)`],
      ["Impossible and certain", String.raw`P(\varnothing) = 0,\quad P(S) = 1`],
    ],
    method: [
      "List the sample space once, completely, before counting anything.",
      "If the question says 'at least one', count the complement and subtract from 1.",
    ],
    example: "Two dice are thrown — find the probability that the sum is 8",
    plot: "sequence",
    rule: "Theoretical Probability",
  }),
];

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
      boardChapter({
        name: "Understanding Quadrilaterals",
        focus: "Angle sums of polygons and the properties of a parallelogram.",
        formulas: [
          "Angle sum of an n-gon = (n − 2) × 180°",
          "Opposite sides and opposite angles of a parallelogram are equal",
          "The exterior angles of any polygon add to 360°",
        ],
        latex: [
          ["Angle sum", String.raw`(n - 2) \times 180^\circ`],
          ["Parallelogram angles", String.raw`\angle A = \angle C,\quad \angle B = \angle D`],
          ["Exterior angles", String.raw`\sum \text{exterior} = 360^\circ`],
        ],
        method: [
          "Draw the diagonal first: it splits a quadrilateral into two triangles and the angle sum follows.",
          "Mark the parallel pair before using any parallelogram property — without it, the equal angles do not follow.",
        ],
        example: "The angles of a quadrilateral are in the ratio 3 : 5 : 9 : 13 — find all four",
        plot: "linear",
        rule: "Angle Sum Property",
      }),
      boardChapter({
        name: "Data Handling",
        focus: "Organising data, reading graphs and simple probability.",
        formulas: [
          "Mean = sum of observations / number of observations",
          "Probability of an event = favourable outcomes / total outcomes",
          "Class mark = (lower limit + upper limit) / 2",
        ],
        latex: [
          ["Mean", String.raw`\bar{x} = \frac{\sum x_i}{n}`],
          ["Probability", String.raw`P(E) = \frac{\text{favourable}}{\text{total}}`],
          ["Class mark", String.raw`\text{mark} = \frac{\text{lower} + \text{upper}}{2}`],
        ],
        method: [
          "Sort the data and count the frequencies before drawing any graph.",
          "Check that the probabilities of all outcomes add to 1 — that is the quickest way to catch a miscount.",
        ],
        example: "A die is thrown once — find the probability of getting a prime number",
        plot: "sequence",
        rule: "Probability of an Event",
      }),
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
      boardChapter({
        name: "Cubes and Cube Roots",
        focus: "Perfect cubes, prime factorisation and cube roots.",
        formulas: [
          "a³ = a × a × a",
          "∛(a × b) = ∛a × ∛b",
          "(a + b)³ = a³ + 3a²b + 3ab² + b³",
        ],
        latex: [
          ["Cube", String.raw`a^3 = a \times a \times a`],
          ["Cube root of a product", String.raw`\sqrt[3]{ab} = \sqrt[3]{a}\,\sqrt[3]{b}`],
          ["Cube of a sum", String.raw`(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3`],
        ],
        method: [
          "Write the number as a product of primes, then group the factors in threes.",
          "Test a cube root by cubing it back — an exact cube returns the original number.",
        ],
        example: "Find the cube root of 13824 by prime factorisation",
        plot: "sqrt",
        rule: "Prime Factorisation",
      }),
      boardChapter({
        name: "Comparing Quantities",
        focus: "Percentages, profit and loss, simple and compound interest.",
        formulas: [
          "Profit % = (SP − CP) / CP × 100",
          "Simple interest = P × R × T / 100",
          "Compound interest = P(1 + R/100)ⁿ − P",
        ],
        latex: [
          ["Profit per cent", String.raw`\text{profit}\% = \frac{SP - CP}{CP} \times 100`],
          ["Simple interest", String.raw`SI = \frac{P \times R \times T}{100}`],
          ["Compound interest", String.raw`CI = P\left(1 + \frac{R}{100}\right)^n - P`],
        ],
        method: [
          "Decide which quantity is the base — profit and loss are always a percentage of cost price, discount of marked price.",
          "For compound interest, apply the rate once per year on the amount, not on the original principal.",
        ],
        example: "Find the compound interest on ₹8000 at 10% per annum for 2 years",
        plot: "sequence",
        rule: "Compound Interest",
      }),
      boardChapter({
        name: "Algebraic Expressions and Identities",
        focus: "Terms, like terms and the four standard identities.",
        formulas: [
          "(a + b)² = a² + 2ab + b²",
          "(a − b)² = a² − 2ab + b²",
          "(x + a)(x + b) = x² + (a + b)x + ab",
        ],
        latex: [
          ["Square of a sum", String.raw`(a + b)^2 = a^2 + 2ab + b^2`],
          ["Square of a difference", String.raw`(a - b)^2 = a^2 - 2ab + b^2`],
          ["Difference of squares", String.raw`a^2 - b^2 = (a - b)(a + b)`],
          ["Product of two binomials", String.raw`(x + a)(x + b) = x^2 + (a+b)x + ab`],
        ],
        method: [
          "Identify the identity that fits before expanding term by term.",
          "Check the coefficient of the middle term twice — that is where a sign error hides.",
        ],
        example: "Expand (2x + 3y)²",
        plot: "quadratic",
        rule: "Standard Identities",
      }),
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
      boardChapter({
        name: "Exponents and Powers",
        focus: "The laws of exponents and numbers in standard form.",
        formulas: [
          "aᵐ × aⁿ = aᵐ⁺ⁿ",
          "(aᵐ)ⁿ = aᵐⁿ",
          "a⁻ᵐ = 1 / aᵐ, and a⁰ = 1",
        ],
        latex: [
          ["Product law", String.raw`a^m \times a^n = a^{m+n}`],
          ["Power of a power", String.raw`(a^m)^n = a^{mn}`],
          ["Negative and zero exponents", String.raw`a^{-m} = \frac{1}{a^m},\qquad a^0 = 1`],
        ],
        method: [
          "Bring every factor to the same base before adding exponents.",
          "A negative exponent flips the factor across the fraction bar; it never changes its sign.",
        ],
        example: "Simplify (2³ × 2⁵) ÷ 2⁶",
        plot: "sqrt",
        rule: "Laws of Exponents",
      }),
      boardChapter({
        name: "Direct and Inverse Proportions",
        focus: "Two quantities changing together, in the same or opposite direction.",
        formulas: [
          "Direct: y = kx, so x₁/y₁ = x₂/y₂",
          "Inverse: xy = k, so x₁y₁ = x₂y₂",
          "More workers on the same job mean fewer days — an inverse proportion",
        ],
        latex: [
          ["Direct proportion", String.raw`\frac{x_1}{y_1} = \frac{x_2}{y_2}`],
          ["Inverse proportion", String.raw`x_1 y_1 = x_2 y_2`],
          ["Constant of variation", String.raw`y = kx \quad \text{or} \quad xy = k`],
        ],
        method: [
          "Ask what happens to the second quantity when the first doubles: the same direction is direct, the opposite is inverse.",
          "Find the constant first, then use it for the pair you were asked about.",
        ],
        example: "12 workers build a wall in 10 days — how long will 15 workers take?",
        plot: "variation",
        rule: "Proportion",
      }),
      boardChapter({
        name: "Factorisation",
        focus: "Common factors, the identities, and dividing one polynomial by another.",
        formulas: [
          "ab + ac = a(b + c)",
          "a² − b² = (a − b)(a + b)",
          "x² + (a + b)x + ab = (x + a)(x + b)",
        ],
        latex: [
          ["Common factor", String.raw`ab + ac = a(b + c)`],
          ["Difference of squares", String.raw`a^2 - b^2 = (a - b)(a + b)`],
          ["Splitting the middle term", String.raw`x^2 + (a+b)x + ab = (x + a)(x + b)`],
        ],
        method: [
          "Take out the highest common factor before trying any identity.",
          "For the middle-term split, find two numbers whose product is the constant and whose sum is the coefficient of x.",
        ],
        example: "Factorise x² + 7x + 12",
        plot: "quadratic",
        rule: "Common Factor Method",
      }),
      boardChapter({
        name: "Introduction to Graphs",
        focus: "Plotting points and reading a line graph.",
        formulas: [
          "A point is written as (x, y) — x along the horizontal axis, y along the vertical",
          "A linear graph is a straight line, y = mx + c",
          "On a distance–time graph, the slope is the speed",
        ],
        latex: [
          ["A point", String.raw`P = (x,\ y)`],
          ["A straight line", String.raw`y = mx + c`],
          ["Slope as speed", String.raw`\text{speed} = \frac{\Delta d}{\Delta t}`],
        ],
        method: [
          "Fix the scale and label both axes with their units before plotting anything.",
          "Read a value off the graph by going up from the x-axis to the line, then across to the y-axis.",
        ],
        example: "Plot the temperature at each hour and read it at noon",
        plot: "linear",
        rule: "Coordinate Axes",
      }),
    ],
    models: [
      reciprocalModel,
      linearModel,
      sqrtModel,
      circleModel,
      quadraticModel,
      sequenceModel,
      variationModel,
    ],
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
      ...CBSE_9,
    ],
    models: [quadraticModel, linearModel, circleModel, sqrtModel, sequenceModel],
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
      ...CBSE_10,
    ],
    models: [quadraticModel, sequenceModel, trigModel, circleModel, sqrtModel],
  },
  {
    id: "11",
    label: "Class 11",
    level: "Senior secondary",
    blurb: "Conic sections, straight lines, trigonometric functions and calculus.",
    advanced: true,
    chapters: [
      boardChapter({
        name: "Sets",
        focus: "Set operations, Venn diagrams and counting the elements of a union.",
        formulas: [
          "n(A ∪ B) = n(A) + n(B) − n(A ∩ B)",
          "A set with n elements has 2ⁿ subsets",
          "n(A − B) = n(A) − n(A ∩ B)",
        ],
        latex: [
          ["Union of two sets", String.raw`n(A \cup B) = n(A) + n(B) - n(A \cap B)`],
          ["Three sets", String.raw`n(A \cup B \cup C) = \sum n(A) - \sum n(A \cap B) + n(A \cap B \cap C)`],
          ["Number of subsets", String.raw`|\mathcal{P}(A)| = 2^n`],
          ["Difference", String.raw`A - B = \{x : x \in A,\ x \notin B\}`],
          ["De Morgan", String.raw`(A \cup B)' = A' \cap B', \qquad (A \cap B)' = A' \cup B'`],
        ],
        method: [
          "Draw the Venn diagram and write the number in every region before using a formula.",
          "For a word problem, start with the intersection and work outwards.",
        ],
        example: "In a class of 40, 25 play cricket, 20 play football and 10 play both — how many play neither?",
        plot: "sequence",
        rule: "Inclusion–Exclusion",
      }),
      boardChapter({
        name: "Relations and Functions",
        focus: "Cartesian products, domain and range, and types of relations.",
        formulas: [
          "A × B = {(a, b) : a ∈ A, b ∈ B}",
          "A relation from A to B is a subset of A × B",
          "Domain of f is the set of inputs; range is the set of outputs",
        ],
        latex: [
          ["Cartesian product", String.raw`A \times B = \{(a, b) : a \in A,\ b \in B\}`],
          ["Number of relations", String.raw`2^{mn},\quad m = n(A),\ n = n(B)`],
          ["Function", String.raw`f: A \to B,\quad (a, b) \in f \Rightarrow b = f(a)`],
          ["Domain and range", String.raw`\operatorname{Dom}(f) = A, \qquad \operatorname{Range}(f) \subseteq B`],
        ],
        method: [
          "A relation is a set of ordered pairs, so equality means the same pairs, not the same rule written differently.",
          "For the domain of a formula, exclude the values that make a denominator zero or a root negative.",
        ],
        example: "If A = {1, 2} and B = {3, 4}, list A × B and the number of relations from A to B",
        plot: "linear",
        rule: "Cartesian Product",
      }),
      boardChapter({
        name: "Complex Numbers and Quadratic Equations",
        focus: "The algebra of i, modulus and argument, and roots of a quadratic.",
        formulas: [
          "i² = −1",
          "|z| = √(a² + b²) for z = a + ib",
          "Roots of az² + bz + c = 0 are (−b ± √(b² − 4ac))/2a",
        ],
        latex: [
          ["The imaginary unit", String.raw`i^2 = -1, \qquad i^3 = -i, \qquad i^4 = 1`],
          ["Algebraic form", String.raw`z = a + ib, \qquad \bar{z} = a - ib`],
          ["Modulus and argument", String.raw`|z| = \sqrt{a^2 + b^2}, \qquad \arg z = \tan^{-1}\frac{b}{a}`],
          ["Product in polar form", String.raw`z_1 z_2 = r_1 r_2\left[\cos(\theta_1 + \theta_2) + i\sin(\theta_1 + \theta_2)\right]`],
          ["Cube roots of unity", String.raw`\omega^3 = 1, \qquad 1 + \omega + \omega^2 = 0`],
        ],
        method: [
          "Collect the real and imaginary parts separately; i² becomes −1 before adding anything.",
          "Multiply by the conjugate to rationalise a complex denominator.",
        ],
        example: "Find the modulus and argument of z = 1 + i√3",
        plot: "quadratic",
        rule: "Modulus–Argument Form",
      }),
      boardChapter({
        name: "Linear Inequalities",
        focus: "Solving inequalities and reading the solution as an interval.",
        formulas: [
          "Multiplying or dividing by a negative reverses the inequality",
          "|x| < a ⇒ −a < x < a",
          "|x| > a ⇒ x < −a or x > a",
        ],
        latex: [
          ["Linear inequality", String.raw`ax + b < c \;\Rightarrow\; x < \frac{c - b}{a},\ a > 0`],
          ["Sign flip", String.raw`a < b \;\Rightarrow\; -a > -b`],
          ["Modulus less than", String.raw`|x| < a \iff -a < x < a`],
          ["Modulus greater than", String.raw`|x| > a \iff x < -a \ \text{or}\ x > a`],
          ["Interval notation", String.raw`a < x \le b \iff (a, b]`],
        ],
        method: [
          "Solve exactly like an equation, then flip the sign the moment you multiply or divide by a negative.",
          "Mark the critical values on a number line and test one point in each interval.",
        ],
        example: "Solve 3x − 5 < 7 and write the solution as an interval",
        plot: "linear",
        rule: "Inequality Rules",
      }),
      boardChapter({
        name: "Permutations and Combinations",
        focus: "Counting arrangements and selections, with and without repetition.",
        formulas: [
          "ⁿPᵣ = n!/(n − r)!",
          "ⁿCᵣ = n!/(r!(n − r)!)",
          "ⁿCᵣ = ⁿC₍ₙ₋ᵣ₎",
        ],
        latex: [
          ["Permutations", String.raw`{}^nP_r = \frac{n!}{(n - r)!}`],
          ["Combinations", String.raw`{}^nC_r = \frac{n!}{r!\,(n - r)!}`],
          ["Link between them", String.raw`{}^nP_r = r!\,{}^nC_r`],
          ["Symmetry", String.raw`{}^nC_r = {}^nC_{n-r}`],
          ["Circular arrangements", String.raw`(n - 1)!`],
        ],
        method: [
          "Ask whether order matters: if AB and BA are different, it is a permutation.",
          "Handle restrictions by fixing the restricted object first, then arranging the rest.",
        ],
        example: "How many 4-letter words can be formed from the letters of EQUATION with no repetition?",
        plot: "sequence",
        rule: "Counting Principle",
      }),
      boardChapter({
        name: "Binomial Theorem",
        focus: "Expanding (a + b)ⁿ and picking out a particular term.",
        formulas: [
          "(a + b)ⁿ = Σ ⁿCᵣ aⁿ⁻ʳ bʳ",
          "General term Tᵣ₊₁ = ⁿCᵣ aⁿ⁻ʳ bʳ",
          "Number of terms in the expansion is n + 1",
        ],
        latex: [
          ["Binomial expansion", String.raw`(a + b)^n = \sum_{r=0}^{n} {}^nC_r\,a^{n-r}b^r`],
          ["General term", String.raw`T_{r+1} = {}^nC_r\,a^{n-r}b^r`],
          ["Sum of coefficients", String.raw`\sum_{r=0}^{n} {}^nC_r = 2^n`],
          ["Middle term", String.raw`n \text{ even}: T_{n/2 + 1}; \quad n \text{ odd}: T_{(n+1)/2},\ T_{(n+3)/2}`],
        ],
        method: [
          "Write the general term first; most questions are a question about r, not about the whole expansion.",
          "For a term independent of x, set the power of x to zero and solve for r.",
        ],
        example: "Find the term independent of x in (2x − 1/x)⁶",
        plot: "sequence",
        rule: "General Term",
      }),
      boardChapter({
        name: "Sequences and Series",
        focus: "Arithmetic and geometric progressions, and the sum to infinity.",
        formulas: [
          "AP: aₙ = a + (n − 1)d",
          "GP: aₙ = arⁿ⁻¹, Sₙ = a(1 − rⁿ)/(1 − r)",
          "S∞ = a/(1 − r) for |r| < 1",
        ],
        latex: [
          ["AP nth term", String.raw`a_n = a + (n - 1)d`],
          ["AP sum", String.raw`S_n = \frac{n}{2}\left[2a + (n - 1)d\right]`],
          ["GP nth term", String.raw`a_n = a r^{n-1}`],
          ["GP sum", String.raw`S_n = \frac{a(1 - r^n)}{1 - r},\ r \neq 1`],
          ["Sum to infinity", String.raw`S_\infty = \frac{a}{1 - r},\ |r| < 1`],
        ],
        method: [
          "Identify the progression by the ratio of consecutive terms: a constant difference is AP, a constant ratio is GP.",
          "The sum to infinity exists only when the common ratio lies strictly between −1 and 1.",
        ],
        example: "Find the sum of the first 10 terms of 3, 7, 11, …",
        plot: "sequence",
        rule: "AP and GP Formulae",
      }),
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
      boardChapter({
        name: "Introduction to Three Dimensional Geometry",
        focus: "Coordinates in space, distance and the section formula.",
        formulas: [
          "Distance = √((x₂ − x₁)² + (y₂ − y₁)² + (z₂ − z₁)²)",
          "Section formula: ((mx₂ + nx₁)/(m + n), …) in all three coordinates",
          "l² + m² + n² = 1 for direction cosines",
        ],
        latex: [
          ["Distance in space", String.raw`d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}`],
          ["Section formula", String.raw`\left(\frac{mx_2 + nx_1}{m+n},\ \frac{my_2 + ny_1}{m+n},\ \frac{mz_2 + nz_1}{m+n}\right)`],
          ["Direction cosines", String.raw`l = \cos\alpha,\ m = \cos\beta,\ n = \cos\gamma`],
          ["Identity", String.raw`l^2 + m^2 + n^2 = 1`],
        ],
        method: [
          "Plot the three coordinates before substituting; the octant usually tells you the sign of every term.",
          "The section formula works coordinate by coordinate, exactly as it does in two dimensions.",
        ],
        example: "Find the distance between (1, 2, 3) and (4, 6, 3)",
        plot: "linear",
        rule: "Distance Formula in Space",
      }),
      boardChapter({
        name: "Statistics",
        focus: "Mean deviation, variance and standard deviation for raw and grouped data.",
        formulas: [
          "Variance σ² = Σ(xᵢ − x̄)²/n",
          "Standard deviation σ = √variance",
          "Coefficient of variation = (σ/x̄) × 100",
        ],
        latex: [
          ["Mean", String.raw`\bar{x} = \frac{\sum x_i}{n}`],
          ["Variance", String.raw`\sigma^2 = \frac{1}{n}\sum_{i=1}^{n}(x_i - \bar{x})^2`],
          ["Shortcut form", String.raw`\sigma^2 = \frac{\sum x_i^2}{n} - \bar{x}^2`],
          ["Mean deviation", String.raw`MD = \frac{\sum |x_i - \bar{x}|}{n}`],
          ["Coefficient of variation", String.raw`CV = \frac{\sigma}{\bar{x}} \times 100`],
        ],
        method: [
          "For grouped data, replace each class by its midpoint before using any formula.",
          "The shortcut form is faster and less rounding-sensitive than subtracting the mean from every observation.",
        ],
        example: "Find the variance of 2, 4, 6, 8, 10",
        plot: "sequence",
        rule: "Variance Formula",
      }),
      boardChapter({
        name: "Probability",
        focus: "Sample spaces, equally likely outcomes and the addition rule.",
        formulas: [
          "P(E) = favourable outcomes / total outcomes",
          "0 ≤ P(E) ≤ 1 and P(E′) = 1 − P(E)",
          "P(A ∪ B) = P(A) + P(B) − P(A ∩ B)",
        ],
        latex: [
          ["Classical probability", String.raw`P(E) = \frac{n(E)}{n(S)}`],
          ["Complement", String.raw`P(E') = 1 - P(E)`],
          ["Addition rule", String.raw`P(A \cup B) = P(A) + P(B) - P(A \cap B)`],
          ["Mutually exclusive", String.raw`A \cap B = \varnothing \Rightarrow P(A \cup B) = P(A) + P(B)`],
          ["Independent events", String.raw`P(A \cap B) = P(A)\,P(B)`],
        ],
        method: [
          "Write the sample space explicitly for small experiments; most errors are a missing outcome, not a wrong formula.",
          "Use the complement when the question says at least one — it is almost always shorter.",
        ],
        example: "A card is drawn from a deck — find the probability that it is a king or a heart",
        plot: "sequence",
        rule: "Addition Rule",
      }),
    ],
    models: [ellipseModel, hyperbolaModel, circleModel, trigModel, linearModel, tangentModel],
  },
  {
    id: "12",
    label: "Class 12",
    level: "Board year",
    blurb: "Relations, matrices, calculus, vectors, three-dimensional geometry and probability.",
    advanced: true,
    chapters: [
      boardChapter({
        name: "Relations and Functions",
        focus: "Types of relations, one-one and onto functions, and inverses.",
        formulas: [
          "A × B has m·n elements, so it has 2^(m·n) relations",
          "f is one-one when f(a₁) = f(a₂) ⇒ a₁ = a₂",
          "f is onto when the range equals the codomain",
        ],
        latex: [
          ["Size of a product set", String.raw`n(A \times B) = m \cdot n`],
          ["Number of relations", String.raw`2^{mn}`],
          ["One-one", String.raw`f(a_1) = f(a_2) \Rightarrow a_1 = a_2`],
          ["Composition", String.raw`(f \circ g)(x) = f(g(x))`],
          ["Inverse", String.raw`(f^{-1})^{-1} = f, \qquad f^{-1} \circ f = I`],
        ],
        method: [
          "For one-one, assume f(a) = f(b) and show a = b; for onto, solve y = f(x) for x and check every y in the codomain.",
          "A function has an inverse only when it is both one-one and onto.",
        ],
        example: "Show that f(x) = 2x + 3 is one-one and onto on R",
        plot: "linear",
        rule: "One-one and Onto",
      }),
      boardChapter({
        name: "Inverse Trigonometric Functions",
        focus: "Principal value branches and the inverse identities.",
        formulas: [
          "sin⁻¹x + cos⁻¹x = π/2",
          "tan⁻¹x + tan⁻¹y = tan⁻¹((x + y)/(1 − xy))",
          "sin⁻¹x has range [−π/2, π/2]",
        ],
        latex: [
          ["Principal branches", String.raw`\sin^{-1}: [-1, 1] \to \left[-\frac{\pi}{2}, \frac{\pi}{2}\right]`],
          ["Cosine branch", String.raw`\cos^{-1}: [-1, 1] \to [0, \pi]`],
          ["Complementary pair", String.raw`\sin^{-1}x + \cos^{-1}x = \frac{\pi}{2}`],
          ["Tangent sum", String.raw`\tan^{-1}x + \tan^{-1}y = \tan^{-1}\frac{x + y}{1 - xy},\ xy < 1`],
          ["Double angle", String.raw`2\tan^{-1}x = \tan^{-1}\frac{2x}{1 - x^2}`],
        ],
        method: [
          "Convert every inverse to its principal branch before combining, so the answer stays inside the range.",
          "For a sum of tangents, check xy < 1; otherwise add or subtract π as the branch requires.",
        ],
        example: "Evaluate tan⁻¹1 + tan⁻¹2 + tan⁻¹3",
        plot: "trig",
        rule: "Principal Value",
      }),
      boardChapter({
        name: "Matrices",
        focus: "Algebra of matrices, transpose and symmetric matrices.",
        formulas: [
          "(AB)ᵀ = BᵀAᵀ",
          "A + Aᵀ is symmetric; A − Aᵀ is skew-symmetric",
          "(AB)⁻¹ = B⁻¹A⁻¹ when both inverses exist",
        ],
        latex: [
          ["Transpose of a product", String.raw`(AB)^T = B^T A^T`],
          ["Symmetric matrix", String.raw`A^T = A`],
          ["Skew-symmetric", String.raw`A^T = -A`],
          ["Inverse of a product", String.raw`(AB)^{-1} = B^{-1} A^{-1}`],
          ["Scalar multiplication", String.raw`(kA)_{ij} = k\,a_{ij}`],
        ],
        method: [
          "Check the orders first: AB exists only when the columns of A equal the rows of B.",
          "Multiply row by column and add the products; never multiply entry by entry unless both matrices are diagonal.",
        ],
        example: "If A = [[1, 2], [3, 4]], find A + Aᵀ and show it is symmetric",
        plot: "linear",
        rule: "Matrix Multiplication",
      }),
      boardChapter({
        name: "Determinants",
        focus: "Expansion, properties, adjoint and the inverse of a matrix.",
        formulas: [
          "|AB| = |A|·|B|",
          "A⁻¹ = adj(A)/|A|, defined only when |A| ≠ 0",
          "Area of a triangle = ½ |determinant of coordinates|",
        ],
        latex: [
          ["Second-order determinant", String.raw`\begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc`],
          ["Product rule", String.raw`|AB| = |A|\,|B|`],
          ["Inverse", String.raw`A^{-1} = \frac{1}{|A|}\,\operatorname{adj}(A)`],
          ["Adjoint identity", String.raw`A\,(\operatorname{adj}A) = |A|\,I`],
          ["Area of a triangle", String.raw`\Delta = \frac{1}{2}\begin{vmatrix} x_1 & y_1 & 1 \\ x_2 & y_2 & 1 \\ x_3 & y_3 & 1 \end{vmatrix}`],
        ],
        method: [
          "Expand along the row or column with the most zeros to cut the arithmetic.",
          "A zero determinant means no inverse; say so instead of dividing by zero.",
        ],
        example: "Find the inverse of A = [[2, 1], [1, 1]]",
        plot: "linear",
        rule: "Cramer's Rule",
      }),
      boardChapter({
        name: "Continuity and Differentiability",
        focus: "Continuity at a point, the chain rule, and the standard derivatives.",
        formulas: [
          "f is continuous at a when lim(x→a) f(x) = f(a)",
          "d/dx (sin x) = cos x and d/dx (cos x) = −sin x",
          "d/dx (log x) = 1/x for x > 0",
        ],
        latex: [
          ["Continuity at a point", String.raw`\lim_{x \to a} f(x) = f(a)`],
          ["Differentiability implies continuity", String.raw`f'(a)\ \text{exists} \Rightarrow f\ \text{is continuous at } a`],
          ["Chain rule", String.raw`\frac{d}{dx}f(g(x)) = f'(g(x))\,g'(x)`],
          ["Quotient rule", String.raw`\left(\frac{u}{v}\right)' = \frac{u'v - uv'}{v^2}`],
          ["Rolle's theorem", String.raw`f(a) = f(b) \Rightarrow \exists\, c \in (a, b): f'(c) = 0`],
        ],
        method: [
          "Test the left and right limits separately at a piecewise join; continuity needs all three values to agree.",
          "Differentiate from the outside in with the chain rule, then simplify before substituting.",
        ],
        example: "Differentiate y = sin(x² + 1)",
        plot: "tangent",
        rule: "Chain Rule",
      }),
      boardChapter({
        name: "Application of Derivatives",
        focus: "Rates of change, monotonicity and maxima–minima.",
        formulas: [
          "Rate of change: dy/dt = (dy/dx)(dx/dt)",
          "f is increasing where f′(x) > 0 and decreasing where f′(x) < 0",
          "Local maximum at c when f′(c) = 0 and f″(c) < 0",
        ],
        latex: [
          ["Related rates", String.raw`\frac{dy}{dt} = \frac{dy}{dx}\cdot\frac{dx}{dt}`],
          ["Increasing on an interval", String.raw`f'(x) > 0 \ \forall x \in (a, b)`],
          ["First derivative test", String.raw`f'(c) = 0,\ f'\ \text{changes sign at } c`],
          ["Second derivative test", String.raw`f'(c) = 0,\ f''(c) < 0 \Rightarrow \text{local maximum}`],
          ["Tangent and normal", String.raw`m_T = f'(a), \qquad m_N = -\frac{1}{f'(a)}`],
        ],
        method: [
          "Write every changing quantity as a function of one variable before differentiating.",
          "For an optimisation, list the critical points and the endpoints: the largest value is the answer on a closed interval.",
        ],
        example: "Find the maximum area of a rectangle with perimeter 40 cm",
        plot: "quadratic",
        rule: "Second Derivative Test",
      }),
      boardChapter({
        name: "Integrals",
        focus: "Standard integrals, substitution, by parts and definite integrals.",
        formulas: [
          "∫xⁿ dx = xⁿ⁺¹/(n + 1) + C, n ≠ −1",
          "∫(u′v) dx = uv − ∫(uv′) dx",
          "∫ₐᵇ f(x) dx = F(b) − F(a)",
        ],
        latex: [
          ["Power rule", String.raw`\int x^n\,dx = \frac{x^{n+1}}{n+1} + C,\ n \neq -1`],
          ["Reciprocal", String.raw`\int \frac{1}{x}\,dx = \log|x| + C`],
          ["Exponential and sine", String.raw`\int e^x dx = e^x + C, \qquad \int \sin x\,dx = -\cos x + C`],
          ["By parts", String.raw`\int u\,v'\,dx = uv - \int u'\,v\,dx`],
          ["Fundamental theorem", String.raw`\int_a^b f(x)\,dx = F(b) - F(a)`],
        ],
        method: [
          "Look for a function and its derivative together — that is a substitution, not a by-parts.",
          "Keep the limits until the antiderivative is found, then substitute upper minus lower in one step.",
        ],
        example: "Evaluate ∫ x·e^x dx and ∫₀¹ x² dx",
        plot: "quadratic",
        rule: "Integration by Parts",
      }),
      boardChapter({
        name: "Application of Integrals",
        focus: "Area under a curve and between two curves.",
        formulas: [
          "Area under y = f(x) from a to b = ∫ₐᵇ f(x) dx",
          "Area between curves = ∫ₐᵇ (upper − lower) dx",
          "Area of a circle of radius r = πr²",
        ],
        latex: [
          ["Area under a curve", String.raw`A = \int_a^b f(x)\,dx`],
          ["Area between curves", String.raw`A = \int_a^b \left[f(x) - g(x)\right] dx`],
          ["Area of a circle", String.raw`A = \pi r^2 = 4\int_0^r \sqrt{r^2 - x^2}\,dx`],
          ["Area with respect to y", String.raw`A = \int_c^d x\,dy`],
        ],
        method: [
          "Sketch first: the limits of integration are the points where the curves meet.",
          "Decide which curve is on top between the intersections; a sign error there halves the answer.",
        ],
        example: "Find the area enclosed by y = x² and y = x",
        plot: "quadratic",
        rule: "Area Between Curves",
      }),
      boardChapter({
        name: "Differential Equations",
        focus: "Order and degree, variable separation and the linear equation.",
        formulas: [
          "Order = highest derivative; degree = its power after clearing radicals",
          "Variable separable: dy/dx = f(x)g(y) ⇒ dy/g(y) = f(x) dx",
          "Linear DE: dy/dx + Py = Q has integrating factor e^(∫P dx)",
        ],
        latex: [
          ["Order and degree", String.raw`\left(\frac{d^2y}{dx^2}\right)^3 + \frac{dy}{dx} = 0 \Rightarrow \text{order } 2,\ \text{degree } 3`],
          ["Variable separable", String.raw`\frac{dy}{dx} = f(x)\,g(y) \Rightarrow \int \frac{dy}{g(y)} = \int f(x)\,dx`],
          ["Integrating factor", String.raw`\mu(x) = e^{\int P\,dx}`],
          ["Linear solution", String.raw`y\,\mu = \int Q\,\mu\,dx + C`],
        ],
        method: [
          "Classify the equation before solving: separable, homogeneous or linear each has one route.",
          "Apply the initial condition only after the constant of integration is written.",
        ],
        example: "Solve dy/dx = (1 + y²)/(1 + x²)",
        plot: "tangent",
        rule: "Integrating Factor",
      }),
      boardChapter({
        name: "Vector Algebra",
        focus: "Components, dot and cross products, and projections.",
        formulas: [
          "a·b = |a||b| cos θ",
          "|a × b| = |a||b| sin θ, perpendicular to both",
          "Projection of a on b = (a·b)/|b|",
        ],
        latex: [
          ["Unit vector", String.raw`\hat{a} = \frac{\vec{a}}{|\vec{a}|}`],
          ["Dot product", String.raw`\vec{a}\cdot\vec{b} = |\vec{a}||\vec{b}|\cos\theta`],
          ["Cross product", String.raw`|\vec{a} \times \vec{b}| = |\vec{a}||\vec{b}|\sin\theta`],
          ["Projection", String.raw`\text{proj}_{\vec{b}}\vec{a} = \frac{\vec{a}\cdot\vec{b}}{|\vec{b}|}`],
          ["Direction cosines", String.raw`l^2 + m^2 + n^2 = 1`],
        ],
        method: [
          "Use the dot product for angles and projections, the cross product for areas and perpendicular vectors.",
          "Write vectors in component form so the arithmetic is three independent multiplications.",
        ],
        example: "Find the angle between a = 2i + j − k and b = i − j + k",
        plot: "linear",
        rule: "Dot and Cross Product",
      }),
      boardChapter({
        name: "Three Dimensional Geometry",
        focus: "Lines and planes in space, angles and shortest distances.",
        formulas: [
          "Line: r = a + λb, or (x − x₁)/a = (y − y₁)/b = (z − z₁)/c",
          "Angle between lines: cos θ = |b₁·b₂|/(|b₁||b₂|)",
          "Plane: r·n = d, or ax + by + cz = d",
        ],
        latex: [
          ["Vector equation of a line", String.raw`\vec{r} = \vec{a} + \lambda\vec{b}`],
          ["Cartesian form", String.raw`\frac{x - x_1}{a} = \frac{y - y_1}{b} = \frac{z - z_1}{c}`],
          ["Angle between lines", String.raw`\cos\theta = \frac{|\vec{b_1}\cdot\vec{b_2}|}{|\vec{b_1}||\vec{b_2}|}`],
          ["Equation of a plane", String.raw`\vec{r}\cdot\hat{n} = d`],
          ["Distance of a point from a plane", String.raw`d = \frac{|ax_1 + by_1 + cz_1 - d|}{\sqrt{a^2 + b^2 + c^2}}`],
        ],
        method: [
          "Read the direction ratios straight off the denominators, and the point off the numerators.",
          "A plane's normal is the cross product of two vectors lying in it.",
        ],
        example: "Find the shortest distance between two parallel lines",
        plot: "linear",
        rule: "Direction Ratios",
      }),
      boardChapter({
        name: "Linear Programming",
        focus: "Constraints, the feasible region and the corner-point theorem.",
        formulas: [
          "Maximise or minimise Z = ax + by",
          "Constraints are linear inequalities, with x ≥ 0 and y ≥ 0",
          "The optimum occurs at a corner of the feasible region",
        ],
        latex: [
          ["Objective function", String.raw`Z = ax + by`],
          ["Feasible region", String.raw`a_ix + b_iy \le c_i,\quad x, y \ge 0`],
          ["Corner-point theorem", String.raw`\max Z = \max\{Z(P_1), \ldots, Z(P_n)\}`],
        ],
        method: [
          "Draw every constraint as a line, shade the side that satisfies it, and keep only the common region.",
          "Evaluate Z at every vertex of the feasible region, including the axes intercepts.",
        ],
        example: "Maximise Z = 3x + 4y subject to x + y ≤ 4, x ≥ 0, y ≥ 0",
        plot: "linear",
        rule: "Corner-Point Theorem",
      }),
      boardChapter({
        name: "Probability",
        focus: "Conditional probability, Bayes' theorem and the binomial distribution.",
        formulas: [
          "P(A|B) = P(A ∩ B)/P(B)",
          "P(A ∩ B) = P(A)P(B|A)",
          "Binomial: P(X = r) = ⁿCᵣ pʳ qⁿ⁻ʳ, mean np, variance npq",
        ],
        latex: [
          ["Conditional probability", String.raw`P(A \mid B) = \frac{P(A \cap B)}{P(B)},\ P(B) > 0`],
          ["Multiplication rule", String.raw`P(A \cap B) = P(A)\,P(B \mid A)`],
          ["Bayes' theorem", String.raw`P(A_i \mid B) = \frac{P(A_i)\,P(B \mid A_i)}{\sum_j P(A_j)\,P(B \mid A_j)}`],
          ["Binomial probability", String.raw`P(X = r) = {}^{n}C_r\,p^r q^{n-r},\ q = 1 - p`],
          ["Mean and variance", String.raw`E(X) = np, \qquad \operatorname{Var}(X) = npq`],
        ],
        method: [
          "Draw the tree or the two-way table before applying a formula; the conditioning usually becomes obvious there.",
          "For a binomial, check the four conditions: fixed n, two outcomes, constant p, independent trials.",
        ],
        example: "A die is thrown twice — find the probability that the sum is 8 given the first throw is 3",
        plot: "sequence",
        rule: "Bayes' Theorem",
      }),
    ],
    models: [linearModel, quadraticModel, trigModel, tangentModel, sequenceModel],
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
