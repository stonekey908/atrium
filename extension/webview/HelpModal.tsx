import { useEffect } from "react";
import { vscode } from "./vscode";
import { mdToHtml } from "./markdown";
import { AGENT_BRIEFING } from "./agentBriefing";

/**
 * Help modal (STO-2507): the project conventions rendered for humans, plus a
 * one-click "Copy agent briefing" that puts the raw text on the clipboard (via
 * the host) to paste into any AI assistant at project start.
 */
export function HelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help — project conventions"
        className="w-full max-w-[660px] max-h-[80vh] flex flex-col rounded-lg border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
          <span className="codicon codicon-question text-link" />
          <span className="font-semibold text-[13px]">Conventions — make work show up on the board</span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-0.5 border border-border rounded text-[11px] text-fg-muted hover:text-fg hover:border-fg-muted"
              title="Copy the briefing to paste into your AI assistant at project start"
              onClick={() => vscode.postMessage({ type: "copyText", text: AGENT_BRIEFING })}
            >
              <span className="codicon codicon-copy text-[12px]" />
              Copy agent briefing
            </button>
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
        <div
          className="overflow-y-auto px-5 py-4 md-body text-[12.5px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: mdToHtml(AGENT_BRIEFING) }}
        />
      </div>
    </div>
  );
}
