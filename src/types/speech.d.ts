/**
 * Web Speech API — the listening half.
 *
 * TypeScript's lib.dom ships `speechSynthesis` (the speaking half) but still
 * omits `SpeechRecognition`, so the shape is declared here. Names are prefixed
 * with `Avia` so they can never collide with a future lib.dom definition.
 */

declare global {
  interface AviaSpeechAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface AviaSpeechResult {
    readonly isFinal: boolean;
    readonly length: number;
    readonly [index: number]: AviaSpeechAlternative;
  }

  interface AviaSpeechResultList {
    readonly length: number;
    readonly [index: number]: AviaSpeechResult;
  }

  interface AviaSpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: AviaSpeechResultList;
  }

  interface AviaSpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface AviaSpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: AviaSpeechRecognition, event: Event) => void) | null;
    onresult:
      | ((this: AviaSpeechRecognition, event: AviaSpeechRecognitionEvent) => void)
      | null;
    onerror:
      | ((this: AviaSpeechRecognition, event: AviaSpeechRecognitionErrorEvent) => void)
      | null;
    onend: ((this: AviaSpeechRecognition, event: Event) => void) | null;
  }

  interface Window {
    SpeechRecognition?: new () => AviaSpeechRecognition;
    webkitSpeechRecognition?: new () => AviaSpeechRecognition;
  }
}

export {};
