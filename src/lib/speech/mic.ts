/**
 * Real mic capture: getUserMedia → AudioContext → AudioWorkletNode (fallback ScriptProcessor) →
 * 16 kHz mono PCM16 chunks, RMS level out, energy-based VAD.
 * Raw audio is downsampled and delivered to onChunk callbacks.
 */

export type MicState = "idle" | "requested" | "recording" | "error";

export type MicIssue =
  | { kind: "not-supported"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "no-device"; message: string }
  | { kind: "unavailable"; message: string };

export interface MicHandlers {
  onState?: (s: MicState) => void;
  /** Smoothed loudness 0..1 (RMS-derived dB, clamped). */
  onLevel?: (level: number) => void;
  /** Energy-based voice activity (speech vs silence). */
  onVad?: (speaking: boolean) => void;
  /** 16 kHz mono PCM16 chunks (~50 ms). */
  onChunk?: (pcm16: Int16Array) => void;
}

export interface MicCapture {
  readonly supported: boolean;
  issue: MicIssue | null;
  start(): Promise<void>;
  stop(): void;
  destroy(): void;
}

const TARGET_RATE = 16000;
const CHUNK_SAMPLES = Math.round(TARGET_RATE * 0.05); // 800
const VAD_THRESHOLD_DB = 0.015; // loudness above this = speech (RMS float range)
const VAD_HANGOVER = 5; // blocks of silence before speech ends

const WORKLET_CODE = `
class MicAudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channel = input[0];
      if (channel && channel.length > 0) {
        this.port.postMessage(channel);
      }
    }
    return true;
  }
}
registerProcessor('mic-audio-processor', MicAudioProcessor);
`;

export function createMicCapture(handlers: MicHandlers): MicCapture {
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let workletNode: AudioNode | null = null;
  let gain: GainNode | null = null;
  let destroying = false;
  let issue: MicIssue | null = null;

  const state: { value: MicState } = { value: "idle" };

  const setState = (s: MicState) => {
    state.value = s;
    handlers.onState?.(s);
  };

  function mapError(err: unknown): MicIssue {
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":
          return {
            kind: "permission-denied",
            message: "Microphone permission was denied — allow access in your browser, then try again.",
          };
        case "NotFoundError":
          return { kind: "no-device", message: "No microphone was found on this device." };
        case "NotReadableError":
          return { kind: "unavailable", message: "The microphone is busy or unavailable right now." };
        default:
          return { kind: "unavailable", message: err.message || "Microphone could not start." };
      }
    }
    return { kind: "unavailable", message: err instanceof Error ? err.message : "Unknown mic error." };
  }

  async function start(): Promise<void> {
    if (state.value === "recording") return;
    if (!supported()) {
      issue = { kind: "not-supported", message: "This browser does not expose microphone access." };
      setState("error");
      return;
    }
    setState("requested");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const sampleRate = audioCtx.sampleRate || 48000;
      const stride = Math.max(1, Math.round(sampleRate / TARGET_RATE));

      gain = audioCtx.createGain();
      gain.gain.value = 0; // monitor silence — audio is only captured, not played

      let pending: number[] = [];
      let speechBlocks = 0;
      let wasSpeaking = false;

      const processAudioBuffer = (input: Float32Array) => {
        if (destroying) return;

        // Loudness -> 0..1
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
        const rms = Math.sqrt(sumSq / input.length);
        const db = 20 * Math.log10(rms + 1e-6);
        const level = Math.min(1, Math.max(0, (db + 50) / 50));
        handlers.onLevel?.(level);

        // Energy VAD
        const isLoud = rms > VAD_THRESHOLD_DB;
        speechBlocks = isLoud
          ? Math.min(speechBlocks + 1, VAD_HANGOVER * 2)
          : Math.max(speechBlocks - 1, 0);
        const speaking = speechBlocks > 0;
        if (speaking !== wasSpeaking) {
          wasSpeaking = speaking;
          handlers.onVad?.(speaking);
        }

        // Downsample to 16 kHz mono
        for (let i = 0; i < input.length; i += stride) pending.push(input[i]);
        while (pending.length >= CHUNK_SAMPLES) {
          const chunk = pending.splice(0, CHUNK_SAMPLES);
          const pcm = new Int16Array(chunk.length);
          for (let i = 0; i < chunk.length; i++) {
            const s = Math.max(-1, Math.min(1, chunk[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          handlers.onChunk?.(pcm);
        }
      };

      // Try modern AudioWorkletNode first to avoid deprecation warning
      let workletSetupSuccess = false;
      if (audioCtx.audioWorklet) {
        try {
          const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
          const workletUrl = URL.createObjectURL(blob);
          await audioCtx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          if (audioCtx && !destroying && audioCtx.state !== "closed") {
            const worklet = new AudioWorkletNode(audioCtx, "mic-audio-processor");
            worklet.port.onmessage = (e) => {
              processAudioBuffer(e.data);
            };
            workletNode = worklet;
            source.connect(worklet);
            worklet.connect(gain);
            workletSetupSuccess = true;
          }
        } catch {
          // AudioWorklet failed or blob URL disallowed, fall back to ScriptProcessor
        }
      }

      if (!workletSetupSuccess) {
        if (!audioCtx || destroying || audioCtx.state === "closed") {
          cleanup();
          return;
        }
        const scriptProc = audioCtx.createScriptProcessor(2048, 1, 1);
        scriptProc.onaudioprocess = (ev) => processAudioBuffer(ev.inputBuffer.getChannelData(0));
        workletNode = scriptProc;
        source.connect(scriptProc);
        scriptProc.connect(gain);
      }

      if (!audioCtx || destroying || audioCtx.state === "closed") {
        cleanup();
        return;
      }
      gain.connect(audioCtx.destination);
      setState("recording");
    } catch (err) {
      issue = mapError(err);
      setState("error");
      cleanup();
    }
  }

  function stop(): void {
    if (state.value === "recording" || state.value === "requested") setState("idle");
    cleanup();
  }

  function cleanup(): void {
    try {
      workletNode?.disconnect();
      gain?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      void audioCtx?.close().catch(() => undefined);
    } catch {
      /* best effort */
    }
    stream = null;
    workletNode = null;
    gain = null;
    audioCtx = null;
  }

  function destroy(): void {
    destroying = true;
    stop();
  }

  return {
    supported: supported(),
    get issue() {
      return issue;
    },
    start,
    stop,
    destroy,
  };
}

function supported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}