export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "done";
export type StageStatus = "done" | "active" | "todo";
export type ActivityKind = "pickup" | "plan" | "phase" | "close" | "commit";

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

export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  stages: Stage[];
  waves: Wave[];
  spikes?: Spike[];
  /** Non-fatal load problem (e.g. malformed snapshot); cockpit shows a banner. */
  error?: string;
}
