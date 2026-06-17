import { describe, it, expect } from "vitest";
import { applyTicketView, filterTickets, sortTickets, isFiltering, DEFAULT_VIEW, type TicketView } from "./ticketView";
import type { Ticket } from "./types";

const t = (id: string, over: Partial<Ticket> = {}): Ticket => ({
  id,
  title: `Title ${id}`,
  priority: "med",
  state: "todo",
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
  sortOrder: 1,
  ...over,
});

const view = (over: Partial<TicketView> = {}): TicketView => ({ ...DEFAULT_VIEW, ...over });

describe("isFiltering", () => {
  it("is false for the default view and for sort-only changes", () => {
    expect(isFiltering(DEFAULT_VIEW)).toBe(false);
    expect(isFiltering(view({ sort: "priority" }))).toBe(false);
  });
  it("is true when search/state/priority narrows the list", () => {
    expect(isFiltering(view({ search: "auth" }))).toBe(true);
    expect(isFiltering(view({ search: "   " }))).toBe(false);
    expect(isFiltering(view({ states: ["doing"] }))).toBe(true);
    expect(isFiltering(view({ priorities: ["high"] }))).toBe(true);
  });
});

describe("filterTickets", () => {
  const list = [
    t("STO-1", { state: "todo", priority: "high", title: "Add auth" }),
    t("STO-2", { state: "doing", priority: "low", title: "Fix layout" }),
    t("STO-3", { state: "done", priority: "high", title: "Ship vsix" }),
  ];

  it("returns all when nothing is set", () => {
    expect(filterTickets(list, DEFAULT_VIEW)).toHaveLength(3);
  });
  it("filters by state (OR within the axis)", () => {
    expect(filterTickets(list, view({ states: ["todo", "done"] })).map((x) => x.id)).toEqual(["STO-1", "STO-3"]);
  });
  it("filters by priority", () => {
    expect(filterTickets(list, view({ priorities: ["high"] })).map((x) => x.id)).toEqual(["STO-1", "STO-3"]);
  });
  it("matches search against id and title, case-insensitively", () => {
    expect(filterTickets(list, view({ search: "auth" })).map((x) => x.id)).toEqual(["STO-1"]);
    expect(filterTickets(list, view({ search: "sto-2" })).map((x) => x.id)).toEqual(["STO-2"]);
  });
  it("ANDs across axes", () => {
    expect(filterTickets(list, view({ states: ["done"], priorities: ["high"] })).map((x) => x.id)).toEqual(["STO-3"]);
  });
});

describe("filterTickets — canceled handling", () => {
  const list = [
    t("STO-1", { state: "todo" }),
    t("STO-2", { state: "done" }),
    t("STO-3", { status: "Canceled" }),
    t("STO-4", { status: "Duplicate" }),
  ];

  it("hides Canceled/Duplicate tickets by default (no status chips selected)", () => {
    expect(filterTickets(list, DEFAULT_VIEW).map((x) => x.id)).toEqual(["STO-1", "STO-2"]);
  });
  it("shows only canceled when the 'canceled' chip is selected alone", () => {
    expect(filterTickets(list, view({ states: ["canceled"] })).map((x) => x.id)).toEqual(["STO-3", "STO-4"]);
  });
  it("combines canceled with active statuses when both are selected", () => {
    expect(filterTickets(list, view({ states: ["done", "canceled"] })).map((x) => x.id)).toEqual([
      "STO-2",
      "STO-3",
      "STO-4",
    ]);
  });
  it("sorts canceled tickets after the active columns under the status sort", () => {
    expect(sortTickets(list, "state").map((x) => x.id)).toEqual(["STO-1", "STO-2", "STO-3", "STO-4"]);
  });
});

describe("sortTickets", () => {
  it("manual preserves the incoming order", () => {
    const list = [t("STO-3"), t("STO-1"), t("STO-2")];
    expect(sortTickets(list, "manual").map((x) => x.id)).toEqual(["STO-3", "STO-1", "STO-2"]);
  });
  it("priority orders urgent → low and is stable within a band", () => {
    const list = [
      t("STO-1", { priority: "low" }),
      t("STO-2", { priority: "urgent" }),
      t("STO-3", { priority: "med" }),
      t("STO-4", { priority: "urgent" }),
    ];
    expect(sortTickets(list, "priority").map((x) => x.id)).toEqual(["STO-2", "STO-4", "STO-3", "STO-1"]);
  });
  it("state orders todo → done (Linear progression)", () => {
    const list = [t("a", { state: "done" }), t("b", { state: "doing" }), t("c", { state: "todo" })];
    expect(sortTickets(list, "state").map((x) => x.state)).toEqual(["todo", "doing", "done"]);
  });
  it("id sorts numerically (STO-9 before STO-10)", () => {
    const list = [t("STO-10"), t("STO-2"), t("STO-9")];
    expect(sortTickets(list, "id").map((x) => x.id)).toEqual(["STO-2", "STO-9", "STO-10"]);
  });
  it("does not mutate the input array", () => {
    const list = [t("STO-2"), t("STO-1")];
    sortTickets(list, "id");
    expect(list.map((x) => x.id)).toEqual(["STO-2", "STO-1"]);
  });
});

describe("applyTicketView", () => {
  it("filters then sorts", () => {
    const list = [
      t("STO-1", { state: "todo", priority: "low" }),
      t("STO-2", { state: "done", priority: "urgent" }),
      t("STO-3", { state: "doing", priority: "high" }),
    ];
    const out = applyTicketView(list, view({ states: ["todo", "doing"], sort: "priority" }));
    expect(out.map((x) => x.id)).toEqual(["STO-3", "STO-1"]);
  });
});
