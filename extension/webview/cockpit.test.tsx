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
  waves: [
    {
      name: "Wave 1 · CLI bridge",
      tickets: [
        { id: "STO-2164", title: "Conversation strip — stream-json renderer", priority: "urgent", state: "todo" },
      ],
    },
  ],
};

function sendInit(payload: InitPayload) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { type: "init", payload } }));
  });
}

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

  it("renders waves, tickets, and real folder count after init", () => {
    render(<App />);
    sendInit(PAYLOAD);
    expect(screen.getByText("Wave 1 · CLI bridge")).toBeInTheDocument();
    expect(screen.getByText("STO-2164")).toBeInTheDocument();
    expect(screen.getByText("2 folders open")).toBeInTheDocument();
  });

  it("round-trips a runClaude message when ▶ Run is clicked", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
    expect(postMessage).toHaveBeenCalledWith({
      type: "runClaude",
      id: "STO-2164",
      title: "Conversation strip — stream-json renderer",
    });
  });

  it("posts openTicket when the row (not the Run button) is clicked", () => {
    render(<App />);
    sendInit(PAYLOAD);
    fireEvent.click(screen.getByText("Conversation strip — stream-json renderer"));
    expect(postMessage).toHaveBeenCalledWith({ type: "openTicket", id: "STO-2164" });
  });
});
