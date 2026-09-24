/**
 * Exact arithmetic for the Math Lab.
 *
 * The engine's answers are read by a student, checked against a textbook, and
 * copied into an exercise book. That means `x = 0.666…` is not a small
 * inaccuracy — it is a wrong answer, because the right one is `x = 2/3`.
 *
 * So the algebra the lab can verify is done here, in exact rationals built on
 * BigInt. Nothing in this file ever produces a floating-point number: every
 * value is a pair of integers, every division is exact or an explicit failure,
 * and every root is either written exactly or reported as irrational. The model
 * is still asked for the explanation; this is the part that has to be right.
 *
 * Scope: linear and quadratic equations in one variable, which is what the lab
 * can check without guessing. Anything outside that is reported honestly as
 * `unsupported` rather than approximated.
 */

/* ------------------------------------------------------------------ */
/* exact rationals                                                     */
/* ------------------------------------------------------------------ */

/** An exact rational, always reduced and always with a positive denominator. */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    if (d === 0n) throw new Error("Division by zero");
    if (d < 0n) {
      this.n = -n;
      this.d = -d;
    } else {
      this.n = n;
      this.d = d;
    }
  }

  static of(n: bigint | number, d: bigint | number = 1n): Rational {
    return new Rational(BigInt(n), BigInt(d)).reduce();
  }

  static parse(text: string): Rational {
    const trimmed = text.trim();
    if (trimmed.includes("/")) {
      const [top, bottom] = trimmed.split("/");
      if (!bottom) throw new Error(`Not a fraction: ${text}`);
      return Rational.of(BigInt(top.trim()), BigInt(bottom.trim()));
    }
    return Rational.parseDecimal(trimmed);
  }

  /**
   * A decimal literal becomes the exact fraction it stands for: "0.125" is
   * 1/8, not a float. This is the difference between a correct answer and a
   * rounded one, and it is the whole reason this file exists.
   */
  static parseDecimal(text: string): Rational {
    const match = /^[+-]?(\d+)(?:\.(\d+))?$/.exec(text.trim());
    if (!match) throw new Error(`Not a number: ${text}`);
    const whole = match[1];
    const fraction = match[2] ?? "";
    if (fraction.length === 0) return Rational.of(BigInt(whole));
    const scale = 10n ** BigInt(fraction.length);
    return Rational.of(BigInt(whole) * scale + BigInt(fraction), scale);
  }

  private reduce(): Rational {
    if (this.d === 1n) return this;
    let a = this.n < 0n ? -this.n : this.n;
    let b = this.d;
    while (b !== 0n) {
      const t = a % b;
      a = b;
      b = t;
    }
    if (a === 0n) return new Rational(0n, 1n);
    return new Rational(this.n / a, this.d / a);
  }

  add(other: Rational): Rational {
    return new Rational(this.n * other.d + other.n * this.d, this.d * other.d).reduce();
  }

  sub(other: Rational): Rational {
    return new Rational(this.n * other.d - other.n * this.d, this.d * other.d).reduce();
  }

  mul(other: Rational): Rational {
    return new Rational(this.n * other.n, this.d * other.d).reduce();
  }

  div(other: Rational): Rational {
    if (other.n === 0n) throw new Error("Division by zero");
    return new Rational(this.n * other.d, this.d * other.n).reduce();
  }

  neg(): Rational {
    return new Rational(-this.n, this.d);
  }

  abs(): Rational {
    return this.n < 0n ? this.neg() : this;
  }

  /** A whole-number power, which covers the squared and cubed terms. */
  pow(exponent: number): Rational {
    if (exponent < 0) throw new Error("Negative powers are outside the exact checker");
    return new Rational(this.n ** BigInt(exponent), this.d ** BigInt(exponent)).reduce();
  }

  get isZero(): boolean {
    return this.n === 0n;
  }

  get isNegative(): boolean {
    return this.n < 0n;
  }

  get isInteger(): boolean {
    return this.d === 1n;
  }

  /** The exact square root, or null when it is irrational. */
  sqrt(): Rational | null {
    if (this.n < 0n) return null;
    const top = integerSqrt(this.n);
    const bottom = integerSqrt(this.d);
    if (top === null || bottom === null) return null;
    return Rational.of(top, bottom).reduce();
  }

  /** `3`, `-1/2` — the form a student writes. */
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  /** `\frac{3}{4}` or `3` — the form the notebook typesets. */
  toLatex(): string {
    if (this.d === 1n) return this.n.toString();
    return `\\frac{${this.n}}{${this.d}}`;
  }
}

const ZERO = Rational.of(0n);
const ONE = Rational.of(1n);

function integerSqrt(value: bigint): bigint | null {
  if (value < 0n) return null;
  if (value < 2n) return value;
  // Newton's method, exact in integers.
  let guess = value;
  let next = (guess + value / guess) / 2n;
  while (next < guess) {
    guess = next;
    next = (guess + value / guess) / 2n;
  }
  return guess * guess === value ? guess : null;
}

/* ------------------------------------------------------------------ */
/* parsing                                                             */
/* ------------------------------------------------------------------ */

/** a0, a1, a2 for a polynomial in x. */
type Poly = [Rational, Rational, Rational];

/** Bring the characters a student actually types into one canonical form. */
export function normaliseExpression(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "")
    .replace(/−|–|—/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "")
    .toLowerCase();
}

/**
 * Read one side of an equation into its coefficients.
 *
 * Deliberately small: it understands coefficients, fractions, decimals and
 * powers up to three, which is every shape the lab's own questions arrive in.
 * It returns null the moment it meets anything else, so an unparsed expression
 * is never silently treated as zero.
 */
function parseSide(source: string): Poly | null {
  const poly: Poly = [ZERO, ZERO, ZERO];
  let i = 0;
  let terms = 0;

  while (i < source.length) {
    const before = i;
    let sign = ONE;
    if (source[i] === "+") {
      i += 1;
    } else if (source[i] === "-") {
      sign = ONE.neg();
      i += 1;
    }

    let coefficient = sign;
    const literal = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(source.slice(i));
    if (literal) {
      coefficient = coefficient.mul(Rational.parse(literal[0]));
      i += literal[0].length;
      if (source[i] === "/") {
        const denominator = /^\d+/.exec(source.slice(i + 1));
        if (!denominator) return null;
        coefficient = coefficient.div(Rational.of(BigInt(denominator[0])));
        i += 1 + denominator[0].length;
      }
    }

    let degree = 0;
    if (source[i] === "x") {
      degree = 1;
      i += 1;
      if (source[i] === "^") {
        const power = source[i + 1];
        if (power !== "2" && power !== "3") return null;
        degree = Number(power);
        i += 2;
      }
    }

    // A trailing divisor applies to the whole term: x/2, 3x/2.
    if (source[i] === "/") {
      const denominator = /^\d+/.exec(source.slice(i + 1));
      if (!denominator) return null;
      coefficient = coefficient.div(Rational.of(BigInt(denominator[0])));
      i += 1 + denominator[0].length;
    }

    // Nothing consumed at all means the character here is not something this
    // parser understands; refuse rather than treat it as zero.
    if (i === before) return null;

    if (degree === 0) poly[0] = poly[0].add(coefficient);
    else if (degree === 1) poly[1] = poly[1].add(coefficient);
    else if (degree === 2) poly[2] = poly[2].add(coefficient);
    else return null;
    terms += 1;
  }

  return terms > 0 ? poly : null;
}

/** Read a whole equation, moving the right-hand side across. */
export function parseEquation(input: string): Poly | null {
  const source = normaliseExpression(input);
  const parts = source.split("=");
  if (parts.length !== 2) return null;
  const left = parseSide(parts[0]);
  const right = parseSide(parts[1]);
  if (!left || !right) return null;
  return [left[0].sub(right[0]), left[1].sub(right[1]), left[2].sub(right[2])];
}

/* ------------------------------------------------------------------ */
/* solving                                                             */
/* ------------------------------------------------------------------ */

export type ExactKind = "linear" | "quadratic" | "identity" | "contradiction" | "unsupported";

export interface ExactSolution {
  kind: ExactKind;
  /** The result, exactly, ready to typeset. */
  answerLatex: string;
  /** The result as a student would write it, e.g. `2/3`. */
  answerText: string;
  /** The working, one exact line per entry. */
  steps: { rule: string; latex: string }[];
  /** The check, computed rather than asserted. */
  verification: string;
}

/**
 * Solve a one-variable equation exactly.
 *
 * Every number that comes back is exact. A root that cannot be written as a
 * rational is written as a surd, and a discriminant that is not a perfect
 * square is left under the radical rather than approximated.
 */
export function solveExactly(input: string): ExactSolution {
  const poly = parseEquation(input);
  if (!poly) {
    return {
      kind: "unsupported",
      answerLatex: "This engine checks linear and quadratic equations exactly.",
      answerText: "Unsupported by the exact checker",
      steps: [],
      verification: "",
    };
  }

  const [c, b, a] = poly;

  if (a.isZero) {
    if (b.isZero) {
      const identity = c.isZero;
      return {
        kind: identity ? "identity" : "contradiction",
        answerLatex: identity ? "\\text{every } x" : "\\text{no solution}",
        answerText: identity ? "Every value of x" : "No solution",
        steps: [
          {
            rule: "Collect like terms",
            latex: `${b.toLatex()}x ${c.isNegative ? "-" : "+"} ${c.n < 0n ? c.neg().toLatex() : c.toLatex()} = 0`,
          },
        ],
        verification: identity
          ? "Both sides are the same expression, so the equation holds for all x."
          : "The terms cancel to 0 = 0 with nothing left to solve.",
      };
    }
    const root = c.neg().div(b);
    return {
      kind: "linear",
      answerLatex: `x = ${root.toLatex()}`,
      answerText: `x = ${root.toString()}`,
      steps: [
        { rule: "Isolate the variable", latex: `${b.toLatex()}x = ${c.neg().toLatex()}` },
        { rule: "Divide by the coefficient", latex: `x = \\frac{${c.neg().toLatex()}}{${b.toLatex()}} = ${root.toLatex()}` },
      ],
      verification: checkSubstitution(poly, root),
    };
  }

  const discriminant = b.mul(b).sub(a.mul(c).mul(Rational.of(4n)));
  const steps: { rule: string; latex: string }[] = [
    { rule: "Discriminant", latex: `D = b^2 - 4ac = ${b.pow(2).toLatex()} - 4(${a.toLatex()})(${c.toLatex()}) = ${discriminant.toLatex()}` },
  ];

  const root = discriminant.sqrt();
  const twoA = a.mul(Rational.of(2n));

  if (discriminant.isZero) {
    const repeated = b.neg().div(twoA);
    steps.push({ rule: "Repeated root", latex: `x = \\frac{-b}{2a} = ${repeated.toLatex()}` });
    return {
      kind: "quadratic",
      answerLatex: `x = ${repeated.toLatex()}`,
      answerText: `x = ${repeated.toString()}`,
      steps,
      verification: checkSubstitution(poly, repeated),
    };
  }

  if (!discriminant.isNegative && root) {
    // x₁ takes the minus branch, so the two roots read in ascending order for
    // a positive leading coefficient.
    const first = b.neg().sub(root).div(twoA);
    const second = b.neg().add(root).div(twoA);
    steps.push({
      rule: "Quadratic formula",
      latex: `x = \\frac{${b.neg().toLatex()} \\pm ${root.toLatex()}}{${twoA.toLatex()}}`,
    });
    steps.push({ rule: "The two roots", latex: `x_1 = ${first.toLatex()},\\quad x_2 = ${second.toLatex()}` });
    return {
      kind: "quadratic",
      answerLatex: `x_1 = ${first.toLatex()},\\quad x_2 = ${second.toLatex()}`,
      answerText: `x₁ = ${first.toString()}, x₂ = ${second.toString()}`,
      steps,
      verification: `${checkSubstitution(poly, first)} ${checkSubstitution(poly, second)}`,
    };
  }

  if (discriminant.isNegative) {
    // No real roots. The real part is exact; the imaginary part keeps its root
    // rather than being rounded to a decimal.
    const real = b.neg().div(twoA);
    const magnitude = discriminant.neg();
    const surd = magnitude.sqrt();
    const denominator = twoA.abs();
    // sqrt(magnitude) / |2a| — simplified when the radical is rational, left
    // exact under the radical when it is not.
    const imaginaryLatex = surd
      ? surd.div(denominator).toLatex()
      : `\\frac{\\sqrt{${magnitude.toLatex()}}}{${denominator.toLatex()}}`;
    const imaginaryText = surd
      ? surd.div(denominator).toString()
      : `√(${magnitude.toString()})/${denominator.toString()}`;
    return {
      kind: "quadratic",
      answerLatex: `x = ${real.toLatex()} \\pm ${imaginaryLatex}i`,
      answerText: `x = ${real.toString()} ± ${imaginaryText}i (no real roots)`,
      steps: [
        ...steps,
        { rule: "Nature of the roots", latex: `D = ${discriminant.toLatex()} < 0 \\Rightarrow \\text{no real roots}` },
        { rule: "Complex pair", latex: `x = ${real.toLatex()} \\pm ${imaginaryLatex}i` },
      ],
      verification:
        "The discriminant is negative, which is the exact condition for the curve to miss the x-axis.",
    };
  }

  // D > 0 but not a perfect square: the roots are real and irrational.
  const surd = `\\sqrt{${discriminant.toLatex()}}`;
  const first = `\\frac{${b.neg().toLatex()} - ${surd}}{${twoA.toLatex()}}`;
  const second = `\\frac{${b.neg().toLatex()} + ${surd}}{${twoA.toLatex()}}`;
  steps.push({ rule: "Quadratic formula", latex: `x = \\frac{${b.neg().toLatex()} \\pm ${surd}}{${twoA.toLatex()}}` });
  return {
    kind: "quadratic",
    answerLatex: `x_1 = ${first},\\quad x_2 = ${second}`,
    answerText: `x₁ and x₂ are irrational, given exactly above`,
    steps,
    verification:
      "Both roots are written with the radical left intact; neither has been rounded to a decimal.",
  };
}

/** Substitute a root back in and report the exact remainder. */
function checkSubstitution(poly: Poly, x: Rational): string {
  const [c, b, a] = poly;
  const value = a.mul(x).mul(x).add(b.mul(x)).add(c);
  if (value.isZero) {
    return `Substituting x = ${x.toLatex()} gives exactly 0, so the root is correct.`;
  }
  return `Substituting x = ${x.toLatex()} gives ${value.toLatex()}, which is not 0.`;
}
