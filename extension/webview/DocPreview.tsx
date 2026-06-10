import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import { mdToHtml } from "./markdown";

/**
 * Rendered markdown document (STO-2496): PRD/TRD content flows through the host
 * (`previewFile` → `fileContent`, workspace-only) exactly like mockup previews,
 * so the host's per-file watcher pushes fresh content on change — edit the doc
 * (user or agent) and the rendered view updates live.
 */
export function DocPreview({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; path?: string; content?: string; error?: string };
      if (msg?.type !== "fileContent" || msg.path !== path) return;
      if (msg.error) {
        setError(msg.error);
      } else {
        setError(null);
        setContent(msg.content ?? "");
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "previewFile", path });
    return () => window.removeEventListener("message", onMessage);
  }, [path]);

  if (error) {
    return (
      <p role="alert" className="text-red text-[11px] italic px-1 py-2">
        {error}
      </p>
    );
  }
  if (content === null) {
    return (
      <div className="flex items-center gap-2 text-fg-muted text-[11px] p-3">
        <span className="codicon codicon-loading codicon-modifier-spin" />
        Loading document…
      </div>
    );
  }
  return (
    <div
      className="md-body text-[12.5px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  );
}
