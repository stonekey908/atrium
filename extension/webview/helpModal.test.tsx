import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { HelpModal } from "./HelpModal";
import { AGENT_BRIEFING } from "./agentBriefing";

describe("HelpModal (STO-2507)", () => {
  beforeEach(() => postMessage.mockClear());

  it("renders the conventions and copies the exact briefing via the host", () => {
    render(<HelpModal onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /conventions/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy agent briefing/i }));
    expect(postMessage).toHaveBeenCalledWith({ type: "copyText", text: AGENT_BRIEFING });
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<HelpModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AGENT_BRIEFING content", () => {
  it("stays platform-agnostic — no tracker or assistant brand names", () => {
    expect(AGENT_BRIEFING).not.toMatch(/linear|jira|claude|cursor|copilot|atrium cockpit/i);
  });

  it("covers labels, criteria, branches, and the file conventions", () => {
    expect(AGENT_BRIEFING).toMatch(/ONE sprint label/);
    expect(AGENT_BRIEFING).toMatch(/bullet lines starting with "- "/);
    expect(AGENT_BRIEFING).toMatch(/feat\/<TICKET-ID>/);
    expect(AGENT_BRIEFING).toMatch(/docs\/waves\/wave-<n>\.md/);
    expect(AGENT_BRIEFING).toMatch(/\.atrium\/waves\.json/);
  });
});
