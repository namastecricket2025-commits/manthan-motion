import { api } from "@/convex/_generated/api";
import {
  detectStudyTopic,
  fallbackReply,
  identityReply,
  isIdentityAsk,
  pickAviaVoice,
  pickGreeting,
  speakText,
  stopSpeaking,
} from "@/components/voice/avia";
import { renderBlocks, toSpokenText } from "@/components/voice/format";
import { AnimatePresence, motion } from "motion/react";
import {
  Mic,
  MicOff,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./avia.css";

/**
 * Avia — the floating voice companion.
 *
 * A single circular orb in the bottom right of every page. Listening uses the
 * browser's own Web Speech API and speaking uses window.speechSynthesis, so
 * the whole widget runs with no API keys and no cost. The reply itself comes
 * from Manthan's model chain with Avia's personality prompt (see
 * convex/ai.ts); if that chain is out of free capacity she says so in
 * character instead of failing silently.
 *
 * She speaks in her own words: the reply comes from the model, and the only
 * fixed lines here are the short greeting and the honest out-of-capacity
 * notice. No scripted announcements, no filler noises.
 */

interface Turn {
  id: number;
  from: "avia" | "student";
  text: string;
}

/** Openers shown to a cold-start visitor who has nothing to say yet. */
const PROMPTS = [
  "What can you help me with?",
  "Explain photosynthesis",
  "Solve 2x + 5 = 17",
  "Quiz me on Newton's laws",
];

/** Persistent nudges — usable at any point in the conversation. */
const QUICK_ACTIONS = [
  "Explain that simpler",
  "Give me an example",
  "Quiz me on this",
  "Why does that work?",
];

export function AviaWidget() {
  const askAvia = useAction(api.ai.aviaReply);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [handsFree, setHandsFree] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel] = useState("device voice");
  const [greeting, setGreeting] = useState(() => pickGreeting());
  // The transcript opens on the same line she speaks when the panel opens, so
  // the first bubble is never a different greeting from the one she says.
  const [turns, setTurns] = useState<Turn[]>(() => [
    { id: 0, from: "avia", text: greeting },
  ]);

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const queuedRef = useRef(0);
  const greetedRef = useRef(false);
  const openRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  /** Live mirrors for callbacks that must not close over stale state. */
  const handsFreeRef = useRef(false);
  const listenRef = useRef<() => void>(() => {});

  turnsRef.current = turns;
  openRef.current = open;
  handsFreeRef.current = handsFree;

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
    // A reply may carry markdown; the synthesiser only ever gets prose.
    speakText(
      toSpokenText(text),
      voiceRef.current,
      () => {
        queuedRef.current = Math.max(0, queuedRef.current - 1);
        if (queuedRef.current === 0) setSpeaking(false);
        onDone?.();
      },
      interrupt,
    );
  }, []);

  /** Cuts her off mid-sentence without closing the panel. */
  const hush = useCallback(() => {
    stopSpeaking();
    queuedRef.current = 0;
    setSpeaking(false);
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

      // Silent: a study question is flagged so the server labels the turn as
      // tutoring rather than casual chat. Nothing is announced on the device —
      // she just answers.
      const studying = detectStudyTopic(message);

      setThinking(true);

      const history = turnsRef.current.slice(-8).map((turn) => ({
        role: (turn.from === "student" ? "student" : "avia") as "student" | "avia",
        text: turn.text,
      }));

      /** Hands-free: reopen the mic the moment she has finished answering. */
      const resume = () => {
        if (handsFreeRef.current && openRef.current) listenRef.current();
      };

      try {
        const result = await askAvia({ message, history, studying });
        addTurn("avia", result.reply);
        // `say` strips markdown for speech; the transcript keeps the structure.
        say(result.reply, false, resume);
      } catch {
        // A question about who made her is answered even when the model chain
        // is unreachable — the credit must never depend on a provider being up.
        const reply = isIdentityAsk(message)
          ? identityReply()
          : fallbackReply(studying);
        addTurn("avia", reply);
        say(reply, false, resume);
      } finally {
        setThinking(false);
      }
    },
    [addTurn, askAvia, say, thinking],
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

  listenRef.current = startListening;

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
      say(greeting, true, () => {
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

  /**
   * Hands-free mode: she keeps the microphone open between turns, so a whole
   * revision session can be held by voice without tapping the mic after every
   * answer.
   */
  function toggleHandsFree() {
    const next = !handsFree;
    if (next && !supported) {
      setNote(
        "This browser can't listen in — Chrome, Edge and Safari can. You can still type to me.",
      );
      return;
    }
    setHandsFree(next);
    setNote(
      next ? "Hands-free on. I'll listen again as soon as I finish answering." : null,
    );
  }

  /** Wipe the thread and let her start over with a different opener. */
  function newChat() {
    stopListening();
    hush();
    const next = pickGreeting(greeting);
    setGreeting(next);
    setNote(null);
    setDraft("");
    idRef.current = 1;
    setTurns([{ id: 0, from: "avia", text: next }]);
    say(next);
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
            style={{ transformOrigin: "calc(100% - 30px) calc(100% - 30px)" }}
            initial={{ opacity: 0, scale: 0.62, y: 26, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.7, y: 20, filter: "blur(10px)" }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 32,
              mass: 0.85,
            }}
            aria-label="Avia voice tutor"
          >
            <header className="avia-head">
              <span className={"avia-dot" + (listening || speaking ? " is-live" : "")} />
              <div className="min-w-0 flex-1">
                <p className="avia-name">Avia</p>
                <p className="avia-sub truncate">
                  {voiceLabel} · pitch 1.0 · rate 1.05
                </p>
              </div>
              <button
                type="button"
                aria-label="Start a new chat with Avia"
                className="avia-icon-btn"
                onClick={newChat}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
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
                  {turn.from === "avia"
                    ? renderBlocks(turn.text)
                    : turn.text}
                </motion.div>
              ))}
              {thinking && (
                <div className="avia-bubble avia-bubble--avia avia-typing">
                  <span />
                  <span />
                  <span />
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
              {speaking && (
                <button
                  type="button"
                  onClick={hush}
                  className="avia-status__action"
                >
                  <VolumeX className="h-3 w-3" />
                  Quiet
                </button>
              )}
              {supported && (
                <button
                  type="button"
                  onClick={toggleHandsFree}
                  aria-pressed={handsFree}
                  className={
                    "avia-status__action" + (handsFree ? " is-on" : "")
                  }
                >
                  {handsFree ? "Hands-free on" : "Hands-free"}
                </button>
              )}
            </div>

            {note && <p className="avia-note">{note}</p>}

            <div className="avia-chips">
              {(turns.length <= 1 ? PROMPTS : QUICK_ACTIONS).map((prompt) => (
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
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* The launcher itself: one living orb, no icon. Six soft light strands
          drift behind a hairline edge while a conic sweep turns around it, so
          the state is legible from across the room — slow and calm at rest,
          wide and fast while she listens, and rippling at speech cadence while
          she talks. */}
      <motion.button
        type="button"
        onClick={() => (open ? closeWidget() : openWidget())}
        aria-expanded={open}
        aria-label={listening ? "Avia is listening" : "Open Avia, the AI voice tutor"}
        className={
          "avia-fab" + (listening || speaking ? " is-live" : "")
        }
        initial={false}
        animate={{ scale: open ? 0.88 : 1, opacity: open ? 0.7 : 1 }}
        whileHover={{ scale: open ? 0.92 : 1.05 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.6 }}
      >
        <span className="avia-fab__halo" aria-hidden="true" />
        <span className="avia-fab__ring" aria-hidden="true" />
        <span className="avia-fab__orb">
          <span className="avia-fab__strands" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="avia-fab__core" aria-hidden="true" />
        </span>
      </motion.button>
    </div>
  );
}

export default AviaWidget;
