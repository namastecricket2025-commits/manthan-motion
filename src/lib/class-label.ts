/**
 * Turning whatever a student types into one consistent "Class 10" label.
 *
 * The review form used to ask for "Class 12 or JEE aspirant" and take the
 * answer literally, so the carousel showed "10", "10th", "class 10th" and
 * "CLASS 10" as four different things for the same class. Nobody should have
 * to spell the word "Class" to be understood: `10th`, `10`, `X` and
 * `class 10` all mean the same thing, and all of them should print the same.
 *
 * Only the leading fact is interpreted. Anything that is not recognised as a
 * class or a named exam is passed through untouched — a student writing
 * "dropper, aiming for NDA" sees their own words, not a guess.
 */

const CLASS_MIN = 8;
const CLASS_MAX = 12;

const ROMAN: Record<string, number> = {
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

/** The class number anywhere in the text, or null. */
function extractClass(text: string): number | null {
  // Digits first: "10", "10th", "class 10", "10th standard", "12th pass".
  const digits = text.match(/(?:^|[^0-9])(1[0-2]|[89])(?:st|nd|rd|th)?(?![0-9])/);
  if (digits) {
    const value = Number(digits[1]);
    if (value >= CLASS_MIN && value <= CLASS_MAX) return value;
  }
  // Then the Roman forms: "X", "XII", "class ix".
  const roman = text.match(/\b(viii|ix|xii|xi|x)\b/);
  if (roman) return ROMAN[roman[1]] ?? null;
  return null;
}

/** Named exams a review can be about, most specific first. */
const EXAMS: Array<[RegExp, string]> = [
  [/\bjee\b/, "JEE"],
  [/\bneet\b/, "NEET"],
  [/\bcuet\b/, "CUET"],
  [/\bbitsat\b/, "BITSAT"],
  [/\bkvpy\b/, "KVPY"],
  [/\bnda\b/, "NDA"],
  [/\bolympiad\b/, "Olympiad"],
  [/\bboards?\b/, "Board exam"],
];

function extractExam(text: string): string | null {
  for (const [pattern, label] of EXAMS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

const MAX_LABEL = 40;

/**
 * `"10th"` → `"Class 10"`, `"class 12 jee"` → `"Class 12 · JEE aspirant"`.
 * Returns undefined for an empty answer so the field stays optional.
 */
export function normalizeClassLabel(raw?: string | null): string | undefined {
  const text = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!text) return undefined;

  const lower = text.toLowerCase();
  const grade = extractClass(lower);
  const exam = extractExam(lower);

  // "Class 10 board" is still just Class 10 — the board is implied.
  const namedExam = exam === "Board exam" && grade !== null ? null : exam;

  const parts: string[] = [];
  if (grade !== null) parts.push(`Class ${grade}`);
  if (namedExam) parts.push(`${namedExam} aspirant`);

  if (parts.length > 0) return parts.join(" · ").slice(0, MAX_LABEL);

  // A board named on its own ("CBSE", "ICSE") reads better than "Board exam".
  if (exam === "Board exam") return "Board exam";
  return text.slice(0, MAX_LABEL);
}

/** What the form shows under the field while typing, or undefined. */
export function classLabelPreview(raw: string): string | undefined {
  const normalized = normalizeClassLabel(raw);
  if (!normalized) return undefined;
  return normalized;
}
