import { describe, it, expect } from "vitest";
import { loopBacks, demoteState } from "./views";
import type { Wave } from "./types";

const wave = (name: string, opts: Partial<Wave> = {}): Wave => ({ name, tickets: [], ...opts });

describe("loopBacks", () => {
  it("returns only waves at Pass ≥ 2", () => {
    const got = loopBacks([wave("A", { passN: 1 }), wave("B", { passN: 3 })]);
    expect(got.map((w) => w.name)).toEqual(["B"]);
  });
});

describe("demoteState", () => {
  it("sends active work back to backlog but leaves done/todo unchanged", () => {
    expect(demoteState("review")).toBe("backlog");
    expect(demoteState("doing")).toBe("backlog");
    expect(demoteState("done")).toBeUndefined();
    expect(demoteState("todo")).toBeUndefined();
  });
});
