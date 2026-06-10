import { PIPELINE } from "./sprint";
import type { Ticket, TicketState, Wave, WriteState } from "./types";

/** Top-level cockpit views (the canvas switcher). */
export type CockpitView = "board" | "prd" | "design";

// ── Tier-1 pipeline (STO-2174) ───────────────────────────────────────────────

export type StageState = "done" | "active" | "todo";
export interface PipelineStage {
  key: string;
  label: string;
  state: StageState;
  waves: Wave[];
}

/**
 * Where a wave ACTUALLY sits on the pipeline (STO-2496 stage-lighting rules).
 * The host derives `plan|build|release` from ticket states; Design is the
 * conditional refinement here: a not-yet-started wave with design signals —
 * mockup files discovered for it, or UI-flagged tickets — sits at Design, not
 * PRD. Waves with no design work skip the stage entirely.
 */
export function effectiveStage(wave: Wave): string | undefined {
  if (wave.stage === "plan" && ((wave.files?.mockups.length ?? 0) > 0 || waveTouchesUi(wave))) {
    return "design";
  }
  return wave.stage;
}

/**
 * Groups waves onto the PRD→Release pipeline and derives each stage's state
 * from where the waves actually sit (not a hardcoded list): a stage is `active`
 * if any wave is at it, `done` if every wave has moved past it, else `todo`.
 */
export function computePipeline(waves: Wave[]): PipelineStage[] {
  const indexOf = (stage?: string) => PIPELINE.findIndex((s) => s.key === stage);
  return PIPELINE.map((s, i) => {
    const here = waves.filter((w) => effectiveStage(w) === s.key);
    const positioned = waves.filter((w) => indexOf(effectiveStage(w)) !== -1);
    const allPast = positioned.length > 0 && positioned.every((w) => indexOf(effectiveStage(w)) > i);
    const state: StageState = here.length > 0 ? "active" : allPast ? "done" : "todo";
    return { key: s.key, label: s.label, state, waves: here };
  });
}

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

// ── Fast-track / UI-detection gate (STO-2169) ────────────────────────────────

const UI_WORDS =
  /\b(ui|screen|canvas|component|dialog|modal|flow|view|pane|panel|card|kanban|strip|layout|button|mockup|wireframe|design|figma|prototype)\b/i;

/** Heuristic: does this ticket touch UI? Drives the fast-track warning chip. */
export function isUiTicket(ticket: Ticket): boolean {
  if (UI_WORDS.test(ticket.title)) return true;
  return ticket.spec.some((s) => UI_WORDS.test(s));
}

/** Does any ticket in the wave touch UI? (Wave-level fast-track gate.) */
export function waveTouchesUi(wave: Wave): boolean {
  return wave.tickets.some(isUiTicket);
}
