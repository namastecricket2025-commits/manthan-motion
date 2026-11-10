import { api } from "@/convex/_generated/api";
import {
  browserVoiceLanguage,
  detectInputLanguage,
  detectStudyTopic,
  fallbackReply,
  identityReply,
  isIdentityAsk,
  pickAviaVoice,
  pickGreeting,
  recognitionLanguageForText,
  speakText,
  speechLanguageForText,
  stopSpeaking,
} from "@/components/voice/avia";
import { createDictation, studyTerms, type Dictation } from "@/components/voice/dictation";
import { renderBlocks, toSpokenText } from "@/components/voice/format";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Mic, MicOff, Square, X } from "lucide-react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./avia.css";

/**
 * Avia — the floating study companion.
 *
 * Deliberately one surface and three controls: a transcript, a text field, a
 * mic and a send button. She detects English, Hindi or Hinglish from what the
 * student writes or says and replies in kind. There is no language switch and
 * no mode to manage.
 */

interface Turn {
  id: number;
  from: "avia" | "student";
  text: string;
}

/** How long a gap counts as the finished question. */
const SILENCE_MS = 4200;

export function AviaWidget() {
  const askAvia = useAction(api.ai.aviaReply);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      id: 0,
      from: "avia",
      text: pickGreeting(undefined, browserVoiceLanguage()),
    },
  ]);

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const dictationRef = useRef<Dictation | null>(null);
  const transcriptRef = useRef("");
  const greetedRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  turnsRef.current = turns;

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    const late = window.setTimeout(load, 800);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(late);
    };
  }, []);

  /* ---------------- speaking ---------------- */

  const say = useCallback((text: string, interrupt = true, onDone?: () => void) => {
    setSpeaking(true);
    const language = speechLanguageForText(text);
    speakText(
      toSpokenText(text),
      pickAviaVoice(voicesRef.current, language),
      () => {
        setSpeaking(false);
        onDone?.();
      },
      interrupt,
      language,
    );
  }, []);

  const hush = useCallback(() => {
    stopSpeaking();
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
      const inputLanguage = detectInputLanguage(message);
      const studying = detectStudyTopic(message);
      setThinking(true);

      const history = turnsRef.current.slice(-8).map((turn) => ({
        role: (turn.from === "student" ? "student" : "avia") as "student" | "avia",
        text: turn.text,
      }));

      try {
        const result = await askAvia({
          message,
          history,
          studying,
          language:
            inputLanguage === "hi"
              ? "hi-IN"
              : inputLanguage === "hinglish"
                ? "hinglish"
                : "en-IN",
        });
        addTurn("avia", result.reply);
        say(result.reply, false);
      } catch {
        const reply = isIdentityAsk(message)
          ? identityReply(inputLanguage === "hi" ? "hi-IN" : "en-IN")
          : fallbackReply(studying, inputLanguage === "hi" ? "hi-IN" : "en-IN");
        addTurn("avia", reply);
        say(reply, false);
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
    const dictation = dictationRef.current;
    dictationRef.current = null;
    transcriptRef.current = "";
    dictation?.abort();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setNote(
        "This browser can't listen in. Chrome, Edge and Safari can — you can still type to me.",
      );
      return;
    }

    // A tap while listening means "that's what I said" — finish and send.
    if (dictationRef.current) {
      dictationRef.current.stop();
      return;
    }

    hush();
    setNote(null);
    transcriptRef.current = "";

    const recent =
      draft.trim() ||
      turnsRef.current.filter((turn) => turn.from === "student").slice(-1)[0]?.text ||
      "";

    const dictation = createDictation({
      lang: recognitionLanguageForText(recent),
      silenceMs: SILENCE_MS,
      terms: () => studyTerms(),
      onText: (text) => {
        transcriptRef.current = text;
        if (text) setDraft(text);
      },
      onListening: setListening,
      onStop: (reason, text) => {
        dictationRef.current = null;
        setListening(false);
        const transcript = text.replace(/\s+/g, " ").trim();
        transcriptRef.current = "";
        const willSend =
          transcript.length > 0 && (reason === "silence" || reason === "user");
        setDraft((current) => (willSend && current === transcript ? "" : current));

        if (!transcript) {
          if (reason === "unsupported") {
            setNote(
              "This browser can't listen in. Chrome, Edge and Safari can — you can still type to me.",
            );
          } else if (reason === "error") {
            setNote(
              "I need microphone permission to hear you. Allow it in the address bar and try again.",
            );
          }
          return;
        }

        if (willSend) void sendRef.current(transcript);
      },
    });

    dictationRef.current = dictation;
    dictation.start();
  }, [draft, hush]);

  /* ---------------- lifecycle ---------------- */

  useEffect(
    () => () => {
      dictationRef.current?.abort();
      dictationRef.current = null;
      stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, thinking, note]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWidget();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("avia-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("avia-open");
    };
  }, [open]);

  function openWidget() {
    setOpen(true);
    if (!greetedRef.current) {
      greetedRef.current = true;
      say(turnsRef.current[0]?.text ?? "What are we working on?", true);
    }
  }

  function closeWidget() {
    stopListening();
    hush();
    setOpen(false);
  }

  const status = listening
    ? "Listening…"
    : thinking
      ? "Thinking…"
      : speaking
        ? "Speaking…"
        : "Your AI study companion";

  return (
    <div className={"avia-root" + (open ? " is-open" : "")}>
      <AnimatePresence>
        {open && (
          <motion.button
            key="avia-scrim"
            type="button"
            className="avia-scrim"
            aria-label="Close Avia"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeWidget}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="avia-panel"
            className="avia-panel avia-panel--v2 avia-panel--simple"
            style={{ transformOrigin: "100% 100%" }}
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Avia voice tutor"
          >
            <motion.div
              className="avia-grab"
              aria-hidden="true"
              onPanEnd={(_, info) => {
                if (info.offset.y > 64 && info.velocity.y > 0) closeWidget();
              }}
            >
              <span />
            </motion.div>

            <motion.header
              className="avia-head avia-head--v2"
              onPanEnd={(_, info) => {
                if (info.offset.y > 84 && info.velocity.y > 0) closeWidget();
              }}
            >
              <span className={"avia-avatar" + (listening || speaking ? " is-live" : "")}>
                <span className="avia-avatar__strand" />
                <span className="avia-avatar__core" />
              </span>
              <div className="avia-head__copy">
                <p className="avia-name">Avia</p>
                <p className="avia-sub">{status}</p>
              </div>
              <button
                type="button"
                aria-label="Close Avia"
                className="avia-icon-btn"
                onClick={closeWidget}
              >
                <X className="h-4 w-4" />
              </button>
            </motion.header>

            <div ref={logRef} className="avia-log">
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                  className={
                    "avia-bubble " +
                    (turn.from === "student"
                      ? "avia-bubble--student"
                      : "avia-bubble--avia")
                  }
                >
                  {turn.from === "avia" ? renderBlocks(turn.text) : turn.text}
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

            {note && <p className="avia-note">{note}</p>}

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
                onChange={(event) => {
                  dictationRef.current?.setSeed(event.target.value);
                  setDraft(event.target.value);
                }}
                placeholder="Ask anything…"
                className="avia-input"
                aria-label="Ask Avia"
              />
              <button
                type="submit"
                className="avia-send"
                disabled={!draft.trim() || thinking}
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={startListening}
                aria-pressed={listening}
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

      <motion.button
        type="button"
        onClick={() => (open ? closeWidget() : openWidget())}
        aria-expanded={open}
        aria-label={
          listening ? "Avia is listening" : "Open Avia, the AI voice tutor"
        }
        data-open={open ? "true" : undefined}
        className={"avia-fab" + (listening || speaking ? " is-live" : "")}
        initial={false}
        animate={{ scale: open ? 0.9 : 1, opacity: open ? 0.8 : 1 }}
        whileHover={{ scale: open ? 0.94 : 1.05 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.6 }}
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
