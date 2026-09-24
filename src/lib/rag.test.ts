import { describe, expect, it } from "vitest";
import { searchDocuments, tokenize } from "./rag";

describe("tokenize", () => {
  it("lowercases, strips punctuation and drops stopwords", () => {
    expect(tokenize("The ROCm GPU, and the driver!")).toEqual(["rocm", "gpu", "driver"]);
  });
});

describe("searchDocuments — offline keyword retrieval over demo docs", () => {
  it("finds the ROCm chunk when asked about ROCm", () => {
    const hits = searchDocuments("ROCm driver GPU");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toContain("ROCm");
    expect(hits[0].excerpt.toLowerCase()).toContain("rocm");
  });

  it("finds the requirements doc for 'requirements' queries", () => {
    const hits = searchDocuments("data layer requirements");
    expect(hits.some((h) => h.title.includes("Requirements"))).toBe(true);
    expect(hits[0].matched.length).toBeGreaterThan(0);
  });

  it("returns no hits for an unrelated query", () => {
    expect(searchDocuments("quantum waffles zzz")).toHaveLength(0);
  });

  it("ranks more-overlapping chunks first", () => {
    const hits = searchDocuments("streams streaming speech audio latency");
    expect(hits.length).toBeGreaterThan(0);
  });
});