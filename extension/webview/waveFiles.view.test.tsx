import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type { InitPayload, Wave } from "./types";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { PrdView } from "./PrdView";
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
  waves,
  ...extra,
});

function sendContent(payload: { path: string; content?: string; error?: string }) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { type: "fileContent", ...payload } }));
  });
}

describe("PRD view (STO-2496)", () => {
  beforeEach(() => postMessage.mockClear());

  it("renders the first documented wave's PRD as markdown, fetched via the host", () => {
    const w = wave({
      files: { prd: { name: "wave-5.md", path: "/repo/docs/waves/wave-5.md", kind: "md" }, mockups: [], docs: [] },
    });
    render(<PrdView init={init([w])} />);
    expect(postMessage).toHaveBeenCalledWith({ type: "previewFile", path: "/repo/docs/waves/wave-5.md" });
    sendContent({ path: "/repo/docs/waves/wave-5.md", content: "## Scope\n\nDo **this** well" });
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("this").tagName).toBe("STRONG");
  });

  it("lists further docs (TRDs) alongside the PRD", () => {
    const w = wave({
      files: {
        prd: { name: "wave-5.md", path: "/r/wave-5.md", kind: "md" },
        mockups: [],
        docs: [{ name: "wave-5-trd.md", path: "/r/wave-5-trd.md", kind: "md" }],
      },
    });
    render(<PrdView init={init([w])} />);
    expect(screen.getByText("wave-5.md")).toBeInTheDocument();
    expect(screen.getByText("wave-5-trd.md")).toBeInTheDocument();
    expect(screen.getByText(/2 docs/)).toBeInTheDocument();
  });

  it("offers open-in-VS-Code per doc", () => {
    const w = wave({
      files: { prd: { name: "wave-5.md", path: "/r/wave-5.md", kind: "md" }, mockups: [], docs: [] },
    });
    render(<PrdView init={init([w])} />);
    fireEvent.click(screen.getByRole("button", { name: /open wave-5\.md in vs code/i }));
    expect(postMessage).toHaveBeenCalledWith({ type: "openFile", path: "/r/wave-5.md" });
  });

  it("shows an honest empty state (no docs vs no folder)", () => {
    const { rerender } = render(<PrdView init={init([wave({ files: { mockups: [], docs: [] } })])} />);
    expect(screen.getByText(/no prd docs found/i)).toBeInTheDocument();
    rerender(<PrdView init={{ ...init([]), folders: [] }} />);
    expect(screen.getByText(/no folder is open/i)).toBeInTheDocument();
  });
});

describe("DesignView wave grouping (STO-2478)", () => {
  beforeEach(() => postMessage.mockClear());

  it("groups a wave's mockups under the wave name", () => {
    const w = wave({
      files: {
        prd: { name: "sprint-design.md", path: "/repo/specs/sprint-design.md", kind: "md" },
        mockups: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }],
        docs: [],
      },
    });
    render(<DesignView init={init([w], { designRefs: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }] })} />);
    expect(screen.getByText("Wave 0.7 · Sprint board")).toBeInTheDocument();
    expect(screen.getByText("horizon.html")).toBeInTheDocument();
    expect(screen.getAllByText("horizon.html")).toHaveLength(1);
  });

  it("puts unclaimed design refs in a project-wide bucket", () => {
    const w = wave({ files: { mockups: [], docs: [] } });
    render(
      <DesignView
        init={init([w], { designRefs: [{ name: "old-sketch.html", path: "/repo/files/old-sketch.html", kind: "html" }] })}
      />,
    );
    expect(screen.getByText(/project-wide/i)).toBeInTheDocument();
    expect(screen.getByText("old-sketch.html")).toBeInTheDocument();
  });

  it("auto-expands the first wave HTML mockup as an inline preview (STO-2479)", () => {
    const w = wave({
      files: {
        mockups: [{ name: "horizon.html", path: "/repo/files/horizon.html", kind: "html" }],
        docs: [],
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
        docs: [],
      },
    });
    render(<DesignView init={init([w])} />);
    expect(postMessage).not.toHaveBeenCalledWith({ type: "previewFile", path: "/repo/files/b.html" });
    fireEvent.click(screen.getByRole("button", { name: "b.html" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "previewFile", path: "/repo/files/b.html" });
  });

  it("offers no preview toggle for non-HTML refs, only open-in-VS-Code", () => {
    const w = wave({
      files: { mockups: [{ name: "flow.png", path: "/repo/files/flow.png", kind: "image" }], docs: [] },
    });
    render(<DesignView init={init([w])} />);
    expect(screen.queryByRole("button", { name: /preview flow\.png/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open flow\.png in vs code/i })).toBeInTheDocument();
  });

  it("explains when no folder is open instead of suggesting a manifest", () => {
    render(<DesignView init={{ ...init([wave({ files: { mockups: [], docs: [] } })]), folders: [] }} />);
    expect(screen.getByText(/no folder is open/i)).toBeInTheDocument();
  });

  it("opens a wave PRD from the design view too", () => {
    const w = wave({
      files: { prd: { name: "sprint-design.md", path: "/repo/specs/sprint-design.md", kind: "md" }, mockups: [], docs: [] },
    });
    render(<DesignView init={init([w])} />);
    fireEvent.click(screen.getByRole("button", { name: /sprint-design\.md/ }));
    expect(postMessage).toHaveBeenCalledWith({ type: "openFile", path: "/repo/specs/sprint-design.md" });
  });
});
