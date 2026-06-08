import type { Priority, TicketState } from "./types";

/** Priority label + colour token, shared across the wave list and the kanban. */
export const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "text-red" },
  high: { label: "High", cls: "text-orange" },
  med: { label: "Med", cls: "text-blue" },
  low: { label: "Low", cls: "text-fg-muted" },
};

/** The state disc used on ticket rows and kanban cards. */
export function StateIcon({ state }: { state: TicketState }) {
  if (state === "done") return <span className="codicon codicon-pass-filled text-green" title="done" />;
  if (state === "review")
    return <span className="codicon codicon-git-pull-request text-blue" title="in review" />;
  if (state === "doing") return <span className="codicon codicon-sync text-yellow" title="in progress" />;
  return <span className="codicon codicon-circle-large-outline text-fg-muted" title="todo" />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-fg-muted italic">{children}</p>;
}
