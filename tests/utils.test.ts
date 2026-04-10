import { describe, it, expect } from "vitest";
import { formatRelative, safeParseJson, slugify, truncate } from "../src/lib/utils";

describe("utils", () => {
  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 20)).toBe("hello world");
    expect(truncate("hello world", 7)).toMatch(/…$/);
  });

  it("slugifies", () => {
    expect(slugify("Iran–US Tensions!")).toBe("iran-us-tensions");
    expect(slugify("   spaces   ")).toBe("spaces");
  });

  it("safeParseJson returns fallback on invalid input", () => {
    expect(safeParseJson<number[]>("not json", [1])).toEqual([1]);
    expect(safeParseJson<string[]>('["a","b"]', [])).toEqual(["a", "b"]);
    expect(safeParseJson<number[]>(null, [9])).toEqual([9]);
  });

  it("formatRelative produces recent-style strings", () => {
    const d = new Date(Date.now() - 60 * 1000 * 5);
    expect(formatRelative(d)).toMatch(/m ago$/);
  });
});
