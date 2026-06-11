import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusStrip } from "./StatusStrip";
import type { InitPayload } from "./types";

const base: InitPayload = {
  project: "atrium",
  branch: "feat/x",
  folders: ["atrium", "shared"],
  waves: [],
};

describe("StatusStrip", () => {
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
});
