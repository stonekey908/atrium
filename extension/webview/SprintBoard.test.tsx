import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { SprintBoard } from "./SprintBoard";
import type { Ticket, Wave } from "./types";

const ticket = (id: string, state: Ticket["state"]): Ticket => ({
  id,
  title: `Title of ${id}`,
  priority: "med",
  state,
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
  url: `https://linear.app/x/${id}`,
  linearId: `uuid-${id}`,
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
