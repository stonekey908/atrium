import { describe, it, expect } from "vitest";
import {
  computePipeline,
  loopBacks,
  demoteState,
  uatCasesFromTicket,
  waveUatRollup,
  isUiTicket,
  waveTouchesUi,
} from "./views";
import type { Ticket, Wave } from "./types";

const tk = (id: string, spec: string[] = [], title = id): Ticket => ({
  id,
  title,
  priority: "med",
  state: "todo",
  spec,
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
});
const wave = (name: string, stage: string, opts: Partial<Wave> = {}): Wave => ({ name, stage, tickets: [], ...opts });

describe("computePipeline", () => {
  it("marks the stage with waves active, earlier stages done, later todo", () => {
    const stages = computePipeline([wave("A", "build"), wave("B", "build")]);
    const by = Object.fromEntries(stages.map((s) => [s.key, s.state]));
    expect(by.plan).toBe("done");
    expect(by.design).toBe("done");
    expect(by.build).toBe("active");
    expect(by.uat).toBe("todo");
    expect(stages.find((s) => s.key === "build")!.waves).toHaveLength(2);
  });

  it("spreads waves across their stages", () => {
    const stages = computePipeline([wave("A", "plan"), wave("B", "build"), wave("C", "release")]);
    expect(stages.find((s) => s.key === "plan")!.state).toBe("active");
    expect(stages.find((s) => s.key === "build")!.state).toBe("active");
    expect(stages.find((s) => s.key === "release")!.state).toBe("active");
  });
});

describe("loopBacks", () => {
  it("returns only waves at Pass ≥ 2", () => {
    const got = loopBacks([wave("A", "build", { passN: 1 }), wave("B", "uat", { passN: 3 })]);
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

describe("uatCasesFromTicket / waveUatRollup", () => {
  it("turns each acceptance criterion into a pending case, de-duped", () => {
    const cases = uatCasesFromTicket(tk("STO-1", ["Renders the kanban", "Renders the kanban", "Drags to sync"]));
    expect(cases.map((c) => c.name)).toEqual(["Renders the kanban", "Drags to sync"]);
    expect(cases.every((c) => c.status === "pending")).toBe(true);
  });

  it("rolls up a wave's cases", () => {
    const w = wave("W", "build", { tickets: [tk("A", ["x", "y"]), tk("B", ["z"])] });
    expect(waveUatRollup(w)).toEqual({ total: 3, pass: 0, fail: 0, pending: 3 });
  });
});

describe("isUiTicket / waveTouchesUi", () => {
  it("flags UI tickets by title or acceptance criteria", () => {
    expect(isUiTicket(tk("STO-1", [], "Sprint kanban view"))).toBe(true);
    expect(isUiTicket(tk("STO-2", ["Renders a modal dialog"], "Backend sync"))).toBe(true);
    expect(isUiTicket(tk("STO-3", ["Parse the GraphQL response"], "Linear writer"))).toBe(false);
  });

  it("detects UI at the wave level", () => {
    expect(waveTouchesUi(wave("W", "plan", { tickets: [tk("A", [], "Add a button")] }))).toBe(true);
    expect(waveTouchesUi(wave("W", "plan", { tickets: [tk("A", ["compute totals"], "rollup math")] }))).toBe(false);
  });
});
