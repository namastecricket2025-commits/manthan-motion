/**
 * Mathematics text handling for the equation engine.
 *
 * The engine's answers arrive as plain sentences ("D = (−5)² − 4(3)(2) = 1"),
 * which is honest and portable but reads as a wall of text. This module turns
 * those sentences into two things: the *maths* worth typesetting, and the
 * *rule* the step applied. The step cards then show the equation set in real
 * LaTeX on one side and a coloured rule badge on the other.
 *
 * Nothing here touches React or the DOM, so the conversion can be exercised on
 * its own. Rendering lives in `latex.tsx`.
 */

/* ------------------------------------------------------------------ */
/* glyph tables                                                        */
/* ------------------------------------------------------------------ */

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "ⁿ": "n",
  "⁺": "+",
  "⁻": "-",
};

const SUBSCRIPTS: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "ₙ": "n",
  "ₖ": "k",
  "ₓ": "x",
};

const SYMBOLS: [RegExp, string][] = [
  [/′′/g, "^{\\prime\\prime}"],
  [/′/g, "^{\\prime}"],
  [/⇒/g, "\\Rightarrow "],
  [/⇔/g, "\\Leftrightarrow "],
  [/→/g, "\\to "],
  [/×/g, "\\cdot "],
  [/·/g, "\\cdot "],
  [/÷/g, "\\div "],
  [/π/g, "\\pi "],
  [/θ/g, "\\theta "],
  [/α/g, "\\alpha "],
  [/β/g, "\\beta "],
  [/λ/g, "\\lambda "],
  [/μ/g, "\\mu "],
  [/σ/g, "\\sigma "],
  [/Δ/g, "\\Delta "],
  [/∞/g, "\\infty "],
  [/≤/g, "\\le "],
  [/≥/g, "\\ge "],
  [/≠/g, "\\ne "],
  [/≈/g, "\\approx "],
  [/±/g, "\\pm "],
  [/°/g, "^{\\circ}"],
  [/\u2212/g, "-"],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
];

const FUNCTIONS = /\b(sin|cos|tan|sec|csc|cot|log|ln|exp|lim|max|min|mod)\b/g;

/* ------------------------------------------------------------------ */
/* conversion                                                          */
/* ------------------------------------------------------------------ */

/** True when the string already contains LaTeX control sequences. */
export function hasLatex(input: string): boolean {
  return /\\[a-zA-Z]+/.test(input) || /\\frac\{/.test(input);
}

/** `x²` and `x^2` both become `x^{2}`; `aₙ` becomes `a_{n}`. */
function groupScripts(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const char = input[i];

    if (char === "^" || char === "_") {
      const script = char === "^" ? "^" : "_";
      const rest = input.slice(i + 1);
      const braced = /^\{([^}]*)\}/.exec(rest);
      if (braced) {
        out += `${script}{${braced[1]}}`;
        i += 1 + braced[0].length;
        continue;
      }
      const bare =
        script === "^" ? /^[A-Za-z0-9+\-]+/.exec(rest) : /^[A-Za-z0-9]+/.exec(rest);
      if (bare) {
        out += `${script}{${bare[0]}}`;
        i += 1 + bare[0].length;
        continue;
      }
      out += script;
      i += 1;
      continue;
    }

    if (SUPERSCRIPTS[char]) {
      let run = "";
      let j = i;
      while (j < input.length && SUPERSCRIPTS[input[j]]) {
        run += SUPERSCRIPTS[input[j]];
        j += 1;
      }
      out += `^{${run}}`;
      i = j;
      continue;
    }

    if (SUBSCRIPTS[char]) {
      let run = "";
      let j = i;
      while (j < input.length && SUBSCRIPTS[input[j]]) {
        run += SUBSCRIPTS[input[j]];
        j += 1;
      }
      out += `_{${run}}`;
      i = j;
      continue;
    }

    out += char;
    i += 1;
  }
  return out;
}

/** The index where the operand whose last character sits at `last` begins. */
function operandStartBack(text: string, last: number): number {
  if (text[last] === ")") {
    let depth = 0;
    for (let i = last; i >= 0; i -= 1) {
      if (text[i] === ")") depth += 1;
      else if (text[i] === "(") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return last;
  }
  let i = last + 1;
  while (i > 0 && /[A-Za-z0-9.^{}]/.test(text[i - 1])) i -= 1;
  return i;
}

/** The index just past the operand whose first character sits at `first`. */
function operandEndForward(text: string, first: number): number {
  if (text[first] === "(") {
    let depth = 0;
    for (let i = first; i < text.length; i += 1) {
      if (text[i] === "(") depth += 1;
      else if (text[i] === ")") {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return text.length;
  }
  let i = first;
  while (i < text.length && /[A-Za-z0-9.^{}]/.test(text[i])) i += 1;
  return i;
}

/**
 * `a/b` becomes `\frac{a}{b}`, and so does `(x + 1)/2` or the nested
 * `(-b ± √(b² − 4ac)) / 2a` — the operands are found by walking outwards over
 * balanced brackets, which a regular expression cannot do. A slash whose
 * neighbours are ordinary words is left exactly as it was.
 */
function toFractions(input: string): string {
  // Never touch an expression we have already built into a command.
  if (input.includes("\\frac")) return input;
  let out = input;
  for (let pass = 0; pass < 4; pass += 1) {
    const slash = out.indexOf("/");
    if (slash < 0) break;
    let left = slash - 1;
    while (left >= 0 && out[left] === " ") left -= 1;
    let right = slash + 1;
    while (right < out.length && out[right] === " ") right += 1;
    if (left < 0 || right >= out.length) break;
    const start = operandStartBack(out, left);
    const end = operandEndForward(out, right);
    const numerator = out.slice(start, slash).trim();
    const denominator = out.slice(slash + 1, end).trim();
    if (
      start >= slash ||
      end <= slash + 1 ||
      !numerator ||
      !denominator ||
      proseWordCount(numerator) > 0 ||
      proseWordCount(denominator) > 0
    ) {
      break;
    }
    out = `${out.slice(0, start)}\\frac{${numerator}}{${denominator}}${out.slice(end)}`;
  }
  return out;
}

/**
 * `\sqrt{` has to close over exactly its own operand, so the radical sign is
 * expanded by walking forward and consuming what belongs to it — a bracketed
 * group, or a run of digits, letters and operators. A blanket `√` → `\sqrt{`
 * replacement plus a brace counted at the end of the string eats the wrong
 * parenthesis.
 */
function expandRadicals(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] !== "√") {
      out += input[i];
      i += 1;
      continue;
    }
    i += 1;
    let operand = "";
    if (input[i] === "(") {
      let depth = 0;
      while (i < input.length) {
        const char = input[i];
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        operand += char;
        i += 1;
        if (depth === 0) break;
      }
      // Braces already make the grouping clear, so drop the outer brackets.
      operand = operand.slice(1, -1);
    } else {
      while (i < input.length && /[A-Za-z0-9.+\-*/^]/.test(input[i])) {
        operand += input[i];
        i += 1;
      }
    }
    out += `\\sqrt{${operand}}`;
  }
  return out;
}

/**
 * Convert a human-written mathematical fragment into LaTeX source.
 * Idempotent: text that is already LaTeX is left essentially alone.
 */
export function toLatex(input: string): string {
  const text = input.trim();
  if (!text) return "";

  let out = text;
  for (const [pattern, replacement] of SYMBOLS) out = out.replace(pattern, replacement);
  out = out.replace(FUNCTIONS, "\\$1 ");
  out = groupScripts(out);
  // Fractions before radicals: the fraction matcher only understands a flat
  // operand, and a radical has not been expanded yet at this point.
  out = toFractions(out);
  out = expandRadicals(out);
  // A digit glued to a letter reads as a product, so give it a hair of space.
  out = out.replace(/(\d)([a-zA-Z])/g, "$1\\,$2");

  // Two adjacent letters are a valid product in math mode ("ac" renders as a·c),
  // and the fragment may already be LaTeX, so nothing else is adjusted here.
  return out.replace(/\s{2,}/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/* rule badges                                                         */
/* ------------------------------------------------------------------ */

export type RuleTone =
  | "factor"
  | "discriminant"
  | "chain"
  | "power"
  | "identity"
  | "standard"
  | "verify";

const RULE_TONES: { match: RegExp; tone: RuleTone }[] = [
  { match: /factori[sz]|factor theorem|remainder theorem|remainder/i, tone: "factor" },
  { match: /discriminant|perfect square|nature of roots|repeated root/i, tone: "discriminant" },
  {
    match: /chain rule|product rule|quotient rule|composite|compound angle|addition formula/i,
    tone: "chain",
  },
  {
    match: /power rule|differentiat|derivative|slope|tangent|limit definition/i,
    tone: "power",
  },
  {
    match: /identit|pythagor|expansion|complet(?:e|ing) the square|conjugate/i,
    tone: "identity",
  },
  {
    match: /standard form|transpos|isolate|rearrange|collect|common denominator|reciprocal|LCM|section formula/i,
    tone: "standard",
  },
  { match: /substitut|verify|back into|check|confirms?|sanity/i, tone: "verify" },
];

const TONE_ORDER: RuleTone[] = [
  "factor",
  "discriminant",
  "chain",
  "power",
  "identity",
  "standard",
  "verify",
];

/** Which badge colour a rule name deserves. */
export function toneForRule(rule: string): RuleTone {
  for (const entry of RULE_TONES) {
    if (entry.match.test(rule)) return entry.tone;
  }
  // No semantic match: spread the remainder across the palette deterministically
  // so the same rule always wears the same colour.
  const index = [...rule].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TONE_ORDER[index % TONE_ORDER.length];
}

const NAMED_RULES: { match: RegExp; label: string }[] = [
  { match: /discriminant/, label: "Discriminant Rule" },
  { match: /factoris|factori[sz]e|remainder theorem|factor theorem/, label: "Factorization Rule" },
  { match: /power rule/, label: "Power Rule" },
  { match: /d\/dx|differentiate|derivative/, label: "Derivative Rule" },
  { match: /tangent/, label: "Tangent Line Rule" },
  { match: /complet(?:e|ing) the square/, label: "Completing the Square" },
  { match: /transpos|isolate the variable|collect the variable/, label: "Transpose Rule" },
  { match: /substitut|check the result|back into the original/, label: "Substitution Check" },
  { match: /common denominator|common multiple|lcm/i, label: "LCM of Denominators" },
  { match: /reciprocal/, label: "Reciprocal Rule" },
  { match: /pythagor/, label: "Pythagorean Theorem" },
  { match: /expand|expansion|identity/, label: "Algebraic Identity" },
  { match: /quadratic formula|±√/, label: "Quadratic Formula" },
  { match: /standard form/, label: "Standard Form" },
  { match: /sum of the roots|product of the roots|sum of roots/, label: "Vieta's Formulas" },
  { match: /limit/, label: "Limit Definition" },
  { match: /plot|graph|sketch/, label: "Graphical Method" },
];

/** Infer a rule name from the step's own wording, when the model did not say. */
export function inferRule(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  for (const entry of NAMED_RULES) {
    if (entry.match.test(lower)) return entry.label;
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* step decomposition                                                  */
/* ------------------------------------------------------------------ */

export interface WorkedStep {
  /** The property or rule this step applied. */
  rule: string;
  /** LaTeX source for the equation, or "" when the step is pure prose. */
  math: string;
  /** The sentence around the maths, tidied. */
  note: string;
  tone: RuleTone;
  /** The step exactly as it came back, for copy and for the follow-up history. */
  raw: string;
}

const RULE_PREFIX = /^\s*\[([^\]]{2,56})\]\s*(?:[—–:.-]\s*)?/;
const CLAUSE_SPLIT = /(?<=[.;:])\s+/;

/** Words that belong to an expression rather than to a sentence. */
const MATH_WORDS = new Set([
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "log",
  "ln",
  "lim",
  "exp",
  "max",
  "min",
  "mod",
  "int",
]);

/** Two-letter English words that are never a product of two variables. */
const STOPWORDS = new Set([
  "of",
  "is",
  "it",
  "in",
  "to",
  "by",
  "if",
  "no",
  "at",
  "on",
  "or",
  "an",
  "as",
  "be",
  "do",
  "so",
  "we",
]);

/**
 * How many ordinary words a fragment carries. Zero means the whole fragment is
 * an expression; anything higher means a human sentence with symbols in it,
 * which must be rendered as text rather than typeset.
 */
export function proseWordCount(text: string): number {
  return text
    // Command names are ours, not the student's: `\cdot` must not read as the
    // English word "cdot".
    .replace(/\\[a-zA-Z]+/g, " ")
    .split(/[^A-Za-z]+/)
    .filter((word) => {
      if (word.length <= 1) return false;
      const lower = word.toLowerCase();
      if (MATH_WORDS.has(lower)) return false;
      return word.length > 2 || STOPWORDS.has(lower);
    }).length;
}

/** Does this fragment carry enough maths to be worth typesetting? */
export function looksMathematical(fragment: string): boolean {
  const symbols = (fragment.match(/[=+\-*/^√±<>]|\d\s*[a-zA-Z]|[a-zA-Z]\s*\^/g) ?? []).length;
  return symbols >= 2 && /\d|[a-zA-Z]/.test(fragment);
}

/**
 * Is this one token the start of an expression? Variables are single letters,
 * operators and bracketed terms are unmistakable, and anything carrying a
 * digit — including the subscripts in `x₁` — is arithmetic.
 */
function isMathToken(token: string): boolean {
  const bare = token.replace(/[.,;:!?]+$/, "");
  if (!bare) return false;
  if (/[\d₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(bare)) return true;
  if (/[=+\-*/^√±<>×÷′()[\]]/.test(bare)) return true;
  if (/^[A-Za-z]$/.test(bare)) return true;
  return false;
}

/**
 * Split one engine step into its equation and its rule.
 *
 * The model is asked to prefix each step with `[Rule Name]`, but older answers
 * and the instant local solver do not, so the rule is inferred from the wording
 * when the prefix is absent.
 */
export function toWorkedStep(raw: string, fallbackRule: string): WorkedStep {
  const text = raw.trim();
  const prefixed = RULE_PREFIX.exec(text);
  const body = (prefixed ? text.slice(prefixed[0].length) : text).trim();
  const rule = prefixed ? prefixed[1].trim() : inferRule(body, fallbackRule);

  // The maths lives in whichever clause carries the operators.
  const clauses = body.split(CLAUSE_SPLIT).filter(Boolean);
  let mathClause = "";
  for (const clause of clauses) {
    if (/[=±√^]/.test(clause) || looksMathematical(clause)) {
      mathClause = clause;
      break;
    }
  }
  if (!mathClause) mathClause = clauses[0] ?? "";

  const isMath = /[=±√^]/.test(mathClause) || looksMathematical(mathClause);
  let math = "";
  let note = body;

  if (isMath) {
    // Within the clause, the expression starts at its first mathematical
    // token: "Compute D = 25 - 24 = 1" is the note "Compute" beside the
    // equation "D = 25 - 24 = 1", not one long string of both.
    const words = mathClause.split(/(\s+)/);
    const firstMath = words.findIndex((word) => /^\S+$/.test(word) && isMathToken(word));
    const start = firstMath >= 0 ? firstMath : 0;
    const expression = words.slice(start).join("").replace(/[.;:]+$/, "").trim();
    math = toLatex(expression);
    const lead = words.slice(0, start).join("").trim();
    const rest = clauses.filter((clause) => clause !== mathClause).join(" ").trim();
    note = [lead, rest].filter(Boolean).join(" ").replace(/[.;:]+$/, "").trim();
  }

  return { rule, math, note, tone: toneForRule(rule), raw: text };
}

/**
 * True when a line is close enough to an expression to be typeset. A line that
 * carries an ordinary word is prose with symbols in it — "1 radian = 180°/π" —
 * and is left as text rather than typeset into nonsense.
 */
export function isMathLine(text: string): boolean {
  if (!/[=±√^]/.test(text) && !/\\[a-zA-Z]/.test(text)) return false;
  return proseWordCount(text) === 0;
}
