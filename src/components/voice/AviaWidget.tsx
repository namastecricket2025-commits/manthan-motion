import { api } from "@/convex/_generated/api";
import {
  detectStudyTopic,
  fallbackReply,
  identityReply,
  isIdentityAsk,
  loadVoiceLanguage,
  pickAviaVoice,
  pickGreeting,
  saveVoiceLanguage,
  speakText,
  stopSpeaking,
  type VoiceLanguage,
} from "@/components/voice/avia";
import { createDictation, studyTerms, type Dictation } from "@/components/voice/dictation";
import { renderBlocks, toSpokenText } from "@/components/voice/format";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
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
 * Avia — the floating study companion.
 *
 * Listening uses the browser's own Web Speech API and speaking uses
 * window.speechSynthesis, so the widget runs with no API keys and no cost.
 * The reply comes from Manthan's model chain with Avia's personality prompt.
 * She can answer schoolwork and ordinary worldwide questions, and she speaks
 * and listens in Indian English or Hindi.
 */

interface Turn {
  id: number;
  from: "avia" | "student";
  text: string;
}

const PROMPTS_EN = [
  "What can you help me with?",
  "Explain photosynthesis",
  "Solve 2x + 5 = 17",
  "What should I see in Japan?",
];

const PROMPTS_HI = [
  "आप किसमें मदद कर सकती हैं?",
  "प्रकाश संश्लेषण समझाइए",
  "2x + 5 = 17 हल कीजिए",
  "जापान में क्या देखना चाहिए?",
];

const QUICK_EN = [
  "Explain that simpler",
  "Give me an example",
  "Quiz me on this",
  "Why does that work?",
];

const QUICK_HI = [
  "इसे आसान शब्दों में समझाइए",
  "एक उदाहरण दीजिए",
  "इस पर क्विज़ लीजिए",
  "यह कैसे काम करता है?",
];

/**
 * How long a gap has to last before what she has heard counts as the finished
 * question. A student thinks mid-question, and a 1.4-second gap sent the first
 * half of that sentence on its own. Four seconds of real quiet keeps a whole
 * question together.
 */
const SILENCE_MS = 4200;

export function AviaWidget() {
  const askAvia = useAction(api.ai.aviaReply);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [handsFree, setHandsFree] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [language, setLanguage] = useState<VoiceLanguage>(() => loadVoiceLanguage());
  const [greeting, setGreeting] = useState(() =>
    pickGreeting(undefined, loadVoiceLanguage()),
  );
  const [turns, setTurns] = useState<Turn[]>(() => [
    { id: 0, from: "avia", text: greeting },
  ]);

  const isHindi = language === "hi-IN";
  const copy = useCallback(
    (english: string, hindi: string) => (isHindi ? hindi : english),
    [isHindi],
  );

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const languageRef = useRef(language);
  const dictationRef = useRef<Dictation | null>(null);
  const transcriptRef = useRef("");
  const queuedRef = useRef(0);
  const greetedRef = useRef(false);
  const openRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const handsFreeRef = useRef(false);
  const listenRef = useRef<() => void>(() => {});

  turnsRef.current = turns;
  openRef.current = open;
  handsFreeRef.current = handsFree;
  languageRef.current = language;

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
      voicesRef.current = synth.getVoices();
      voiceRef.current = pickAviaVoice(voicesRef.current, languageRef.current);
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

  useEffect(() => {
    languageRef.current = language;
    voiceRef.current = pickAviaVoice(voicesRef.current, language);
  }, [language]);

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
      languageRef.current,
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
        const result = await askAvia({
          message,
          history,
          studying,
          language: languageRef.current,
        });
        addTurn("avia", result.reply);
        // `say` strips markdown for speech; the transcript keeps the structure.
        say(result.reply, false, resume);
      } catch {
        // A question about who made her is answered even when the model chain
        // is unreachable — the credit must never depend on a provider being up.
        const reply = isIdentityAsk(message)
          ? identityReply(languageRef.current)
          : fallbackReply(studying, languageRef.current);
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

     All accumulation lives in `createDictation`, because a phone re-reports
     the same sentence at a new result index. The panel owns only the hand-off:
     the live transcript mirrors into the composer, nothing is sent until the
     room is quiet, and closing or starting a new chat drops the take. */

  const vocabulary = useCallback(() => {
    return turnsRef.current
      .filter((turn) => turn.from === "student")
      .slice(-2)
      .flatMap((turn) => turn.text.split(/[^\p{L}\p{N}'-]+/u))
      .filter((word) => word.length > 3);
  }, []);

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
        isHindi
          ? "यह ब्राउज़र सुन नहीं सकता। Chrome, Edge या Safari आज़माइए — आप लिख भी सकते हैं।"
          : "This browser can't listen in — Chrome, Edge and Safari can. You can still type to me.",
      );
      return;
    }

    // Already listening: this tap means "I'm done" — send what she has.
    if (dictationRef.current) {
      dictationRef.current.stop();
      return;
    }

    stopSpeaking();
    setNote(null);
    transcriptRef.current = "";

    const dictation = createDictation({
      lang: languageRef.current,
      silenceMs: SILENCE_MS,
      terms: () => [...studyTerms(), ...vocabulary()],
      repair: vocabulary,
      onText: (text) => {
        transcriptRef.current = text;
        if (text) setDraft(text);
      },
      onListening: (on) => setListening(on),
      onStop: (reason, text) => {
        dictationRef.current = null;
        setListening(false);
        const transcript = text.replace(/\s+/g, " ").trim();
        transcriptRef.current = "";
        const willSend =
          transcript.length > 0 && (reason === "silence" || reason === "user");
        /* Clear the composer only while it still shows a take being sent. */
        setDraft((current) => (willSend && current === transcript ? "" : current));

        if (!transcript) {
          if (reason === "unsupported") {
            setNote(
              isHindi
                ? "यह ब्राउज़र सुन नहीं सकता। Chrome, Edge या Safari आज़माइए — आप लिख भी सकते हैं।"
                : "This browser can't listen in — Chrome, Edge and Safari can. You can still type to me.",
            );
          } else if (reason === "error") {
            setNote(
              isHindi
                ? "सुनने के लिए माइक्रोफ़ोन की अनुमति चाहिए। पता बार में अनुमति दें और फिर कोशिश करें।"
                : "I need microphone permission to hear you. Allow it in the address bar and try again.",
            );
          }
          return;
        }

        if (willSend) void sendRef.current(transcript);
      },
    });

    dictationRef.current = dictation;
    dictation.start();
  }, [isHindi, vocabulary]);

  listenRef.current = startListening;

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

  function chooseLanguage(next: VoiceLanguage) {
    if (next === language) return;
    saveVoiceLanguage(next);
    languageRef.current = next;
    voiceRef.current = pickAviaVoice(voicesRef.current, next);
    hush();
    stopListening();
    setLanguage(next);
    setNote(null);

    if (turns.length <= 1) {
      const nextGreeting = pickGreeting(undefined, next);
      setGreeting(nextGreeting);
      idRef.current = 1;
      setTurns([{ id: 0, from: "avia", text: nextGreeting }]);
      setDraft("");
      say(nextGreeting, true);
      return;
    }

    const switchLine =
      next === "hi-IN"
        ? "ठीक है, अब हिंदी में बात करेंगे।"
        : "Okay, switching back to English.";
    addTurn("avia", switchLine);
    setDraft("");
    say(switchLine, true);
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
        isHindi
          ? "यह ब्राउज़र सुन नहीं सकता। Chrome, Edge या Safari आज़माइए।"
          : "This browser can't listen in — Chrome, Edge and Safari can. You can still type to me.",
      );
      return;
    }
    setHandsFree(next);
    setNote(
      next
        ? isHindi
          ? "हैंड्स-फ़्री चालू है। जवाब पूरा होते ही मैं फिर सुनूँगी।"
          : "Hands-free on. I'll listen again as soon as I finish answering."
        : null,
    );
  }

  /** Wipe the thread and let her start over with a different opener. */
  function newChat() {
    stopListening();
    hush();
    const next = pickGreeting(greeting, language);
    setGreeting(next);
    setNote(null);
    setDraft("");
    idRef.current = 1;
    setTurns([{ id: 0, from: "avia", text: next }]);
    say(next, true);
  }

  const statusLabel = listening
    ? copy("Listening", "सुन रही हूँ")
    : thinking
      ? copy("Thinking", "सोच रही हूँ")
      : speaking
        ? copy("Speaking", "बोल रही हूँ")
        : copy("Tap the mic and talk", "माइक दबाकर बोलिए");

  const prompts = isHindi ? PROMPTS_HI : PROMPTS_EN;
  const quickActions = isHindi ? QUICK_HI : QUICK_EN;

  return (
    <div className={"avia-root" + (open ? " is-open" : "")}>
      <AnimatePresence>
        {open && (
          <motion.button
            key="avia-scrim"
            type="button"
            className="avia-scrim"
            aria-label={copy("Close Avia", "अविया बंद करें")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeWidget}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="avia-panel"
            className="avia-panel avia-panel--v2"
            style={{ transformOrigin: "100% 100%" }}
            initial={{ opacity: 0, y: 34, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            aria-label={copy("Avia voice tutor", "अविया वॉइस ट्यूटर")}
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
                <p className="avia-sub">
                  {isHindi
                    ? "अध्ययन साथी · दुनिया की जानकारी"
                    : "Study companion · world knowledge"}
                </p>
              </div>
              <div className="avia-lang" role="group" aria-label={copy("Voice language", "आवाज़ की भाषा")}>
                <button
                  type="button"
                  data-active={language === "en-IN" ? "true" : undefined}
                  aria-pressed={language === "en-IN"}
                  onClick={() => chooseLanguage("en-IN")}
                >
                  EN
                </button>
                <button
                  type="button"
                  data-active={language === "hi-IN" ? "true" : undefined}
                  aria-pressed={language === "hi-IN"}
                  onClick={() => chooseLanguage("hi-IN")}
                >
                  हिं
                </button>
              </div>
              <button
                type="button"
                aria-label={copy("Start a new chat with Avia", "अविया के साथ नई बातचीत")}
                className="avia-icon-btn"
                onClick={newChat}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={copy("Close Avia", "अविया बंद करें")}
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
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
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
                  {copy("Quiet", "चुप")}
                </button>
              )}
              {supported && (
                <button
                  type="button"
                  onClick={toggleHandsFree}
                  aria-pressed={handsFree}
                  className={"avia-status__action" + (handsFree ? " is-on" : "")}
                >
                  {handsFree
                    ? copy("Hands-free on", "हैंड्स-फ़्री चालू")
                    : copy("Hands-free", "हैंड्स-फ़्री")}
                </button>
              )}
            </div>

            {note && <p className="avia-note">{note}</p>}

            <div className="avia-chips">
              {(turns.length <= 1 ? prompts : quickActions).map((prompt) => (
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
                onChange={(event) => {
                  // Typing over a live transcript edits the take, not the mic.
                  dictationRef.current?.setSeed(event.target.value);
                  setDraft(event.target.value);
                }}
                placeholder={
                  supported
                    ? copy("Ask anything, in English or Hindi…", "अंग्रेज़ी या हिंदी में कुछ भी पूछिए…")
                    : copy("Type to Avia…", "अविया से लिखिए…")
                }
                className="avia-input"
                aria-label={copy("Type a message to Avia", "अविया को संदेश लिखें")}
              />
              <button
                type="submit"
                className="avia-send"
                disabled={!draft.trim() || thinking}
                aria-label={copy("Send message", "संदेश भेजें")}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={startListening}
                aria-pressed={listening}
                aria-label={
                  listening
                    ? copy("Finish and send", "खत्म करके भेजें")
                    : copy("Start listening", "सुनना शुरू करें")
                }
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

            <p className="avia-footnote">
              {isHindi
                ? "भारतीय अंग्रेज़ी और हिंदी में बोलती और सुनती है"
                : "Speaks and listens in Indian English or Hindi"}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* The launcher itself: one living orb, no icon. */}
      <motion.button
        type="button"
        onClick={() => (open ? closeWidget() : openWidget())}
        aria-expanded={open}
        aria-label={
          listening
            ? copy("Avia is listening", "अविया सुन रही है")
            : copy("Open Avia, the AI voice tutor", "अविया खोलें, AI वॉइस ट्यूटर")
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
