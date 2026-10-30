/**
 * LaTeX → readable text, for the places that cannot typeset.
 *
 * The review queue renders prompt and answer as plain text, so a formula card
 * has to carry something a student can actually read on a phone: fractions as
 * a/b, roots as √(…), Greek letters and relation symbols as themselves. This is
 * deliberately lossy — it is a reading of the relation, not a TeX engine.
 */

const SYMBOLS: Array<[RegExp, string]> = [
  [/\\left|\\right/g, ""],
  [/\\[,;:!]/g, " "],
  [/\\quad|\\qquad/g, "  "],
  [/\\\\/g, " "],
  [/\\cdot/g, "·"],
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\pm/g, "±"],
  [/\\mp/g, "∓"],
  [/\\leq|\\le(?![a-z])/g, "≤"],
  [/\\geq|\\ge(?![a-z])/g, "≥"],
  [/\\neq|\\ne(?![a-z])/g, "≠"],
  [/\\approx/g, "≈"],
  [/\\equiv/g, "≡"],
  [/\\infty/g, "∞"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\phi/g, "φ"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\delta/g, "δ"],
  [/\\Delta/g, "Δ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\nu/g, "ν"],
  [/\\rho/g, "ρ"],
  [/\\sigma/g, "σ"],
  [/\\tau/g, "τ"],
  [/\\omega/g, "ω"],
  [/\\Omega/g, "Ω"],
  [/\\sum/g, "Σ"],
  [/\\prod/g, "Π"],
  [/\\int/g, "∫"],
  [/\\partial/g, "∂"],
  [/\\nabla/g, "∇"],
  [/\\angle/g, "∠"],
  [/\\perp/g, "⊥"],
  [/\\parallel/g, "∥"],
  [/\\to|\\rightarrow/g, "→"],
  [/\\Rightarrow/g, "⇒"],
  [/\\Leftrightarrow/g, "⇔"],
  [/\\in(?![a-z])/g, "∈"],
  [/\\notin/g, "∉"],
  [/\\subset/g, "⊂"],
  [/\\cup/g, "∪"],
  [/\\cap/g, "∩"],
  [/\\degree/g, "°"],
  [/\\circ/g, "°"],
  [/\\mathbb\{R\}/g, "ℝ"],
  [/\\mathbb\{N\}/g, "ℕ"],
  [/\\mathbb\{Z\}/g, "ℤ"],
  [/\\mathbb\{Q\}/g, "ℚ"],
  [/\\mathbb\{C\}/g, "ℂ"],
  [/\\sin/g, "sin"],
  [/\\cos/g, "cos"],
  [/\\tan/g, "tan"],
  [/\\cot/g, "cot"],
  [/\\sec/g, "sec"],
  [/\\csc/g, "csc"],
  [/\\log/g, "log"],
  [/\\ln/g, "ln"],
  [/\\lim/g, "lim"],
  [/\\max/g, "max"],
  [/\\min/g, "min"],
  [/\\sqrt\s*\{([^{}]*)\}/g, "√($1)"],
  [/\\overline\s*\{([^{}]*)\}/g, "$1"],
  [/\\vec\s*\{([^{}]*)\}/g, "$1"],
  [/\\hat\s*\{([^{}]*)\}/g, "$1"],
  [/\\bar\s*\{([^{}]*)\}/g, "$1"],
];

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "⁺",
  n: "ⁿ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  a: "ₐ",
  e: "ₑ",
  i: "ᵢ",
  n: "ₙ",
  x: "ₓ",
};

function mapChars(source: string, table: Record<string, string>, fallback: string) {
  const chars = [...source];
  if (chars.every((char) => table[char])) return chars.map((char) => table[char]).join("");
  return fallback ? `${fallback}(${source})` : source;
}

/** Simple groups can lose their brackets; anything compound keeps them. */
function fraction(numerator: string, denominator: string) {
  const simple = /^[A-Za-z0-9πθ°²³√.]+$/;
  const top = simple.test(numerator) ? numerator : `(${numerator})`;
  const bottom = simple.test(denominator) ? denominator : `(${denominator})`;
  return `${top}/${bottom}`;
}

/** Read a balanced `{…}` group starting at `start`, which must be a brace. */
function readGroup(source: string, start: number): { content: string; end: number } | null {
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

/**
 * `\frac{a}{b}` with balanced groups, not a regex that stops at the first
 * closing brace. The quadratic formula nests a `\sqrt` inside the numerator;
 * a one-level regex leaves "frac" in the answer, which is exactly the kind of
 * quietly wrong card this helper exists to avoid.
 */
function replaceFractions(text: string): string {
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("\\frac", index)) {
      let cursor = index + 5;
      while (text[cursor] === " ") cursor += 1;
      const numerator = readGroup(text, cursor);
      if (numerator) {
        cursor = numerator.end;
        while (text[cursor] === " ") cursor += 1;
        const denominator = readGroup(text, cursor);
        if (denominator) {
          output += fraction(numerator.content, denominator.content);
          index = denominator.end;
          continue;
        }
      }
    }
    output += text[index];
    index += 1;
  }
  return output;
}

export function latexToPlain(source: string): string {
  let text = source ?? "";

  // Braced text and operators first: their contents must not be rewritten.
  for (let pass = 0; pass < 4; pass += 1) {
    text = text.replace(/\\(?:text|mathrm|operatorname|mathbf|textbf)\s*\{([^{}]*)\}/g, "$1");
  }

  // Fractions, a few passes so a fraction inside a fraction is reached.
  for (let pass = 0; pass < 4; pass += 1) {
    text = replaceFractions(text);
  }

  for (const [pattern, replacement] of SYMBOLS) {
    text = text.replace(pattern, replacement);
  }

  // A degree written as a power reads as a degree, not as "^°".
  text = text.replace(/\^\s*\{?\s*°\s*\}?/g, "°");

  // Exponents and subscripts.
  text = text.replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9+-])/g, (_match, braced, single) => {
    const value = braced ?? single ?? "";
    return mapChars(value, SUPERSCRIPTS, "^");
  });
  text = text.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_match, braced, single) => {
    const value = braced ?? single ?? "";
    return mapChars(value, SUBSCRIPTS, "_");
  });

  // Anything left that is still a command keeps its readable name; environment
  // wrappers and alignment marks carry no meaning in a sentence.
  text = text.replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, " ");
  text = text.replace(/\\[A-Za-z]+/g, (match) => match.slice(1));
  text = text.replace(/[{}&]/g, "");
  text = text.replace(/\s+([,.;:])/g, "$1");
  text = text.replace(/\s+/g, " ");

  return text.trim();
}

/** One review card's worth of text for a formula-sheet entry. */
export function formulaAnswer(latex: string, note?: string): string {
  const plain = latexToPlain(latex);
  const cleanNote = (note ?? "").trim();
  return cleanNote ? `${plain} — ${cleanNote}` : plain;
}
