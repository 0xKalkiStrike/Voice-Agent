/**
 * Browser-native TTS (local OS voices, no network, no keys) — used by the
 * deterministic offline lane. The LocalAMD lane replaces this with streamed
 * Piper/Kokoro chunks when the backend is reachable (Phase 7).
 */
export interface SpeakHandlers {
  onStart?(): void;
  onEnd?(): void;
  onError?(err: Error): void;
}

export const browserTts = {
  supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  /** Prefer a clear English voice; fall back to any available voice. */
  pickVoice(): SpeechSynthesisVoice | undefined {
    if (!this.supported()) return undefined;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return undefined;
    const eng = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const pool = eng.length > 0 ? eng : voices;
    return (
      pool.find((v) => /google|natural|premium|real/i.test(v.name)) ??
      pool.find((v) => v.default) ??
      pool[0]
    );
  },

  speak(text: string, handlers: SpeakHandlers = {}): void {
    if (!this.supported()) {
      handlers.onError?.(new Error("Speech synthesis is not available in this browser."));
      return;
    }
    // Barge-in: cancel any playback currently in flight (start fresh).
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = () => handlers.onEnd?.();
    utterance.onerror = (event) => {
      if (event.error === "canceled") return;
      handlers.onError?.(new Error(`TTS failed (${event.error})`));
    };
    window.speechSynthesis.speak(utterance);
  },

  stop(): void {
    if (this.supported()) window.speechSynthesis.cancel();
  },
};