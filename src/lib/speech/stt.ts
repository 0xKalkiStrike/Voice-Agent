/**
 * Browser-native STT wrapper (Web Speech API / SpeechRecognition)
 * Captures live microphone audio input and streams partial & final transcripts.
 */

export interface SpeechRecognitionHandlers {
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechRecognizer {
  readonly supported: boolean;
  start(): void;
  stop(): void;
}

// Extend global Window interface for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function createSpeechRecognizer(handlers: SpeechRecognitionHandlers): SpeechRecognizer {
  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognitionClass);
  let recognition: any = null;
  let isListening = false;
  let shouldRestart = false;

  if (supported && SpeechRecognitionClass) {
    try {
      recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        isListening = true;
        handlers.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          handlers.onPartialResult?.(interimTranscript);
        }

        if (finalTranscript) {
          handlers.onFinalResult?.(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        // Ignore non-fatal 'no-speech' or 'aborted' errors
        if (event.error !== "no-speech" && event.error !== "aborted") {
          handlers.onError?.(event.error || "Speech recognition error");
        }
      };

      recognition.onend = () => {
        isListening = false;
        handlers.onEnd?.();
        // Auto restart if still supposed to be listening (for continuous voice control)
        if (shouldRestart) {
          try {
            recognition.start();
          } catch {
            /* ignore restart race */
          }
        }
      };
    } catch {
      // Failed to instantiate
    }
  }

  function start() {
    if (!supported || !recognition) return;
    shouldRestart = true;
    if (!isListening) {
      try {
        recognition.start();
      } catch {
        /* ignore start race */
      }
    }
  }

  function stop() {
    shouldRestart = false;
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch {
        /* ignore stop race */
      }
    }
  }

  return {
    supported,
    start,
    stop,
  };
}
