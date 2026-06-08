export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "review" | "done";
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

export interface Wave {
  name: string;
  tickets: Ticket[];
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

export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  stages: Stage[];
  waves: Wave[];
  spikes?: Spike[];
  /** Real workspace git status for the status strip (STO-2170); absent if not a repo. */
  git?: GitInfo;
  /** Where the board came from + how fresh it is (shown as a header chip). */
  source?: "snapshot" | "live";
  generatedAt?: string;
  /** Non-fatal load problem (e.g. malformed snapshot); cockpit shows a banner. */
  error?: string;
}
