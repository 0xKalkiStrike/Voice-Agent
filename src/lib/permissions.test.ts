import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  decisionFor,
  levelLabel,
  requiresConfirmation,
} from "./permissions";

describe("decisionFor — the three-tier permission gate", () => {
  it("auto-runs READ tools under any policy", () => {
    expect(decisionFor("read")).toBe("auto");
    expect(decisionFor("read", { autoApproveWrite: true })).toBe("auto");
  });

  it("confirms WRITE by default, auto-runs when autoApproveWrite is on", () => {
    expect(decisionFor("write", DEFAULT_POLICY)).toBe("confirm");
    expect(decisionFor("write", { autoApproveWrite: false })).toBe("confirm");
    expect(decisionFor("write", { autoApproveWrite: true })).toBe("auto");
  });

  it("ALWAYS confirms DESTRUCTIVE, even with autoApproveWrite on", () => {
    expect(decisionFor("destructive", { autoApproveWrite: true })).toBe("confirm");
    expect(decisionFor("destructive")).toBe("confirm");
  });
});

describe("requiresConfirmation", () => {
  it("reflects decisionFor", () => {
    expect(requiresConfirmation("read")).toBe(false);
    expect(requiresConfirmation("write")).toBe(true);
    expect(requiresConfirmation("destructive")).toBe(true);
    expect(requiresConfirmation("write", { autoApproveWrite: true })).toBe(false);
  });
});

describe("levelLabel", () => {
  it("labels levels for the UI", () => {
    expect(levelLabel("read")).toBe("READ");
    expect(levelLabel("write")).toBe("WRITE");
    expect(levelLabel("destructive")).toBe("DESTRUCTIVE");
  });
});