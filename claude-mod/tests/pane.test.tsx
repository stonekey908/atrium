import { expect, mock, test } from "claude-code/testing";
import type { On } from "claude-code";

const ISSUES = [
  { id: "STO-1", uuid: "u1", title: "Lay the foundations", url: "https://linear.app/x/issue/STO-1", priority: { value: 2, name: "High" }, status: "Done", statusType: "completed", labels: ["ATR Wave 1 · Foundations"], description: "done" },
  { id: "STO-2", uuid: "u2", title: "Wire the board", url: "https://linear.app/x/issue/STO-2", priority: { value: 1, name: "Urgent" }, status: "In Progress", statusType: "started", labels: ["ATR Wave 2 · Cockpit"], description: "- draw it\n- ship it", gitBranchName: "nick/sto-2-wire" },
  { id: "STO-3", uuid: "u3", title: "Polish the strip", url: "https://linear.app/x/issue/STO-3", priority: { value: 3, name: "Medium" }, status: "Todo", statusType: "unstarted", labels: ["ATR Wave 2 · Cockpit"], description: null },
];

/** Issues per project name; a created project starts empty. */
const ISSUES_BY_PROJECT: Record<string, typeof ISSUES> = { Atrium: ISSUES };

const RUN = { origin: { kind: "composer" as const }, presentation: { isFullscreen: true, columns: 120 } };
const PANE_PROPS = { title: "Atrium", isFocused: false, bodyColumns: 100, placement: "inline" as const, scroll: { offset: 0, bodyRows: 40 }, view: {} };

/** The world beneath the mod: a Linear connector, a git repo on a ticket branch, an empty tree. */
type Fs = {
  list: (path: string) => { name: string; kind: "file" | "dir" | "other"; size: number; mtimeMs: number; isLink: boolean }[];
  exists: (path: string) => boolean;
  read: (path: string) => string;
};
const EMPTY_FS: Fs = { list: () => [], exists: () => false, read: () => "" };

function world(on: On, writes: Record<string, unknown>[], fs: Fs = EMPTY_FS, root = "/repo/atrium") {
  mock.clock(on, { now: 1_700_000_000_000 });
  on("tool.call", { tool: "mcp__Linear__list_teams" }, () => ({ result: {}, text: JSON.stringify({ teams: [{ id: "t1", name: "Stonekey" }], hasNextPage: false }) }));
  on("tool.call", { tool: "mcp__Linear__save_project" }, ($, e) => {
    writes.push({ project: e.name, teams: e.addTeams });
    ISSUES_BY_PROJECT[String(e.name)] = [];
    return { result: {}, text: JSON.stringify({ id: "P-9", name: e.name, url: "https://linear.app/x/project/p9" }) };
  });
  on("tool.list", () => ({
    value: [
      { name: "mcp__Linear__list_issues", description: "", mcp: true },
      { name: "mcp__Linear__get_issue", description: "", mcp: true },
      { name: "mcp__Linear__save_issue", description: "", mcp: true },
      { name: "mcp__Linear__list_projects", description: "", mcp: true },
      { name: "mcp__Linear__save_project", description: "", mcp: true },
      { name: "mcp__Linear__list_teams", description: "", mcp: true },
    ],
  }));
  on("tool.call", { tool: "mcp__Linear__list_projects" }, () => ({
    result: {},
    text: JSON.stringify({ projects: [{ id: "P-1", name: "Atrium" }, { id: "P-2", name: "Other" }], hasNextPage: false }),
  }));
  on("tool.call", { tool: "mcp__Linear__list_issues" }, ($, e) => ({
    result: {},
    text: JSON.stringify({ issues: ISSUES_BY_PROJECT[String(e.project)] ?? [], hasNextPage: false }),
  }));
  on("tool.call", { tool: "mcp__Linear__get_issue" }, ($, e) => ({ result: {}, text: JSON.stringify({ id: e.id, description: "# Full description\n\n- draw it\n- ship it" }) }));
  on("tool.call", { tool: "mcp__Linear__save_issue" }, ($, e) => {
    writes.push({ id: e.id, state: e.state });
    return { result: {}, text: JSON.stringify({ id: e.id, status: e.state }) };
  });
  on("process.run", () => ({ value: { exitCode: 0, stdout: "feat/STO-2-wire-the-board\n", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } }));
  on("session.root", () => ({ value: root }));
  on("fs.list", ($, e) => ({ value: fs.list(e.path) }));
  on("fs.exists", ($, e) => ({ value: fs.exists(e.path) }));
  on("fs.read", ($, e) => ({ value: fs.read(e.path) }));
  on("ui.toast", () => ({ value: undefined }));
  on("store.get", () => ({ value: undefined }));
  on("store.set", () => ({ value: undefined }));
  on("prompt.compose", () => ({ sections: [] }));
}

test("the pane shows the current sprint, the ticket on the branch, and writes a status change", async ($, on) => {
  const writes: Record<string, unknown>[] = [];
  world(on, writes);

  expect((await $.command.run({ ...RUN, command: "atrium", args: "refresh" })).text).toBe("Atrium board refreshed.");

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ plugin: "atrium", surface, component: "Pane", requestId: "atrium", props: PANE_PROPS });

    // The sprint with active work is spotlighted; the done wave is summarised below.
    expect(await ui.find({ type: "Text", text: /Wave 2 · Cockpit/ }), `${surface}: sprint header`).toBeDefined();
    expect(await ui.find({ type: "Text", text: /Wave 1 1\/1/ }), `${surface}: other waves summary`).toBeDefined();
    // The branch names STO-2, so the strip shows it.
    expect(await ui.find({ type: "Text", text: "STO-2" }), `${surface}: working-on strip`).toBeDefined();
    expect(await ui.find({ key: "t:STO-2" }), `${surface}: STO-2 row`).toBeDefined();
    expect(await ui.find({ key: "t:STO-3" }), `${surface}: STO-3 row`).toBeDefined();
    // The done wave's ticket is not in this wave.
    expect(await ui.find({ key: "t:STO-1" }), `${surface}: STO-1 absent`).toBeUndefined();

    // Expanding a ticket fetches its full description and offers the next status.
    await ui.press({ key: "t:STO-2" });
    expect(await ui.find({ type: "Markdown", text: /Full description/ }), `${surface}: description`).toBeDefined();
    expect(await ui.find({ key: "s:STO-2:next" }), `${surface}: next status`).toMatchObject({ props: { label: "→ In Review" } });

    await ui.press({ key: "s:STO-2:next" });
    expect(writes.at(-1), `${surface}: write`).toEqual({ id: "STO-2", state: "In Review" });

    // Collapse again so the next surface starts from the same state ($.state persists across mounts).
    await ui.press({ key: "t:STO-2" });
    expect(await ui.find({ type: "Markdown", text: /Full description/ }), `${surface}: collapsed`).toBeUndefined();
    await ui.unmount();
    writes.length = 0;
  }
});

test("the PRD and Design views list wave files and link the mockups", async ($, on) => {
  const writes: Record<string, unknown>[] = [];
  const file = (name: string) => ({ name, kind: "file" as const, size: 10, mtimeMs: 0, isLink: false });
  world(on, writes, {
    list: (path) => (path === "/repo/atrium/docs/waves" ? [file("wave-2.md")] : path === "/repo/atrium/files" ? [file("wave-2-board.html")] : []),
    exists: (path) => path === "/repo/atrium/docs/waves/wave-2.md" || path === "/repo/atrium/docs/PRD.md",
    read: (path) => (path === "/repo/atrium/docs/waves/wave-2.md" ? "# Wave 2 PRD\n\nThe cockpit." : "# Build PRD"),
  });

  await $.command.run({ ...RUN, command: "atrium", args: "refresh" });
  const ui = await $.ui.mount({ plugin: "atrium", surface: "terminal", component: "Pane", requestId: "atrium", props: PANE_PROPS });

  await ui.press({ key: "view:prd" });
  expect(await ui.find({ key: "doc:/repo/atrium/docs/PRD.md" })).toBeDefined();
  await ui.press({ key: "doc:/repo/atrium/docs/waves/wave-2.md" });
  expect(await ui.find({ type: "Markdown", text: /Wave 2 PRD/ })).toBeDefined();

  await ui.press({ key: "view:design" });
  const link = await ui.find({ type: "Link", text: "wave-2-board.html" });
  expect(link?.props.href).toBe("file:///repo/atrium/files/wave-2-board.html");
  await ui.unmount();
});

test("the model is briefed only once a board has loaded", async ($, on) => {
  world(on, []);
  const before = await $.prompt.compose({ model: "m", promptModel: "m", surfaces: ["terminal"], tools: [], outputStyle: null, traits: [] });
  expect(before.sections).toEqual([]);
  await $.command.run({ ...RUN, command: "atrium", args: "refresh" });
  const { sections } = await $.prompt.compose({ model: "m", promptModel: "m", surfaces: ["terminal"], tools: [], outputStyle: null, traits: [] });
  expect(sections.map((s) => s.id)).toEqual(["atrium:conventions", "atrium:working-on"]);
  const working = sections.find((s) => s.id === "atrium:working-on");
  expect(working?.text).toMatch(/Working on: STO-2 — Wire the board/);
  expect(working?.text).toMatch(/Current sprint: Wave 2 · Cockpit — 0\/2 done, 1 in progress/);
  expect(working?.scope).toBe("session");
});

test("with no Linear connector the pane says so instead of failing", async ($, on) => {
  on("tool.list", () => ({ value: [{ name: "Read", description: "", mcp: false }] }));
  on("session.root", () => ({ value: "/repo/atrium" }));
  on("process.run", () => ({ value: { exitCode: 128, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } }));
  on("store.get", () => ({ value: undefined }));
  on("ui.toast", () => ({ value: undefined }));
  mock.clock(on);
  const { text } = await $.command.run({ ...RUN, command: "atrium", args: "refresh" });
  expect(text).toMatch(/No Linear MCP tools are connected/);
  const ui = await $.ui.mount({ plugin: "atrium", surface: "terminal", component: "Pane", requestId: "atrium", props: PANE_PROPS });
  expect(await ui.find({ type: "Text", text: /No Linear MCP tools/ })).toBeDefined();
  await ui.unmount();
});

test("with no matching project the pane offers to create one named after the repo", async ($, on) => {
  const writes: Record<string, unknown>[] = [];
  world(on, writes, EMPTY_FS, "/repo/newthing");

  const { text } = await $.command.run({ ...RUN, command: "atrium", args: "refresh" });
  expect(text).toMatch(/No Linear project matches the folder "newthing"/);

  const ui = await $.ui.mount({ plugin: "atrium", surface: "terminal", component: "Pane", requestId: "atrium", props: PANE_PROPS });
  expect(await ui.find({ key: "proj:create" })).toMatchObject({ props: { label: 'Create a Linear project named "newthing"' } });
  expect(await ui.find({ key: "proj:Atrium" })).toBeDefined();

  await ui.press({ key: "proj:create" });
  expect(writes.at(-1)).toEqual({ project: "newthing", teams: ["Stonekey"] });
  // The new, empty project is now the board: no waves yet, and a way to plan the first one.
  expect(await ui.find({ type: "Text", text: /· newthing/ })).toBeDefined();
  expect(await ui.find({ key: "plan" })).toBeDefined();
  await ui.unmount();
});

test("/atrium falls back to the board as text where the surface seats no pane", async ($, on) => {
  world(on, []);
  on("ui.open", () => ({ value: { isPlaced: false, reason: "the attached surface places no panes" } }));
  const { text } = await $.command.run({ ...RUN, command: "atrium", args: "" });
  expect(text).toMatch(/places no pane \(the attached surface places no panes\)/);
  expect(text).toMatch(/▶ STO-2  Wire the board · In Progress/);
  expect(text).toMatch(/Wave 2 · Cockpit · build · 0\/2 done  ← current/);
  expect(text).toMatch(/● In progress \(1\)\n  ‼ STO-2  Wire the board/);
  expect(text).toMatch(/Wave 1 1\/1/);

  const plain = await $.command.run({ ...RUN, command: "atrium", args: "text" });
  expect(plain.text).toMatch(/^Atrium · Atrium\n▶ STO-2/);
});

test("/atrium reports the pane opened where the surface seats it", async ($, on) => {
  world(on, []);
  on("ui.open", () => ({ value: { isPlaced: true } }));
  const { text } = await $.command.run({ ...RUN, command: "atrium", args: "" });
  expect(text).toBe("Atrium pane opened.");
});
