/**
 * Avia — the browser-native voice companion.
 *
 * Everything here runs on the client with zero API keys: listening uses the
 * Web Speech API (SpeechRecognition) and speaking uses window.speechSynthesis
 * with a hand-picked, natural-sounding English voice.
 *
 * The Study Switch is enforced twice on purpose. The server prompt owns the
 * words Avia is allowed to use; this module owns the moment — a keyword
 * detector fires the instant an academic question arrives, so the switch line
 * is spoken before the reply has even been written.
 */

/**
 * The Study Switch, in Avia's own words.
 *
 * The canonical line stays first and exact — it is the sentence the product
 * promises. The rest exist because a companion who greets every single
 * question with the identical announcement stops sounding like a person and
 * starts sounding like a broken prompt. The widget speaks exactly one of
 * these, once per session, the moment the switch first flips.
 */
export const AVIA_SWITCH_LINE =
  "Alright, jokes over. Activating 100% brain power. Let's lock in.";

export const AVIA_SWITCH_LINES = [
  AVIA_SWITCH_LINE,
  "Okay, brain is on. Notes down, vibes parked. Let's work it out together.",
  "Locked in. I'm not handing you the answer, but I will get you all the way to it.",
  "Serious mode. One step at a time, and you do the thinking with me.",
];

/** Rotates through the switch lines without ever repeating the previous one. */
export function pickSwitchLine(avoid?: string): string {
  const pool =
    avoid && AVIA_SWITCH_LINES.length > 1
      ? AVIA_SWITCH_LINES.filter((line) => line !== avoid)
      : AVIA_SWITCH_LINES;
  return pool[Math.floor(Math.random() * pool.length)] ?? AVIA_SWITCH_LINE;
}

export const AVIA_GREETINGS = [
  "Yo, I'm Avia. Ask me literally anything, or hit the mic and just talk. I'll keep it real until something school-shaped shows up.",
  "Hey, Avia here. Talk to me like a friend down the corridor — and when work shows up, I switch on properly.",
  "I'm Avia. Warm up with whatever, then throw me a topic and watch me get serious.",
  "Avia, reporting in. Free form chat, or full study mode — your call.",
];

export function pickGreeting(avoid?: string): string {
  const pool =
    avoid && AVIA_GREETINGS.length > 1
      ? AVIA_GREETINGS.filter((line) => line !== avoid)
      : AVIA_GREETINGS;
  return pool[Math.floor(Math.random() * pool.length)] ?? AVIA_GREETING;
}

export const AVIA_GREETING = AVIA_GREETINGS[0];

/* ------------------------------------------------------------------ */
/* The Study Switch detector                                           */
/* ------------------------------------------------------------------ */

/** Subjects, chapters and exam words that mean "this is schoolwork". */
const STUDY_SUBJECT =
  /\b(physics|chemistry|biology|maths?|mathematics|algebra|geometry|trigonometry|calculus|statistics|probability|science|history|civics|geography|economics|accountancy|grammar|literature|poem|poetry|novel|english|hindi|sanskrit|computer science|programming|python|java|javascript|algorithm|cell|organelle|mitochondria|photosynthesis|respiration|mitosis|meiosis|genetics|dna|protein|enzyme|atom|molecule|reaction|periodic table|chemical|organic|titration|mole|acid|base|salt|equation|formula|derivative|integral|logarithm|polynomial|quadratic|matrix|vector|theorem|trigonometric|thermodynamics|optics|lens|mirror|electricity|circuit|voltage|current|magnet|motion|newton|velocity|acceleration|momentum|kinematics|syllabus|revision|exam|homework|assignment|viva|practical|boards?|cbse|icse|neet|jee|upsc)\b/i;

/** "Teach me", "explain", "solve" — an academic ask even without a subject word. */
const ACADEMIC_ASK =
  /\b(explain|define|derive|prove|solve|calculate|compute|evaluate|what is|what's|whats|why does|why is|how does|how do i|describe|summarise|summarize|state the|difference between|help me understand|teach me|walk me through|step by step|notes on|meaning of|give an example|work out)\b/i;

/** A literal expression — "3x + 5 = 20" is never banter. */
const EQUATION = /\d\s*(x|y|z|\^|\+|-|\*|\/|=)/i;

/** A message that opens with a study verb ("Explain osmosis.") is schoolwork. */
const STUDY_VERB_OPENER =
  /^\s*(explain|define|solve|derive|prove|calculate|compute|evaluate|summari[sz]e|describe|state|trace|balance|differentiate|integrate)\b/i;

/** "How do plants make food" — a question that opens with a question word. */
const QUESTION_OPENER =
  /^\s*(what|why|how|which|where|when|who|whose|is|are|does|do|can|could|would|should)\b/i;

/**
 * Is this message schoolwork?
 *
 * Deliberately biased toward yes: falsely locking in is a small annoyance,
 * while treating a real question as banter is the failure the Study Switch
 * exists to prevent.
 */
export function detectStudyTopic(text: string): boolean {
  const message = text.trim();
  if (message.length < 3) return false;
  if (EQUATION.test(message)) return true;
  if (STUDY_VERB_OPENER.test(message)) return true;
  if (STUDY_SUBJECT.test(message)) return true;
  const words = message.split(/\s+/).length;
  if (ACADEMIC_ASK.test(message) && words >= 4) return true;
  if (QUESTION_OPENER.test(message) && words >= 4) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Speaking                                                           */
/* ------------------------------------------------------------------ */

/**
 * Which voice Avia uses.
 *
 * Ranked, not first-match: the device list varies wildly (and low-quality
 * "novelty" voices sit right next to the good ones), so the named naturals win
 * outright, then anything the platform flags as premium, enhanced or neural,
 * then Google's voices, then a plain US English fallback.
 */
export function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (name.includes("samantha")) score += 120;
  if (name.includes("google us english")) score += 110;
  if (/\b(premium|enhanced|natural|neural|siri)\b/.test(name)) score += 80;
  if (name.includes("google")) score += 40;
  if (name.includes("microsoft")) score += 15;
  if (/^en[-_]us$/i.test(voice.lang)) score += 25;
  else if (/^en[-_]/i.test(voice.lang)) score += 15;
  // Reject the obvious novelty / low-quality entries outright.
  if (/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|zarvox|wobble)\b/.test(name)) {
    score -= 200;
  }
  if (voice.localService) score += 3;
  return score;
}

/** The best available English voice, or null to let the device decide. */
export function pickAviaVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  const pool = english.length > 0 ? english : voices;
  const ranked = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] ?? null;
}

/** Speech synthesis reads symbols out loud; strip anything that is not prose. */
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu,
      "",
    )
    .replace(/[*_`#>~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read a line aloud.
 *
 * Pitch stays at 1.0 (natural) and the rate at 1.05 — brisk, energetic, peer
 * paced: not slow, not syrupy. `cancel` first so a new reply never queues
 * behind an old one the student has already moved past.
 */
export function speakText(
  text: string,
  voice: SpeechSynthesisVoice | null,
  onDone?: () => void,
  interrupt = true,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.();
    return;
  }
  const clean = sanitizeForSpeech(text);
  if (!clean) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.pitch = 1.0;
  utterance.rate = 1.05;
  utterance.volume = 1;
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  if (onDone) {
    utterance.onend = () => onDone();
    utterance.onerror = () => onDone();
  }
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

/* ------------------------------------------------------------------ */
/* When the models are unreachable                                     */
/* ------------------------------------------------------------------ */

/**
 * Avia still speaks when the model chain is out of free capacity. She says so
 * in her own voice rather than failing silently — and stays in whichever of
 * her two modes the student is in.
 */
export function fallbackReply(studying: boolean): string {
  return studying
    ? "My study engine is out of free capacity right now, so I can't think properly yet. Your question is safe with me. Give it a minute and hit me again, and we'll finish it step by step."
    : "Bruh, my brain is buffering. Every model behind me is slammed for a moment. Give it a minute and say that again.";
}
