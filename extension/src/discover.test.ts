import { describe, it, expect } from "vitest";
import { getDesignRefs } from "./discover";

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
