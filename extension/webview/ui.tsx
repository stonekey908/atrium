import type { ActivityKind, Priority, TicketState } from "./types";

/** The four mandatory audit-trail steps (global CLAUDE.md rule), surfaced as a
 *  dot ribbon (STO-2172). A step is filled when the ticket has a Linear comment
 *  that maps to it. */
const AUDIT_STEPS: { kind: ActivityKind; label: string }[] = [
  { kind: "pickup", label: "Pickup" },
  { kind: "plan", label: "Plan locked" },
  { kind: "phase", label: "Phase end" },
  { kind: "close", label: "Close" },
];

export function AuditRibbon({ activity, labeled = false }: { activity: { kind: ActivityKind }[]; labeled?: boolean }) {
  const has = (k: ActivityKind) => activity.some((a) => a.kind === k);
  return (
    <span className="flex items-center gap-1" title="Audit trail · Pickup → Plan → Phase → Close">
      {AUDIT_STEPS.map((s) => (
        <span key={s.kind} className="flex items-center gap-1">
          <span
            title={`${s.label}${has(s.kind) ? "" : " — not yet recorded"}`}
            className={`w-1.5 h-1.5 rounded-full ${has(s.kind) ? "bg-green" : "border border-fg-muted/50"}`}
          />
          {labeled && <span className={`text-[10px] ${has(s.kind) ? "text-fg" : "text-fg-muted/60"}`}>{s.label}</span>}
        </span>
      ))}
    </span>
  );
}

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

