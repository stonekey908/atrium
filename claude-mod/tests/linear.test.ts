import { describe, expect, test } from "claude-code/testing";

import type { Call } from "../hooks/linear";
import { fetchIssues, findLinearTools, issueFromMcp, parseJson } from "../hooks/linear";

describe("findLinearTools", () => {
  const names = [
    "Read",
    "mcp__Linear__list_issues",
    "mcp__Linear__get_issue",
    "mcp__Linear__save_issue",
    "mcp__Linear__list_projects",
    "mcp__github__list_issues",
  ];

  test("prefers the configured server, else one whose name says linear", () => {
    expect(findLinearTools(names, "Linear")?.server).toBe("Linear");
    expect(findLinearTools(names, "nothing-like-it")?.server).toBe("Linear");
    expect(findLinearTools(names, "github")).toMatchObject({ server: "github", getIssue: null, saveIssue: null });
  });

  test("answers null with no tracker tools connected", () => {
    expect(findLinearTools(["Read", "Bash"])).toBeNull();
  });
});

describe("issueFromMcp", () => {
  test("flattens the shape list_issues returns", () => {
    const lite = issueFromMcp({
      id: "STO-2574",
      uuid: "2d7c",
      title: "Per-wave descriptions",
      url: "https://linear.app/stonekey/issue/STO-2574/x",
      priority: { value: 2, name: "High" },
      status: "Done",
      statusType: "completed",
      labels: ["ATR Wave 7 · Editable docs"],
      description: "- one\n- two",
      gitBranchName: "nick/sto-2574-x",
    });
    expect(lite).toEqual({
      id: "2d7c",
      identifier: "STO-2574",
      title: "Per-wave descriptions",
      url: "https://linear.app/stonekey/issue/STO-2574/x",
      priority: 2,
      stateType: "completed",
      stateName: "Done",
      labels: ["ATR Wave 7 · Editable docs"],
      description: "- one\n- two",
      branch: "nick/sto-2574-x",
    });
  });

  test("tolerates object labels, numeric priority and a status object", () => {
    const lite = issueFromMcp({ id: "X-1", title: "t", priority: 1, status: { name: "In Review", type: "started" }, labels: [{ name: "Sprint 2" }] });
    expect(lite).toMatchObject({ priority: 1, stateType: "started", stateName: "In Review", labels: ["Sprint 2"], id: "X-1" });
    expect(issueFromMcp({ nope: true })).toBeNull();
  });
});

describe("fetchIssues", () => {
  test("follows the cursor and sends the project filter", async () => {
    const calls: Record<string, unknown>[] = [];
    const call: Call = async (_tool, input) => {
      calls.push(input);
      const page = input.cursor === "c1" ? 2 : 1;
      return {
        text: JSON.stringify({
          issues: [{ id: `P-${page}`, title: `page ${page}`, statusType: "unstarted", status: "Todo", labels: [] }],
          hasNextPage: page === 1,
          cursor: page === 1 ? "c1" : null,
        }),
      };
    };
    const issues = await fetchIssues(call, "mcp__Linear__list_issues", "Atrium");
    expect(issues.map((i) => i.identifier)).toEqual(["P-1", "P-2"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ project: "Atrium", limit: 250 });
    expect(calls[1]).toMatchObject({ cursor: "c1" });
  });
});

describe("parseJson", () => {
  test("names a refusal, an error and non-JSON", () => {
    expect(() => parseJson({ deny: "no" }, "Listing")).toThrow(/refused: no/);
    expect(() => parseJson({ isError: true, text: "boom" }, "Listing")).toThrow(/failed: boom/);
    expect(() => parseJson({ text: "not json" }, "Listing")).toThrow(/not JSON/);
    expect(parseJson({ text: 'Result:\n{"a":1}' }, "Listing")).toEqual({ a: 1 });
    expect(parseJson({ result: { content: [{ type: "text", text: "[1]" }] } }, "Listing")).toEqual([1]);
  });
});
