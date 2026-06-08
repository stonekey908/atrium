import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import { Cockpit } from "./Cockpit";
import type { InitPayload, Ticket } from "./types";

/**
 * Owns the host message channel. On mount it announces `ready`; the host
 * replies with the project payload (real workspace folders + stub waves).
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

  const openTicket = (t: Ticket) => vscode.postMessage({ type: "openTicket", id: t.id });
  const runClaude = (t: Ticket) =>
    vscode.postMessage({ type: "runClaude", id: t.id, title: t.title });

  if (!init) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald animate-pulse" />
        Connecting to Atrium host…
      </div>
    );
  }

  return <Cockpit init={init} onOpenTicket={openTicket} onRunClaude={runClaude} />;
}
