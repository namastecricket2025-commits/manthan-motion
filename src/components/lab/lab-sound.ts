/** Tiny WebAudio SFX helper — quiet, tasteful, no assets. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function isSoundEnabled() {
  return enabled;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new AudioContext();
  } catch {
    return null;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.06);
}

export const sfx = {
  /** Burette valve drip. */
  drip: () => tone(950, 0.06, "sine", 0.045),
  /** DNA nucleotide snap. */
  snap: () => {
    tone(520, 0.09, "triangle", 0.11);
    tone(1040, 0.12, "sine", 0.07, 0.03);
  },
  /** Wrong snap — low buzz. */
  buzz: () => {
    tone(170, 0.16, "square", 0.05);
  },
  /** Heartbeat lub-dub. */
  thump: () => {
    tone(78, 0.12, "sine", 0.2);
    tone(56, 0.16, "sine", 0.11, 0.16);
  },
  /** Reaction chamber ignition. */
  whoosh: () => {
    tone(160, 0.34, "sawtooth", 0.045);
    tone(220, 0.3, "triangle", 0.05, 0.05);
  },
  /** Result pop. */
  pop: () => {
    tone(300, 0.1, "square", 0.055);
    tone(620, 0.13, "sine", 0.05, 0.02);
  },
  /** Valve stopcock click. */
  click: () => tone(1400, 0.04, "sine", 0.035),
};