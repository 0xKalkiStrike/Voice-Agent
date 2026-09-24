/**
 * Provider abstraction layer — the swap point between local AMD inference
 * and the deterministic offline engine. Cloud providers are deliberately
 * absent from this build (privacy decision: LOCAL ONLY).
 */

export type PermissionLevel = "read" | "write" | "destructive";

export type ProviderMode = "auto" | "local-amd" | "deterministic";

export type AgentStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "transcribing"
  | "thinking"
  | "using-tool"
  | "verifying"
  | "speaking"
  | "interrupted"
  | "permission-pending"
  | "error";

/** Result of a local-environment health probe (never fabricated). */
export interface EnvProbe {
  backend: "local-amd" | "none";
  amd?: {
    rocm?: string;
    gpus: string[];
    driver: string;
    modelName?: string;
  };
  reason?: string;
  measuredAt: number;
}

export interface ToolSchemaField {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
}
export type ToolSchema = Record<string, ToolSchemaField>;

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolContext {
  envStatus: EnvProbe;
  now: () => Date;
}

export interface AgentTool {
  name: string;
  description: string;
  permission: PermissionLevel;
  inputSchema: ToolSchema;
  execute(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): ToolResult | Promise<ToolResult>;
}

export interface ModelProvider {
  readonly name: string;
  readonly kind: "local-amd" | "deterministic";
  available(): { ok: boolean; reason?: string };
  complete(input: string): string;
}

export interface SpeechProvider {
  readonly name: string;
  available(): { ok: boolean; reason?: string };
  /** Real-time STT facade; the AMD lane streams via WebSocket, the offline lane is unavailable by design. */
  transcribe(
    pcm16: Int16Array,
    sampleRate: number,
  ): Promise<{ text?: string; error?: string }>;
}

export interface EmbeddingProvider {
  readonly name: string;
  available(): { ok: boolean; reason?: string };
  embed(texts: string[]): Promise<{ vectors: number[][]; error?: string }>;
}

export interface TtsProvider {
  readonly name: string;
  available(): { ok: boolean; reason?: string };
  speak(
    text: string,
    handlers: { onStart?(): void; onEnd?(): void; onError?(err: Error): void },
  ): void;
  stop(): void;
}

export interface PlannerPlan {
  intent: string;
  confidence: number; // 0..1
  tool?: string;
  args?: Record<string, unknown>;
  /** Set when no tool is required (greetings, unmatched input). */
  response?: string;
}

export interface Planner {
  readonly name: string;
  readonly modelProvider: string;
  plan(
    input: string,
    ctx: { tools: AgentTool[]; now: () => Date },
  ): PlannerPlan | Promise<PlannerPlan>;
}