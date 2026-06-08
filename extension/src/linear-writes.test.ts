import { describe, it, expect } from "vitest";
import { resolveStateId, type WorkflowState } from "./linear-writes";

/** A typical team: two "started" states (In Progress + In Review) plus the
 *  standard backlog/unstarted/completed/canceled. */
const STATES: WorkflowState[] = [
  { id: "s-backlog", name: "Backlog", type: "backlog" },
  { id: "s-todo", name: "Todo", type: "unstarted" },
  { id: "s-doing", name: "In Progress", type: "started" },
  { id: "s-review", name: "In Review", type: "started" },
  { id: "s-done", name: "Done", type: "completed" },
  { id: "s-cancel", name: "Canceled", type: "canceled" },
];

describe("resolveStateId", () => {
  it("maps each column onto the right workflow-state id", () => {
    expect(resolveStateId(STATES, "done")).toBe("s-done");
    expect(resolveStateId(STATES, "review")).toBe("s-review");
    expect(resolveStateId(STATES, "doing")).toBe("s-doing");
    expect(resolveStateId(STATES, "todo")).toBe("s-todo");
  });

  it("matches review by name even when it is custom", () => {
    const custom: WorkflowState[] = [
      { id: "a", name: "Building", type: "started" },
      { id: "b", name: "Peer review", type: "started" },
      { id: "c", name: "Shipped", type: "completed" },
    ];
    expect(resolveStateId(custom, "review")).toBe("b");
    expect(resolveStateId(custom, "doing")).toBe("a");
  });

  it("falls back to the first started state when no review-named state exists", () => {
    const noReview: WorkflowState[] = [
      { id: "only", name: "Working", type: "started" },
      { id: "done", name: "Done", type: "completed" },
    ];
    expect(resolveStateId(noReview, "review")).toBe("only");
    expect(resolveStateId(noReview, "doing")).toBe("only");
  });

  it("prefers unstarted over backlog for todo, and uses backlog if that's all", () => {
    expect(resolveStateId(STATES, "todo")).toBe("s-todo");
    const backlogOnly: WorkflowState[] = [{ id: "bk", name: "Backlog", type: "backlog" }];
    expect(resolveStateId(backlogOnly, "todo")).toBe("bk");
  });

  it("returns null when the needed state type is absent", () => {
    const started: WorkflowState[] = [{ id: "x", name: "Doing", type: "started" }];
    expect(resolveStateId(started, "done")).toBeNull();
    expect(resolveStateId(started, "todo")).toBeNull();
  });
});
