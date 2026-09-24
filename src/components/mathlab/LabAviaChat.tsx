import { api } from "@/convex/_generated/api";
import {
  detectStudyTopic,
  fallbackReply,
  pickAviaVoice,
  pickBackchannel,
  speakText,
  stopSpeaking,
} from "@/components/voice/avia";
import "@/types/speech";
import { useAction } from "convex/react";
import { Mic, SendHorizontal, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Avia, docked inside the Math Lab.
 *
 * The floating orb and this panel are the same companion: same `aviaReply`
 * action, same persona, same voice. This surface adds a lab-specific context
 * line (the current grade, chapter and latest result) so a student can ask
 * "why step 2?" out loud and be answered about the working on screen.
 *
 * Listening uses the browser's Web Speech API; speaking uses speechSynthesis
 * with the same natural-voice picker as the orb. Muted by default — the lab
 * is often used in shared spaces — with a one-tap unmute.
 */

interface LabTurn {
  id: number;
  from: "student" | "avia";
  text: string;
}

const LAB_PROMPTS = [
  "Why does step 2 work?",
  "Is my working correct?",
  "Give me a similar question",
];

export function LabAviaChat({ context }: { context?: string }) {
  const askAvia = useAction(api.ai.aviaReply);

  const [turns, setTurns] = useState<LabTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  const idRef = useRef(1);
  const turnsRef = useRef(turns);
  const contextRef = useRef(context);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const mutedRef = useRef(muted);
  /** Whether the Study Switch line has already been spoken this session. */
  const switchSpokenRef = useRef(false);

  turnsRef.current = turns;
  contextRef.current = context;
  mutedRef.current = muted;

  /* Same natural-voice selection as the floating orb. */
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => setVoice(pickAviaVoice(synth.getVoices()));
    load();
    synth.addEventListener?.("voiceschanged", load);
    const late = window.setTimeout(load, 800);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(late);
    };
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, thinking]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    },
    [],
  );

  const say = useCallback(
    (text: string) => {
      if (mutedRef.current) return;
      speakText(text, voice, undefined, false);
    },
    [voice],
  );

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || thinking) return;

      setTurns((current) => [
        ...current,
        { id: idRef.current++, from: "student", text: message },
      ]);
      setThinking(true);
      setNote(null);

      const academic = detectStudyTopic(message);
      if (academic && !switchSpokenRef.current) {
        switchSpokenRef.current = true;
        say("Alright, jokes over. Activating 100% brain power. Let's lock in.");
      }

      const history = turnsRef.current.slice(-8).map((turn) => ({
        role: turn.from === "student" ? ("student" as const) : ("avia" as const),
        text: turn.text,
      }));

      try {
        const result = await askAvia({
          message,
          history,
          studying: academic || undefined,
        });
        setTurns((current) => [
          ...current,
          { id: idRef.current++, from: "avia", text: result.reply },
        ]);
        say(result.reply);
      } catch {
        const reply = fallbackReply(academic);
        setTurns((current) => [
          ...current,
          { id: idRef.current++, from: "avia", text: reply },
        ]);
        say(reply);
      } finally {
        setThinking(false);
      }
    },
    [askAvia, say, thinking],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setNote("This browser can't listen in — Chrome, Edge and Safari can. You can still type.");
      return;
    }
    if (recognitionRef.current) {
      stopListening();
      return;
    }
    stopSpeaking();

    const recognition = new Ctor() as AviaSpeechRecognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: AviaSpeechRecognitionEvent) => {
      const transcript = event.results?.[event.results.length - 1]?.[0]?.transcript;
      if (transcript?.trim()) void sendRef.current(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [stopListening]);

  return (
    <div className="lab-avia">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
          <Volume2 className="mr-1.5 inline h-3 w-3" />
          Avia is in the lab
        </p>
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (next) stopSpeaking();
          }}
          aria-label={muted ? "Unmute Avia's voice" : "Mute Avia's voice"}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-line)] px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
        >
          {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {muted ? "Voice off" : "Voice on"}
        </button>
      </div>

      <div ref={logRef} className="lab-avia__log">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {LAB_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void send(prompt)}
                className="rounded-full border border-[var(--glass-line)] px-3 py-1 text-[11px] text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn) => (
          <p
            key={turn.id}
            className={
              "lab-avia__turn " +
              (turn.from === "student" ? "lab-avia__turn--student" : "lab-avia__turn--avia")
            }
          >
            <span className="lab-avia__who">
              {turn.from === "student" ? "You" : "Avia"}
            </span>
            {turn.text}
          </p>
        ))}
        {thinking && (
          <p className="lab-avia__turn lab-avia__turn--avia lab-avia__turn--thinking">
            <span className="lab-avia__who">Avia</span>
            thinking…
          </p>
        )}
      </div>

      {note && <p className="lab-avia__note">{note}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={startListening}
          aria-label={listening ? "Stop listening" : "Speak to Avia"}
          className={
            "lab-avia__mic" + (listening ? " is-live" : "")
          }
        >
          <Mic className="h-4 w-4" />
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const message = draft.trim();
            if (!message) return;
            setDraft("");
            void send(message);
          }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={listening ? "Listening…" : "Ask Avia about this problem…"}
            className="min-w-0 flex-1 rounded-full border border-[var(--glass-line)] bg-transparent px-3.5 py-2 text-[13px] outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
          />
          <button
            type="submit"
            aria-label="Send to Avia"
            disabled={!draft.trim() || thinking}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--signal-strong)] text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </div>
      {listening && (
        <p className="lab-avia__note">
          Listening — speak once, then pause. Tap the mic again to stop.
        </p>
      )}
      <p className="lab-avia__note">
        Same companion as the orb in the corner — she knows the lab context here.
      </p>
    </div>
  );
}

export default LabAviaChat;
