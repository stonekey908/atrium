import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
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
  stages: [
    { key: "build", label: "Build", status: "active" },
    { key: "uat", label: "UAT", status: "todo" },
  ],
  spikes: [{ id: "STO-2146", code: "T-110", gatesWave: "Wave 1", state: "todo" }],
  waves: [
    {
      name: "Wave 1 · CLI bridge",
      stage: "build",
      gatedBy: "T-110",
      passN: 2,
      tickets: [
        {
          id: "STO-2164",
          title: "Conversation strip — stream-json renderer",
          url: "https://linear.app/stonekey/issue/STO-2164",
          priority: "urgent",
          state: "todo",
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

  it("renders the pipeline, waves, tickets and folder count after init", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getAllByText("Build").length).toBeGreaterThan(0); // pipeline stage (also appears in the wave strip)
    expect(screen.getByText("Wave 1 · CLI bridge")).toBeInTheDocument();
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // open folder count
  });

  it("expands a ticket to its acceptance criteria (Spec) on click", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByText(TICKET_TITLE));
    expect(screen.getByText("Renders streaming assistant text")).toBeInTheDocument();
  });

  it("switches the expanded ticket to the Tests tab", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByText(TICKET_TITLE));
    fireEvent.click(screen.getByText("tests"));
    expect(screen.getByText("3 passed")).toBeInTheDocument();
  });

  it("shows the Active Work strip for the branch-matched ticket", () => {
    render(<App />);
    sendInit({ ...PAYLOAD, branch: "feat/sto-2164-conversation-strip" });
    expect(screen.getByText(/working on/i)).toBeInTheDocument();
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
    expect(screen.getByTitle("in review")).toBeInTheDocument();
  });

  it("shows the project rollup with done/total and spike count", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText("0/1 done")).toBeInTheDocument();
    expect(screen.getByText(/1 spike/i)).toBeInTheDocument();
  });

  it("flags a gated wave with its blocking spike", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText(/gated by T-110/i)).toBeInTheDocument();
  });

  it("shows a Pass-N badge when a wave has looped back", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText(/pass 2/i)).toBeInTheDocument();
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
    expect(screen.getByText(/current sprint/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Wave 1 · CLI bridge"));
    expect(screen.queryByText("STO-2164")).toBeNull();
  });
});
