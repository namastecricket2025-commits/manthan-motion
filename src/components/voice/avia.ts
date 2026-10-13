/**
 * Avia — the browser-native voice companion.
 *
 * Everything here runs on the client with zero API keys: listening uses the
 * Web Speech API (SpeechRecognition) and speaking uses window.speechSynthesis
 * with a hand-picked, natural-sounding English voice.
 *
 * There are no scripted interjections. Avia used to announce a "Study Switch"
 * before answering schoolwork and drop in filler noises like "mm-hm"; both made
 * her sound like a bot reading a script. The only fixed lines left in this file
 * are the short greeting and the honest out-of-capacity notice — everything the
 * student hears mid-conversation is written by the model (see convex/ai.ts).
 */

export const AVIA_GREETINGS = [
  "Hey — what are we working on?",
  "Hi. What can I help you with?",
  "Hey, what's the question?",
  "Hi there. What are you studying today?",
  "Hey. What do you want to go through?",
  "What are we looking at today?",
];

/** Rotates through greetings without ever repeating the previous one. */
export function pickGreeting(avoid?: string): string {
  const pool =
    avoid && AVIA_GREETINGS.length > 1
      ? AVIA_GREETINGS.filter((line) => line !== avoid)
      : AVIA_GREETINGS;
  return pool[Math.floor(Math.random() * pool.length)] ?? AVIA_GREETINGS[0];
}

/** One greeting, used for the very first turn of a fresh session. */
export const AVIA_GREETING = AVIA_GREETINGS[0];

/* ------------------------------------------------------------------ */
/* Academic-question detector                                          */
/* ------------------------------------------------------------------ */

/** Subjects, chapters and exam words that mean "this is schoolwork". */
const STUDY_SUBJECT =
  /\b(physics|chemistry|biology|maths?|mathematics|algebra|geometry|trigonometry|calculus|statistics|probability|science|history|civics|geography|economics|accountancy|grammar|literature|poem|poetry|novel|english|hindi|sanskrit|computer science|programming|python|java|javascript|algorithm|cell|organelle|mitochondria|photosynthesis|respiration|mitosis|meiosis|genetics|dna|protein|enzyme|atom|molecule|reaction|periodic table|chemical|organic|titration|mole|acid|base|salt|equation|formula|derivative|integral|logarithm|polynomial|quadratic|matrix|vector|theorem|trigonometric|thermodynamics|optics|lens|mirror|electricity|circuit|voltage|current|magnet|motion|newton|velocity|acceleration|momentum|kinematics|syllabus|revision|exam|homework|assignment|viva|practical|boards?|cbse|icse|neet|jee|upsc)\b/i;

/** "Teach me", "explain", "solve" — an academic ask even without a subject word. */
const ACADEMIC_ASK =
  /\b(explain|define|derive|prove|solve|calculate|compute|evaluate|what is|what's|whats|why does|why is|how does|how do i|describe|summarise|summarize|state the|difference between|help me understand|teach me|walk me through|step by step|notes on|meaning of|give an example|work out)\b/i;

/** A literal expression — "3x + 5 = 20" is never casual chat. */
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
 * Used only to bias the reply toward tutoring mode — nothing is announced on
 * the device. Deliberately biased toward yes: answering a casual question with
 * worked steps is a small annoyance, while answering a real question casually
 * is the failure this guards against.
 */
export function detectStudyTopic(text: string): boolean {
  const message = text.trim();
  if (message.length < 3) return false;
  // "Who made you?" / "who founded Manthan" satisfy the question-opener rule
  // below, but they are questions about Avia herself — forcing her into
  // tutoring mode to answer them would be nonsense.
  if (isIdentityAsk(message)) return false;
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
 * Pitch sits at 1.0 (natural) and the rate at 1.05 — normal conversational
 * pace, not slow and not syrupy — with a small per-turn jitter around those
 * values so she never reads two answers with identical prosody. `cancel` first
 * so a new reply never queues behind an old one the student has moved past.
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
  // Base voice: natural pitch, conversational pace. Both are nudged per-turn by
  // a grain of randomness — identical prosody on every line is exactly what
  // makes a synthesiser sound synthesised. Long replies settle slightly slower
  // and a touch lower; short ones stay quick.
  const long = clean.length > 220;
  const grain = (spread: number) => (Math.random() * 2 - 1) * spread;
  utterance.pitch = Number(
    Math.min(1.25, Math.max(0.85, (long ? 0.99 : 1.02) + grain(0.03))).toFixed(3),
  );
  utterance.rate = Number(
    Math.min(1.2, Math.max(0.94, (long ? 1.02 : 1.08) + grain(0.04))).toFixed(3),
  );
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
/* Identity & origin                                                   */
/* ------------------------------------------------------------------ */

/**
 * The founder's name, in one place.
 *
 * The server prompt owns what Avia says about herself in a normal turn; this
 * constant exists so the offline path gives the *same* credit instead of a
 * generic apology. Keep the two in step — see AVIA_SYSTEM in convex/ai.ts.
 */
export const AVIA_FOUNDER = "Luv Moond";

/**
 * A question about who made Avia, who founded Manthan, or who is behind it.
 *
 * Deliberately narrow — it names the founder or asks who made/built/owns her —
 * so an ordinary study question can never be mistaken for a credit request.
 * Only consulted when the model chain is unreachable, where the alternative is
 * saying nothing about her maker at all.
 */
const IDENTITY_ASK =
  /\b(who\s+(made|created|built|designed|owns|runs|is\s+behind)\s+(you|this|manthan)|who'?s\s+your\s+(founder|creator|maker|owner|boss|developer)|who\s+is\s+your\s+(founder|creator|maker|owner|boss|developer)|who\s+(is|was)\s+luv\s+moond|who\s+founded\s+(manthan|this|the\s+app)|who\s+is\s+the\s+founder|who\s+(should|do)\s+i\s+thank|who\s+made\s+manthan)\b/i;

/** Is the student asking who made her? */
export function isIdentityAsk(text: string): boolean {
  return IDENTITY_ASK.test(text);
}

/**
 * Who made Avia, in her own voice.
 *
 * Spoken only when the models cannot answer, so the credit survives an outage.
 * It states the two facts the product stands behind — Luv Moond founded and
 * built Manthan, and Avia is part of it — and invents nothing further.
 */
export function identityReply(): string {
  return (
    `${AVIA_FOUNDER} is the founder who built Manthan, and the person who made me. ` +
    "What are we working on?"
  );
}

/* ------------------------------------------------------------------ */
/* When the models are unreachable                                     */
/* ------------------------------------------------------------------ */

/**
 * Avia still speaks when the model chain is out of free capacity, and says so
 * plainly — one honest line, no performance.
 */
export function fallbackReply(studying: boolean): string {
  return studying
    ? "I'm out of capacity for a minute, so I can't work this through properly yet. Ask me again shortly."
    : "I'm briefly out of capacity — give me a minute and ask again.";
}
