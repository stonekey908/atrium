import type { TicketState, Wave, WriteState } from "./types";

/** Top-level cockpit views (the canvas switcher). */
export type CockpitView = "board" | "prd" | "design";

/** Waves that have looped back through UAT (Pass ≥ 2) — for the return-strip (STO-2177). */
export function loopBacks(waves: Wave[]): Wave[] {
  return waves.filter((w) => (w.passN ?? 1) >= 2);
}

/**
 * The state a ticket should land in when demoted out of the sprint back to a
 * wave: active work (doing/review) drops to `backlog`; done/todo keep their
 * state (returns undefined = leave unchanged). Keeps a demoted ticket from
 * lingering "In Review" in Linear, and sends it back to the backlog rather than
 * the Todo column.
 */
export function demoteState(fromState: TicketState): WriteState | undefined {
  return fromState === "review" || fromState === "doing" ? "backlog" : undefined;
}

