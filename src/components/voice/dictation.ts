/**
 * Dictation — the listening half of every voice feature, in one place.
 *
 * The Web Speech API hands us a *growing list* of results, not a stream of new
 * words. The old handlers concatenated the whole list on every event, which is
 * why a phone could show the same sentence five or six times: Android ends and
 * restarts the recogniser constantly, and each restart begins a fresh list with
 * the same indices. Three rules fix that:
 *
 *   1. Final results are stored **by index**, so a result delivered twice
 *      overwrites instead of appending, and re-emitted duplicates are dropped.
 *   2. Interim text is rebuilt from scratch on every event — never accumulated.
 *   3. When the browser ends a session on its own (mobile does this after every
 *      phrase), the finals are committed once and a new session starts, so the
 *      student can keep talking without tapping the mic again.
 *
 * On top of that, `collapseRepeats` removes genuine back-to-back repetitions
 * that slip through as separate results ("lens lens lens lens"), and
 * `repairTerms` fixes near-miss words against the vocabulary of the current
 * question ("islands" → "eye lens"), which is the other complaint: a recogniser
 * that has never heard of "eye lens" hears "islands" every time.
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
   * tolerates a broad vocabulary, but silently rewriting "islands" to "eye
   * lens" every time somebody mentions Lakshadweep would be worse than the
   * misrecognition.
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
 * Recogniser homophones that are worth undoing when the topic makes it
 * unambiguous. Keys are what the engine writes; values are what was said.
 */
const HOMOPHONES: Record<string, string> = {
  islands: "eye lens",
  island: "eye lens",
  iland: "eye lens",
  ilands: "eye lens",
  meniscus: "meniscus",
  maniscus: "meniscus",
  miniscus: "meniscus",
  burret: "burette",
  burett: "burette",
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
};

function normaliseWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
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
  const tokens = input.split(/\s+/).filter(Boolean);
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

/**
 * Repair near-miss words against the vocabulary of the current question.
 *
 * Only words that are *close* to a term the student is demonstrably talking
 * about are touched: an exact homophone from the table above, or a word whose
 * consonant skeleton matches a term of at least five letters. Anything else is
 * left exactly as heard.
 */
export function repairTerms(input: string, terms: string[]): string {
  const vocabulary = [...new Set(terms.map((term) => term.toLowerCase().trim()))].filter(
    (term) => term.length > 2,
  );
  if (vocabulary.length === 0) return input;

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

  const words = input.split(/\s+/).filter(Boolean);
  const repaired: string[] = [];

  words.forEach((raw) => {
    const word = normaliseWord(raw);
    if (word.length < 3) {
      repaired.push(raw);
      return;
    }

    const homophone = HOMOPHONES[word];
    if (homophone) {
      const target = homophone.split(/\s+/);
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

/**
 * Drop finals the engine re-delivered. Android can report the same sentence at
 * a new index after a restart; those are duplicates, not new speech.
 */
function repeatKind(previous: string, next: string): "drop" | "replace" | "keep" {
  const a = cleanWhitespace(previous).toLowerCase();
  const b = cleanWhitespace(next).toLowerCase();
  if (!a || !b) return "keep";
  if (a === b) return "drop";
  // Only treat a prefix as a re-delivery once it is a real clause; short
  // answers like "yes" followed by "yes it works" are two utterances.
  const shortest = Math.min(a.length, b.length);
  if (shortest >= 20 && b.startsWith(a)) return "replace";
  if (shortest >= 20 && a.startsWith(b)) return "drop";
  return "keep";
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
  let finals = new Map<number, string>();
  let interim = "";
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

  function orderedFinals(): string[] {
    return [...finals.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, text]) => text)
      .filter(Boolean);
  }

  function transcript(): string {
    const raw = cleanWhitespace(
      [committed, ...orderedFinals(), interim].filter(Boolean).join(" "),
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

  /** Move this session's finals into the durable buffer. */
  function commitSession() {
    const text = cleanWhitespace(orderedFinals().join(" "));
    if (text) {
      committed = cleanWhitespace([committed, text].filter(Boolean).join(" "));
    }
    finals = new Map();
    interim = "";
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
    next.maxAlternatives = 1;
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
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (!result?.isFinal) continue;
        const previous = finals.get(index) ?? "";
        if (text.trim().length >= previous.trim().length) finals.set(index, text);
      }

      // Rebuild the pending text from scratch — it is a hypothesis, and old
      // hypotheses must not survive into the final transcript.
      interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) interim += ` ${result?.[0]?.transcript ?? ""}`;
      }
      interim = cleanWhitespace(interim);

      // A re-delivered sentence arrives at the next free index.
      const ordered = [...finals.entries()].sort((a, b) => a[0] - b[0]);
      const deduped = new Map<number, string>();
      let last = "";
      let lastIndex = -1;
      for (const [index, text] of ordered) {
        const kind = repeatKind(last, text);
        if (kind === "drop") continue;
        if (kind === "replace") deduped.delete(lastIndex);
        deduped.set(index, text);
        last = text;
        lastIndex = index;
      }
      finals = deduped;

      emit();
      armSilence();
    };

    next.onerror = (event) => handleError(event.error);

    next.onend = () => {
      active = false;
      starting = false;
      if (recognition !== next) return;
      recognition = null;
      const heard = cleanWhitespace(
        [committed, ...orderedFinals()].filter(Boolean).join(" "),
      );
      if (heard) {
        clearSilence();
        commitSession();
        emit();
      }
      // A phone ends the session after almost every phrase. Restart without
      // dropping anything already heard; if the room really is quiet, the
      // silence timer armed at start still ends the take.
      if (want) scheduleRestart();
      else options.onListening?.(false);
    };

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
      finals = new Map();
      interim = "";
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
      finals = new Map();
      interim = "";
      startSession();
    },
    stop: () => finish("user"),
    abort: () => {
      finished = true;
      want = false;
      clearSilence();
      clearRestart();
      committed = "";
      finals = new Map();
      interim = "";
      stopEngine();
      options.onListening?.(false);
    },
  };
}

/** The vocabulary the exam-style dictations bias toward. */
export function studyTerms(): string[] {
  return STUDY_TERMS;
}
