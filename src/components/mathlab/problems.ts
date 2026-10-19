/**
 * Several problems in one box.
 *
 * Students paste a worksheet line or dictate two questions in a row:
 *
 *   2/3 + 1/6, and 3/4 ÷ 9/10
 *
 * The engine returns one `problems` entry per question, so the input has to be
 * split the same way before anything is rendered. This module owns that split,
 * and the matching rule for keeping English connective words OUT of maths
 * mode — MathLive would otherwise set "and" as three italic variables and run
 * it into the next fraction, which is exactly the glitch this replaces.
 */

/** True when a chunk actually contains mathematics, not just a connective. */
function looksMathematical(text: string) {
  return /[0-9]|\\[a-zA-Z]+|[=+\-*/^×÷()]/.test(text);
}

/**
 * Split a raw input into individual problems.
 *
 * Order of separators, strongest first:
 *   newline / semicolon  → always a boundary
 *   comma                → always a boundary (a worksheet separator)
 *   the word "and"       → a boundary only when BOTH sides look mathematical,
 *                          so "find the slope and intercept" stays one question
 *
 * Leading connectives left over from the split ("and 3/4 ÷ 9/10") are dropped,
 * and an empty input returns an empty list rather than one blank problem.
 */
export function splitProblems(raw: string): string[] {
  if (!raw.trim()) return [];

  const normalised = raw
    // A word the editor has already uprighted is still a separator.
    .replace(/\\text\{\s*(and|or|then)\s*\}/gi, " $1 ")
    // "and3/4" — MathLive eats the space after the word; restore it so the
    // separator is visible to the split rather than glued to the fraction.
    .replace(/\b(and|or|then)(?=[\d\\])/gi, "$1 ");

  // A comma inside a number (1,000) is not a worksheet separator. Park those
  // commas on a private marker for the duration of the split, then put them
  // back in each returned problem.
  const THOUSANDS = "\u0000";
  const guarded = normalised.replace(/(\d),(\d{3})(?!\d)/g, `$1${THOUSANDS}$2`);

  const chunks = guarded
    .split(/\n|;|,/)
    .flatMap((chunk) => {
      const parts = chunk.split(/\s+(?:and|or|then)\s+/i);
      if (parts.length < 2) return [chunk];
      return parts.every((part) => looksMathematical(part)) ? parts : [chunk];
    })
    .map((part) =>
      part
        .replaceAll(THOUSANDS, ",")
        .trim()
        .replace(/^(?:and|or|then)\b\s*/i, "")
        .replace(/[,;]+$/g, "")
        .trim(),
    )
    .filter(Boolean);

  return chunks;
}

/**
 * Wrap bare English connective words in `\text{…}` so the maths renderer sets
 * them upright with their spaces intact. Words already inside `\text{…}` and
 * LaTeX commands (`\and` does not exist, but be safe) are left alone.
 */
export function uprightWords(raw: string): string {
  if (!raw) return raw;
  // MathLive drops the space after a word when it converts the next token, so
  // "and3/4" arrives glued together. Restore the space before wrapping.
  const spaced = raw.replace(/\b(and|or|then)(?=[\d\\])/gi, "$1 ");
  return spaced.replace(
    /(^|[^\w\\{])(and|or|then)(?![\w}])/gi,
    (_match, lead: string, word: string) => `${lead}\\text{${word}}`,
  );
}

/**
 * A plain-text label for a detected problem — used by the chips under the
 * field. Chips are labels, not rendered maths, so English words can appear
 * here without being italicised.
 */
export function problemLabel(raw: string): string {
  return raw
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, "·")
    .replace(/\\pi/g, "π")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\left|\\right/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
