/**
 * The exact text behind a citation.
 *
 * Source peek deliberately does not ask a model for a quote: a model can
 * paraphrase a passage and then present it as the source's words. This picks a
 * window of the extracted text itself, so whatever the student sees under
 * "Source peek" is what Manthan actually read.
 */

const WORD_RE = /[a-z0-9][a-z0-9'-]{2,}/gi;

function words(value: string) {
  return new Set(
    (value.toLowerCase().match(WORD_RE) ?? []).filter(
      (word) => !STOP.has(word),
    ),
  );
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "your",
  "with",
  "this",
  "that",
  "from",
  "have",
  "has",
  "was",
  "were",
  "will",
  "can",
  "into",
  "its",
  "their",
  "they",
  "them",
  "than",
  "then",
  "when",
  "where",
  "what",
  "which",
  "how",
  "why",
  "all",
  "any",
  "our",
  "out",
  "about",
  "also",
  "more",
  "most",
  "some",
  "such",
  "only",
  "other",
  "over",
  "very",
]);

type Window = { start: number; end: number; text: string; score: number };

function windows(text: string): Window[] {
  // Prefer paragraphs, then sentences. A source that is one long line still
  // yields useful windows rather than a single 200-page blob.
  const spans: { start: number; end: number }[] = [];
  const pushRange = (start: number, end: number) => {
    if (end - start > 40) spans.push({ start, end });
  };

  const paragraphRe = /\n\s*\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = paragraphRe.exec(text))) {
    pushRange(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  pushRange(cursor, text.length);

  if (spans.length < 2) {
    const sentenceRe = /[^.!?\n]+[.!?]?/g;
    let sentence: RegExpExecArray | null;
    while ((sentence = sentenceRe.exec(text))) {
      const raw = sentence[0];
      if (raw.trim().length > 60) {
        const start = sentence.index + (raw.length - raw.trimStart().length);
        pushRange(start, sentence.index + raw.trimEnd().length);
      }
    }
  }

  return spans.map(({ start, end }) => ({
    start,
    end,
    text: text.slice(start, end),
    score: 0,
  }));
}

/**
 * Pick the passage that best overlaps `focus` (the answer, a term, a question).
 * With no focus, the opening of the source is the honest default.
 */
export function sourceExcerpt(
  text: string,
  focus?: string,
  maxChars = 900,
): string {
  const body = text.replace(/\r/g, "").trim();
  if (!body) return "";

  const wanted = focus?.trim() ? words(focus) : new Set<string>();
  if (wanted.size === 0) {
    return body.length <= maxChars ? body : `${body.slice(0, maxChars).trim()}…`;
  }

  const chunks = windows(body);
  let best: Window | null = null;
  for (const chunk of chunks) {
    const have = words(chunk.text);
    let hits = 0;
    for (const word of wanted) if (have.has(word)) hits += 1;
    // Normalise lightly so a long paragraph cannot win on volume alone.
    const score = hits / Math.sqrt(Math.max(1, have.size));
    if (!best || score > best.score) best = { ...chunk, score };
  }

  if (!best || best.score === 0) {
    return body.length <= maxChars ? body : `${body.slice(0, maxChars).trim()}…`;
  }

  const context = Math.max(0, Math.floor((maxChars - best.text.length) / 2));
  const start = Math.max(0, best.start - context);
  const end = Math.min(body.length, best.end + context);
  const slice = body.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < body.length ? "…" : ""}`;
}
