import { describe, it, expect } from "vitest";
import { computePipeline, effectiveStage, loopBacks, demoteState, isUiTicket, waveTouchesUi } from "./views";
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

describe("effectiveStage (STO-2496 stage-lighting rules)", () => {
  it("keeps a plain unstarted wave at PRD (plan)", () => {
    expect(effectiveStage(wave("A", "plan", { tickets: [tk("T", ["compute totals"], "rollup math")] }))).toBe("plan");
  });

  it("lights Design for an unstarted wave with discovered mockups", () => {
    const w = wave("A", "plan", {
      files: { mockups: [{ name: "m.html", path: "/r/m.html", kind: "html" }], docs: [] },
    });
    expect(effectiveStage(w)).toBe("design");
  });

  it("lights Design for an unstarted wave with UI-flagged tickets", () => {
    expect(effectiveStage(wave("A", "plan", { tickets: [tk("T", [], "Add a button")] }))).toBe("design");
  });

  it("never overrides started or shipped waves", () => {
    const files = { mockups: [{ name: "m.html", path: "/r/m.html", kind: "html" as const }], docs: [] };
    expect(effectiveStage(wave("A", "build", { files }))).toBe("build");
    expect(effectiveStage(wave("A", "release", { files }))).toBe("release");
  });
});

describe("computePipeline", () => {
  it("marks the stage with waves active, earlier stages done, later todo", () => {
    const stages = computePipeline([wave("A", "build"), wave("B", "build")]);
    const by = Object.fromEntries(stages.map((s) => [s.key, s.state]));
    expect(by.plan).toBe("done");
    expect(by.design).toBe("done");
    expect(by.build).toBe("active");
    expect(by.release).toBe("todo");
    expect(stages.find((s) => s.key === "build")!.waves).toHaveLength(2);
  });

  it("is the four-stage PRD → Design → Build → Release pipeline", () => {
    expect(computePipeline([]).map((s) => s.label)).toEqual(["PRD", "Design", "Build", "Release"]);
  });

  it("spreads waves across their stages, honouring the Design lighting rule", () => {
    const designy = wave("D", "plan", {
      files: { mockups: [{ name: "m.html", path: "/r/m.html", kind: "html" }], docs: [] },
    });
    const stages = computePipeline([wave("A", "plan"), designy, wave("B", "build"), wave("C", "release")]);
    expect(stages.find((s) => s.key === "plan")!.state).toBe("active");
    expect(stages.find((s) => s.key === "design")!.waves.map((w) => w.name)).toEqual(["D"]);
    expect(stages.find((s) => s.key === "build")!.state).toBe("active");
    expect(stages.find((s) => s.key === "release")!.state).toBe("active");
  });
});

describe("loopBacks", () => {
  it("returns only waves at Pass ≥ 2", () => {
    const got = loopBacks([wave("A", "build", { passN: 1 }), wave("B", "build", { passN: 3 })]);
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
