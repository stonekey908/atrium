import { describe, it, expect } from "vitest";
import {
  SnapshotSource,
  validateBoard,
  mapPriority,
  mapState,
  specFromDescription,
  boardFromIssues,
  activityFromComments,
  deriveStage,
  fullStatus,
  isCanceled,
  type LinearIssueLite,
  type Ticket,
} from "./board";

const ticketIn = (state: Ticket["state"]): Ticket => ({
  id: "x",
  title: "x",
  url: "u",
  priority: "med",
  state,
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0, discovered: false },
  activity: [],
});

describe("deriveStage", () => {
  it("derives the pipeline stage from ticket states", () => {
    expect(deriveStage([ticketIn("done"), ticketIn("done")], "plan")).toBe("release");
    expect(deriveStage([ticketIn("doing"), ticketIn("todo")], "plan")).toBe("build");
    expect(deriveStage([ticketIn("review"), ticketIn("done")], "plan")).toBe("build");
    expect(deriveStage([ticketIn("todo"), ticketIn("todo")], "plan")).toBe("plan");
  });

  it("uses the fallback only for an empty wave", () => {
    expect(deriveStage([], "uat")).toBe("uat");
  });

  it("ignores canceled tickets when deriving the stage", () => {
    const canceled: Ticket = { ...ticketIn("todo"), status: "Canceled" };
    // All active tickets done → release, even alongside a canceled one.
    expect(deriveStage([ticketIn("done"), canceled], "plan")).toBe("release");
    // A wave of only canceled tickets falls back (no active work).
    expect(deriveStage([canceled], "plan")).toBe("plan");
  });
});

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
          url: "https://linear.app/x/issue/STO-2095",
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

describe("fullStatus", () => {
  it("keeps the exact Linear status, distinguishing Backlog/Todo and Canceled/Duplicate", () => {
    expect(fullStatus("completed", "Done")).toBe("Done");
    expect(fullStatus("started", "In Progress")).toBe("In Progress");
    expect(fullStatus("started", "In Review")).toBe("In Review");
    expect(fullStatus("backlog", "Backlog")).toBe("Backlog");
    expect(fullStatus("unstarted", "Todo")).toBe("Todo");
    expect(fullStatus("canceled", "Canceled")).toBe("Canceled");
    expect(fullStatus("canceled", "Duplicate")).toBe("Duplicate");
  });
});

describe("specFromDescription", () => {
  it("pulls every bullet line, stripped of markers (uncapped since STO-2494)", () => {
    const desc = "intro\n- crit one\n- crit two\n- crit three\n- crit four";
    expect(specFromDescription(desc)).toEqual(["crit one", "crit two", "crit three", "crit four"]);
  });

  it("returns [] when there are no bullets", () => {
    expect(specFromDescription("just a paragraph")).toEqual([]);
    expect(specFromDescription(null)).toEqual([]);
  });
});

describe("activityFromComments", () => {
  it("maps comment bodies onto the four audit-trail kinds", () => {
    const items = activityFromComments([
      { body: "Starting work on this", createdAt: "2026-06-08T10:00:00.000Z" },
      { body: "**Plan locked** — three slices", createdAt: "2026-06-08T11:00:00.000Z" },
      { body: "Slice 1 complete", createdAt: "2026-06-08T12:00:00.000Z" },
      { body: "Closed · merged to main", createdAt: "2026-06-08T13:00:00.000Z" },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["pickup", "plan", "phase", "close"]);
    expect(items[0].text).toBe("Starting work on this");
    expect(items[1].text).toBe("Plan locked — three slices"); // markdown stripped
    expect(items[0].when).toBe("2026-06-08");
  });

  it("falls back to phase for an unrecognized body", () => {
    expect(activityFromComments([{ body: "a random note", createdAt: "2026-06-08T00:00:00.000Z" }])[0].kind).toBe(
      "phase",
    );
  });
});

describe("boardFromIssues", () => {
  const ISSUES: LinearIssueLite[] = [
    { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-2095", title: "AppShell", url: "u1", priority: 2, stateType: "completed", stateName: "Done", labels: ["ATR Wave 0"], description: "- a\n- b\n- c\n- d" },
    { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-2461", title: "Board snapshot", url: "u2", priority: 1, stateType: "started", stateName: "In Review", labels: ["ATR Wave 0.6 · Cockpit data"], description: "scope" },
    { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-2468", title: "Read-only kanban", url: "u3", priority: 2, stateType: "started", stateName: "In Progress", labels: ["ATR Wave 0.7 · Sprint board"], description: null },
    { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-9999", title: "Dead", url: "u4", priority: 4, stateType: "canceled", stateName: "Canceled", labels: ["ATR Wave 0.7 · Sprint board"], description: null },
  ];
  const board = boardFromIssues(ISSUES, { projectName: "Atrium", generatedAt: "2026-06-08" });

  it("produces a board that passes validateBoard", () => {
    expect(() => validateBoard(board)).not.toThrow();
  });

  it("detects waves dynamically from labels, named from the label and ordered by number", () => {
    // Names are derived from the labels (leading "ATR " dropped), not a hardcoded map.
    expect(board.waves.map((w) => w.name)).toEqual([
      "Wave 0",
      "Wave 0.6 · Cockpit data",
      "Wave 0.7 · Sprint board",
    ]);
    expect(board.waves[0].stage).toBe("release");
    expect(board.waves.find((w) => w.name === "Wave 0.7 · Sprint board")!.stage).toBe("build");
  });

  it("honours a custom wave prefix (e.g. Sprint labels)", () => {
    const issues: LinearIssueLite[] = [
      { id: "u", sortOrder: 1, comments: [], identifier: "STO-A", title: "a", url: "u", priority: 3, stateType: "started", stateName: "In Progress", labels: ["Sprint 2"], description: null },
    ];
    const b = boardFromIssues(issues, { projectName: "Atrium", generatedAt: "2026-06-08", wavePrefix: "Sprint" });
    expect(b.waves.map((w) => w.name)).toEqual(["Sprint 2"]);
    expect(b.waves[0].stage).toBe("build");
  });

  it("carries each wave's label description + id from the live label info (STO-2574)", () => {
    const issues: LinearIssueLite[] = [
      {
        id: "u", sortOrder: 1, comments: [], identifier: "STO-1", title: "t", url: "u", priority: 2,
        stateType: "started", stateName: "In Progress", labels: ["ATR Wave 9 · Docs"],
        labelInfo: [{ name: "ATR Wave 9 · Docs", id: "lbl-9", description: "What wave 9 entails" }], description: null,
      },
    ];
    const b = boardFromIssues(issues, { projectName: "Atrium", generatedAt: "d" });
    const w = b.waves.find((x) => x.label === "ATR Wave 9 · Docs")!;
    expect(w.description).toBe("What wave 9 entails");
    expect(w.labelId).toBe("lbl-9");
  });

  it("does not render a wave whose only tickets are canceled (no blank waves)", () => {
    const issues: LinearIssueLite[] = [
      { id: "u", sortOrder: 1, comments: [], identifier: "STO-A", title: "live", url: "u", priority: 2, stateType: "started", stateName: "In Progress", labels: ["ATR Wave 1"], description: null },
      { id: "u", sortOrder: 1, comments: [], identifier: "STO-DEAD", title: "dead", url: "u", priority: 4, stateType: "canceled", stateName: "Canceled", labels: ["ATR Wave 9 · Abandoned"], description: null },
    ];
    const b = boardFromIssues(issues, { projectName: "Atrium", generatedAt: "2026-06-08" });
    expect(b.waves.map((w) => w.name)).toContain("Wave 1");
    expect(b.waves.map((w) => w.name)).not.toContain("Wave 9 · Abandoned");
    expect(b.waves.flatMap((w) => w.tickets).map((t) => t.id)).not.toContain("STO-DEAD");
  });

  it("handles a project never set up with Atrium labels — everything lands in Unsorted", () => {
    const issues: LinearIssueLite[] = [
      { id: "u", sortOrder: 1, comments: [], identifier: "EXT-1", title: "a", url: "u", priority: 2, stateType: "started", stateName: "In Progress", labels: ["Frontend"], description: null },
      { id: "u", sortOrder: 1, comments: [], identifier: "EXT-2", title: "b", url: "u", priority: 3, stateType: "unstarted", stateName: "Todo", labels: [], description: null },
    ];
    const b = boardFromIssues(issues, { projectName: "Other", generatedAt: "2026-06-08" });
    const unsorted = b.waves.find((w) => w.name === "Unsorted · No sprint");
    expect(unsorted).toBeTruthy();
    expect(unsorted!.tickets.map((t) => t.id).sort()).toEqual(["EXT-1", "EXT-2"]);
  });

  it("surfaces canceled issues, flagged via status (not dropped)", () => {
    const all = board.waves.flatMap((w) => w.tickets);
    const dead = all.find((t) => t.id === "STO-9999");
    expect(dead).toBeTruthy();
    expect(dead!.status).toBe("Canceled");
    expect(isCanceled(dead!)).toBe(true);
    // The canceled ticket doesn't change its wave's derived stage (still build).
    expect(board.waves.find((w) => w.name === "Wave 0.7 · Sprint board")!.stage).toBe("build");
  });

  it("collects tickets with no recognized wave label into an Unsorted bucket", () => {
    const issues: LinearIssueLite[] = [
      { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-1", title: "in a wave", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: ["ATR Wave 0"], description: null },
      { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-2", title: "odd label", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: ["Some Other Label"], description: null },
      { id: "uuid", sortOrder: 1, comments: [], identifier: "STO-3", title: "no labels", url: "u", priority: 3, stateType: "backlog", stateName: "Backlog", labels: [], description: null },
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
    expect(ticket.spec).toEqual(["a", "b", "c", "d"]);
    expect(ticket.tests.discovered).toBe(false);
  });

  it("derives no spikes now that the gated waves were pruned", () => {
    expect(board.spikes).toEqual([]);
  });
});

// ── Flexible wave detection (STO-2495) ───────────────────────────────────────

import { parsePrefixes, makeWaveLabelMatcher } from "./board";

/** Representative labels for the wave-detection corpus — what the heuristic must hold against. */
const CORPUS = {
  sprintish: [
    "CG Phase 3",
    "CG Sprint A: Launch Blockers",
    "CG Sprint B: Submission",
    "Anvil Sprint 2",
    "sprint-12",
    "SS Wave 7",
    "CP Wave 5",
    "TL Wave 6",
    "CV Slice 6",
    "Wave 14",
    "phase-1",
  ],
  not: [
    "gemmy-feature",
    "gemmy-bug",
    "LKT polish",
    "LKT tmux",
    "Igloo Post-MVP",
    "Igloo P4: Forwarding", // deliberately conservative: bare P<n> stays Unsorted
    "SS v1 Build",
    "Hackathon",
    "guardian",
    "ATR Spike",
  ],
};

describe("parsePrefixes", () => {
  it("splits a comma-separated setting, trimming each entry", () => {
    expect(parsePrefixes("CG Phase, CG Sprint")).toEqual(["CG Phase", "CG Sprint"]);
  });

  it("keeps the single-string form and defaults when empty", () => {
    expect(parsePrefixes("ATR Wave")).toEqual(["ATR Wave"]);
    expect(parsePrefixes(undefined)).toEqual(["ATR Wave"]);
    expect(parsePrefixes(" , ")).toEqual(["ATR Wave"]);
  });
});

describe("makeWaveLabelMatcher", () => {
  it("uses configured prefixes when any label matches them (heuristic OFF)", () => {
    const labels = ["ATR Wave 6 · Ship & portability", "ATR Spike", "sprint-12"];
    const matches = makeWaveLabelMatcher("ATR Wave", labels);
    expect(matches("ATR Wave 6 · Ship & portability")).toBe(true);
    // sprint-12 would pass the heuristic, but prefix mode is authoritative.
    expect(matches("sprint-12")).toBe(false);
  });

  it("supports a prefix list", () => {
    const labels = ["CG Phase 3", "CG Sprint A: Launch Blockers"];
    const matches = makeWaveLabelMatcher("CG Phase, CG Sprint", labels);
    expect(matches("CG Phase 3")).toBe(true);
    expect(matches("CG Sprint A: Launch Blockers")).toBe(true);
  });

  it("falls back to the sprint-ish heuristic when no prefix matches anything", () => {
    const matches = makeWaveLabelMatcher("ATR Wave", [...CORPUS.sprintish, ...CORPUS.not]);
    for (const label of CORPUS.sprintish) expect(matches(label), label).toBe(true);
    for (const label of CORPUS.not) expect(matches(label), label).toBe(false);
  });
});

describe("boardFromIssues with foreign conventions", () => {
  const issue = (id: string, label: string): LinearIssueLite => ({
    id: `uuid-${id}`,
    identifier: id,
    title: id,
    url: "",
    priority: 3,
    sortOrder: 0,
    stateType: "unstarted",
    stateName: "Todo",
    labels: [label],
    description: null,
    comments: [],
  });

  it("groups CarGuide-style labels into waves with zero config (default prefix)", () => {
    const board = boardFromIssues(
      [issue("CG-1", "CG Phase 1"), issue("CG-2", "CG Sprint A: Launch Blockers"), issue("CG-3", "Hackathon")],
      { projectName: "CarGuide", generatedAt: "2026-06-11" },
    );
    expect(board.waves.map((w) => w.label)).toContain("CG Phase 1");
    expect(board.waves.map((w) => w.label)).toContain("CG Sprint A: Launch Blockers");
    // Non-sprint-ish labels stay visibly Unsorted, never lost.
    const unsorted = board.waves.find((w) => w.name.startsWith("Unsorted"));
    expect(unsorted?.tickets.map((t) => t.id)).toEqual(["CG-3"]);
  });
});
