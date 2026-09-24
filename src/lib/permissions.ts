import type { PermissionLevel } from "../types/providers";

export type AccessDecision = "auto" | "confirm" | "deny";

export interface AccessPolicy {
  /** WRITE tools may auto-run when approved. DESTRUCTIVE tools NEVER auto-run. */
  autoApproveWrite: boolean;
}

export const DEFAULT_POLICY: AccessPolicy = { autoApproveWrite: false };

export function decisionFor(
  level: PermissionLevel,
  policy: AccessPolicy = DEFAULT_POLICY,
): AccessDecision {
  switch (level) {
    case "read":
      return "auto";
    case "write":
      return policy.autoApproveWrite ? "auto" : "confirm";
    case "destructive":
      return "confirm";
  }
}

export function requiresConfirmation(
  level: PermissionLevel,
  policy: AccessPolicy = DEFAULT_POLICY,
): boolean {
  return decisionFor(level, policy) === "confirm";
}

export function levelLabel(level: PermissionLevel): string {
  switch (level) {
    case "read":
      return "READ";
    case "write":
      return "WRITE";
    case "destructive":
      return "DESTRUCTIVE";
  }
}