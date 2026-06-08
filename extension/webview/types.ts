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
}

export interface Wave {
  name: string;
  tickets: Ticket[];
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
}
