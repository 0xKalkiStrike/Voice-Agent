import { describe, expect, it } from "vitest";
import { verifyToolResult } from "./verifier";

describe("verifyToolResult — never present broken output as fact", () => {
  it("fails a tool that reported ok:false", () => {
    const r = verifyToolResult("x", { ok: false, error: "disk full" });
    expect(r.ok).toBe(false);
    expect(r.note).toContain("disk full");
  });

  it("fails undefined / null data", () => {
    expect(verifyToolResult("x", { ok: true, data: undefined }).ok).toBe(false);
    expect(verifyToolResult("x", { ok: true, data: null }).ok).toBe(false);
  });

  it("fails empty strings and arrays, passes non-empty ones", () => {
    expect(verifyToolResult("x", { ok: true, data: "" }).ok).toBe(false);
    expect(verifyToolResult("x", { ok: true, data: "ok" }).ok).toBe(true);
    expect(verifyToolResult("x", { ok: true, data: [] }).ok).toBe(false);
    expect(verifyToolResult("x", { ok: true, data: [1] }).ok).toBe(true);
  });

  it("fails empty objects, passes structured ones", () => {
    expect(verifyToolResult("x", { ok: true, data: {} }).ok).toBe(false);
    expect(verifyToolResult("x", { ok: true, data: { count: 0 } }).ok).toBe(true);
  });

  it("numbers: 0 is fine, NaN is not", () => {
    expect(verifyToolResult("x", { ok: true, data: 0 }).ok).toBe(true);
    expect(verifyToolResult("x", { ok: true, data: Number.NaN }).ok).toBe(false);
    expect(verifyToolResult("x", { ok: true, data: Infinity }).ok).toBe(false);
  });
});