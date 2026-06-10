export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "review" | "done";
/** A write target for moves: the four columns plus an explicit `backlog`, used
 *  when demoting a ticket out of the sprint (distinct from the todo column). */
export type WriteState = TicketState | "backlog";
export type StageStatus = "done" | "active" | "todo";
export type ActivityKind = "pickup" | "plan" | "phase" | "close" | "commit";

/** Per-card write-back status for the sprint kanban (slice 2+). `idle` = no
 *  pending write; `conflict` = Linear already moved out from under us. */
export type SyncState = "idle" | "syncing" | "synced" | "failed" | "conflict";

export interface TestSummary {
  passed: number;
  failed: number;
  missing: number;
}

export interface ActivityItem {
  kind: ActivityKind;
  text: string;
  when: string;
}

export interface Ticket {
  id: string;
  title: string;
  /** Full Linear description markdown — rendered in the ticket modal (STO-2494).
   *  Live pull only; absent in the committed snapshot. */
  description?: string;
  priority: Priority;
  state: TicketState;
  spec: string[];
  tests: TestSummary;
  activity: ActivityItem[];
  /** Linear issue URL, for click-through. */
  url?: string;
  /** Linear's internal UUID — present on a live pull; the write target. */
  linearId?: string;
  /** Linear sortOrder — drives kanban ordering + drag-to-reorder. Live only. */
  sortOrder?: number;
}

export interface WaveFileRef {
  name: string;
  path: string;
  kind: "md" | "html" | "image" | "figma";
}

/** PRD + mockups resolved from the repo for a wave (STO-2478) — manifest
 *  (.atrium/waves.json) first, naming convention second, honest empty otherwise. */
export interface WaveFiles {
  prd?: WaveFileRef;
  mockups: WaveFileRef[];
}

export interface Wave {
  name: string;
  tickets: Ticket[];
  /** PRD + mockups resolved from the repo for this wave (STO-2478). */
  files?: WaveFiles;
  /** The wave's Linear label (e.g. "ATR Wave 0.7 · Sprint board") — the target
   *  when a ticket is dragged into or out of this wave. */
  label?: string;
  /** Where this wave sits on the Tier-1 pipeline (plan…release). */
  stage?: string;
  /** Spike code blocking this wave (e.g. "T-110"), or null/absent. */
  gatedBy?: string | null;
  /** UAT loop-back count; >1 means it bounced back. */
  passN?: number;
}

export interface Spike {
  id: string;
  code: string;
  gatesWave: string;
  state: TicketState;
}

export interface Stage {
  key: string;
  label: string;
  status: StageStatus;
}

export interface GitInfo {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface DesignRef {
  name: string;
  path: string;
  kind: "html" | "image" | "figma";
}

export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  stages: Stage[];
  waves: Wave[];
  spikes?: Spike[];
  /** Real workspace git status for the status strip (STO-2170); absent if not a repo. */
  git?: GitInfo;
  /** Count of unit-test files in the workspace (STO-2186). */
  testFiles?: number;
  /** Design reference artifacts found in the project (STO-2168). */
  designRefs?: DesignRef[];
  /** Where the board came from + how fresh it is (shown as a header chip). */
  source?: "snapshot" | "live";
  generatedAt?: string;
  /** Non-fatal load problem (e.g. malformed snapshot); cockpit shows a banner. */
  error?: string;
  /** All Linear project names (live mode) — feeds the header project picker (STO-2486). */
  projects?: string[];
  /** How the shown project was chosen: pinned setting, folder-name auto-detect,
   *  or nothing matched (empty board + banner + picker). */
  projectSource?: "setting" | "detected" | "none";
}
