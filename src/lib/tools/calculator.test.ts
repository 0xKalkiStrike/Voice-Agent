import { describe, expect, it } from "vitest";
import { calculate } from "./calculator";

describe("calculate — safe arithmetic evaluator", () => {
  it("evaluates the basic four operations with precedence", () => {
    expect(calculate("2 + 3 * 4")).toBe(14);
    expect(calculate("10 - 2 - 3")).toBe(5);
    expect(calculate("20 / 4 / 5")).toBe(1);
    expect(calculate("2.5 * 4 + 1")).toBe(11);
  });

  it("handles parentheses and unary minus", () => {
    expect(calculate("(2 + 3) * 4")).toBe(20);
    expect(calculate("-5 + 3")).toBe(-2);
    expect(calculate("2 * (-3)")).toBe(-6);
  });

  it("supports modulo", () => {
    expect(calculate("10 % 3")).toBe(1);
  });

  it("rejects invalid input instead of evaluating it", () => {
    expect(() => calculate("2 +")).toThrow();
    expect(() => calculate("(2 + 3")).toThrow();
    expect(() => calculate("1 / 0")).toThrow("division by zero");
    expect(() => calculate("alert(1)")).toThrow(/unsupported|unexpected/i);
    expect(() => calculate("")).toThrow("empty expression");
  });
});