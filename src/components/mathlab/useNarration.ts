import { pickAviaVoice } from "@/components/voice/avia";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One line of the read-aloud script. `key` matches the step the line belongs
 * to, so the step can light up while it is being read.
 */
export interface NarrationLine {
  key: string;
  label: string;
  text: string;
}

export type NarrationState = "idle" | "playing" | "paused";

export const NARRATION_RATES = [0.75, 1, 1.25, 1.5] as const;

/**
 * The one audio control in the Math Lab.
 *
 * Speech synthesis is a queue of utterances, not a media element, so pause,
 * resume, stop and speed all have to be managed explicitly:
 *
 *   • one sentence per utterance — Chrome drops long utterances part-way, and
 *     a student who pauses between steps should resume at the step, not at the
 *     start of the paragraph;
 *   • `stop` sets a cancellation flag before `cancel()`, so the `onend` of the
 *     utterance that was in flight cannot queue the next sentence;
 *   • unmount, tab change and `beforeunload` all cancel, so leaving the lab or
 *     closing the page can never leave the voice talking to an empty room.
 */
export function useNarration(lines: NarrationLine[]) {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [state, setState] = useState<NarrationState>("idle");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(1);

  const linesRef = useRef(lines);
  const rateRef = useRef(rate);
  const cancelled = useRef(false);
  const cursor = useRef({ line: 0, sentence: 0 });
  const sentences = useRef<string[]>([]);
  const stepRef = useRef<() => void>(() => {});
  const speakLineRef = useRef<(lineIndex: number) => void>(() => {});

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  const stop = useCallback(() => {
    cancelled.current = true;
    if (supported) window.speechSynthesis.cancel();
    setState("idle");
    setActiveKey(null);
  }, [supported]);

  const speakLine = useCallback(
    (lineIndex: number) => {
      if (cancelled.current) return;
      const line = linesRef.current[lineIndex];
      if (!line) {
        stop();
        return;
      }
      setActiveKey(line.key);
      sentences.current = line.text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      if (!sentences.current.length) {
        speakLineRef.current(lineIndex + 1);
        return;
      }
      cursor.current = { line: lineIndex, sentence: 0 };
      stepRef.current();
    },
    [stop],
  );

  const step = useCallback(() => {
    if (cancelled.current || !supported) return;
    const { sentence } = cursor.current;
    const text = sentences.current[sentence];
    if (!text) {
      const next = cursor.current.line + 1;
      if (next >= linesRef.current.length) {
        setState("idle");
        setActiveKey(null);
        return;
      }
      speakLine(next);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    const voice = pickAviaVoice(voices);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rateRef.current;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-IN";
    }
    const advance = () => {
      if (cancelled.current) return;
      cursor.current = {
        line: cursor.current.line,
        sentence: cursor.current.sentence + 1,
      };
      stepRef.current();
    };
    utterance.onend = advance;
    utterance.onerror = advance;
    window.speechSynthesis.speak(utterance);
  }, [speakLine, supported]);

  useEffect(() => {
    stepRef.current = step;
    speakLineRef.current = speakLine;
  }, [speakLine, step]);

  const play = useCallback(() => {
    if (!supported || linesRef.current.length === 0) return;
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    cancelled.current = false;
    cursor.current = { line: 0, sentence: 0 };
    setState("playing");
    speakLine(0);
  }, [speakLine, state, supported]);

  const pause = useCallback(() => {
    if (!supported || state !== "playing") return;
    window.speechSynthesis.pause();
    setState("paused");
  }, [state, supported]);

  const toggle = useCallback(() => {
    if (state === "playing") pause();
    else play();
  }, [pause, play, state]);

  useEffect(() => {
    if (!supported) return;
    const cancel = () => window.speechSynthesis.cancel();
    window.addEventListener("beforeunload", cancel);
    window.addEventListener("pagehide", cancel);
    return () => {
      window.removeEventListener("beforeunload", cancel);
      window.removeEventListener("pagehide", cancel);
      cancelled.current = true;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  return {
    supported,
    state,
    activeKey,
    rate,
    setRate,
    play,
    pause,
    stop,
    toggle,
  };
}
