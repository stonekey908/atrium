import { describe, it, expect } from "vitest";
import {
  SnapshotSource,
  validateBoard,
  mapPriority,
  mapState,
  specFromDescription,
  boardFromIssues,
  type LinearIssueLite,
} from "./board";

/** A minimal well-formed board used across the validation tests. */
const GOOD = {
  project: "Atrium",
  generatedAt: "2026-06-08",
  spikes: [{ id: "STO-2146", code: "T-110", gatesWave: "Wave 1", state: "todo" }],
  waves: [
    {
      name: "Wave 0 · Visual layer",
      label: "ATR Wave 0",
      stage: "release",
      passN: 1,
      gatedBy: null,
      tickets: [
        {
          id: "STO-2095",
          title: "AppShell — folder canvas + rails",
          url: "https://linear.app/stonekey/issue/STO-2095",
          priority: "high",
          state: "done",
          spec: ["280px file-tree rail + folder page"],
          tests: { passed: 0, failed: 0, missing: 0, discovered: false },
          activity: [{ kind: "close", text: "Closed · merged", when: "May 6" }],
        },
      ],
    },
  ],
};

describe("validateBoard", () => {
  it("accepts a well-formed board and returns it typed", () => {
    const board = validateBoard(GOOD);
    expect(board.project).toBe("Atrium");
    expect(board.waves[0].tickets[0].id).toBe("STO-2095");
    expect(board.spikes[0].code).toBe("T-110");
  });

  it("throws on non-object input", () => {
    expect(() => validateBoard(null)).toThrow();
    expect(() => validateBoard("nope")).toThrow();
  });

  it("throws when waves is missing", () => {
    const { waves: _omit, ...noWaves } = GOOD;
    expect(() => validateBoard(noWaves)).toThrow(/waves/i);
  });

  it("throws when a ticket has an invalid state", () => {
    const bad = structuredClone(GOOD);
    bad.waves[0].tickets[0].state = "wip"; // not todo | doing | done
    expect(() => validateBoard(bad)).toThrow(/state/i);
  });

  it("throws when a ticket has an invalid priority", () => {
    const bad = structuredClone(GOOD);
    bad.waves[0].tickets[0].priority = "blocker"; // not urgent|high|med|low
    expect(() => validateBoard(bad)).toThrow(/priority/i);
  });
});

describe("SnapshotSource", () => {
  it("load() validates and resolves the board", async () => {
    expect((await new SnapshotSource(GOOD).load()).waves).toHaveLength(1);
  });

  it("load() rejects on malformed data", async () => {
    await expect(new SnapshotSource({ project: "x" }).load()).rejects.toThrow();
  });
});

describe("mapPriority", () => {
  it("maps Linear's 0-4 priority onto our four buckets", () => {
    expect(mapPriority(1)).toBe("urgent");
    expect(mapPriority(2)).toBe("high");
    expect(mapPriority(3)).toBe("med");
    expect(mapPriority(4)).toBe("low");
    expect(mapPriority(0)).toBe("low");
  });
});

describe("mapState", () => {
  it("maps Linear workflow-state types onto todo/doing/done", () => {
    expect(mapState("completed")).toBe("done");
    expect(mapState("started")).toBe("doing");
    expect(mapState("backlog")).toBe("todo");
    expect(mapState("unstarted")).toBe("todo");
  });
});

describe("specFromDescription", () => {
  it("pulls up to 3 bullet lines, stripped of markers", () => {
    const desc = "intro\n- crit one\n- crit two\n- crit three\n- crit four";
    expect(specFromDescription(desc)).toEqual(["crit one", "crit two", "crit three"]);
  });

  it("returns [] when there are no bullets", () => {
    expect(specFromDescription("just a paragraph")).toEqual([]);
    expect(specFromDescription(null)).toEqual([]);
  });
});

describe("boardFromIssues", () => {
  const ISSUES: LinearIssueLite[] = [
    { identifier: "STO-2095", title: "AppShell", url: "u1", priority: 2, stateType: "completed", stateName: "Done", labels: ["ATR Wave 0"], description: "- a\n- b\n- c\n- d" },
    { identifier: "STO-2461", title: "Board snapshot", url: "u2", priority: 1, stateType: "backlog", stateName: "Backlog", labels: ["ATR Wave 0.6 · Cockpit data"], description: "scope" },
    { identifier: "STO-2146", title: "Spike T-110", url: "u3", priority: 3, stateType: "unstarted", stateName: "Todo", labels: ["ATR Wave 1", "ATR Spike"], description: null },
    { identifier: "STO-9999", title: "Dead", url: "u4", priority: 4, stateType: "canceled", stateName: "Canceled", labels: ["ATR Wave 1"], description: null },
  ];
  const board = boardFromIssues(ISSUES, { projectName: "Atrium", generatedAt: "2026-06-08" });

  it("produces a board that passes validateBoard", () => {
    expect(() => validateBoard(board)).not.toThrow();
  });

  it("groups issues into named, ordered, non-empty waves with stage + gatedBy metadata", () => {
    expect(board.waves.map((w) => w.name)).toEqual([
      "Wave 0 · Visual layer",
      "Wave 0.6 · Cockpit data",
      "Wave 1 · CLI bridge",
    ]);
    const w1 = board.waves.find((w) => w.name === "Wave 1 · CLI bridge")!;
    expect(w1.gatedBy).toBe("T-110");
    expect(board.waves[0].stage).toBe("release");
  });

  it("excludes canceled issues", () => {
    const ids = board.waves.flatMap((w) => w.tickets.map((t) => t.id));
    expect(ids).not.toContain("STO-9999");
    expect(ids).toContain("STO-2146");
  });

  it("maps ticket fields and derives spikes from known ids present in the input", () => {
    const ticket = board.waves[0].tickets[0];
    expect(ticket).toMatchObject({ id: "STO-2095", priority: "high", state: "done" });
    expect(ticket.spec).toEqual(["a", "b", "c"]);
    expect(ticket.tests.discovered).toBe(false);
    expect(board.spikes).toEqual([{ id: "STO-2146", code: "T-110", gatesWave: "Wave 1", state: "todo" }]);
  });
});
