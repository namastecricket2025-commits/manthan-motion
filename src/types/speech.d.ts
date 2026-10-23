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

  /** One entry of the contextual-biasing list (Chrome 142+, experimental). */
  interface AviaSpeechPhrase {
    readonly phrase: string;
    readonly boost: number;
  }

  interface AviaSpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    /**
     * Hints for words the engine would otherwise guess wrong — "eye lens"
     * instead of "islands". Optional: most browsers still omit it.
     */
    phrases?: AviaSpeechPhrase[];
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
    SpeechRecognitionPhrase?: new (phrase: string, boost?: number) => AviaSpeechPhrase;
  }
}

export {};
