import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import { currentSprint } from "./sprint";
import { waveUatRollup, type UatRollup } from "./views";
import type { InitPayload, Ticket } from "./types";

type Verdict = "Bug" | "Feature" | "Docs";
const VERDICTS: { v: Verdict; cls: string }[] = [
  { v: "Bug", cls: "bg-red/15 text-red" },
  { v: "Feature", cls: "bg-blue/15 text-blue" },
  { v: "Docs", cls: "bg-fg-muted/15 text-fg-muted" },
];

/**
 * UAT canvas (STO-2176): the current sprint's UAT rollup (STO-2187) plus a
 * finding composer that files a classified finding as a Linear comment on a
 * ticket (STO-2175's "file as finding"). Capture/draw/redact is left to VS Code
 * / OS tools — reference the screenshot path in the note.
 */
export function UatView({ init }: { init: InitPayload }) {
  const sprint = currentSprint(init.waves);
  const tickets = sprint?.tickets ?? init.waves.flatMap((w) => w.tickets);
  const canWrite = init.source === "live";
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 py-4 flex flex-col gap-4">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            UAT · findings
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            {sprint ? `Acceptance pass for ${sprint.name}.` : "No current sprint."} Findings file as Linear comments,
            tagged with the verdict.
          </p>
        </header>
        {sprint && <RollupTiles rollup={waveUatRollup(sprint)} />}
        <FindingComposer tickets={tickets} canWrite={canWrite} />
      </div>
    </div>
  );
}

function RollupTiles({ rollup }: { rollup: UatRollup }) {
  const tiles: { label: string; n: number; cls: string }[] = [
    { label: "UAT cases", n: rollup.total, cls: "text-fg" },
    { label: "Pending", n: rollup.pending, cls: "text-yellow" },
    { label: "Pass", n: rollup.pass, cls: "text-green" },
    { label: "Fail", n: rollup.fail, cls: "text-red" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="border border-border rounded-md p-2 text-center">
          <div className={`font-mono text-[18px] ${t.cls}`}>{t.n}</div>
          <div className="text-[10px] uppercase tracking-wide text-fg-muted">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function FindingComposer({ tickets, canWrite }: { tickets: Ticket[]; canWrite: boolean }) {
  const [ticketId, setTicketId] = useState(tickets[0]?.id ?? "");
  const [verdict, setVerdict] = useState<Verdict>("Bug");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "filing" | "filed" | "failed">("idle");

  // The host replies to our addFinding with a mutationResult keyed by finding id.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string; ok?: boolean };
      if (m?.type === "mutationResult" && m.id === `finding:${ticketId}`) {
        setStatus(m.ok ? "filed" : "failed");
        if (m.ok) setBody("");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ticketId]);

  const ticket = tickets.find((t) => t.id === ticketId);
  const disabled = !canWrite || !ticket?.linearId || body.trim().length === 0 || status === "filing";

  const file = () => {
    if (disabled || !ticket) return;
    setStatus("filing");
    vscode.postMessage({
      type: "addFinding",
      id: `finding:${ticket.id}`,
      linearId: ticket.linearId,
      verdict,
      body: body.trim(),
    });
  };

  return (
    <section className="border border-border rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="codicon codicon-comment-draft text-link" />
        <span className="font-semibold">File a finding</span>
        {!canWrite && (
          <span className="ml-auto text-fg-muted text-[10px]" title="Set a Linear API key to file findings">
            read-only
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          className="bg-bg border border-border rounded px-1.5 py-1 text-[12px] max-w-[280px]"
          aria-label="Target ticket"
        >
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} · {t.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {VERDICTS.map(({ v, cls }) => (
            <button
              key={v}
              type="button"
              onClick={() => setVerdict(v)}
              className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                verdict === v ? cls : "text-fg-muted hover:text-fg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setStatus("idle");
        }}
        placeholder="Describe the finding (reference a screenshot path if you have one)…"
        className="bg-bg border border-border rounded px-2 py-1.5 text-[12px] min-h-[64px] resize-y"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={file}
          disabled={disabled}
          className="px-2 py-1 rounded bg-active text-active-fg text-[12px] disabled:opacity-40"
        >
          {status === "filing" ? "Filing…" : "File as finding"}
        </button>
        {status === "filed" && <span className="text-green text-[11px]">Filed ✓</span>}
        {status === "failed" && <span className="text-red text-[11px]">Couldn't file — check the API key</span>}
      </div>
    </section>
  );
}
