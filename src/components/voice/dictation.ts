/**
 * Dictation — the listening half of every voice feature, in one place.
 *
 * The Web Speech API hands us a *growing list* of results, not a stream of new
 * words. Two bugs came out of treating that list as a stream:
 *
 *   - A phone ends and restarts the recogniser after almost every phrase, and
 *     each restart begins a fresh list at index 0 with the same sentence in
 *     it. Appending every list printed the sentence five or six times.
 *   - Interim results were appended to the finals, so the last few words were
 *     written twice while the student was still speaking.
 *
 * This module keeps one map of results per session, keyed by the engine's own
 * index, and folds results into a single string with an overlap-aware merge:
 * a sentence that begins with the words the transcript already ends with is
 * stitched, not repeated. Finals are committed by index, so a result delivered
 * twice overwrites rather than appends.
 *
 * On top of that:
 *
 *   - alternatives are scored against the vocabulary of the current question,
 *     so when the engine offers both "islands" and "eye lens", the one the
 *     topic supports wins;
 *   - `repairTerms` fixes near-miss words against that vocabulary, plus a
 *     small table of context-gated homophones ("islands" → "eye lens" only
 *     when the talk is about the eye);
 *   - `collapseRepeats` removes back-to-back repetitions that slip through as
 *     separate results ("lens lens lens lens").
 *
 * Vocabulary is only ever a hint. A word the topic does not support is left
 * exactly as heard — rewriting "islands" to "eye lens" in a geography answer
 * would be worse than the misrecognition.
 */

export type DictationStopReason = "silence" | "user" | "error" | "unsupported";

export interface DictationOptions {
  lang?: string;
  /** How long the room has to stay quiet before the take ends. */
  silenceMs?: number;
  /** Vocabulary for contextual biasing — a hint to the recogniser. */
  terms?: () => string[];
  /**
   * Words that may be repaired. Kept separate from `terms` on purpose: biasing
   * tolerates a broad vocabulary, but silently rewriting a word the student
   * actually said would be worse than the misrecognition.
   */
  repair?: () => string[];
  onText: (text: string) => void;
  onListening?: (listening: boolean) => void;
  onStop?: (reason: DictationStopReason, text: string) => void;
}

export interface Dictation {
  supported: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  isListening: () => boolean;
  /** Replace the text the next interim result builds on (the student typed). */
  setSeed: (text: string) => void;
}

/** Everyday school vocabulary — biased to, but never used to rewrite words. */
const STUDY_TERMS = [
  "lens", "eye lens", "convex lens", "concave lens", "retina", "cornea", "iris",
  "pupil", "myopia", "hypermetropia", "presbyopia", "refraction", "reflection",
  "focal length", "aperture", "prism", "dispersion", "scattering", "meniscus",
  "titration", "burette", "pipette", "indicator", "solute", "solvent", "solution",
  "oxidation", "reduction", "amphoteric", "electrolysis", "resistance", "resistivity",
  "ammeter", "voltmeter", "rheostat", "solenoid", "electromagnet", "induction",
  "photosynthesis", "respiration", "transpiration", "osmosis", "diffusion",
  "mitochondria", "chloroplast", "nucleus", "cytoplasm", "vacuole", "enzyme",
  "amylase", "pepsin", "trypsin", "bile", "villi", "alveoli", "nephron", "neuron",
  "hormone", "insulin", "thyroxine", "adrenaline", "reflex action", "synapse",
  "mitosis", "meiosis", "chromosome", "gene", "allele", "dominant", "recessive",
  "genotype", "phenotype", "heredity", "variation", "evolution", "speciation",
  "quadratic", "polynomial", "discriminant", "arithmetic progression", "tangent",
  "secant", "sine", "cosine", "trigonometric", "hypotenuse", "perpendicular",
  "circumference", "sector", "segment", "probability", "median", "mode",
  "nationalism", "satyagraha", "swaraj", "khilafat", "rowlatt", "partition",
  "federalism", "secularism", "democracy", "parliament", "judiciary", "franchise",
  "globalisation", "liberalisation", "privatisation", "urbanisation", "monsoon",
  "alluvial", "laterite", "biodiversity", "sustainable", "irrigation", "horticulture",
];

/**
 * Recogniser slips that are worth undoing. Keys are what the engine writes;
 * values are what was said. Applied only when the target word is part of the
 * current question's vocabulary, so a chat about islands stays about islands.
 */
const HOMOPHONES: Record<string, string> = {
  meniscus: "meniscus",
  maniscus: "meniscus",
  miniscus: "meniscus",
  burret: "burette",
  burett: "burette",
  buret: "burette",
  pipet: "pipette",
  pippet: "pipette",
  solonoid: "solenoid",
  rheostate: "rheostat",
  amiter: "ammeter",
  ammeter: "ammeter",
  satyagrah: "satyagraha",
  satyagra: "satyagraha",
  rowlett: "rowlatt",
  rawlatt: "rowlatt",
  khalifat: "khilafat",
  khilafath: "khilafat",
  phtosynthesis: "photosynthesis",
  photosyntesis: "photosynthesis",
  mitocondria: "mitochondria",
  chlorophyl: "chlorophyll",
  nefron: "nephron",
  myopiea: "myopia",
  hypermetropya: "hypermetropia",
  hipotenuse: "hypotenuse",
  discriminate: "discriminant",
};

/**
 * Whole-phrase repairs that need topic support. Each pair is applied only when
 * one of its hints appears in the vocabulary or in the words being repaired —
 * "islands" becomes "eye lens" in an optics answer and nowhere else.
 */
const CONTEXT_REPAIRS: {
  hints: string[];
  pairs: [string, string][];
}[] = [
  {
    hints: [
      "eye", "lens", "retina", "cornea", "pupil", "iris", "optic", "vision",
      "myopia", "hypermetropia", "presbyopia", "cataract", "accommodation",
      "focal", "refraction", "ciliary",
    ],
    pairs: [
      ["islands", "eye lens"],
      ["island", "eye lens"],
      ["ilands", "eye lens"],
      ["iland", "eye lens"],
      ["eye lands", "eye lens"],
      ["eye land", "eye lens"],
      ["is lens", "eye lens"],
      ["i land", "eye lens"],
      ["eye lens's", "eye lens"],
    ],
  },
  {
    hints: ["axis", "graph", "coordinate", "plot", "symmetry", "parabola", "vertex"],
    pairs: [
      ["x access", "x-axis"],
      ["y access", "y-axis"],
      ["excess", "x-axis"],
      ["ex axis", "x-axis"],
      ["why axis", "y-axis"],
    ],
  },
  {
    hints: ["triangle", "angle", "trigonometry", "sine", "cosine", "theta"],
    pairs: [
      ["sign theta", "sin θ"],
      ["sine theta", "sin θ"],
      ["sine theater", "sin θ"],
      ["sign theater", "sin θ"],
      ["cost theta", "cos θ"],
      ["because theta", "cos θ"],
      ["tan theater", "tan θ"],
    ],
  },
];

function normaliseWord(word: string): string {
  // Unicode-aware: a Hindi or Sanskrit term must survive normalisation, and
  // must never normalise to the empty string (which would make every word
  // look like a repeat of every other).
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function sameWords(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((word, index) => normaliseWord(word) === normaliseWord(b[index]));
}

function sameBlock(
  tokens: string[],
  a: number,
  b: number,
  size: number,
): boolean {
  for (let index = 0; index < size; index += 1) {
    if (normaliseWord(tokens[a + index]) !== normaliseWord(tokens[b + index])) {
      return false;
    }
  }
  return true;
}

/**
 * Collapse back-to-back repeats that a recogniser emits as separate results.
 *
 * A single word has to repeat three times before it is treated as a glitch
 * ("very very good" is real speech); a two-or-more-word block only twice
 * ("eye lens eye lens"). Punctuation and case are ignored for comparison and
 * the first copy is preserved.
 */
export function collapseRepeats(input: string): string {
  const tokens = words(input);
  const output: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    let best: { period: number; copies: number } | null = null;

    for (let period = 1; period <= Math.min(8, Math.floor((tokens.length - index) / 2)); period += 1) {
      let copies = 1;
      while (
        index + period * (copies + 1) <= tokens.length &&
        sameBlock(tokens, index, index + period * copies, period)
      ) {
        copies += 1;
      }
      // A long word said twice is almost always the recogniser repeating
      // itself; short words ("no no", "very very") can be real speech.
      const minimum =
        period === 1
          ? normaliseWord(tokens[index]).length >= 7
            ? 2
            : 3
          : 2;
      if (
        copies >= minimum &&
        (!best || copies * period > best.copies * best.period)
      ) {
        best = { period, copies };
      }
    }

    if (best) {
      output.push(...tokens.slice(index, index + best.period));
      index += best.period * best.copies;
    } else {
      output.push(tokens[index]);
      index += 1;
    }
  }

  return output.join(" ");
}

/**
 * Append a new chunk of transcript, stitching an overlap instead of repeating
 * it. A phone restarts the recogniser after each phrase and often re-reports
 * the phrase that just ended, so "the eye lens" followed by "eye lens focuses
 * light" must read as one sentence, not two.
 *
 * The overlap is capped at twenty words — longer than a phone's usual restart
 * echo — and requires whole-word agreement, so near matches are never stitched.
 */
export function mergeTranscript(base: string, addition: string): string {
  const left = words(base);
  const right = words(addition);
  if (left.length === 0) return right.join(" ");
  if (right.length === 0) return left.join(" ");

  const limit = Math.min(20, left.length, right.length);
  for (let size = limit; size >= 1; size -= 1) {
    if (
      sameWords(left.slice(left.length - size), right.slice(0, size))
    ) {
      return [...left, ...right.slice(size)].join(" ");
    }
  }
  return [...left, ...right].join(" ");
}

/** Consonant skeleton — "lense" and "lens" share one. */
function skeleton(word: string): string {
  return word.replace(/[aeiouy]/g, "");
}

/** Levenshtein with an early bail so a long word list stays cheap. */
function distance(a: string, b: string, ceiling: number): number {
  if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let lowest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      lowest = Math.min(lowest, current[j]);
    }
    if (lowest > ceiling) return ceiling + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Replace a phrase case-insensitively, keeping the rest of the text intact. */
function replacePhrase(input: string, from: string, to: string): string {
  const pattern = new RegExp(
    `(^|[^a-z0-9])(${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`,
    "gi",
  );
  return input.replace(pattern, (_match, lead: string) => `${lead}${to}`);
}

/**
 * Repair near-miss words against the vocabulary of the current question.
 *
 * Three passes, each conservative:
 *
 *   1. Context repairs — whole-phrase homophones with a topic gate, so "eye
 *      lens" is restored only while the conversation is about the eye.
 *   2. Per-word homophones from the table above, when the corrected word is
 *      part of the vocabulary.
 *   3. Skeleton and edit-distance matching for words of four letters or more,
 *      never touching inflected verbs.
 */
export function repairTerms(input: string, terms: string[]): string {
  const vocabulary = [...new Set(terms.map((term) => term.toLowerCase().trim()))].filter(
    (term) => term.length > 2,
  );

  let text = input;
  const context = `${vocabulary.join(" ")} ${text}`.toLowerCase();

  for (const group of CONTEXT_REPAIRS) {
    if (!group.hints.some((hint) => context.includes(hint))) continue;
    for (const [from, to] of group.pairs) {
      text = replacePhrase(text, from, to);
    }
  }

  if (vocabulary.length === 0) return text;

  const singleWords = new Set(
    vocabulary.flatMap((term) => term.split(/[\s-]+/)).filter((word) => word.length > 2),
  );
  const bySkeleton = new Map<string, string>();
  vocabulary.forEach((term) => {
    term
      .split(/[\s-]+/)
      .filter((word) => word.length >= 4)
      .forEach((word) => {
        const key = skeleton(word);
        if (key.length >= 3 && !bySkeleton.has(key)) bySkeleton.set(key, word);
      });
  });

  const repaired: string[] = [];

  words(text).forEach((raw) => {
    // Multi-word replacements above may have inserted a space or a symbol;
    // only plain words are examined here.
    const word = normaliseWord(raw);
    if (word.length < 3) {
      repaired.push(raw);
      return;
    }

    const homophone = HOMOPHONES[word];
    if (homophone) {
      const target = homophone.split(/[\s-]+/);
      const covered = target.some((part) => singleWords.has(part));
      if (covered) {
        repaired.push(homophone);
        return;
      }
    }

    if (singleWords.has(word) || word.length < 4) {
      repaired.push(raw);
      return;
    }

    const key = skeleton(word);
    const candidate = key.length >= 3 ? bySkeleton.get(key) : undefined;
    if (candidate && (key === skeleton(candidate) || distance(word, candidate, 2) <= 2)) {
      repaired.push(candidate);
      return;
    }

    // Do not rewrite an inflected form back to its root: "the light
    // reflecting off" must not become "the light reflection off".
    const near = vocabulary.find(
      (term) =>
        !term.includes(" ") &&
        term.length >= 4 &&
        distance(word, term, 2) <= 2 &&
        !["ing", "ed", "es", "s", "ly"].some(
          (suffix) => word.endsWith(suffix) && !term.endsWith(suffix),
        ),
    );
    repaired.push(near ?? raw);
  });

  return repaired.join(" ");
}

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A vocabulary flattened once per result event, so scoring stays cheap. */
interface VocabProfile {
  words: Set<string>;
  phrases: Set<string>;
}

function buildProfile(terms: string[]): VocabProfile {
  const profile: VocabProfile = { words: new Set(), phrases: new Set() };
  for (const term of terms) {
    const parts = words(term.toLowerCase())
      .map(normaliseWord)
      .filter(Boolean);
    if (parts.length === 0) continue;
    parts.forEach((part) => {
      if (part.length >= 3) profile.words.add(part);
    });
    for (let index = 0; index + 1 < parts.length; index += 1) {
      profile.phrases.add(`${parts[index]} ${parts[index + 1]}`);
    }
  }
  return profile;
}

/**
 * How well a candidate transcript fits the current question. Used to choose
 * between the recogniser's alternatives: given "islands" and "eye lens", the
 * optics answer scores the phrase that belongs.
 */
function vocabularyScore(text: string, profile: VocabProfile): number {
  const tokens = words(text.toLowerCase())
    .map(normaliseWord)
    .filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    if (profile.words.has(token)) score += 2;
  }
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    if (profile.phrases.has(`${tokens[index]} ${tokens[index + 1]}`)) score += 5;
  }
  return score;
}

interface SessionResult {
  text: string;
  final: boolean;
}

export function createDictation(options: DictationOptions): Dictation {
  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  let want = false;
  let active = false;
  let starting = false;
  let recognition: AviaSpeechRecognition | null = null;
  let committed = "";
  /** Results of the *current* recognition session, keyed by engine index. */
  let session = new Map<number, SessionResult>();
  let silenceTimer: number | null = null;
  let restartTimer: number | null = null;
  let finished = true;

  const silenceMs = options.silenceMs ?? 2600;

  function terms(): string[] {
    try {
      return options.terms?.() ?? [];
    } catch {
      return [];
    }
  }

  function repairList(): string[] {
    try {
      return options.repair?.() ?? terms();
    } catch {
      return terms();
    }
  }

  function orderedSession(includeInterim: boolean): string[] {
    return [...session.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, entry]) => includeInterim || entry.final)
      .map(([, entry]) => entry.text)
      .filter(Boolean);
  }

  function sessionText(includeInterim: boolean): string {
    return orderedSession(includeInterim).reduce(
      (merged, text) => mergeTranscript(merged, text),
      "",
    );
  }

  function transcript(): string {
    const raw = cleanWhitespace(
      mergeTranscript(committed, sessionText(true)),
    );
    if (!raw) return "";
    return repairTerms(collapseRepeats(raw), repairList());
  }

  function emit() {
    options.onText(transcript());
  }

  function clearSilence() {
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function clearRestart() {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function armSilence(delay = silenceMs) {
    clearSilence();
    silenceTimer = window.setTimeout(() => finish("silence"), delay);
  }

  /** Move this session's finals into the durable buffer, stitching any echo. */
  function commitSession() {
    const text = sessionText(false);
    if (text) committed = mergeTranscript(committed, text);
    session = new Map();
  }

  /** Best alternative for one result, by how well it fits the question. */
  function bestAlternative(result: AviaSpeechResult, profile: VocabProfile): string {
    let bestText = result?.[0]?.transcript ?? "";
    if (result.length <= 1) return bestText;

    let bestScore = -1;
    for (let index = 0; index < result.length; index += 1) {
      const candidate = result[index]?.transcript ?? "";
      if (!candidate.trim()) continue;
      const score = vocabularyScore(candidate, profile);
      // Alternative 0 is the engine's own pick, so a tie must not move away
      // from it; `>` keeps the earlier alternative on equal scores.
      if (score > bestScore) {
        bestScore = score;
        bestText = candidate;
      }
    }
    return bestText;
  }

  function bindPhrases(target: AviaSpeechRecognition) {
    const Phrase = window.SpeechRecognitionPhrase;
    const list = terms()
      .map((term) => term.trim())
      .filter((term) => term.length > 1)
      .slice(0, 40);
    if (!Phrase || list.length === 0) return;
    try {
      target.phrases = list.map((term) => new Phrase(term, 3));
    } catch {
      /* Experimental property: ignore devices that reject it. */
    }
  }

  function stopEngine() {
    const current = recognition;
    recognition = null;
    active = false;
    starting = false;
    try {
      current?.stop();
    } catch {
      /* Already stopped. */
    }
  }

  function scheduleRestart() {
    clearRestart();
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      if (want) startSession();
    }, 260);
  }

  function finish(reason: DictationStopReason) {
    if (finished) return;
    finished = true;
    want = false;
    clearSilence();
    clearRestart();
    // A tap on the mic or a quiet room means "that is what I said": keep the
    // pending hypothesis too. An error keeps only what the engine settled.
    if (reason === "user" || reason === "silence") {
      session.forEach((entry, index) => session.set(index, { ...entry, final: true }));
    }
    commitSession();
    stopEngine();
    options.onListening?.(false);
    emit();
    options.onStop?.(reason, transcript());
  }

  function handleError(error: string) {
    const fatal =
      error === "not-allowed" ||
      error === "service-not-allowed" ||
      error === "audio-capture" ||
      error === "language-not-supported";
    if (fatal) {
      finish("error");
      return;
    }
    // "no-speech" and "aborted" are routine on phones; whatever was heard is
    // kept and listening either restarts or ends on the silence timer.
    if (!active && !starting && want) scheduleRestart();
  }

  function startSession() {
    if (!want || active || starting) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      finish("unsupported");
      return;
    }

    const next = new Ctor();
    next.lang = options.lang ?? "en-IN";
    next.continuous = true;
    next.interimResults = true;
    // Five alternatives are scored against the question's vocabulary — the
    // only reliable way to prefer "eye lens" when the engine also offers
    // "islands".
    next.maxAlternatives = 5;
    bindPhrases(next);

    starting = true;

    next.onstart = () => {
      active = true;
      starting = false;
      options.onListening?.(true);
      // With no speech at all the result handler never fires, so arm here too.
      armSilence(silenceMs * 2);
    };

    next.onresult = (event) => {
      // A stopped session can still deliver one last event on Android; its
      // indices belong to the old list, not the new one.
      if (recognition !== next) return;
      const profile = buildProfile([...terms(), ...repairList()]);
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const text = bestAlternative(result, profile).trim();
        if (!text) continue;
        const previous = session.get(index);
        if (previous?.final && !result.isFinal) {
          // A late interim at a final index is the engine rewinding; the
          // settled words win.
          continue;
        }
        if (
          previous?.final &&
          !sameWords(words(previous.text), words(text))
        ) {
          // Some devices reset their result list without firing `end`, then
          // report the next sentence at index 0. Keep both by giving the new
          // words the next index instead of overwriting the settled ones.
          const nextIndex =
            Math.max(...[...session.keys()], -1) + 1;
          session.set(nextIndex, { text, final: result.isFinal });
          continue;
        }
        if (previous && !result.isFinal && text.length < previous.text.length) {
          // Hypotheses may shrink while they are re-scored; keep the words.
          continue;
        }
        session.set(index, { text, final: result.isFinal });
      }

      emit();
      armSilence();
    };

    next.onerror = (event) => handleError(event.error);

    next.onend = () => {
      active = false;
      starting = false;
      if (recognition !== next) return;
      recognition = null;
      // The session is over, so whatever it heard is all it will produce:
      // settle the finals *and* the last hypothesis. Phones end a session
      // mid-sentence, and dropping the hypothesis would lose those words.
      if (session.size > 0) {
        session.forEach((entry, index) => session.set(index, { ...entry, final: true }));
        commitSession();
        emit();
      }
      // A phone ends the session after almost every phrase. Restart without
      // dropping anything already heard; if the room really is quiet, the
      // silence timer armed at start still ends the take.
      if (want) scheduleRestart();
      else options.onListening?.(false);
    };

    // Anything left in the map never reached `onend` as a final. Keep it — a
    // phone can end a session mid-sentence — by settling it before the new
    // index space begins; the overlap merge prevents an echo.
    if (session.size > 0) {
      session.forEach((entry, index) => session.set(index, { ...entry, final: true }));
      commitSession();
      emit();
    }

    recognition = next;
    try {
      next.start();
    } catch {
      recognition = null;
      starting = false;
      if (want) scheduleRestart();
    }
  }

  return {
    supported,
    isListening: () => want,
    setSeed: (text: string) => {
      committed = cleanWhitespace(text);
      session = new Map();
    },
    start: () => {
      if (!supported) {
        options.onStop?.("unsupported", "");
        return;
      }
      if (want) return;
      want = true;
      finished = false;
      committed = "";
      session = new Map();
      startSession();
    },
    stop: () => finish("user"),
    abort: () => {
      finished = true;
      want = false;
      clearSilence();
      clearRestart();
      committed = "";
      session = new Map();
      stopEngine();
      options.onListening?.(false);
    },
  };
}

/** The vocabulary the exam-style dictations bias toward. */
export function studyTerms(): string[] {
  return STUDY_TERMS;
}
