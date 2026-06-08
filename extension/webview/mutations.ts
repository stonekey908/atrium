import type { SyncState, TicketState, Wave } from "./types";

/**
 * Optimistic write-back bookkeeping for the sprint kanban. Pure + framework-free
 * so the move/synced/failed/conflict/reconcile transitions unit-test without
 * React. `useBoardMutations` wraps this with postMessage + the synced→idle timer.
 *
 *   overrides — ticketId → optimistic state, layered over the host's board
 *   sync      — ticketId → badge (syncing/synced/failed/conflict); absent = idle
 *   backup    — ticketId → state before the move, used to revert on failure
 */
export interface MutationState {
  overrides: Record<string, TicketState>;
  sync: Record<string, SyncState>;
  backup: Record<string, TicketState>;
}

export const initialMutationState: MutationState = { overrides: {}, sync: {}, backup: {} };

export type MutationAction =
  | { type: "move"; id: string; fromState: TicketState; toState: TicketState }
  | { type: "result"; id: string; ok: boolean; conflict?: boolean }
  | { type: "settle"; id: string }
  | { type: "reconcile" };

export function mutationReducer(s: MutationState, a: MutationAction): MutationState {
  switch (a.type) {
    case "move":
      return {
        overrides: { ...s.overrides, [a.id]: a.toState },
        sync: { ...s.sync, [a.id]: "syncing" },
        backup: { ...s.backup, [a.id]: a.fromState },
      };
    case "result": {
      const backup = { ...s.backup };
      delete backup[a.id];
      if (a.ok) {
        // Keep the override (it now matches Linear); show a brief synced badge.
        return { overrides: s.overrides, sync: { ...s.sync, [a.id]: "synced" }, backup };
      }
      // Failure or conflict: revert the optimistic move, flag the card.
      const overrides = { ...s.overrides };
      delete overrides[a.id];
      return { overrides, sync: { ...s.sync, [a.id]: a.conflict ? "conflict" : "failed" }, backup };
    }
    case "settle": {
      const sync = { ...s.sync };
      delete sync[a.id];
      return { ...s, sync };
    }
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
