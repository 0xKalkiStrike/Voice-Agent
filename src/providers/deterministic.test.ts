import { describe, expect, it } from "vitest";
import { deterministicPlanner, normalizeInput } from "./deterministic";
import { listTools } from "../lib/tools/registry";

/** Shared ctx matching what the orchestrator passes (see orchestrator.ts run()). */
const CTX = { tools: listTools(), now: () => new Date() };
const plan = (input: string) => deterministicPlanner.plan(input, CTX);

describe("normalizeInput", () => {
  it("collapses case, punctuation and whitespace", () => {
    expect(normalizeInput("  Hello,   AURA! ")).toBe("hello aura");
    // "?" is preserved (the time rule keys off it); case + spacing collapse.
    expect(normalizeInput("What's the date?")).toBe("what s the date?");
  });
});

describe("deterministicPlanner — intent matching over the tool registry", () => {
  it("routes simple utilities", async () => {
    const time = await plan("What time is it?");
    expect(time).toMatchObject({ intent: "get_current_time", tool: "get_current_time" });

    const calc = await plan("2.5 * 4 + 1");
    expect(calc).toMatchObject({ intent: "calculator", tool: "calculator" });
    expect((calc.args as { expression?: string }).expression).toBe("2.5 * 4 + 1");
  });

  it("routes task queries to task_manager with a status filter", async () => {
    const planResult = await plan("Find the unfinished tasks");
    expect(planResult).toMatchObject({ intent: "task_manager", tool: "task_manager" });
    expect((planResult.args as { status?: string }).status).toBe("open");

    const all = await plan("Show all tasks");
    expect(all.tool).toBe("task_manager");
  });

  it("routes document questions to search_documents", async () => {
    const planResult = await plan("Search my docs for the latest requirements");
    expect(planResult.tool).toBe("search_documents");
    const prd = await plan("what does the PRD say about the data layer?");
    expect(prd.tool).toBe("search_documents");
  });

  it("routes drafting requests to create_draft (WRITE gate)", async () => {
    const planResult = await plan("Prepare a summary for the team");
    expect(planResult.tool).toBe("create_draft");
  });

  it("routes environment checks to env_status, not the project tool", async () => {
    const planResult = await plan("Check my local AI environment");
    expect(planResult.tool).toBe("env_status");
  });

  it("routes memory asks to the right memory tool", async () => {
    const save = await plan("remember to always verify results before answering");
    expect(save.tool).toBe("memory_save");
    expect((save.args as { type?: string }).type).toBe("preference");

    const recall = await plan("do you remember what I asked you");
    expect(recall.tool).toBe("memory_recall");

    const wipe = await plan("forget everything about the demo");
    expect(wipe.tool).toBe("memory_delete");
    expect((wipe.args as { all?: boolean }).all).toBe(true);

    const one = await plan("delete the memory about the RAG plan");
    expect(one.tool).toBe("memory_delete");
    expect((one.args as { query?: string }).query).toContain("RAG");
  });

  it("answers greetings and stays honest about unmatched input", async () => {
    const hi = await plan("hello there");
    expect(hi.response).toBeTruthy();

    const unknown = await plan("purple monkeys in space");
    expect(unknown.intent).toBe("unknown");
    expect(unknown.confidence).toBe(0);
    expect(unknown.response).toContain("couldn't");
  });
});