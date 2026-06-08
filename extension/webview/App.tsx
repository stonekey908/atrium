import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import { Cockpit } from "./Cockpit";
import type { InitPayload } from "./types";

/**
 * Owns the host message channel. On mount it announces `ready`; the host
 * replies with project state (real workspace folders + stub waves/stages).
 * Ticket interactions (expand, tabs) are handled inside the cockpit.
 */
export function App() {
  const [init, setInit] = useState<InitPayload | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; payload?: InitPayload };
      if (msg?.type === "init" && msg.payload) {
        setInit(msg.payload);
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!init) {
    return (
      <div className="flex items-center gap-2 p-4 text-fg-muted">
        <span className="codicon codicon-loading codicon-modifier-spin" />
        Connecting to Atrium host…
      </div>
    );
  }

  return <Cockpit init={init} />;
}
