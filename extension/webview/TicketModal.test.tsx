import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { TicketModal } from "./TicketModal";
import type { Ticket } from "./types";

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "STO-2482",
  title: "Distribute the .vsix",
  priority: "high",
  state: "doing",
  status: "In Progress",
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
  url: "https://linear.app/x/STO-2482",
  linearId: "uuid-2482",
  sortOrder: 1,
  ...over,
});

describe("TicketModal status picker", () => {
  beforeEach(() => postMessage.mockClear());

  it("shows the picker preset to the current status in live mode", () => {
    const { getByLabelText } = render(<TicketModal ticket={ticket()} canWrite onClose={vi.fn()} />);
    expect((getByLabelText("Change status") as HTMLSelectElement).value).toBe("In Progress");
  });

  it("posts setStatus with the mapped write target and closes when changed", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<TicketModal ticket={ticket()} canWrite onClose={onClose} />);
    fireEvent.change(getByLabelText("Change status"), { target: { value: "Canceled" } });
    expect(postMessage).toHaveBeenCalledWith({
      type: "setStatus",
      id: "STO-2482",
      linearId: "uuid-2482",
      status: "canceled",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("maps Duplicate and Done to their write targets", () => {
    const { getByLabelText } = render(<TicketModal ticket={ticket()} canWrite onClose={vi.fn()} />);
    fireEvent.change(getByLabelText("Change status"), { target: { value: "Duplicate" } });
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "setStatus", status: "duplicate" }));
    fireEvent.change(getByLabelText("Change status"), { target: { value: "Done" } });
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "setStatus", status: "done" }));
  });

  it("is read-only without a live key: no picker, status shown statically", () => {
    const { queryByLabelText, getByText } = render(
      <TicketModal ticket={ticket({ status: undefined })} canWrite={false} onClose={vi.fn()} />,
    );
    expect(queryByLabelText("Change status")).toBeNull();
    // Falls back to the 4-state mapping when the exact status wasn't pulled.
    expect(getByText("In Progress")).toBeInTheDocument();
  });
});
