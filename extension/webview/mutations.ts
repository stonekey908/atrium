import type { SyncState, TicketState, Wave } from "./types";

/**
 * Optimistic write-back bookkeeping for the sprint kanban. Pure + framework-free
 * so the move/reorder/synced/failed/conflict/reconcile transitions unit-test
 * without React. `useBoardMutations` wraps this with postMessage + the
 * synced→idle timer.
 *
 *   overrides — ticketId → optimistic state (drag-to-status, STO-2469)
 *   order     — ticketId → optimistic sortOrder (drag-to-reorder, STO-2470)
 *   sync      — ticketId → badge (syncing/synced/failed/conflict); absent = idle
 *   backup    — pre-move state, used to revert on failure
 *   backupOrder — pre-reorder sortOrder, used to revert on failure
 */
export interface MutationState {
  overrides: Record<string, TicketState>;
  order: Record<string, number>;
  sync: Record<string, SyncState>;
  backup: Record<string, TicketState>;
  backupOrder: Record<string, number>;
}

export const initialMutationState: MutationState = {
  overrides: {},
  order: {},
  sync: {},
  backup: {},
  backupOrder: {},
};

export type MutationAction =
  | { type: "move"; id: string; fromState: TicketState; toState: TicketState }
  | { type: "reorder"; id: string; fromSortOrder: number; toSortOrder: number }
  | { type: "wavemove"; id: string }
  | { type: "result"; id: string; ok: boolean; conflict?: boolean }
  | { type: "settle"; id: string }
  | { type: "reconcile" };

function without<T>(rec: Record<string, T>, id: string): Record<string, T> {
  const copy = { ...rec };
  delete copy[id];
  return copy;
}

export function mutationReducer(s: MutationState, a: MutationAction): MutationState {
  switch (a.type) {
    case "move":
      return {
        ...s,
        overrides: { ...s.overrides, [a.id]: a.toState },
        sync: { ...s.sync, [a.id]: "syncing" },
        backup: { ...s.backup, [a.id]: a.fromState },
      };
    case "reorder":
      return {
        ...s,
        order: { ...s.order, [a.id]: a.toSortOrder },
        sync: { ...s.sync, [a.id]: "syncing" },
        backupOrder: { ...s.backupOrder, [a.id]: a.fromSortOrder },
      };
    case "wavemove":
      // Cross-wave moves aren't optimistic (the ticket changes wave membership);
      // we just badge it syncing and let the host's post-write refresh reposition it.
      return { ...s, sync: { ...s.sync, [a.id]: "syncing" } };
    case "result": {
      const base = { ...s, backup: without(s.backup, a.id), backupOrder: without(s.backupOrder, a.id) };
      if (a.ok) {
        // Keep the optimistic value (it now matches Linear); brief synced badge.
        return { ...base, sync: { ...s.sync, [a.id]: "synced" } };
      }
      // Failure or conflict: revert whichever optimistic change was pending.
      return {
        ...base,
        overrides: without(s.overrides, a.id),
        order: without(s.order, a.id),
        sync: { ...s.sync, [a.id]: a.conflict ? "conflict" : "failed" },
      };
    }
    case "settle":
      return { ...s, sync: without(s.sync, a.id) };
    case "reconcile":
      // A fresh board arrived from the host — it's the truth; drop all local state.
      return initialMutationState;
    default:
      return s;
  }
}

/** Layers optimistic state overrides onto the host's waves for display. */
export function applyOverrides(waves: Wave[], overrides: Record<string, TicketState>): Wave[] {
  if (Object.keys(overrides).length === 0) return waves;
  return waves.map((w) => ({
    ...w,
    tickets: w.tickets.map((t) => (overrides[t.id] ? { ...t, state: overrides[t.id] } : t)),
  }));
}

/** Layers optimistic sortOrder overrides onto the host's waves for display. */
export function applyOrder(waves: Wave[], order: Record<string, number>): Wave[] {
  if (Object.keys(order).length === 0) return waves;
  return waves.map((w) => ({
    ...w,
    tickets: w.tickets.map((t) => (t.id in order ? { ...t, sortOrder: order[t.id] } : t)),
  }));
}
