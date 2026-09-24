import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent } from "../lib/events";
import { createEventBus } from "../lib/events";
import { AgentOrchestrator, type PermissionRequest } from "../lib/orchestrator";
import { probeLocalAmd } from "../providers/localAmd";
import { apiBaseUrl, STORAGE_KEYS } from "../lib/envConfig";
import { browserTts } from "../lib/speech/tts";
import {
  createMicCapture,
  type MicCapture,
  type MicIssue,
  type MicState,
} from "../lib/speech/mic";
import {
  createSpeechRecognizer,
  type SpeechRecognizer,
} from "../lib/speech/stt";
import type { AgentStatus, EnvProbe } from "../types/providers";
import { memoryStore, type MemoryEntry } from "../lib/memoryStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  at: number;
}

export interface ToolRunMetric {
  tool: string;
  at: number;
  ms: number;
  ok: boolean;
}

export interface VerificationRun {
  at: number;
  ok: boolean;
  note: string;
}

export interface AuraSettings {
  ttsEnabled: boolean;
  autoApproveWrite: boolean;
  handsFree: boolean;
  sttProvider: string;
  sttModel: string;
  languageMode: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  ttsVoice: string;
}

export const DEFAULT_SETTINGS: AuraSettings = {
  ttsEnabled: true,
  autoApproveWrite: false,
  handsFree: false,
  sttProvider: "assemblyai",
  sttModel: "universal-3-5-pro",
  languageMode: "auto",
  llmProvider: "local",
  llmModel: "local-amd-rocm-q4",
  ttsProvider: "local",
  ttsVoice: "anna",
};

function loadSettings(): AuraSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AuraSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let msgCounter = 0;
function nextMsgId(): string {
  msgCounter += 1;
  return `m${msgCounter}`;
}

const ACTIVITY_LIMIT = 60;

export function useAura() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<{ id: string; event: AgentEvent }[]>([]);
  const [permission, setPermission] = useState<PermissionRequest | null>(null);
  const [env, setEnv] = useState<EnvProbe | null>(null);
  const [envProbeMs, setEnvProbeMs] = useState<number | null>(null);
  const [toolRuns, setToolRuns] = useState<ToolRunMetric[]>([]);
  const [verifications, setVerifications] = useState<VerificationRun[]>([]);
  const [ttsRuns, setTtsRuns] = useState<number[]>([]);
  const [responseLatencies, setResponseLatencies] = useState<number[]>([]);
  const [settings, setSettingsState] = useState<AuraSettings>(loadSettings);
  const [micState, setMicState] = useState<MicState>("idle");
  const [micIssue, setMicIssue] = useState<MicIssue | null>(null);
  const [micSpeaking, setMicSpeaking] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState<string>("");
  const [memories, setMemories] = useState<MemoryEntry[]>(() => memoryStore.list());

  const busRef = useRef<ReturnType<typeof createEventBus> | null>(null);
  const orbRef = useRef<AgentOrchestrator | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const sttRef = useRef<SpeechRecognizer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const settingsRef = useRef<AuraSettings>(settings);
  const policyRef = useRef({ autoApproveWrite: settings.autoApproveWrite });
  const levelRef = useRef(0);
  const lastAgentStartRef = useRef<number | null>(null);
  const probeStartRef = useRef<number | null>(null);
  const capturedChunksRef = useRef(0);

  settingsRef.current = settings;

  if (!busRef.current) busRef.current = createEventBus();
  const bus = busRef.current;

  if (!orbRef.current) {
    orbRef.current = new AgentOrchestrator({
      bus,
      probeEnv: () => {
        probeStartRef.current = performance.now();
        return probeLocalAmd(apiBaseUrl());
      },
      policy: policyRef.current,
      onStatus: setStatus,
      onPermission: setPermission,
    });
  }
  const orb = orbRef.current;

  const appendMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (role === "system" && last && last.role === "system" && last.text === text) {
        return prev;
      }
      return [
        ...prev.slice(-199),
        { id: nextMsgId(), role, text, at: Date.now() },
      ];
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (!settingsRef.current.ttsEnabled) {
      setStatus("idle");
      return;
    }
    if (!browserTts.supported()) {
      setStatus("idle");
      busRef.current?.emit({ type: "tts_failed", at: Date.now(), error: "unsupported browser" });
      return;
    }
    const t0 = performance.now();
    setStatus("speaking");
    busRef.current?.emit({ type: "tts_started", at: Date.now() });
    browserTts.speak(text, {
      onStart: () => undefined,
      onEnd: () => {
        setStatus("idle");
        busRef.current?.emit({
          type: "tts_completed",
          at: Date.now(),
          ms: Math.round(performance.now() - t0),
        });
      },
      onError: (err) => {
        setStatus("idle");
        busRef.current?.emit({ type: "tts_failed", at: Date.now(), error: err.message });
      },
    });
  }, []);

  // Interruption / Barge-in trigger
  const triggerBargeIn = useCallback(() => {
    browserTts.stop();
    setStatus("idle");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "tts.interrupt" }));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = bus.subscribe((event) => {
      setActivity((prev) => {
        const next = [...prev, { id: nextMsgId(), event }];
        return next.length > ACTIVITY_LIMIT ? next.slice(next.length - ACTIVITY_LIMIT) : next;
      });
      switch (event.type) {
        case "env_probed": {
          setEnv({ backend: event.backend, reason: event.reason, measuredAt: event.at });
          if (probeStartRef.current !== null) {
            setEnvProbeMs(Math.round(performance.now() - probeStartRef.current));
            probeStartRef.current = null;
          }
          break;
        }
        case "agent_started":
          lastAgentStartRef.current = performance.now();
          break;
        case "response_generated": {
          appendMessage("assistant", event.text);
          const startedAt = lastAgentStartRef.current;
          if (startedAt !== null) {
            setResponseLatencies((prev) => [
              ...prev.slice(-19),
              Math.round(performance.now() - startedAt),
            ]);
            lastAgentStartRef.current = null;
          }
          speak(event.text);
          break;
        }
        case "tool_completed":
          setToolRuns((prev) => [
            ...prev.slice(-19),
            { tool: event.tool, at: event.at, ms: event.ms, ok: event.ok },
          ]);
          if (event.tool === "memory_save" || event.tool === "memory_delete") {
            setMemories(memoryStore.list());
          }
          break;
        case "verification_completed":
          setVerifications((prev) => [
            ...prev.slice(-19),
            { at: event.at, ok: event.ok, note: event.note },
          ]);
          break;
        case "tts_completed":
          setTtsRuns((prev) => [...prev.slice(-9), event.ms]);
          break;
        case "system":
          appendMessage("system", `${event.kind.toUpperCase()}: ${event.message}`);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, [bus, appendMessage, speak]);

  useEffect(() => {
    void (async () => {
      const probe = await orb.envStatus();
      appendMessage(
        "system",
        probe.backend === "local-amd"
          ? `AMD lane online — ROCm ${probe.amd?.rocm ?? "ready"}, AssemblyAI Realtime STT active.`
          : "AssemblyAI Realtime Engine online — streaming STT connected."
      );
    })();
    return () => {
      micRef.current?.destroy();
      sttRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setPartialTranscript("");
      appendMessage("user", trimmed);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "chat", message: trimmed }));
      } else {
        void orb.run(trimmed);
      }
    },
    [appendMessage, orb],
  );

  const ensureStt = useCallback(() => {
    if (sttRef.current) return sttRef.current;
    const recognizer = createSpeechRecognizer({
      onPartialResult: (text) => {
        setPartialTranscript(text);
      },
      onFinalResult: (text) => {
        setPartialTranscript("");
        send(text);
      },
    });
    sttRef.current = recognizer;
    return recognizer;
  }, [send]);

  const ensureMic = useCallback((): MicCapture | null => {
    if (micRef.current) return micRef.current;
    const mic = createMicCapture({
      onState: setMicState,
      onLevel: (level) => {
        levelRef.current = level;
      },
      onVad: (speaking) => {
        setMicSpeaking(speaking);
        // Barge-in check: if user speaks while agent is talking, interrupt speech
        if (speaking && status === "speaking") {
          triggerBargeIn();
        }
      },
      onChunk: (pcm16) => {
        capturedChunksRef.current += 1;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          wsRef.current.send(
            JSON.stringify({
              type: "audio.chunk",
              data: base64,
            })
          );
        }
      },
    });
    micRef.current = mic;
    return mic;
  }, [status, triggerBargeIn]);

  const startMic = useCallback(async () => {
    const mic = ensureMic();
    if (!mic) return;
    const stt = ensureStt();
    setMicIssue(null);
    if (status === "speaking") {
      triggerBargeIn();
    }
    await mic.start();
    if (stt && stt.supported) {
      stt.start();
    }
    if (mic.issue) setMicIssue(mic.issue);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio.start" }));
    }
  }, [ensureMic, ensureStt, status, triggerBargeIn]);

  const stopMic = useCallback(() => {
    const mic = micRef.current;
    if (mic) mic.stop();
    const stt = sttRef.current;
    if (stt) stt.stop();
    if (mic?.issue) setMicIssue(mic.issue);
    capturedChunksRef.current = 0;
    setPartialTranscript("");
  }, []);

  const updateSettings = useCallback((patch: Partial<AuraSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      policyRef.current.autoApproveWrite = next.autoApproveWrite;
      try {
        window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      } catch {
        /* storage fallback */
      }
      return next;
    });
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  const probeNow = useCallback(() => {
    void orb.refreshEnv();
  }, [orb]);

  const cancelPermission = useCallback(() => {
    orb.cancelPending();
  }, [orb]);

  const approvePermission = useCallback(
    (id: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && permission) {
        wsRef.current.send(JSON.stringify({
          type: "approve_permission",
          tool: permission.tool,
          args: permission.args
        }));
        setPermission(null);
      } else {
        void orb.approve(id);
      }
    },
    [orb, permission],
  );

  const denyPermission = useCallback(
    (id: string) => {
      orb.deny(id);
    },
    [orb],
  );

  const stopSpeaking = useCallback(() => {
    triggerBargeIn();
  }, [triggerBargeIn]);

  const refreshMemories = useCallback(() => {
    setMemories(memoryStore.list());
  }, []);

  const micSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // WebSocket connection to FastAPI backend with auto-reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      try {
        ws = new WebSocket("ws://localhost:8008/ws/voice");
        wsRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) return;
          bus.emit({
            type: "system",
            at: Date.now(),
            kind: "info",
            message: "AssemblyAI Realtime & FastAPI Backend Connected (ws://localhost:8008/ws/voice)",
          });
        };

        ws.onmessage = (evt) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(evt.data);
            const event = payload.event;

            if (event === "transcript.partial") {
              setPartialTranscript(payload.data?.text || "");
            } else if (event === "transcript.final") {
              setPartialTranscript("");
            } else if (event === "agent.started" || event === "agent.thinking") {
              setStatus("thinking");
            } else if (event === "permission.requested") {
              setPermission(payload.data);
              setStatus("permission-pending");
            } else if (event === "response.completed") {
              const text = payload.data?.text || "";
              appendMessage("assistant", text);
              speak(text);
            } else if (event === "voice.interrupted") {
              setStatus("idle");
            }
          } catch {
            // fallback
          }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            timer = setTimeout(connect, 4000);
          }
        };

        ws.onerror = () => {};
      } catch {
        if (!isDisposed) {
          timer = setTimeout(connect, 4000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        const socket = ws;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket.close();
        }
      }
    };
  }, [bus, appendMessage, speak]);

  return {
    status,
    messages,
    activity,
    permission,
    env,
    envProbeMs,
    toolRuns,
    verifications,
    ttsRuns,
    responseLatencies,
    settings,
    updateSettings,
    micState,
    micIssue,
    micSpeaking,
    micSupported,
    partialTranscript,
    levelRef,
    send,
    startMic,
    stopMic,
    clearConversation,
    probeNow,
    cancelPermission,
    approvePermission,
    denyPermission,
    stopSpeaking,
    memories,
    refreshMemories,
  };
}

export type AuraApi = ReturnType<typeof useAura>;