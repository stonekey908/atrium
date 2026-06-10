import { useEffect, useState } from "react";
import { vscode } from "./vscode";

/**
 * Sandboxed inline preview of a repo HTML mockup (STO-2479). Content flows
 * through the host (`previewFile` → `fileContent`) so the webview never touches
 * the filesystem; the host watches the file and pushes fresh content when the
 * user or the agent edits it — the preview re-renders live. The iframe is fully
 * sandboxed (no scripts): mockups are static visual contracts.
 */
export function MockupPreview({ path, title }: { path: string; title: string }) {
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
        Loading preview…
      </div>
    );
  }
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={content}
      className="w-full h-[480px] rounded border border-border bg-bg"
    />
  );
}
