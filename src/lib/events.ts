/**
 * Internal observability event bus. Every meaningful pipeline step emits an
 * event here; the activity timeline and (later) the performance panel render
 * from these — nothing is fabricated, only real measured events.
 */

export type AgentEvent =
  | { type: "voice_received"; at: number; durationMs: number }
  | { type: "transcription_completed"; at: number; text: string }
  | { type: "agent_started"; at: number; input: string }
  | { type: "intent_identified"; at: number; intent: string; tool?: string }
  | { type: "tool_selected"; at: number; tool: string; args: Record<string, unknown> }
  | { type: "tool_started"; at: number; tool: string }
  | { type: "tool_completed"; at: number; tool: string; ok: boolean; ms: number }
  | { type: "tool_failed"; at: number; tool: string; error: string }
  | {
      type: "permission_requested";
      at: number;
      tool: string;
      level: string;
      id: string;
    }
  | { type: "permission_granted"; at: number; id: string }
  | { type: "permission_denied"; at: number; id: string }
  | { type: "verification_started"; at: number }
  | { type: "verification_completed"; at: number; ok: boolean; note: string }
  | { type: "response_generated"; at: number; text: string }
  | { type: "tts_started"; at: number }
  | { type: "tts_completed"; at: number; ms: number }
  | { type: "tts_failed"; at: number; error: string }
  | { type: "system"; at: number; message: string; kind: "info" | "warn" | "error" }
  | { type: "env_probed"; at: number; backend: "local-amd" | "none"; reason?: string };

export type EventListener = (event: AgentEvent) => void;

export interface EventBus {
  emit(event: AgentEvent): void;
  subscribe(listener: EventListener): () => void;
  history(): AgentEvent[];
}

const LIMIT = 400;

export function createEventBus(): EventBus {
  let listeners: EventListener[] = [];
  const log: AgentEvent[] = [];

  return {
    emit(event) {
      log.push(event);
      if (log.length > LIMIT) log.shift();
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    history() {
      return [...log];
    },
  };
}