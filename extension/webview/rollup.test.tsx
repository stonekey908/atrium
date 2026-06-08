import { describe, it, expect } from "vitest";
import { computeRollup } from "./rollup";
import type { Wave } from "./types";

const wave = (name: string, states: Array<"todo" | "doing" | "review" | "done">): Wave => ({
  name,
  tickets: states.map((state, i) => ({
    id: `${name}-${i}`,
    title: "t",
    priority: "med",
    state,
    spec: [],
    tests: { passed: 0, failed: 0, missing: 0 },
    activity: [],
  })),
});

describe("computeRollup", () => {
  it("totals ticket states across every wave, counting review as active", () => {
    const r = computeRollup([wave("A", ["done", "done", "todo"]), wave("B", ["doing", "review"])]);
    expect(r).toEqual({ total: 5, done: 2, doing: 1, review: 1, todo: 1, active: 2, pct: 40 });
  });

  it("is all-zero with pct 0 for an empty board", () => {
    expect(computeRollup([])).toEqual({ total: 0, done: 0, doing: 0, review: 0, todo: 0, active: 0, pct: 0 });
  });
});
