import type { InitPayload, Priority, Ticket, TicketState, Wave } from "./types";

interface CockpitProps {
  init: InitPayload;
  onOpenTicket: (t: Ticket) => void;
  onRunClaude: (t: Ticket) => void;
}

const PIPELINE = [
  { label: "Plan", bg: "bg-violet-soft", text: "text-violet" },
  { label: "Design", bg: "bg-orange-soft", text: "text-orange" },
  { label: "UX", bg: "bg-indigo-soft", text: "text-indigo" },
  { label: "Build", bg: "bg-emerald-soft", text: "text-emerald" },
  { label: "UAT", bg: "bg-amber-soft", text: "text-amber" },
  { label: "Release", bg: "bg-muted", text: "text-muted-foreground" },
];

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-rose-soft text-rose border-rose-border" },
  high: { label: "High", cls: "bg-amber-soft text-amber border-amber-border" },
  med: { label: "Med", cls: "bg-indigo-soft text-indigo border-indigo-border" },
  low: { label: "Low", cls: "bg-muted text-muted-foreground border-border" },
};

export function Cockpit({ init, onOpenTicket, onRunClaude }: CockpitProps) {
  return (
    <div className="flex flex-col h-screen">
      <Header init={init} />
      <PipelineRow />
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {init.waves.map((w) => (
          <WaveCard key={w.name} wave={w} onOpenTicket={onOpenTicket} onRunClaude={onRunClaude} />
        ))}
        <p className="text-2xs text-muted-foreground px-1 pt-1 leading-relaxed">
          Stub data. Click a ticket row or its <span className="font-mono">▶ Run</span> button — the
          host round-trips the message and shows a VS Code notification. Wave 0.5 replaces this with
          live Linear data; Wave 1 wires <span className="font-mono">▶ Run</span> to the
          stream-json bridge.
        </p>
      </div>
    </div>
  );
}

function Header({ init }: { init: InitPayload }) {
  return (
    <header className="flex items-center gap-3 px-4 h-11 border-b border-border flex-shrink-0">
      <span className="font-semibold tracking-tight">Atrium</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-[13px]">{init.project}</span>
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-border font-mono text-2xs text-muted-foreground">
        <Glyph />
        {init.branch}
        <span className="w-1.5 h-1.5 rounded-full bg-amber" title="uncommitted changes" />
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-border font-mono text-2xs text-muted-foreground">
        {init.folders.length} folder{init.folders.length === 1 ? "" : "s"} open
      </span>
    </header>
  );
}

function PipelineRow() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border flex-shrink-0 overflow-x-auto">
      <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground mr-1">
        Pipeline
      </span>
      {PIPELINE.map((s, i) => (
        <span key={s.label} className="inline-flex items-center">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full border border-border text-2xs font-medium ${s.bg} ${s.text}`}
          >
            {s.label}
          </span>
          {i < PIPELINE.length - 1 && <span className="text-subtle mx-0.5">→</span>}
        </span>
      ))}
    </div>
  );
}

function WaveCard({
  wave,
  onOpenTicket,
  onRunClaude,
}: {
  wave: Wave;
  onOpenTicket: (t: Ticket) => void;
  onRunClaude: (t: Ticket) => void;
}) {
  const done = wave.tickets.filter((t) => t.state === "done").length;
  const pct = Math.round((done / wave.tickets.length) * 100);
  return (
    <section className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/40">
        <span className="font-medium text-[13px]">{wave.name}</span>
        <span className="font-mono text-2xs text-muted-foreground">
          {done}/{wave.tickets.length}
        </span>
        <div className="ml-auto w-24 h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-emerald" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div>
        {wave.tickets.map((t) => (
          <TicketRow key={t.id} t={t} onOpen={onOpenTicket} onRun={onRunClaude} />
        ))}
      </div>
    </section>
  );
}

function TicketRow({
  t,
  onOpen,
  onRun,
}: {
  t: Ticket;
  onOpen: (t: Ticket) => void;
  onRun: (t: Ticket) => void;
}) {
  const p = PRIORITY[t.priority];
  return (
    <div
      className="group grid grid-cols-[auto_auto_auto_1fr_auto_auto] items-center gap-3 px-3 py-2 border-t border-border hover:bg-accent cursor-pointer"
      onClick={() => onOpen(t)}
    >
      <StateDot state={t.state} />
      <span className="font-mono text-2xs text-muted-foreground">{t.id}</span>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-2xs font-medium ${p.cls}`}>
        {p.label}
      </span>
      <span className="text-[13px] truncate">{t.title}</span>
      <span className="font-mono text-2xs text-muted-foreground">{t.tests ?? ""}</span>
      <button
        className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-background text-2xs font-medium hover:bg-muted"
        onClick={(e) => {
          e.stopPropagation();
          onRun(t);
        }}
      >
        ▶ Run
      </button>
    </div>
  );
}

function StateDot({ state }: { state: TicketState }) {
  const cls =
    state === "done"
      ? "bg-emerald border-emerald"
      : state === "doing"
        ? "bg-amber-soft border-amber"
        : "bg-transparent border-subtle";
  return <span className={`w-3 h-3 rounded-full border ${cls}`} title={state} />;
}

function Glyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="4" cy="4" r="2" />
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="8" r="2" />
      <path d="M4 6v4M6 8h4M11 6 6 4" />
    </svg>
  );
}
