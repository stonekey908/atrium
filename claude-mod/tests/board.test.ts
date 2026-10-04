import { describe, expect, test } from "claude-code/testing";

import type { LinearIssueLite } from "../hooks/board";
import { boardFromIssues, currentSprint, groupByState, matchProject, nextStatus, resolveActiveTicket } from "../hooks/board";

const issue = (over: Partial<LinearIssueLite> & { identifier: string }): LinearIssueLite => ({
  id: `uuid-${over.identifier}`,
  title: `Title ${over.identifier}`,
  url: `https://linear.app/x/issue/${over.identifier}`,
  priority: 3,
  stateType: "unstarted",
  stateName: "Todo",
  labels: ["ATR Wave 1 · Foundations"],
  description: null,
  branch: null,
  ...over,
});

const OPTS = { projectName: "Atrium", generatedAt: "2026-10-04T00:00:00Z" };

describe("boardFromIssues", () => {
  test("groups tickets into waves by label, in wave-number order", () => {
    const board = boardFromIssues(
      [
        issue({ identifier: "A-1", labels: ["ATR Wave 2 · Polish"] }),
        issue({ identifier: "A-2", labels: ["ATR Wave 1 · Foundations"], stateType: "started", stateName: "In Progress" }),
        issue({ identifier: "A-3", labels: ["ATR Wave 1 · Foundations"], stateType: "completed", stateName: "Done" }),
        issue({ identifier: "A-4", labels: [] }),
      ],
      OPTS,
    );
    expect(board.waves.map((w) => w.name)).toEqual(["Wave 1 · Foundations", "Wave 2 · Polish", "Unsorted · No sprint"]);
    expect(board.waves[0]?.stage).toBe("build");
    expect(board.waves[1]?.stage).toBe("plan");
    expect(board.waves[0]?.tickets.map((t) => t.state)).toEqual(["doing", "done"]);
  });

  test("falls back to sprint-ish labels when no prefix matches", () => {
    const board = boardFromIssues(
      [issue({ identifier: "B-1", labels: ["CG Phase 3", "bug"] }), issue({ identifier: "B-2", labels: ["sprint-12"] })],
      OPTS,
    );
    expect(board.waves.map((w) => w.label)).toEqual(["CG Phase 3", "sprint-12"]);
  });

  test("canceled tickets never make a wave of their own and stay flagged", () => {
    const board = boardFromIssues(
      [
        issue({ identifier: "C-1", labels: ["ATR Wave 9 · Old"], stateType: "canceled", stateName: "Canceled" }),
        issue({ identifier: "C-2", labels: ["ATR Wave 1 · Foundations"], stateType: "duplicate", stateName: "Duplicate" }),
        issue({ identifier: "C-3", labels: ["ATR Wave 1 · Foundations"] }),
      ],
      OPTS,
    );
    expect(board.waves.map((w) => w.name)).toEqual(["Wave 1 · Foundations"]);
    const wave = board.waves[0];
    expect(wave?.tickets.find((t) => t.id === "C-2")?.status).toBe("Duplicate");
    expect(groupByState(wave!).flatMap((g) => g.tickets.map((t) => t.id))).toEqual(["C-3"]);
  });
});

describe("currentSprint and resolveActiveTicket", () => {
  const board = boardFromIssues(
    [
      issue({ identifier: "D-1", labels: ["ATR Wave 1 · Done"], stateType: "completed", stateName: "Done" }),
      issue({ identifier: "D-2", labels: ["ATR Wave 2 · Now"], stateType: "started", stateName: "In Review" }),
      issue({ identifier: "D-3", labels: ["ATR Wave 2 · Now"] }),
      issue({ identifier: "D-4", labels: ["ATR Wave 3 · Next"], branch: "nick/d-4-later" }),
    ],
    OPTS,
  );

  test("spotlights the wave with active work; an override wins", () => {
    expect(currentSprint(board.waves)?.name).toBe("Wave 2 · Now");
    expect(currentSprint(board.waves, "Wave 3 · Next")?.name).toBe("Wave 3 · Next");
    expect(currentSprint(board.waves, "nope")?.name).toBe("Wave 2 · Now");
  });

  test("finds the ticket by id in the branch, by the tracker's branch, else the one in progress", () => {
    expect(resolveActiveTicket(board.waves, "feat/d-3-thing")?.id).toBe("D-3");
    expect(resolveActiveTicket(board.waves, "nick/d-4-later")?.id).toBe("D-4");
    expect(resolveActiveTicket(board.waves, "main")).toBeNull();
    const doing = boardFromIssues([issue({ identifier: "E-1", stateType: "started", stateName: "In Progress" })], OPTS);
    expect(resolveActiveTicket(doing.waves, "main")?.id).toBe("E-1");
  });
});

test("nextStatus walks the workflow and stops at the end", () => {
  expect(nextStatus("Backlog")).toBe("Todo");
  expect(nextStatus("Todo")).toBe("In Progress");
  expect(nextStatus("In Progress")).toBe("In Review");
  expect(nextStatus("In Review")).toBe("Done");
  expect(nextStatus("Done")).toBeNull();
  expect(nextStatus("Canceled")).toBeNull();
});

test("matchProject relates a folder name to a project loosely", () => {
  expect(matchProject(["atrium"], ["Atrium Studio", "Atrium"])).toBe("Atrium");
  expect(matchProject(["atrium-cockpit"], ["Atrium Cockpit"])).toBe("Atrium Cockpit");
  expect(matchProject(["something-else"], ["Atrium"])).toBeNull();
});
