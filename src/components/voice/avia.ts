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
  "Right, switching gears. Full focus now, and we take it slowly.",
  "Okay — pens out, vibes off. Let's actually understand this one.",
  "Hold on, that's schoolwork. Full brain, no shortcuts. Walk me through where you are.",
  "Alright, I'm taking this one seriously. Give me your first thought and we build from there.",
  "Focus mode on. Hmm, let's break this into pieces you can actually hold.",
  "Right. Deep breath, clear head. We'll do this properly, one step at a time.",
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
  "Hey there! Welcome to your personal study sanctuary.\nReady to untangle some tricky concepts?\nWhat are we diving into first?",
  "So glad you dropped by! Let's make some magic happen.\nLet's turn that study stress into absolute clarity.\nShow me what you're working on!",
  "Standard rules don't apply here — welcome to Manthan!\nYou bring the curiosity, I'll bring the clarity.\nDrop your toughest question right here.",
  "Hello, brilliant mind — you made it.\nEvery concept gets easier the moment we break it down together.\nSo, what's on today's agenda?",
  "Look who showed up ready to learn!\nToday's the day that tricky topic finally clicks.\nWhere should we start?",
  "Welcome back to your study corner.\nYou've handled harder things than whatever's on your plate right now.\nTell me what we're solving first.",
  "Great to see you! Your study sanctuary awaits.\nNo problem is too big when we take it one clear step at a time.\nWhat are we exploring today?",
  "Hey you! The session officially starts now.\nConfusion doesn't stand a chance once we break it down together.\nGive me your toughest question — I'm ready.",
];

/** Rotates through greetings without ever repeating the previous one. */
export function pickGreeting(avoid?: string): string {
  const pool =
    avoid && AVIA_GREETINGS.length > 1
      ? AVIA_GREETINGS.filter((line) => line !== avoid)
      : AVIA_GREETINGS;
  return pool[Math.floor(Math.random() * pool.length)] ?? AVIA_GREETINGS[0];
}

/**
 * Backchannels — the short, human noises a person makes while listening.
 *
 * Spoken before the real answer on some turns, never twice in a row: they are
 * what separates a conversation from a chatbot reading out paragraphs. Kept
 * to a couple of syllables so they never delay an actual answer, and only
 * used once the student is already talking, never on a first message.
 */
export const AVIA_BACKCHANNELS = [
  "Mm-hm.",
  "Right, okay.",
  "Hmm — okay, let me think.",
  "Ah, got it.",
  "Mhm, so...",
  "Okay, okay.",
  "Hold on — yeah, I see it.",
  "Right.",
  "Hmm, yeah.",
  "Ah, that one. Okay.",
];

/** One backchannel, never the same one twice in a row. */
export function pickBackchannel(avoid?: string): string {
  const pool =
    avoid && AVIA_BACKCHANNELS.length > 1
      ? AVIA_BACKCHANNELS.filter((line) => line !== avoid)
      : AVIA_BACKCHANNELS;
  return pool[Math.floor(Math.random() * pool.length)] ?? AVIA_BACKCHANNELS[0];
}

/** One greeting, used for the very first turn of a fresh session. */
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
 * Pitch sits at 1.0 (natural) and the rate at 1.05 — brisk, energetic, peer
 * paced: not slow, not syrupy — with a small per-turn jitter around those
 * values so she never reads two answers with identical prosody. `cancel`
 * first so a new reply never queues behind an old one the student has already
 * moved past.
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
  // Base voice: natural pitch, brisk peer pace. Both are nudged per-turn by a
  // grain of randomness — identical prosody on every line is exactly what made
  // her sound synthesised. Long replies settle slightly slower and a touch
  // lower; short reactions stay quick and bright.
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
/* When the models are unreachable                                     */
/* ------------------------------------------------------------------ */

/**
 * Avia still speaks when the model chain is out of free capacity. She says so
 * in her own voice — warm, never robotic — and stays in whichever of her two
 * modes the student is in.
 */
export function fallbackReply(studying: boolean): string {
  return studying
    ? "Okay, deep breath — my study engine is out of free capacity for a moment, so I can't think this one through properly yet. Your question isn't going anywhere, and neither am I. Give it a minute and ask me again, and we'll break it down step by step."
    : "Hey, my brain is buffering for just a moment — everything behind me is catching its breath. Give it a minute and say that again? I'm not going anywhere.";
}
