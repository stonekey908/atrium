import { isCanceled, type Priority, type Ticket, type TicketState } from "./types";

/** How the wave-list ticket rows are ordered. `manual` keeps the incoming order
 *  (Linear sortOrder, the drag-to-reorder result); the rest are view-only sorts. */
export type SortKey = "manual" | "priority" | "state" | "id";

/** The status axis the filter chips operate on: the four kanban columns plus
 *  `canceled` (covering Canceled + Duplicate, which are hidden by default). */
export type FilterStatus = TicketState | "canceled";

/** The cockpit-wide ticket lens for the wave lists (STO sort/filter). Empty
 *  `states`/`priorities` arrays mean "no narrowing on that axis" (and, for
 *  status, canceled tickets stay hidden); an empty `search` means no text match.
 *  Sort is independent of the filters. */
export interface TicketView {
  search: string;
  states: FilterStatus[];
  priorities: Priority[];
  sort: SortKey;
}

export const DEFAULT_VIEW: TicketView = { search: "", states: [], priorities: [], sort: "manual" };

/** True when any narrowing (search/state/priority) is active. Sort alone is not
 *  a filter — used to decide auto-expand + show the "clear" affordance. */
export function isFiltering(v: TicketView): boolean {
  return v.search.trim() !== "" || v.states.length > 0 || v.priorities.length > 0;
}

/** Linear's own progression order (see the status picker): Todo → In Progress →
 *  In Review → Done. Drives the "status" sort. */
const STATE_RANK: Record<TicketState, number> = { todo: 0, doing: 1, review: 2, done: 3 };
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, med: 2, low: 3 };
/** Canceled/Duplicate sort after the four active columns. */
const stateRank = (t: Ticket): number => (isCanceled(t) ? 4 : STATE_RANK[t.state]);

export function filterTickets(tickets: Ticket[], v: TicketView): Ticket[] {
  const q = v.search.trim().toLowerCase();
  return tickets.filter((t) => {
    const canceled = isCanceled(t);
    if (v.states.length === 0) {
      // No status chips selected → show active tickets only; canceled stay hidden.
      if (canceled) return false;
    } else {
      // Explicit selection: a canceled/duplicate ticket counts as "canceled".
      const status: FilterStatus = canceled ? "canceled" : t.state;
      if (!v.states.includes(status)) return false;
    }
    if (v.priorities.length > 0 && !v.priorities.includes(t.priority)) return false;
    if (q && !`${t.id} ${t.title}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Stable sort: ties keep their incoming (manual) order, so e.g. sorting by
 *  priority preserves the drag order within each priority band. */
export function sortTickets(tickets: Ticket[], sort: SortKey): Ticket[] {
  if (sort === "manual") return tickets;
  const arr = [...tickets];
  if (sort === "priority") arr.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  else if (sort === "state") arr.sort((a, b) => stateRank(a) - stateRank(b));
  else if (sort === "id") arr.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return arr;
}

/** Filter, then sort — the lens applied to a wave's tickets before render. */
export function applyTicketView(tickets: Ticket[], v: TicketView): Ticket[] {
  return sortTickets(filterTickets(tickets, v), v.sort);
}
