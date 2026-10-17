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

/**
 * How long a gap has to last before what she has heard counts as the finished
 * question. Long enough to sit through the pause inside a normal sentence
 * ("solve for x ... where x is positive"), short enough that handing over the
 * floor does not feel laggy.
 */
const SILENCE_MS = 1400;

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
  /** What the recogniser has heard this session, and the pause timer. */
  const heardRef = useRef("");
  const silenceRef = useRef<number | null>(null);
  const sentRef = useRef(false);
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

  /* ---------------- listening ----------------

     The recogniser fires a result the moment IT thinks the speaker paused,
     which on the first word is almost immediately — the old build sent "so"
     as a message while the student was still asking their question. Waiting is
     the entire job here, so the technique is:

       1. `interimResults` and `continuous` both ON: the engine keeps listening
          through the small pauses inside a sentence, and hands over its best
          guess as it revises it.
       2. Every result rebuilds one buffer (settled results plus the one still
          being revised) and that buffer is written into the composer, so the
          student can watch the sentence being taken down.
       3. Nothing is sent until the room is actually quiet: a silence timer is
          re-armed on every result and only fires when no new words arrive for
          SILENCE_MS. Tapping the mic while it listens commits immediately,
          because that tap means "that's what I said".
       4. If the browser ends the session on its own (Safari does, Chrome does
          after about a minute), whatever was heard is committed rather than
          dropped. */

  const clearSilence = useCallback(() => {
    if (silenceRef.current !== null) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  }, []);

  /** Hand the accumulated speech to Avia — at most once per listening session. */
  const commit = useCallback(() => {
    clearSilence();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      // Already stopped or never started; nothing to do.
    }
    setListening(false);
    const heard = heardRef.current;
    const transcript = heard.replace(/\s+/g, " ").trim();
    heardRef.current = "";
    /* Clear the composer only while it is still showing the live transcript —
       never wipe something the student typed over the top of it. */
    setDraft((current) => (current === heard ? "" : current));
    if (!transcript || sentRef.current) return;
    sentRef.current = true;
    void sendRef.current(transcript);
  }, [clearSilence]);

  /** Drop the session without sending anything (closing the panel, new chat). */
  const stopListening = useCallback(() => {
    clearSilence();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      // See `commit`.
    }
    heardRef.current = "";
    setListening(false);
  }, [clearSilence]);

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
      // Already listening: this tap means "I'm done" — send what she has.
      commit();
      return;
    }

    stopSpeaking();
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    heardRef.current = "";
    sentRef.current = false;
    /* The draft is NOT cleared here, and neither is it cleared when a session
       ends empty: anything the student had typed is theirs, and the live
       transcript simply replaces the box once the first word arrives
       (`setDraft(heardRef.current)` in onresult). */

    /** Re-arm the pause timer: it is the only thing that sends a message. */
    const armSilence = () => {
      clearSilence();
      silenceRef.current = window.setTimeout(() => commit(), SILENCE_MS);
    };

    recognition.onstart = () => {
      setListening(true);
      setNote(null);
    };
    recognition.onresult = (event) => {
      let settled = "";
      let pending = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) settled += text + " ";
        else pending += text + " ";
      }
      heardRef.current = (settled + pending).replace(/\s+/g, " ").trim();
      setDraft(heardRef.current);
      armSilence();
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setListening(false);
      clearSilence();
      if (heardRef.current.trim()) {
        // Whatever reached us before the error is still their question.
        commit();
        return;
      }
      setNote(
        event.error === "not-allowed"
          ? "I need microphone permission to hear you. Allow it in the address bar and try again."
          : event.error === "no-speech"
            ? "I didn't hear anything. Tap the mic when you're ready."
            : "I didn't catch that. Give the mic another tap and speak clearly.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      clearSilence();
      /* The engine ended the session itself. Anything it did hand over is the
         student's question, so it is committed, not discarded. */
      if (heardRef.current.trim()) commit();
      else setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [clearSilence, commit]);

  listenRef.current = startListening;

  /* ---------------- lifecycle ---------------- */

  useEffect(
    () => () => {
      if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
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
                /* While it listens this button means "that's what I said": it
                   commits and sends, which is the student's way of skipping the
                   silence wait. */
                aria-label={listening ? "Finish and send" : "Start listening"}
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
