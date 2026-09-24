import { describe, expect, it } from "vitest";
import { createMemoryStore, memoryTokens } from "./memoryStore";

describe("memoryTokens", () => {
  it("tokenizes key terms and skips stopwords", () => {
    expect(memoryTokens("always confirm before you delete")).toContain("confirm");
    expect(memoryTokens("always confirm before you delete")).toContain("delete");
    expect(memoryTokens("always confirm before you delete")).not.toContain("you");
  });
});

describe("createMemoryStore — session long-term memory", () => {
  it("saves entries with unique ids and defaults type", () => {
    const store = createMemoryStore();
    const a = store.save("prefer dark mode");
    const b = store.save("build ships with qa handoff", "project-context");
    expect(a.id).not.toBe(b.id);
    expect(a.type).toBe("conversation-summary");
    expect(b.type).toBe("project-context");
    expect(store.list()).toHaveLength(2);
  });

  it("recalls by keyword match, best first", () => {
    const store = createMemoryStore();
    store.save("demo flow must run in under three thirty", "project-context");
    store.save("the demo judge watches the live timeline", "project-context");
    const hits = store.recall("demo flow");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].text).toContain("flow");
  });

  it("returns nothing for an unrelated query", () => {
    const store = createMemoryStore();
    store.save("prefer tts on", "preference");
    expect(store.recall("gorilla")).toEqual([]);
  });

  it("removes single entries and clears", () => {
    const store = createMemoryStore();
    const a = store.save("one");
    store.save("two");
    expect(store.remove("nope")).toBe(false);
    expect(store.remove(a.id)).toBe(true);
    expect(store.list()).toHaveLength(1);
    expect(store.clear()).toBe(1);
    expect(store.list()).toHaveLength(0);
  });

  it("removeWhere reports how many were deleted", () => {
    const store = createMemoryStore();
    store.save("the demo uses qwen on rocm", "project-context");
    store.save("prefer rocm", "preference");
    const removed = store.removeWhere((e) => e.text.includes("rocm"));
    expect(removed).toBe(2);
  });
});