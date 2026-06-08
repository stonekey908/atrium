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
  it("maps Linear workflow-state types onto todo/doing/review/done", () => {
    expect(mapState("completed")).toBe("done");
    expect(mapState("started", "In Progress")).toBe("doing");
    expect(mapState("started", "In Review")).toBe("review");
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
    { identifier: "STO-2461", title: "Board snapshot", url: "u2", priority: 1, stateType: "started", stateName: "In Review", labels: ["ATR Wave 0.6 · Cockpit data"], description: "scope" },
    { identifier: "STO-2468", title: "Read-only kanban", url: "u3", priority: 2, stateType: "started", stateName: "In Progress", labels: ["ATR Wave 0.7 · Sprint board"], description: null },
    { identifier: "STO-9999", title: "Dead", url: "u4", priority: 4, stateType: "canceled", stateName: "Canceled", labels: ["ATR Wave 0.7 · Sprint board"], description: null },
  ];
  const board = boardFromIssues(ISSUES, { projectName: "Atrium", generatedAt: "2026-06-08" });

  it("produces a board that passes validateBoard", () => {
    expect(() => validateBoard(board)).not.toThrow();
  });

  it("groups issues into named, ordered, non-empty waves with stage metadata", () => {
    expect(board.waves.map((w) => w.name)).toEqual([
      "Wave 0 · Visual layer",
      "Wave 0.6 · Cockpit data",
      "Wave 0.7 · Sprint board",
    ]);
    expect(board.waves[0].stage).toBe("release");
    // The current sprint is whichever wave sits at the Build stage.
    expect(board.waves.find((w) => w.name === "Wave 0.7 · Sprint board")!.stage).toBe("build");
  });

  it("excludes canceled issues", () => {
    const ids = board.waves.flatMap((w) => w.tickets.map((t) => t.id));
    expect(ids).not.toContain("STO-9999");
    expect(ids).toContain("STO-2468");
  });

  it("collects tickets with no recognized wave label into an Unsorted bucket", () => {
    const issues: LinearIssueLite[] = [
      { identifier: "STO-1", title: "in a wave", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: ["ATR Wave 0"], description: null },
      { identifier: "STO-2", title: "odd label", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: ["Some Other Label"], description: null },
      { identifier: "STO-3", title: "no labels", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: [], description: null },
    ];
    const b = boardFromIssues(issues, { projectName: "Atrium", generatedAt: "2026-06-08" });
    const unsorted = b.waves.find((w) => w.name === "Unsorted · No sprint");
    expect(unsorted).toBeTruthy();
    expect(unsorted!.tickets.map((t) => t.id).sort()).toEqual(["STO-2", "STO-3"]);
    expect(unsorted!.stage).toBe("");
  });

  it("adds no Unsorted bucket when every ticket has a wave label", () => {
    expect(board.waves.some((w) => w.name === "Unsorted · No sprint")).toBe(false);
  });

  it("maps ticket fields onto the board model", () => {
    const ticket = board.waves[0].tickets[0];
    expect(ticket).toMatchObject({ id: "STO-2095", priority: "high", state: "done" });
    expect(ticket.spec).toEqual(["a", "b", "c"]);
    expect(ticket.tests.discovered).toBe(false);
  });

  it("derives no spikes now that the gated waves were pruned", () => {
    expect(board.spikes).toEqual([]);
  });
});
