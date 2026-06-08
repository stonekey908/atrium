import { describe, it, expect } from "vitest";
import { SnapshotSource, LinearSdkSource, validateBoard } from "./board";

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
  it("load() validates and returns the board", () => {
    expect(new SnapshotSource(GOOD).load().waves).toHaveLength(1);
  });

  it("load() throws on malformed data", () => {
    expect(() => new SnapshotSource({ project: "x" }).load()).toThrow();
  });
});

describe("LinearSdkSource", () => {
  it("load() is not implemented yet — the live path is a stub", () => {
    expect(() => new LinearSdkSource().load()).toThrow(/not implemented/i);
  });
});
