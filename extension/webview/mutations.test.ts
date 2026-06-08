import { describe, it, expect } from "vitest";
import { mutationReducer, applyOverrides, applyOrder, initialMutationState, type MutationState } from "./mutations";
import type { Wave } from "./types";

const move = (s: MutationState, id: string, from: "todo" | "doing" | "review" | "done", to: typeof from) =>
  mutationReducer(s, { type: "move", id, fromState: from, toState: to });

describe("mutationReducer", () => {
  it("applies an optimistic override and marks the card syncing", () => {
    const s = move(initialMutationState, "STO-1", "todo", "doing");
    expect(s.overrides["STO-1"]).toBe("doing");
    expect(s.sync["STO-1"]).toBe("syncing");
    expect(s.backup["STO-1"]).toBe("todo");
  });

  it("keeps the move and shows synced on success", () => {
    let s = move(initialMutationState, "STO-1", "todo", "doing");
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: true });
    expect(s.overrides["STO-1"]).toBe("doing");
    expect(s.sync["STO-1"]).toBe("synced");
    expect(s.backup["STO-1"]).toBeUndefined();
  });

  it("reverts the override and flags failed on a failure", () => {
    let s = move(initialMutationState, "STO-1", "todo", "doing");
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: false });
    expect(s.overrides["STO-1"]).toBeUndefined();
    expect(s.sync["STO-1"]).toBe("failed");
  });

  it("reverts and flags conflict when Linear moved out from under us", () => {
    let s = move(initialMutationState, "STO-1", "todo", "review");
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: false, conflict: true });
    expect(s.overrides["STO-1"]).toBeUndefined();
    expect(s.sync["STO-1"]).toBe("conflict");
  });

  it("clears the badge on settle but keeps a successful override", () => {
    let s = move(initialMutationState, "STO-1", "todo", "doing");
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: true });
    s = mutationReducer(s, { type: "settle", id: "STO-1" });
    expect(s.sync["STO-1"]).toBeUndefined();
    expect(s.overrides["STO-1"]).toBe("doing");
  });

  it("drops all local state when a fresh board reconciles", () => {
    let s = move(initialMutationState, "STO-1", "todo", "doing");
    s = mutationReducer(s, { type: "reconcile" });
    expect(s).toEqual(initialMutationState);
  });

  it("applies an optimistic sortOrder on reorder and reverts it on failure", () => {
    let s = mutationReducer(initialMutationState, { type: "reorder", id: "STO-1", fromSortOrder: 10, toSortOrder: 5 });
    expect(s.order["STO-1"]).toBe(5);
    expect(s.sync["STO-1"]).toBe("syncing");
    expect(s.backupOrder["STO-1"]).toBe(10);
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: false });
    expect(s.order["STO-1"]).toBeUndefined();
    expect(s.sync["STO-1"]).toBe("failed");
  });

  it("keeps the reordered sortOrder on success", () => {
    let s = mutationReducer(initialMutationState, { type: "reorder", id: "STO-1", fromSortOrder: 10, toSortOrder: 5 });
    s = mutationReducer(s, { type: "result", id: "STO-1", ok: true });
    expect(s.order["STO-1"]).toBe(5);
    expect(s.sync["STO-1"]).toBe("synced");
  });
});

describe("applyOverrides", () => {
  const waves: Wave[] = [
    {
      name: "W",
      stage: "build",
      tickets: [
        { id: "STO-1", title: "a", priority: "med", state: "todo", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
        { id: "STO-2", title: "b", priority: "med", state: "done", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
      ],
    },
  ];

  it("returns the same array when there are no overrides", () => {
    expect(applyOverrides(waves, {})).toBe(waves);
  });

  it("overrides only the matching ticket's state", () => {
    const out = applyOverrides(waves, { "STO-1": "review" });
    expect(out[0].tickets[0].state).toBe("review");
    expect(out[0].tickets[1].state).toBe("done");
  });
});

describe("applyOrder", () => {
  const waves: Wave[] = [
    {
      name: "W",
      stage: "build",
      tickets: [
        { id: "STO-1", title: "a", priority: "med", state: "todo", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [], sortOrder: 10 },
      ],
    },
  ];

  it("overrides sortOrder for matching tickets only", () => {
    const out = applyOrder(waves, { "STO-1": 3 });
    expect(out[0].tickets[0].sortOrder).toBe(3);
  });

  it("returns the same array when there are no order overrides", () => {
    expect(applyOrder(waves, {})).toBe(waves);
  });
});
