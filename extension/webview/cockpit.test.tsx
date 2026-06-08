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
  waves: [
    {
      name: "Wave 1 · CLI bridge",
      stage: "build",
      tickets: [
        {
          id: "STO-2164",
          title: "Conversation strip — stream-json renderer",
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
