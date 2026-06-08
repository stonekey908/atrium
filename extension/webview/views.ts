import { PIPELINE } from "./sprint";
import type { Ticket, TicketState, Wave } from "./types";

/** Top-level cockpit views (the canvas switcher). */
export type CockpitView = "board" | "plan" | "design" | "uat";

// ── Tier-1 pipeline (STO-2174) ───────────────────────────────────────────────

export type StageState = "done" | "active" | "todo";
export interface PipelineStage {
  key: string;
  label: string;
  state: StageState;
  waves: Wave[];
}

/**
 * Groups waves onto the Plan→Release pipeline and derives each stage's state
 * from where the waves actually sit (not a hardcoded list): a stage is `active`
 * if any wave is at it, `done` if every wave has moved past it, else `todo`.
 */
export function computePipeline(waves: Wave[]): PipelineStage[] {
  const indexOf = (stage?: string) => PIPELINE.findIndex((s) => s.key === stage);
  return PIPELINE.map((s, i) => {
    const here = waves.filter((w) => w.stage === s.key);
    const positioned = waves.filter((w) => indexOf(w.stage) !== -1);
    const allPast = positioned.length > 0 && positioned.every((w) => indexOf(w.stage) > i);
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
 * wave: active work (doing/review) un-starts to `todo`; done/todo keep their
 * state (returns undefined = leave unchanged). Keeps a demoted ticket from
 * lingering "In Review" in Linear.
 */
export function demoteState(fromState: TicketState): TicketState | undefined {
  return fromState === "review" || fromState === "doing" ? "todo" : undefined;
}

// ── UAT cases from acceptance criteria (STO-2187) ────────────────────────────

export type UatStatus = "pass" | "fail" | "pending";
export interface UatCase {
  name: string;
  status: UatStatus;
}

/** Each acceptance criterion (the ticket's `spec` bullets) becomes a pending UAT
 *  case. De-duped by name. */
export function uatCasesFromTicket(ticket: Ticket): UatCase[] {
  const seen = new Set<string>();
  const cases: UatCase[] = [];
  for (const name of ticket.spec) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      cases.push({ name, status: "pending" });
    }
  }
  return cases;
}

export interface UatRollup {
  total: number;
  pass: number;
  fail: number;
  pending: number;
}

/** Wave-level UAT rollup: every ticket's acceptance criteria summed. */
export function waveUatRollup(wave: Wave): UatRollup {
  const cases = wave.tickets.flatMap(uatCasesFromTicket);
  return {
    total: cases.length,
    pass: cases.filter((c) => c.status === "pass").length,
    fail: cases.filter((c) => c.status === "fail").length,
    pending: cases.filter((c) => c.status === "pending").length,
  };
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
