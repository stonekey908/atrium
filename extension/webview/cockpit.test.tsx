import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import type { InitPayload } from "./types";

// Mock the VS Code webview bridge (acquireVsCodeApi is only injected at runtime).
const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { App } from "./App";

const PAYLOAD: InitPayload = {
  project: "atrium",
  branch: "claude/vs-plugin-architecture",
  folders: ["atrium", "shared"],
  spikes: [{ id: "STO-2146", code: "T-110", gatesWave: "Wave 1", state: "todo" }],
  waves: [
    // The current sprint (Build stage) — spotlighted in the kanban, not the list.
    {
      name: "Wave 0.7 · Sprint board",
      stage: "build",
      tickets: [
        {
          id: "STO-2468",
          title: "Read-only sprint kanban",
          url: "https://linear.app/stonekey/issue/STO-2468",
          priority: "high",
          state: "doing",
          spec: ["Spotlight current sprint"],
          tests: { passed: 0, failed: 0, missing: 0 },
          activity: [],
        },
      ],
    },
    // A horizon wave (not Build) — renders as a collapsible WaveSection in the list.
    {
      name: "Wave 1 · CLI bridge",
      stage: "plan",
      gatedBy: "T-110",
      passN: 2,
      tickets: [
        {
          id: "STO-2164",
          title: "Conversation strip — stream-json renderer",
          url: "https://linear.app/stonekey/issue/STO-2164",
          priority: "urgent",
          state: "todo",
          description: "Renders **streaming** assistant text.\n\n- Tool calls as collapsible cards",
          spec: ["Renders streaming assistant text", "Tool calls as collapsible cards"],
          tests: { passed: 3, failed: 1, missing: 2 },
          activity: [{ kind: "pickup", text: "Picked up", when: "today" }],
        },
      ],
    },
  ],
};

function sendInit(payload: InitPayload) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { type: "init", payload } }));
  });
}

const TICKET_TITLE = "Conversation strip — stream-json renderer";

describe("Atrium cockpit webview", () => {
  beforeEach(() => postMessage.mockClear());

  it("announces 'ready' to the host on mount", () => {
    render(<App />);
    expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
  });

  it("shows a connecting state before init arrives", () => {
    render(<App />);
    expect(screen.getByText(/Connecting to Atrium host/i)).toBeInTheDocument();
  });

  it("renders the waves, tickets and folder count after init (no pipeline strip — STO-2498)", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // "Wave 1 · CLI bridge" appears in the WaveSection and the return-strip (it's looped back).
    expect(screen.getAllByText("Wave 1 · CLI bridge").length).toBeGreaterThan(0);
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // open folder count
    expect(screen.queryByText("Release")).not.toBeInTheDocument(); // pipeline strip gone
  });

  it("opens the ticket modal with the rendered description on click (STO-2494)", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByText(TICKET_TITLE));
    const dialog = screen.getByRole("dialog", { name: /STO-2164 details/i });
    // Markdown renders styled, not raw: **streaming** → <strong>.
    expect(dialog.querySelector("strong")?.textContent).toBe("streaming");
    expect(dialog).not.toHaveTextContent("**streaming**");
  });

  it("closes the ticket modal with Escape and via the close button", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByText(TICKET_TITLE));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(TICKET_TITLE));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to the criteria list when a ticket has no description (snapshot mode)", () => {
    render(<App />);
    // Strip the description → the modal shows the extracted criteria instead.
    const stripped = structuredClone(PAYLOAD);
    delete stripped.waves[1].tickets[0].description;
    sendInit(stripped);
    fireEvent.click(screen.getByText(TICKET_TITLE));
    const dialog = screen.getByRole("dialog", { name: /STO-2164 details/i });
    expect(dialog).toHaveTextContent("Tool calls as collapsible cards");
  });

  it("shows the Active Work strip for the branch-matched ticket", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, branch: "feat/sto-2164-conversation-strip" });
    expect(screen.getByText(/working on/i)).toBeInTheDocument();
  });

  it("opens the ticket modal from the Active Work strip (STO-2498)", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, branch: "feat/sto-2164-conversation-strip" });
    fireEvent.click(screen.getByRole("button", { name: /open STO-2164 details/i }));
    expect(screen.getByRole("dialog", { name: /STO-2164 details/i })).toBeInTheDocument();
  });

  it("opens the ticket in Linear via the host when its open button is clicked", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: /open STO-2164 in Linear/i }));
    expect(postMessage).toHaveBeenCalledWith({
      type: "openLinear",
      url: "https://linear.app/stonekey/issue/STO-2164",
    });
  });

  it("shows percent done and counts in-review / in-progress as active", () => {
    render(<App />);
    sendInit({
      ...PAYLOAD,
      spikes: [],
      waves: [
        {
          name: "W",
          stage: "build",
          tickets: [
            { id: "A", title: "a", priority: "med", state: "done", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
            { id: "B", title: "b", priority: "med", state: "review", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
          ],
        },
      ],
    });
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/1 active/i)).toBeInTheDocument();
  });

  it("shows the project rollup with done/total and spike count", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText("0/2 done")).toBeInTheDocument();
    expect(screen.getByText(/1 spike/i)).toBeInTheDocument();
  });

  it("flags a gated wave with its blocking spike", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText(/gated by T-110/i)).toBeInTheDocument();
  });

  it("shows a Pass-N badge and a return-strip when a wave has looped back", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // Pass-2 appears on the wave card and in the return-strip (STO-2177).
    expect(screen.getAllByText(/pass 2/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/looped back/i)).toBeInTheDocument();
  });

  it("switches to the PRD and Design views via the tabs (STO-2496)", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: /^PRD$/i }));
    expect(screen.getByRole("heading", { name: /prd · documents/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Design$/i }));
    expect(screen.getByRole("heading", { name: /design · references/i })).toBeInTheDocument();
    // Plan and UAT tabs are gone — Board / PRD / Design only.
    expect(screen.queryByRole("button", { name: /^Plan$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^UAT$/i })).toBeNull();
  });

  it("asks the host to refresh when the Refresh button is clicked", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(postMessage).toHaveBeenCalledWith({ type: "refresh" });
  });

  it("marks the Build-stage wave as the current sprint", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // "Current sprint" shows in the kanban spotlight AND as a badge on the wave's
    // list entry (the sprint is kept in the list, not removed).
    expect(screen.getAllByText(/current sprint/i).length).toBeGreaterThan(0);
  });

  it("keeps the current sprint in the wave list (badged), not just the kanban", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // The sprint's name appears in both the kanban header and its list entry.
    expect(screen.getAllByText("Wave 0.7 · Sprint board").length).toBeGreaterThanOrEqual(2);
  });

  it("spotlights the current sprint in the kanban with its four columns", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // All four kanban columns render. Scope to the kanban section so the new
    // filter-bar status chips ("To do"/"Done") don't collide with the query.
    // The kanban renders above the wave list, so its "Current sprint" header is
    // the first match (the second is the badge on the wave's list entry).
    const kanban = within(screen.getAllByText("Current sprint")[0].closest("section")!);
    for (const label of ["To do", "In progress", "In review", "Done"]) {
      expect(kanban.getByText(label)).toBeInTheDocument();
    }
    // The Build-stage ticket shows in the kanban; the horizon wave keeps its own.
    expect(screen.getAllByText("STO-2468").length).toBeGreaterThan(0);
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
  });

  it("filters the wave ticket lists via the toolbar search, with an empty state", () => {
    render(<App />);
    sendInit(PAYLOAD);
    const search = screen.getByLabelText("Filter tickets by id or title");
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "zzz-no-match" } });
    expect(screen.getByText(/No tickets match/i)).toBeInTheDocument();
    expect(screen.queryByText("STO-2164")).toBeNull();
  });

  it("auto-expands a collapsed wave when its ticket matches the filter", () => {
    render(<App />);
    sendInit(PAYLOAD);
    // The sprint wave (Wave 0.7) is collapsed in the list by default, so its
    // STO-2468 row isn't rendered there. Searching for it force-expands the wave,
    // adding exactly one more occurrence of the title (its list row).
    const before = screen.getAllByText("Read-only sprint kanban").length;
    fireEvent.change(screen.getByLabelText("Filter tickets by id or title"), {
      target: { value: "Read-only sprint" },
    });
    expect(screen.getAllByText("Read-only sprint kanban")).toHaveLength(before + 1);
    expect(screen.queryByText("STO-2164")).toBeNull(); // non-matching wave is hidden
  });

  it("filters the lists by a priority chip", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText("STO-2164")).toBeInTheDocument(); // urgent
    fireEvent.click(screen.getByTitle("Show High priority"));
    expect(screen.queryByText("STO-2164")).toBeNull(); // urgent drops out under High-only
  });

  it("hides canceled tickets by default and reveals them via the Canceled chip", () => {
    const withCanceled: InitPayload = {
      ...PAYLOAD,
      waves: [
        {
          name: "Wave 1 · CLI bridge",
          stage: "plan",
          tickets: [
            { ...PAYLOAD.waves[1].tickets[0] },
            {
              id: "STO-DEAD",
              title: "Abandoned approach",
              url: "https://linear.app/x/STO-DEAD",
              priority: "low",
              state: "todo",
              status: "Canceled",
              spec: [],
              tests: { passed: 0, failed: 0, missing: 0 },
              activity: [],
            },
          ],
        },
      ],
    };
    render(<App />);
    sendInit(withCanceled);
    expect(screen.queryByText("Abandoned approach")).toBeNull(); // hidden by default
    fireEvent.click(screen.getByTitle(/Show canceled/i));
    expect(screen.getByText("Abandoned approach")).toBeInTheDocument(); // revealed
  });

  it("pins a horizon wave as the current sprint, then unpins back to auto", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: /Pin Wave 1 · CLI bridge as the current sprint/i }));
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /unpin current sprint/i }));
    expect(screen.queryByText(/pinned/i)).toBeNull();
  });

  it("shows the all-shipped state when every ticket is done", () => {
    render(<App />);
    sendInit({
      ...PAYLOAD,
      spikes: [],
      waves: [
        {
          name: "Done wave",
          stage: "build",
          tickets: [
            { id: "A", title: "a", priority: "med", state: "done", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
          ],
        },
      ],
    });
    expect(screen.getByText(/All shipped/i)).toBeInTheDocument();
  });

  it("collapses and expands all active waves at once", () => {
    render(<App />);
    sendInit(PAYLOAD); // two active waves → the collapse-all toolbar shows
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    expect(screen.queryByText("STO-2164")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
  });

  it("bundles fully-done waves under a collapsed Completed group", () => {
    render(<App />);
    sendInit({
      ...PAYLOAD,
      spikes: [],
      waves: [
        {
          name: "Wave 9 · Active",
          stage: "build",
          tickets: [
            { id: "STO-A", title: "active one", priority: "med", state: "doing", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
          ],
        },
        {
          name: "Wave 1 · Shipped",
          stage: "release",
          tickets: [
            { id: "STO-DONE", title: "shipped one", priority: "med", state: "done", spec: [], tests: { passed: 0, failed: 0, missing: 0 }, activity: [] },
          ],
        },
      ],
    });
    // The completed wave is hidden inside a collapsed Completed group by default.
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Wave 1 · Shipped")).toBeNull();
    // Expanding the group reveals the done wave.
    fireEvent.click(screen.getByText("Completed"));
    expect(screen.getByText("Wave 1 · Shipped")).toBeInTheDocument();
  });

  it("opens a kanban card in Linear via the host", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: /open STO-2468 in Linear/i }));
    expect(postMessage).toHaveBeenCalledWith({
      type: "openLinear",
      url: "https://linear.app/stonekey/issue/STO-2468",
    });
  });

  it("shows a live badge when the board came from Linear", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, source: "live", generatedAt: "2026-06-08" });
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it("shows the snapshot date when the board came from the committed file", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, source: "snapshot", generatedAt: "2026-06-08" });
    expect(screen.getByText(/snapshot · 2026-06-08/i)).toBeInTheDocument();
  });

  it("surfaces a non-fatal banner when the host reports a load error", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, waves: [], error: "Couldn't load board snapshot: boom" });
    expect(screen.getByText(/Couldn't load board snapshot/i)).toBeInTheDocument();
  });

  it("collapses a wave, hiding its tickets", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    // The collapse toggle button's name starts with the wave name (the pin
    // button's starts with "Pin …"); the return-strip mentions it in a div.
    fireEvent.click(screen.getByRole("button", { name: /^Wave 1 · CLI bridge/i }));
    expect(screen.queryByText("STO-2164")).toBeNull();
  });
});
