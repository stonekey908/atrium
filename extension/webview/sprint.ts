import type { StageStatus, Ticket, TicketState, Wave } from "./types";

/** The kanban columns, in board order, with their display labels. */
export const KANBAN_COLUMNS: { key: TicketState; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "review", label: "In review" },
  { key: "done", label: "Done" },
];

export interface KanbanColumn {
  key: TicketState;
  label: string;
  tickets: Ticket[];
}

/** Groups a wave's tickets into the four ordered kanban columns by state, each
 *  column ordered by Linear sortOrder (ascending) so drag-to-reorder is stable.
 *  Tickets without a sortOrder keep their incoming order. Pure. */
export function boardToColumns(wave: Wave): KanbanColumn[] {
  return KANBAN_COLUMNS.map((c) => ({
    ...c,
    tickets: wave.tickets
      .filter((t) => t.state === c.key)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }));
}

/**
 * The wave to spotlight as the current sprint. Data-driven: the wave with active
 * (in-progress / in-review) work, else the next wave that still has unfinished
 * tickets, preferring whichever is furthest along the pipeline. Returns null when
 * every ticket is done (no active sprint → the board shows the "all shipped"
 * state). An explicit `override` wave name wins whenever it still matches a wave,
 * so the user can correct a wrong guess.
 */
export function currentSprint(waves: Wave[], override?: string | null): Wave | null {
  if (override) {
    const pinned = waves.find((w) => w.name === override);
    if (pinned) return pinned;
  }
  const unfinished = waves.filter((w) => w.tickets.length > 0 && w.tickets.some((t) => t.state !== "done"));
  if (unfinished.length === 0) return null;
  const active = unfinished.filter((w) => w.tickets.some((t) => t.state === "doing" || t.state === "review"));
  const pool = active.length > 0 ? active : unfinished;
  const stageIdx = (w: Wave) => PIPELINE.findIndex((s) => s.key === w.stage);
  return pool.reduce((best, w) => (stageIdx(w) > stageIdx(best) ? w : best), pool[0]);
}

/** The Tier-1 pipeline, in order. A wave's `stage` names where it sits on it. */
export const PIPELINE: { key: string; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "design", label: "Design" },
  { key: "ux", label: "UX" },
  { key: "build", label: "Build" },
  { key: "uat", label: "UAT" },
  { key: "release", label: "Release" },
];

export interface WaveStage {
  key: string;
  label: string;
  status: StageStatus;
}

/**
 * Projects a wave's coarse `stage` onto the full pipeline: everything before it
 * is `done`, the stage itself is `active`, everything after is `todo`. An
 * unrecognised stage yields all-`todo` (we don't know where it is).
 */
export function waveStages(stage: string): WaveStage[] {
  const at = PIPELINE.findIndex((s) => s.key === stage);
  return PIPELINE.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: at === -1 ? "todo" : i < at ? "done" : i === at ? "active" : "todo",
  }));
}

/** The "sprint we're working on right now" is whatever wave is at the Build stage. */
export function isCurrentSprint(stage: string | undefined): boolean {
  return stage === "build";
}

/**
 * The ticket you're working on right now: the one whose id appears in the
 * current git branch (e.g. `feat/sto-2181-…` → STO-2181), else the first ticket
 * in progress, else nothing.
 */
export function resolveActiveTicket(waves: Wave[], branch: string): Ticket | null {
  const tickets = waves.flatMap((w) => w.tickets);
  const b = branch.toLowerCase();
  const matched = tickets.find((t) => b.includes(t.id.toLowerCase()));
  if (matched) return matched;
  return tickets.find((t) => t.state === "doing") ?? null;
}
