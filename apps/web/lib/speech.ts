// Typed, honest wrapper around the browser SpeechRecognition API.
// No fake transcription: when the API is unavailable, support is reported as false.

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition ??
    null
  );
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type SpeechHandlers = {
  onPartial: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (reason: string) => void;
  onEnd: () => void;
};

export type SpeechController = {
  start: () => void;
  stop: () => void;
};

export function createSpeechSession(
  lang: string,
  handlers: SpeechHandlers,
): SpeechController | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last[0].transcript;
    if (last.isFinal) handlers.onFinal(transcript.trim());
    else handlers.onPartial(transcript);
  };
  recognition.onerror = (event) => {
    const error = (event as { error?: string })?.error ?? 'speech-error';
    handlers.onError(error);
  };
  recognition.onend = handlers.onEnd;
  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        /* start called twice — ignore */
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
