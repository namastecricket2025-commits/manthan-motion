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

/* ------------------------------------------------------------------ */
/* arithmetic expressions                                             */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a pure arithmetic expression in exact rationals.
 *
 * The lab's own questions are fractions, divisions and powers, so
 * `2/3 + 1/6` has to answer `5/6` — not `0.8333`, and certainly not a
 * floating-point form of it. Brackets, unary signs and whole-number powers are
 * the entire grammar. A variable, a function or a word makes the parse fail
 * (`null`) rather than guess, so "verified" always means verified.
 */
export function evaluateExpression(input: string): Rational | null {
  const source = normaliseExpression(input);
  if (!source) return null;
  // Anything that is not arithmetic — a variable, a function name, a unit —
  // is outside this evaluator and must not be approximated.
  if (/[a-zπ√∞]/i.test(source)) return null;

  let pos = 0;

  const readExponent = (): number | null => {
    let negative = false;
    if (source[pos] === "(") {
      pos += 1;
      if (source[pos] === "-") {
        negative = true;
        pos += 1;
      } else if (source[pos] === "+") pos += 1;
      const digits = /^\d+/.exec(source.slice(pos));
      if (!digits || source[pos + digits[0].length] !== ")") return null;
      pos += digits[0].length + 1;
      const value = Number(digits[0]);
      return negative ? -value : value;
    }
    if (source[pos] === "-") {
      negative = true;
      pos += 1;
    } else if (source[pos] === "+") pos += 1;
    const digits = /^\d+/.exec(source.slice(pos));
    if (!digits) return null;
    pos += digits[0].length;
    const value = Number(digits[0]);
    return negative ? -value : value;
  };

  const atom = (): Rational | null => {
    if (source[pos] === "(") {
      pos += 1;
      const inner = expression();
      if (!inner || source[pos] !== ")") return null;
      pos += 1;
      return inner;
    }
    const literal = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(source.slice(pos));
    if (!literal) return null;
    pos += literal[0].length;
    try {
      return Rational.parse(literal[0]);
    } catch {
      return null;
    }
  };

  const power = (): Rational | null => {
    const base = atom();
    if (!base) return null;
    if (source[pos] !== "^") return base;
    pos += 1;
    const exponent = readExponent();
    if (exponent === null || Math.abs(exponent) > 64) return null;
    if (exponent < 0) {
      if (base.isZero) return null;
      return ONE.div(base.pow(-exponent));
    }
    return base.pow(exponent);
  };

  const unary = (): Rational | null => {
    const char = source[pos];
    if (char === "+") {
      pos += 1;
      return unary();
    }
    if (char === "-") {
      pos += 1;
      const value = unary();
      return value ? value.neg() : null;
    }
    return power();
  };

  function term(): Rational | null {
    let left = unary();
    if (!left) return null;
    for (;;) {
      const char = source[pos];
      if (char === "*" || char === "/") {
        pos += 1;
        const right = unary();
        if (!right) return null;
        if (char === "/") {
          if (right.isZero) return null;
          left = left.div(right);
        } else {
          left = left.mul(right);
        }
        continue;
      }
      // Implicit multiplication: 2(3), which students write constantly.
      if (char === "(") {
        const right = unary();
        if (!right) return null;
        left = left.mul(right);
        continue;
      }
      return left;
    }
  }

  function expression(): Rational | null {
    let left = term();
    if (!left) return null;
    for (;;) {
      const char = source[pos];
      if (char !== "+" && char !== "-") return left;
      pos += 1;
      const right = term();
      if (!right) return null;
      left = char === "+" ? left.add(right) : left.sub(right);
    }
  }

  const value = expression();
  if (!value || pos !== source.length) return null;
  return value;
}

/** `5/6`, `-3`, `12` — the form a student writes. */
export function describeExact(value: Rational): string {
  return value.toString();
}

/** `\frac{5}{6}` or `12` — the form the notebook typesets. */
export function describeExactLatex(value: Rational): string {
  return value.toLatex();
}

/* ------------------------------------------------------------------ */
/* reading LaTeX back                                                  */
/* ------------------------------------------------------------------ */

const LATEX_STRIPPERS: [RegExp, string][] = [
  [/\\left|\\right|\\displaystyle|\\limits|\\!|\\,|\\;|\\:|\\ /g, ""],
  [/\\quad|\\qquad|\\space|\\ensuremath/g, " "],
  [/\\text\s*\{[^{}]*\}/g, " "],
  [/\\mathrm\s*\{([^{}]*)\}/g, "$1"],
  [/\\operatorname\s*\{([^{}]*)\}/g, "$1"],
  [/\\cdot|\\times|\\ast/g, "*"],
  [/[×·]/g, "*"],
  [/\\div/g, "/"],
  [/÷/g, "/"],
  [/\u2212|\u2013|\u2014/g, "-"],
  [/²/g, "^2"],
  [/³/g, "^3"],
  [/\$+/g, ""],
];

/**
 * Rewrite `\frac{A}{B}` as `(A)/(B)`, innermost-first, so nested fractions
 * survive. Returns null when a brace never closes.
 */
function expandFractions(input: string): string | null {
  const fraction = /\\(?:d|t)?frac\s*\{/;
  let text = input;
  for (let guard = 0; guard < 200; guard += 1) {
    const match = fraction.exec(text);
    if (!match) return text;
    const start = match.index;
    let cursor = start + match[0].length - 1;
    const groups: string[] = [];
    for (let group = 0; group < 2; group += 1) {
      if (text[cursor] !== "{") return null;
      let depth = 0;
      let end = -1;
      for (let i = cursor; i < text.length; i += 1) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) return null;
      groups.push(text.slice(cursor + 1, end));
      cursor = end + 1;
      while (text[cursor] === " ") cursor += 1;
    }
    const [top, bottom] = groups;
    // A single term over a whole number (`\frac{x}{2}`, `\frac{2x}{3}`) is the
    // one fraction shape the polynomial reader already understands as written,
    // so it keeps that bare form. Everything else is bracketed, which is what
    // makes a division of two fractions — `\frac{3}{4} \div \frac{9}{10}` —
    // mean what it says instead of collapsing into one long division chain.
    const simpleTerm =
      /^[+-]?\s*(?:\d+(?:\.\d+)?|\.\d+)?\s*[a-z]\s*(?:\^\s*\{?\s*\d+\s*\}?)?$/i.test(
        top.trim(),
      );
    const wholeBottom = /^\s*\d+\s*$/.test(bottom.trim());
    const rendered =
      simpleTerm && wholeBottom
        ? `${top.trim()}/${bottom.trim()}`
        : `((${top})/(${bottom}))`;
    text = `${text.slice(0, start)}${rendered}${text.slice(cursor)}`;
  }
  return null;
}

/**
 * Turn a small LaTeX fragment into the plain arithmetic and algebra the exact
 * engine reads: `\frac{5}{6}` becomes `(5)/(6)`, `x^{2}` becomes `x^2`, and a
 * `\text{...}` block is dropped.
 *
 * If any command is left that this module does not know — a radical, an
 * integral, a matrix — the conversion fails rather than guess, because a
 * half-understood expression must never be reported as verified.
 */
export function latexToPlain(input: string): string | null {
  let text = input;
  for (const [pattern, replacement] of LATEX_STRIPPERS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\^\s*\{([^{}]*)\}/g, "^$1");
  text = text.replace(/_\s*\{([^{}]*)\}/g, "_$1");
  const expanded = expandFractions(text);
  if (expanded === null) return null;
  text = expanded;
  // A lingering command means the fragment carries something this reader does
  // not understand. Refuse it.
  if (/\\[a-zA-Z]+/.test(text)) return null;
  if (/[{}]/.test(text)) return null;
  if (/[√∫∑±]/.test(text)) return null;
  return text.replace(/\s+/g, "").toLowerCase();
}

/**
 * Every rational a LaTeX answer explicitly states, in the order written.
 *
 * `x = \frac{2}{3}` yields `2/3`; `x_1 = 2,\; x_2 = -3` yields `2` and `-3`.
 * Root subscripts are dropped first so `x_1` cannot masquerade as the value 1,
 * and radicals are removed entirely — they are not comparable as rationals, so
 * an answer built on one takes the honest "could not verify" path.
 */
export function numbersFromLatex(input: string): Rational[] {
  let text = input
    .replace(/\\sqrt\s*\{[^{}]*\}/g, " ")
    .replace(/√\s*[\d.]+/g, " ");
  // x_1, x_{2}, a_n — labels, not values.
  text = text.replace(/_\s*\{[^{}]*\}/g, "").replace(/_\s*[0-9a-zA-Z]/g, "");
  const found: Rational[] = [];
  const fraction = /\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
  text = text.replace(fraction, (_full, top: string, bottom: string) => {
    const value = ratio(top, bottom);
    if (value) found.push(value);
    return " ";
  });
  // A plain `5/6` written without \frac is still one value, not two.
  text = text.replace(
    /(?<![\d.])([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\/\s*((?:\d+(?:\.\d+)?|\.\d+))(?!\d)/g,
    (_full, top: string, bottom: string) => {
      const value = ratio(top, bottom);
      if (value) found.push(value);
      return " ";
    },
  );
  for (const match of text.matchAll(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g)) {
    try {
      found.push(Rational.parse(match[0]));
    } catch {
      /* ignore */
    }
  }
  return found;
}

/** `a` over `b`, exactly, or null when either is not a number. */
function ratio(top: string, bottom: string): Rational | null {
  try {
    return Rational.parse(top.trim()).div(Rational.parse(bottom.trim()));
  } catch {
    return null;
  }
}

/**
 * Every exact number a plain-text answer states — `2/3`, `-3`, `12` — with a
 * radical making the whole reading unusable (a surd is not a rational, so it
 * cannot be compared as one).
 */
export function numbersFromPlain(input: string): Rational[] {
  if (/[√]/.test(input)) return [];
  const found: Rational[] = [];
  const text = input.replace(/_\s*[0-9a-zA-Z]/g, "");
  for (const chunk of text.split(/[^0-9.+/\-]+/)) {
    if (!/\d/.test(chunk)) continue;
    const pieces = chunk.split("+").filter(Boolean);
    for (const piece of pieces) {
      const value = ratioOrNumber(piece);
      if (value) found.push(value);
    }
  }
  return found;
}

function ratioOrNumber(piece: string): Rational | null {
  const trimmed = piece.trim();
  if (!trimmed || trimmed === "-" || trimmed === "+") return null;
  if (trimmed.includes("/")) {
    const [top, bottom] = trimmed.split("/");
    return ratio(top, bottom);
  }
  try {
    return Rational.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Two exact values agree when they differ by less than a millionth. The
 * comparison is done on the rationals themselves, so a model that wrote
 * `0.6667` for `2/3` is caught exactly where a float comparison would wobble.
 */
export function exactClose(a: Rational, b: Rational): boolean {
  const difference = a.sub(b).abs();
  if (difference.isZero) return true;
  const tolerance = Rational.of(1n, 1_000_000n);
  return difference.n * tolerance.d < tolerance.n * difference.d;
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
