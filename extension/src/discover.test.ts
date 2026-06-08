import { describe, it, expect } from "vitest";
import { getTestFileCount, getDesignRefs } from "./discover";

describe("getTestFileCount", () => {
  it("counts unit-test files under a directory (this repo has them)", () => {
    expect(getTestFileCount(process.cwd())).toBeGreaterThan(0);
  });

  it("returns 0 for a nonexistent path", () => {
    expect(getTestFileCount("/no/such/dir/xyz123")).toBe(0);
  });
});

describe("getDesignRefs", () => {
  it("returns well-formed refs (or none) without throwing", () => {
    const refs = getDesignRefs(process.cwd());
    expect(Array.isArray(refs)).toBe(true);
    for (const r of refs) {
      expect(typeof r.name).toBe("string");
      expect(["html", "image", "figma"]).toContain(r.kind);
    }
  });

  it("returns [] for a nonexistent path", () => {
    expect(getDesignRefs("/no/such/dir/xyz123")).toEqual([]);
  });
});
