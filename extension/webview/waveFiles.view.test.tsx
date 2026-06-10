import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InitPayload, Wave } from "./types";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { PlanView } from "./PlanView";
import { DesignView } from "./DesignView";

const wave = (over: Partial<Wave>): Wave => ({
  name: "Wave 0.7 · Sprint board",
  tickets: [
    {
      id: "STO-2468",
      title: "Kanban",
      priority: "high",
      state: "done",
      spec: ["Spotlights the sprint"],
      tests: { passed: 0, failed: 0, missing: 0 },
      activity: [],
    },
  ],
  ...over,
});

const init = (waves: Wave[], extra: Partial<InitPayload> = {}): InitPayload => ({
  project: "Atrium",
  branch: "main",
  folders: ["Atrium"],
  stages: [],
  waves,
  ...extra,
});

describe("PlanView PRD chip (STO-2478)", () => {
  beforeEach(() => postMessage.mockClear());

  it("shows the wave's PRD as a chip and opens it on click", () => {
    const w = wave({
      files: { prd: { name: "sprint-design.md", path: "/repo/specs/sprint-design.md", kind: "md" }, mockups: [] },
    });
    render(<PlanView init={init([w])} />);
    const chip = screen.getByRole("button", { name: /sprint-design\.md/ });
    fireEvent.click(chip);
    expect(postMessage).toHaveBeenCalledWith({ type: "openFile", path: "/repo/specs/sprint-design.md" });
  });

  it("renders no chip when the wave has no PRD", () => {
    render(<PlanView init={init([wave({ files: { mockups: [] } })])} />);
    expect(screen.queryByRole("button", { name: /\.md/ })).not.toBeInTheDocument();
  });

  it("renders criteria markdown styled, not raw (STO-2494)", () => {
    const w = wave({});
    w.tickets[0].spec = ["Support a **list** of prefixes with `back-compat`"];
    const { container } = render(<PlanView init={init([w])} />);
    expect(container.querySelector("strong")?.textContent).toBe("list");
    expect(container.querySelector("code")?.textContent).toBe("back-compat");
    expect(container).not.toHaveTextContent("**list**");
  });
});

describe("DesignView wave grouping (STO-2478)", () => {
  beforeEach(() => postMessage.mockClear());

  it("groups a wave's mockups under the wave name", () => {
    const w = wave({
      files: {
        prd: { name: "sprint-design.md", path: "/repo/specs/sprint-design.md", kind: "md" },
        mockups: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }],
      },
    });
    render(<DesignView init={init([w], { designRefs: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }] })} />);
    expect(screen.getByText("Wave 0.7 · Sprint board")).toBeInTheDocument();
    expect(screen.getByText("horizon.html")).toBeInTheDocument();
    // Claimed by the wave → must not ALSO appear in a project-wide bucket.
    expect(screen.getAllByText("horizon.html")).toHaveLength(1);
  });

  it("puts unclaimed design refs in a project-wide bucket", () => {
    const w = wave({ files: { mockups: [] } });
    render(
      <DesignView
        init={init([w], { designRefs: [{ name: "old-sketch.html", path: "/repo/files/old-sketch.html", kind: "html" }] })}
      />,
    );
    expect(screen.getByText(/project-wide/i)).toBeInTheDocument();
    expect(screen.getByText("old-sketch.html")).toBeInTheDocument();
  });

  it("explains when no folder is open instead of suggesting a manifest", () => {
    render(<DesignView init={{ ...init([wave({ files: { mockups: [] } })]), folders: [] }} />);
    expect(screen.getByText(/no folder is open/i)).toBeInTheDocument();
  });

  it("auto-expands the first wave HTML mockup as an inline preview (STO-2479)", () => {
    const w = wave({
      files: {
        mockups: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }],
      },
    });
    render(<DesignView init={init([w])} />);
    expect(postMessage).toHaveBeenCalledWith({ type: "previewFile", path: "/repo/files/horizon.html" });
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
  });

  it("toggles a collapsed mockup open to request its preview", () => {
    const w = wave({
      files: {
        mockups: [
          { name: "a.html", path: "/repo/files/a.html", kind: "html" },
          { name: "b.html", path: "/repo/files/b.html", kind: "html" },
        ],
      },
    });
    render(<DesignView init={init([w])} />);
    expect(postMessage).not.toHaveBeenCalledWith({ type: "previewFile", path: "/repo/files/b.html" });
    fireEvent.click(screen.getByRole("button", { name: "b.html" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "previewFile", path: "/repo/files/b.html" });
  });

  it("offers no preview toggle for non-HTML refs, only open-in-VS-Code", () => {
    const w = wave({
      files: { mockups: [{ name: "flow.png", path: "/repo/files/flow.png", kind: "image" }] },
    });
    render(<DesignView init={init([w])} />);
    expect(screen.queryByRole("button", { name: /preview flow\.png/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open flow\.png in vs code/i })).toBeInTheDocument();
  });

  it("opens a wave PRD from the design view too", () => {
    const w = wave({
      files: { prd: { name: "sprint-design.md", path: "/repo/specs/sprint-design.md", kind: "md" }, mockups: [] },
    });
    render(<DesignView init={init([w])} />);
    fireEvent.click(screen.getByRole("button", { name: /sprint-design\.md/ }));
    expect(postMessage).toHaveBeenCalledWith({ type: "openFile", path: "/repo/specs/sprint-design.md" });
  });
});
