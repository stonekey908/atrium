import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BranchChip } from "./BranchChip";

describe("BranchChip", () => {
  it("renders the branch name", () => {
    render(<BranchChip branch="main" dirty={false} ahead={0} behind={0} />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("hides dirty dot when clean", () => {
    render(<BranchChip branch="main" dirty={false} ahead={0} behind={0} />);
    expect(screen.queryByTestId("dirty-dot")).not.toBeInTheDocument();
  });

  it("shows dirty dot when dirty", () => {
    render(<BranchChip branch="main" dirty={true} ahead={0} behind={0} />);
    expect(screen.getByTestId("dirty-dot")).toBeInTheDocument();
  });

  it("hides ahead/behind when both are 0", () => {
    render(<BranchChip branch="main" dirty={false} ahead={0} behind={0} />);
    expect(screen.queryByTestId("ahead-behind")).not.toBeInTheDocument();
  });

  it("shows only ahead glyph when ahead > 0 and behind === 0", () => {
    render(<BranchChip branch="main" dirty={false} ahead={3} behind={0} />);
    expect(screen.getByTestId("ahead")).toHaveTextContent("↑3");
    expect(screen.queryByTestId("behind")).not.toBeInTheDocument();
  });

  it("shows only behind glyph when behind > 0 and ahead === 0", () => {
    render(<BranchChip branch="main" dirty={false} ahead={0} behind={2} />);
    expect(screen.getByTestId("behind")).toHaveTextContent("↓2");
    expect(screen.queryByTestId("ahead")).not.toBeInTheDocument();
  });

  it("shows both glyphs when ahead and behind > 0", () => {
    render(<BranchChip branch="main" dirty={false} ahead={2} behind={1} />);
    expect(screen.getByTestId("ahead")).toHaveTextContent("↑2");
    expect(screen.getByTestId("behind")).toHaveTextContent("↓1");
  });

  it("hides ahead/behind block when both are null (no upstream)", () => {
    render(<BranchChip branch="main" dirty={false} ahead={null} behind={null} />);
    expect(screen.queryByTestId("ahead-behind")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ahead")).not.toBeInTheDocument();
    expect(screen.queryByTestId("behind")).not.toBeInTheDocument();
  });

  it("renders 'detached' when branch is null", () => {
    render(<BranchChip branch={null} dirty={false} ahead={null} behind={null} />);
    expect(screen.getByText("detached")).toBeInTheDocument();
  });

  it("uses provided tooltip override", () => {
    render(
      <BranchChip
        branch="main"
        dirty={false}
        ahead={0}
        behind={0}
        title="custom tooltip"
      />,
    );
    expect(screen.getByTestId("branch-chip")).toHaveAttribute("title", "custom tooltip");
  });

  it("generates a 'no upstream' tooltip when ahead/behind are null", () => {
    render(<BranchChip branch="feat/x" dirty={false} ahead={null} behind={null} />);
    expect(screen.getByTestId("branch-chip").getAttribute("title")).toContain("no upstream");
  });

  it("generates an 'up to date' tooltip when ahead and behind are both 0", () => {
    render(<BranchChip branch="main" dirty={false} ahead={0} behind={0} />);
    expect(screen.getByTestId("branch-chip").getAttribute("title")).toContain("up to date");
  });

  it("includes ahead/behind counts in tooltip", () => {
    render(<BranchChip branch="main" dirty={true} ahead={2} behind={1} />);
    const title = screen.getByTestId("branch-chip").getAttribute("title");
    expect(title).toContain("uncommitted changes");
    expect(title).toContain("2 ahead");
    expect(title).toContain("1 behind");
  });
});
