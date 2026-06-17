export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "review" | "done";
/** The exact Linear status set — the status picker's options. `state` collapses
 *  these to the four kanban columns; `status` keeps Backlog/Canceled/Duplicate. */
export type FullStatus = "Backlog" | "Todo" | "In Progress" | "In Review" | "Done" | "Canceled" | "Duplicate";
/** A write target for moves: the four columns, an explicit `backlog` (demote out
 *  of the sprint), and the two terminal statuses the modal picker can set. */
export type WriteState = TicketState | "backlog" | "canceled" | "duplicate";
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
  /** Exact Linear status (Backlog…Duplicate) — drives the modal status picker and
   *  marks Canceled/Duplicate tickets. Live pull only; absent in the snapshot. */
  status?: FullStatus;
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
  /** Further docs for the wave (TRDs etc.) — rendered in the PRD view (STO-2496). */
  docs: WaveFileRef[];
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
  /** Short "what this wave entails" blurb (the Linear label description) — shown
   *  succinctly on the board, editable + synced back to the label (STO-2574). */
  description?: string;
  /** The wave label's Linear id — the write target for the description sync. */
  labelId?: string;
}

export interface Spike {
  id: string;
  code: string;
  gatesWave: string;
  state: TicketState;
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
  waves: Wave[];
  spikes?: Spike[];
  /** Real workspace git status for the status strip (STO-2170); absent if not a repo. */
  git?: GitInfo;
  /** Design reference artifacts found in the project (STO-2168). */
  designRefs?: DesignRef[];
  /** The single build PRD (docs/PRD.md) — editable in the PRD view, synced to
   *  the Linear project overview (STO-2573). Absent when the file doesn't exist. */
  prd?: { path: string };
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
  /** Current auto-refresh cadence (atrium.linear.pollSeconds) — the status
   *  strip exposes a picker for it (STO-2481 finding #2). */
  pollSeconds?: number;
}

/** Canceled or Duplicate — terminal statuses kept off the kanban and out of
 *  progress counts, and hidden from the wave lists until the filter reveals them. */
export function isCanceled(t: Pick<Ticket, "status">): boolean {
  return t.status === "Canceled" || t.status === "Duplicate";
}

/** A ticket's active tickets only — the ones that count toward progress/stage. */
export function activeTickets(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => !isCanceled(t));
}

/** Fallback FullStatus from the 4-state `state`, for the snapshot/read-only path
 *  where the exact Linear `status` wasn't pulled. */
export function statusFromState(state: TicketState): FullStatus {
  return state === "done" ? "Done" : state === "doing" ? "In Progress" : state === "review" ? "In Review" : "Todo";
}
