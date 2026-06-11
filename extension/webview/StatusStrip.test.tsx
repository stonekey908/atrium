import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InitPayload } from "./types";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { StatusStrip } from "./StatusStrip";

const base: InitPayload = {
  project: "atrium",
  branch: "feat/x",
  folders: ["atrium", "shared"],
  waves: [],
};

describe("StatusStrip", () => {
  beforeEach(() => postMessage.mockClear());

  it("shows the git branch with dirty + ahead indicators", () => {
    render(<StatusStrip init={{ ...base, git: { branch: "feat/sto-2170", dirty: true, ahead: 3, behind: 0 } }} />);
    expect(screen.getByText("feat/sto-2170")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // ahead count
    expect(screen.getByTitle("uncommitted changes")).toBeInTheDocument(); // the dirty dot
  });

  it("drops the git cell when the workspace isn't a repo", () => {
    render(<StatusStrip init={base} />);
    expect(screen.queryByText("feat/sto-2170")).toBeNull();
  });

  it("shows a live Linear cell, or the snapshot date", () => {
    const { rerender } = render(<StatusStrip init={{ ...base, source: "live" }} />);
    expect(screen.getByText(/Linear live/i)).toBeInTheDocument();
    rerender(<StatusStrip init={{ ...base, source: "snapshot", generatedAt: "2026-06-08" }} />);
    expect(screen.getByText(/snapshot · 2026-06-08/i)).toBeInTheDocument();
  });

  it("shows the open-folder count", () => {
    render(<StatusStrip init={base} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("offers the auto-refresh picker in live mode and writes the choice (STO-2481)", () => {
    render(<StatusStrip init={{ ...base, source: "live", pollSeconds: 60 }} />);
    const select = screen.getByRole("combobox", { name: /auto-refresh/i }) as HTMLSelectElement;
    expect(select.value).toBe("60");
    fireEvent.change(select, { target: { value: "300" } });
    expect(postMessage).toHaveBeenCalledWith({ type: "setPollSeconds", seconds: 300 });
  });

  it("hides the auto-refresh picker in snapshot mode", () => {
    render(<StatusStrip init={{ ...base, source: "snapshot", pollSeconds: 60 }} />);
    expect(screen.queryByRole("combobox", { name: /auto-refresh/i })).not.toBeInTheDocument();
  });
});
