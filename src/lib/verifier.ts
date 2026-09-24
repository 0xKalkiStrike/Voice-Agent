import type { ToolResult } from "../types/providers";

export interface Verification {
  ok: boolean;
  note: string;
}

/**
 * Structural verification of a tool result before the agent answers with it.
 * Catches undefined/empty/failed results so AURA never presents broken output
 * as if it were verified.
 */
export function verifyToolResult(toolName: string, result: ToolResult): Verification {
  if (!result.ok) {
    return { ok: false, note: result.error ?? `tool ${toolName} reported a failure` };
  }
  const value = result.data;
  if (value === undefined || value === null) {
    return { ok: false, note: `tool ${toolName} returned no data` };
  }
  if (typeof value === "string") {
    return value.trim().length > 0
      ? { ok: true, note: "non-empty text" }
      : { ok: false, note: "empty text result" };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, note: "finite number" }
      : { ok: false, note: "non-finite number" };
  }
  if (Array.isArray(value)) {
    return value.length > 0
      ? { ok: true, note: `${value.length} item(s)` }
      : { ok: false, note: "empty result set" };
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0
      ? { ok: true, note: "structured result" }
      : { ok: false, note: "empty object result" };
  }
  if (typeof value === "boolean") {
    return { ok: true, note: "boolean result" };
  }
  return { ok: true, note: "result verified" };
}