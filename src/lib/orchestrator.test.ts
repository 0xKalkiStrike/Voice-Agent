import { afterEach, describe, expect, it } from "vitest";
import type { AgentEvent, EventBus } from "./events";
import { createEventBus } from "./events";
import { memoryStore } from "./memoryStore";
import { AgentOrchestrator } from "./orchestrator";
import type { EnvProbe } from "../types/providers";

function makeOrchestrator(autoApproveWrite = false) {
  const bus: EventBus = createEventBus();
  const events: AgentEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const orb = new AgentOrchestrator({
    bus,
    probeEnv: (): Promise<EnvProbe> => Promise.resolve({ backend: "none", measuredAt: Date.now() }),
    policy: { autoApproveWrite },
    onStatus: () => undefined,
    onPermission: () => undefined,
  });
  return { orb, events };
}

/** Filters the bus capture to one event type, narrowing the element type. */
const ofType = <T extends AgentEvent["type"]>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }>[] =>
  events.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === type);

afterEach(() => {
  memoryStore.clear();
});

describe("AgentOrchestrator — plan → gate → execute → verify → respond", () => {
  it("runs a READ tool without asking and answers", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("What time is it?");
    expect(ofType(events, "permission_requested")).toHaveLength(0);
    expect(ofType(events, "tool_completed")).toHaveLength(1);
    expect(ofType(events, "response_generated")[0].text).toContain("time");
  });

  it("reads the demo tasks for 'find the unfinished tasks'", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("Find the unfinished tasks");
    expect(ofType(events, "tool_selected")[0]).toMatchObject({ tool: "task_manager" });
    const response = ofType(events, "response_generated")[0].text;
    expect(response).toContain("open");
  });

  it("gates a WRITE tool by default and resumes on approve", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("Create a draft for the team");
    const requests = ofType(events, "permission_requested");
    expect(requests).toHaveLength(1);
    expect(ofType(events, "tool_completed")).toHaveLength(0);

    await orb.approve(requests[0].id);
    expect(ofType(events, "permission_granted")).toHaveLength(1);
    expect(ofType(events, "tool_completed")[0]).toMatchObject({ tool: "create_draft", ok: true });
    expect(ofType(events, "response_generated")[0].text).toContain("Draft prepared");
  });

  it("auto-runs WRITE when the policy allows, but never DESTRUCTIVE", async () => {
    const write = makeOrchestrator(true);
    await write.orb.run("Create a draft for the team");
    expect(ofType(write.events, "permission_requested")).toHaveLength(0);
    expect(ofType(write.events, "tool_completed")).toHaveLength(1);

    memoryStore.save("the demo flow hovers under three thirty", "project-context");
    const del = makeOrchestrator(true);
    await del.orb.run("forget everything");
    expect(ofType(del.events, "permission_requested")).toHaveLength(1);
    const req = ofType(del.events, "permission_requested")[0];
    expect(req.level).toBe("destructive");
    await del.orb.approve(req.id);
    expect(memoryStore.list()).toHaveLength(0);
  });

  it("denies cleanly without executing", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("Create a draft for the team");
    const req = ofType(events, "permission_requested")[0];
    orb.deny(req.id);
    expect(ofType(events, "permission_denied")).toHaveLength(1);
    expect(ofType(events, "tool_completed")).toHaveLength(0);
    expect(ofType(events, "response_generated")[0].text).toMatch(/cancelled|cancel/i);
  });

  it("stops on tool failure without claiming a result", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("2 +"); // invalid expression
    expect(ofType(events, "tool_failed")).toHaveLength(1);
    expect(ofType(events, "verification_completed")).toHaveLength(0);
    expect(ofType(events, "response_generated")[0].text).toMatch(/problem|failed/i);
  });

  it("matches nothing gracefully and stays honest", async () => {
    const { orb, events } = makeOrchestrator();
    await orb.run("purple monkeys in space");
    expect(ofType(events, "response_generated")[0].text).toContain("couldn't");
  });
});