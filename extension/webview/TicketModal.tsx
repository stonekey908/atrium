import { useEffect } from "react";
import { vscode } from "./vscode";
import { mdToHtml } from "./markdown";
import { PRIORITY, StateIcon } from "./ui";
import type { Ticket } from "./types";

/**
 * Ticket detail modal (STO-2494) — replaces the old Spec/Tests/Activity
 * inline-expand tabs. Shows the full Linear description rendered as proper
 * markdown, with open-in-Linear as the edit affordance (Atrium is a lens;
 * editing happens in Linear). Closes on Esc, overlay click, or the X.
 */
export function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <StateIcon state={ticket.state} />
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
