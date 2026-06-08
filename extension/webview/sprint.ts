import type { StageStatus } from "./types";

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
