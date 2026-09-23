import { api } from "@/convex/_generated/api";
import {
  AVIA_GREETING,
  AVIA_SWITCH_LINE,
  detectStudyTopic,
  fallbackReply,
  pickAviaVoice,
  speakText,
  stopSpeaking,
} from "@/components/voice/avia";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Brain,
  Mic,
  MicOff,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./avia.css";

/**
 * Avia — the floating voice companion.
 *
 * Bottom right on every page. Listening uses the browser's own Web Speech API
 * and speaking uses window.speechSynthesis, so the whole widget runs with no
 * API keys and no cost. The reply itself comes from Manthan's model chain with
 * Avia's personality prompt (see convex/ai.ts); if that chain is out of free
 * capacity she says so in character instead of failing silently.
 */

interface Turn {
  id: number;
  from: "avia" | "student";
  text: string;
}

const PROMPTS = [
  "Yo, how's it going",
  "Explain photosynthesis",
  "Solve 2x + 5 = 17",
  "Quiz me on Newton's laws",
];

export function AviaWidget() {
  const askAvia = useAction(api.ai.aviaReply);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [studying, setStudying] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel] = useState("device voice");
  const [turns, setTurns] = useState<Turn[]>([
    { id: 0, from: "avia", text: AVIA_GREETING },
  ]);

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const queuedRef = useRef(0);
  const greetedRef = useRef(false);
  const openRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  turnsRef.current = turns;
  openRef.current = open;

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  /* ---------------- voice selection ---------------- */

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    const load = () => {
      const picked = pickAviaVoice(synth.getVoices());
      voiceRef.current = picked;
      // Named naturals first, then "premium"/"enhanced"/"neural" entries, then
      // any English voice the device offers.
      setVoiceLabel(picked ? picked.name.replace(/^(Microsoft|Google)\s+/i, "") : "device voice");
    };

    load();
    synth.addEventListener?.("voiceschanged", load);
    // Safari populates the list late and fires nothing when it does.
    const late = window.setTimeout(load, 800);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(late);
    };
  }, []);

  /* ---------------- speaking ---------------- */

  const say = useCallback((text: string, interrupt = true, onDone?: () => void) => {
    queuedRef.current += 1;
    setSpeaking(true);
    speakText(
      text,
      voiceRef.current,
      () => {
        queuedRef.current = Math.max(0, queuedRef.current - 1);
        if (queuedRef.current === 0) setSpeaking(false);
        onDone?.();
      },
      interrupt,
    );
  }, []);

  /* ---------------- conversation ---------------- */

  const addTurn = useCallback((from: Turn["from"], text: string) => {
    setTurns((current) => [...current, { id: idRef.current++, from, text }]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || thinking) return;

      addTurn("student", message);
      setNote(null);

      // The Study Switch fires here, before the round trip, so the line is
      // spoken the instant the academic question lands.
      const academic = detectStudyTopic(message);
      const nextStudying = studying || academic;
      if (academic && !studying) {
        setStudying(true);
        say(AVIA_SWITCH_LINE);
      }

      setThinking(true);
      const history = turnsRef.current.slice(-8).map((turn) => ({
        role: (turn.from === "student" ? "student" : "avia") as "student" | "avia",
        text: turn.text,
      }));

      try {
        const result = await askAvia({ message, history, studying: nextStudying });
        addTurn("avia", result.reply);
        if (result.mode === "tutoring" || nextStudying) setStudying(true);
        say(result.reply, false);
      } catch {
        const reply = fallbackReply(nextStudying);
        addTurn("avia", reply);
        say(reply, false);
      } finally {
        setThinking(false);
      }
    },
    [addTurn, askAvia, say, studying, thinking],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  /* ---------------- listening ---------------- */

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setNote(
        "This browser can't listen in — Chrome, Edge and Safari can. You can still type to me.",
      );
      return;
    }
    if (recognitionRef.current) {
      stopListening();
      return;
    }

    stopSpeaking();
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setNote(null);
    };
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex] ?? event.results[0];
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) void sendRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      setNote(
        event.error === "not-allowed"
          ? "I need microphone permission to hear you. Allow it in the address bar and try again."
          : "I didn't catch that. Give the mic another tap and speak clearly.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [stopListening]);

  /* ---------------- lifecycle ---------------- */

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, thinking, note]);

  function openWidget() {
    setOpen(true);
    if (!greetedRef.current) {
      // First click: Avia introduces herself out loud, then the mic opens on
      // its own so the student can simply start talking.
      greetedRef.current = true;
      say(AVIA_GREETING, true, () => {
        if (openRef.current) startListening();
      });
    } else {
      startListening();
    }
  }

  function closeWidget() {
    stopListening();
    stopSpeaking();
    queuedRef.current = 0;
    setSpeaking(false);
    setOpen(false);
  }

  const statusLabel = listening
    ? "Listening"
    : thinking
      ? "Thinking"
      : speaking
        ? "Speaking"
        : "Tap the mic and talk";

  return (
    <div className="avia-root">
      <AnimatePresence>
        {open && (
          <motion.section
            key="avia-panel"
            className="avia-panel"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
            aria-label="Avia voice tutor"
          >
            <header className="avia-head">
              <span className="avia-dot" />
              <div className="min-w-0 flex-1">
                <p className="avia-name">Avia</p>
                <p className="avia-sub truncate">
                  {voiceLabel} · pitch 1.0 · rate 1.05
                </p>
              </div>
              <span className="avia-mode">
                {studying ? (
                  <>
                    <Brain className="h-3 w-3" />
                    Locked in
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Banter
                  </>
                )}
              </span>
              <button
                type="button"
                aria-label="Close Avia"
                className="avia-icon-btn"
                onClick={closeWidget}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={logRef} className="avia-log">
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                  className={
                    "avia-bubble " +
                    (turn.from === "student"
                      ? "avia-bubble--student"
                      : "avia-bubble--avia")
                  }
                >
                  {turn.text}
                </motion.div>
              ))}
              {thinking && (
                <div className="avia-bubble avia-bubble--avia text-text-dim">
                  Avia is thinking…
                </div>
              )}
            </div>

            <div className="avia-status">
              {speaking || listening ? (
                <span className="avia-status__bar" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span>{statusLabel}</span>
              {studying && (
                <button
                  type="button"
                  onClick={() => {
                    setStudying(false);
                    setNote("Back to banter. Say the word when you want to lock in again.");
                  }}
                  className="ml-auto text-[11px] font-medium text-text-dim underline-offset-2 hover:text-foreground hover:underline"
                >
                  Back to banter
                </button>
              )}
            </div>

            {note && <p className="avia-note">{note}</p>}

            {turns.length <= 1 && (
              <div className="avia-chips">
                {PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="avia-chip"
                    onClick={() => void sendRef.current(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              className="avia-foot"
              onSubmit={(event) => {
                event.preventDefault();
                const value = draft;
                setDraft("");
                void sendRef.current(value);
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={supported ? "Or type to Avia…" : "Type to Avia…"}
                className="avia-input"
                aria-label="Type a message to Avia"
              />
              <button
                type="button"
                onClick={startListening}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Start listening"}
                className={"avia-mic" + (listening ? " is-live" : "")}
              >
                {listening ? (
                  <Square className="h-4 w-4" />
                ) : supported ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </button>
              <button
                type="submit"
                className="avia-send"
                disabled={!draft.trim() || thinking}
                aria-label="Send to Avia"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => (open ? closeWidget() : openWidget())}
        aria-expanded={open}
        aria-label="AI Voice Tutor"
        className={"avia-fab" + (listening || speaking ? " is-live" : "")}
      >
        <span className="avia-fab__orb">
          {listening ? <Mic className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </span>
        <span className="avia-fab__label">AI Voice Tutor</span>
      </button>
    </div>
  );
}

export default AviaWidget;
