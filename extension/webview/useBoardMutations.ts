import { useEffect, useReducer, useRef } from "react";
import { vscode } from "./vscode";
import { mutationReducer, applyOverrides, applyOrder, initialMutationState } from "./mutations";
import type { SyncState, TicketState, Wave } from "./types";

/** How long a `synced` badge lingers before fading back to idle. */
const SETTLE_MS = 1400;

export interface BoardMutations {
  /** Host waves with optimistic moves layered on, for display. */
  displayWaves: Wave[];
  /** Current sync badge for a ticket (idle when no pending write). */
  syncOf: (id: string) => SyncState;
  /** Optimistically move a ticket to a new column and ask the host to write it. */
  move: (id: string, linearId: string | undefined, fromState: TicketState, toState: TicketState) => void;
  /** Reorder a ticket within its column (STO-2470); writes Linear sortOrder. */
  reorder: (id: string, linearId: string | undefined, fromSortOrder: number, toSortOrder: number) => void;
}

/**
 * Optimistic write-back for the sprint kanban. Layers local moves over the
 * host's board, tracks per-card sync status, reverts on failure/conflict, and
 * reconciles when a fresh board arrives. The host owns the API key and performs
 * the actual Linear writes; this just brokers intent + optimistic UI.
 */
export function useBoardMutations(waves: Wave[]): BoardMutations {
  const [state, dispatch] = useReducer(mutationReducer, initialMutationState);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // A fresh board from the host is the source of truth — drop optimistic state.
  useEffect(() => {
    dispatch({ type: "reconcile" });
  }, [waves]);

  // The host replies to each move/reorder with a mutationResult.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string; ok?: boolean; conflict?: boolean };
      if (m?.type !== "mutationResult" || !m.id) return;
      dispatch({ type: "result", id: m.id, ok: !!m.ok, conflict: m.conflict });
      if (m.ok) {
        const id = m.id;
        timers.current[id] = setTimeout(() => dispatch({ type: "settle", id }), SETTLE_MS);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      for (const t of Object.values(timers.current)) clearTimeout(t);
    };
  }, []);

  const move: BoardMutations["move"] = (id, linearId, fromState, toState) => {
    if (fromState === toState) return;
    dispatch({ type: "move", id, fromState, toState });
    vscode.postMessage({ type: "moveTicket", id, linearId, fromState, toState });
  };

  const reorder: BoardMutations["reorder"] = (id, linearId, fromSortOrder, toSortOrder) => {
    if (fromSortOrder === toSortOrder) return;
    dispatch({ type: "reorder", id, fromSortOrder, toSortOrder });
    vscode.postMessage({ type: "reorderTicket", id, linearId, sortOrder: toSortOrder });
  };

  return {
    displayWaves: applyOrder(applyOverrides(waves, state.overrides), state.order),
    syncOf: (id) => state.sync[id] ?? "idle",
    move,
    reorder,
  };
}
