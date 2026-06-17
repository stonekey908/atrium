import { useEffect } from "react";
import { vscode } from "./vscode";
import { mdToHtml } from "./markdown";
import { PRIORITY, StateIcon } from "./ui";
import { isCanceled, statusFromState, type FullStatus, type Ticket, type WriteState } from "./types";

/** The status picker's options, in Linear's own order, each mapped to the write
 *  target `resolveStateId` understands (host-side). */
const STATUS_OPTIONS: { label: FullStatus; write: WriteState }[] = [
  { label: "Backlog", write: "backlog" },
  { label: "Todo", write: "todo" },
  { label: "In Progress", write: "doing" },
  { label: "In Review", write: "review" },
  { label: "Done", write: "done" },
  { label: "Canceled", write: "canceled" },
  { label: "Duplicate", write: "duplicate" },
];

/**
 * Ticket detail modal (STO-2494) — replaces the old Spec/Tests/Activity
 * inline-expand tabs. Shows the full Linear description rendered as proper
 * markdown, with open-in-Linear as the edit affordance (Atrium is a lens;
 * editing happens in Linear). A status picker (live mode) changes the Linear
 * status directly — including Cancel — without leaving the cockpit. Closes on
 * Esc, overlay click, or the X.
 */
export function TicketModal({
  ticket,
  canWrite = false,
  onClose,
}: {
  ticket: Ticket;
  /** Live key set → show the status picker; otherwise the status is read-only. */
  canWrite?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const currentStatus: FullStatus = ticket.status ?? statusFromState(ticket.state);
  const changeStatus = (write: WriteState) => {
    vscode.postMessage({ type: "setStatus", id: ticket.id, linearId: ticket.linearId, status: write });
    onClose(); // the host writes + refreshes the board, repositioning the ticket
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${ticket.id} details`}
        className="w-full max-w-[660px] max-h-[80vh] flex flex-col rounded-lg border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
          {isCanceled(ticket) ? (
            <span className="codicon codicon-circle-slash text-fg-muted" title={currentStatus} />
          ) : (
            <StateIcon state={ticket.state} />
          )}
          <span className="font-mono text-[11px] text-fg-muted">{ticket.id}</span>
          <span className={`text-[10px] uppercase tracking-wide ${PRIORITY[ticket.priority].cls}`}>
            {PRIORITY[ticket.priority].label}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {ticket.url && (
              <button
                type="button"
                aria-label={`Open ${ticket.id} in Linear`}
                title="Open in Linear to edit"
                className="flex items-center text-fg-muted hover:text-link"
                onClick={() => vscode.postMessage({ type: "openLinear", url: ticket.url })}
              >
                <span className="codicon codicon-link-external" />
              </button>
            )}
            <button
              type="button"
              aria-label="Close"
              title="Close (Esc)"
              className="flex items-center text-fg-muted hover:text-fg"
              onClick={onClose}
            >
              <span className="codicon codicon-close" />
            </button>
          </span>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-wide text-fg-muted">Status</span>
            {canWrite ? (
              <select
                aria-label="Change status"
                value={currentStatus}
                onChange={(e) => {
                  const opt = STATUS_OPTIONS.find((o) => o.label === e.target.value);
                  if (opt) changeStatus(opt.write);
                }}
                className="bg-bg text-fg border border-border rounded px-1.5 h-6 text-[12px] cursor-pointer focus:outline-none focus:border-link"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full border border-border text-[11px] text-fg-muted">
                {currentStatus}
              </span>
            )}
          </div>
          <h2 className="text-[15px] font-semibold leading-snug mb-3">{ticket.title}</h2>
          {ticket.description ? (
            <div
              className="md-body text-[12.5px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: mdToHtml(ticket.description) }}
            />
          ) : ticket.spec.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-[12.5px]">
              {ticket.spec.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-fg-muted/60 select-none">—</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted italic text-[12px]">
              No description on this ticket — open it in Linear for details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
