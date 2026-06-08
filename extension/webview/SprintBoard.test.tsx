import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { SprintBoard } from "./SprintBoard";
import type { Ticket, Wave } from "./types";

const ticket = (id: string, state: Ticket["state"], sortOrder = 1): Ticket => ({
  id,
  title: `Title of ${id}`,
  priority: "med",
  state,
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
  url: `https://linear.app/x/${id}`,
  linearId: `uuid-${id}`,
  sortOrder,
});

const WAVE: Wave = { name: "Wave 0.7", stage: "build", tickets: [ticket("STO-1", "todo")] };

/** A jsdom-friendly DataTransfer that persists across dragStart → drop. */
function dataTransfer(): DataTransfer {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? "",
    effectAllowed: "",
    dropEffect: "",
  } as unknown as DataTransfer;
}

describe("SprintBoard drag-to-status", () => {
  it("calls onMove when a card is dragged to a different column (live mode)", () => {
    const onMove = vi.fn();
    const { container, getByText } = render(<SprintBoard wave={WAVE} canWrite onMove={onMove} />);
    const card = getByText("STO-1").closest("[draggable='true']")!;
    const dt = dataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(container.querySelector('[data-col="done"]')!, { dataTransfer: dt });
    expect(onMove).toHaveBeenCalledWith("STO-1", "uuid-STO-1", "todo", "done");
  });

  it("does not call onMove when dropped back on the same column", () => {
    const onMove = vi.fn();
    const { container, getByText } = render(<SprintBoard wave={WAVE} canWrite onMove={onMove} />);
    const card = getByText("STO-1").closest("[draggable='true']")!;
    const dt = dataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(container.querySelector('[data-col="todo"]')!, { dataTransfer: dt });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("calls onReorder with a midpoint sortOrder when a card is dropped on another in the same column", () => {
    const onReorder = vi.fn();
    const wave: Wave = {
      name: "Wave 0.7",
      stage: "build",
      tickets: [ticket("STO-1", "todo", 10), ticket("STO-2", "todo", 20), ticket("STO-3", "todo", 30)],
    };
    const { getByText } = render(<SprintBoard wave={wave} canWrite onMove={vi.fn()} onReorder={onReorder} />);
    const dt = dataTransfer();
    fireEvent.dragStart(getByText("STO-3").closest("[draggable='true']")!, { dataTransfer: dt });
    // Drop on STO-1 (column index 0) → newOrder = targetOrder(10) - 1 = 9.
    fireEvent.drop(getByText("STO-1").closest("[draggable='true']")!, { dataTransfer: dt });
    expect(onReorder).toHaveBeenCalledWith("STO-3", "uuid-STO-3", 30, 9);
  });

  it("promotes a card dragged in from another wave (relabels to the sprint + sets the column state)", () => {
    const onMoveToWave = vi.fn();
    const wave: Wave = {
      name: "Wave 0.7",
      stage: "build",
      label: "ATR Wave 0.7 · Sprint board",
      tickets: [ticket("STO-1", "todo", 10)],
    };
    const { container } = render(
      <SprintBoard wave={wave} canWrite onMove={vi.fn()} onReorder={vi.fn()} onMoveToWave={onMoveToWave} />,
    );
    const dt = dataTransfer();
    dt.setData(
      "application/x-atrium-card",
      JSON.stringify({ id: "STO-9", linearId: "uuid-9", fromState: "todo", fromWaveLabel: "ATR Wave 4.5", sortOrder: 5 }),
    );
    fireEvent.drop(container.querySelector('[data-col="doing"]')!, { dataTransfer: dt });
    expect(onMoveToWave).toHaveBeenCalledWith("STO-9", "uuid-9", "ATR Wave 0.7 · Sprint board", "doing");
  });

  it("is read-only without a key: cards aren't draggable and drops are ignored", () => {
    const onMove = vi.fn();
    const { container, getByText, getAllByText } = render(
      <SprintBoard wave={WAVE} canWrite={false} onMove={onMove} />,
    );
    expect(getByText("STO-1").closest("[draggable='true']")).toBeNull();
    expect(getAllByText(/read-only/i).length).toBeGreaterThan(0);
    const dt = dataTransfer();
    dt.setData("application/x-atrium-card", JSON.stringify({ id: "STO-1", fromState: "todo" }));
    fireEvent.drop(container.querySelector('[data-col="done"]')!, { dataTransfer: dt });
    expect(onMove).not.toHaveBeenCalled();
  });
});
