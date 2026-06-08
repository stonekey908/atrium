import type { StageStatus, Ticket, Wave } from "./types";

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
