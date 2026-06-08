export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "done";

export interface Ticket {
  id: string;
  title: string;
  priority: Priority;
  state: TicketState;
  tests?: string;
}

export interface Wave {
  name: string;
  tickets: Ticket[];
}

export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  waves: Wave[];
}
