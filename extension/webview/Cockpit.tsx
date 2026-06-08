import { useState } from "react";
import type {
  ActivityKind,
  InitPayload,
  Priority,
  Stage,
  TestSummary,
  Ticket,
  TicketState,
  Wave,
} from "./types";

export function Cockpit({ init }: { init: InitPayload }) {
  return (
    <div className="flex flex-col h-full bg-bg text-fg select-none">
      <Header init={init} />
      <Pipeline stages={init.stages} />
      {/* Centred, capped width so it reads well full-screen and in the rail. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1000px]">
          {init.waves.map((w) => (
            <WaveSection key={w.name} wave={w} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ init }: { init: InitPayload }) {
  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0 text-[12px]">
      <span className="codicon codicon-symbol-structure text-link" />
      <span className="font-semibold">Atrium</span>
      <span className="text-fg-muted truncate">{init.project}</span>
      <span className="ml-auto flex items-center gap-1 text-fg-muted" title="Current branch">
        <span className="codicon codicon-source-control" />
        <span className="font-mono text-[11px]">{init.branch}</span>
      </span>
      <span className="flex items-center gap-1 text-fg-muted" title="Open workspace folders">
        <span className="codicon codicon-folder-opened" />
        <span className="text-[11px]">{init.folders.length}</span>
      </span>
    </div>
  );
}

function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
      {stages.map((s, i) => (
        <span key={s.key} className="flex items-center shrink-0">
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
              s.status === "active"
                ? "bg-active text-active-fg"
                : s.status === "done"
                  ? "text-fg"
                  : "text-fg-muted"
            }`}
          >
            <span className={`codicon ${stageIcon(s.status)}`} />
            {s.label}
          </span>
          {i < stages.length - 1 && (
            <span className="codicon codicon-chevron-right text-fg-muted opacity-50" />
          )}
        </span>
      ))}
    </div>
  );
}

function stageIcon(status: Stage["status"]): string {
  if (status === "done") return "codicon-pass-filled text-green";
  if (status === "active") return "codicon-circle-large-filled";
  return "codicon-circle-large-outline";
}

function WaveSection({ wave }: { wave: Wave }) {
  const [open, setOpen] = useState(true);
  const done = wave.tickets.filter((t) => t.state === "done").length;
  const pct = Math.round((done / wave.tickets.length) * 100);
  return (
    <section className="border-b border-border">
      <button
        className="w-full flex items-center gap-1.5 px-2 h-7 hover:bg-hover text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
        <span className="font-semibold text-[11px] uppercase tracking-wide truncate">{wave.name}</span>
        <span className="ml-auto flex items-center gap-2 text-fg-muted text-[11px] shrink-0">
          <span className="font-mono">
            {done}/{wave.tickets.length}
          </span>
          <span className="w-16 h-1 rounded-full bg-border overflow-hidden">
            <span className="block h-full bg-green" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </button>
      {open && (
        <div>
          {wave.tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </section>
  );
}

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "text-red" },
  high: { label: "High", cls: "text-orange" },
  med: { label: "Med", cls: "text-blue" },
  low: { label: "Low", cls: "text-fg-muted" },
};

function TicketRow({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className={`w-full grid grid-cols-[16px_minmax(0,auto)_1fr_auto] items-center gap-2 pl-5 pr-3 h-[26px] text-left text-[13px] hover:bg-hover ${
          open ? "bg-active text-active-fg" : ""
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <StateIcon state={ticket.state} />
        <span className="font-mono text-[11px] text-fg-muted">{ticket.id}</span>
        <span className="truncate">{ticket.title}</span>
        <span className={`text-[10px] uppercase tracking-wide ${PRIORITY[ticket.priority].cls}`}>
          {PRIORITY[ticket.priority].label}
        </span>
      </button>
      {open && <TicketDetail ticket={ticket} />}
    </div>
  );
}

function StateIcon({ state }: { state: TicketState }) {
  if (state === "done") return <span className="codicon codicon-pass-filled text-green" title="done" />;
  if (state === "doing")
    return <span className="codicon codicon-sync text-yellow" title="in progress" />;
  return <span className="codicon codicon-circle-large-outline text-fg-muted" title="todo" />;
}

type Tab = "spec" | "tests" | "activity";

function TicketDetail({ ticket }: { ticket: Ticket }) {
  const [tab, setTab] = useState<Tab>("spec");
  const tabs: Tab[] = ["spec", "tests", "activity"];
  return (
    <div className="pl-5 pr-3 pb-3 pt-1 border-b border-border">
      <div className="flex items-center gap-4 border-b border-border mb-2 text-[12px]">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-1 capitalize ${
              tab === t ? "text-fg border-b border-link -mb-px" : "text-fg-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "spec" && <Spec spec={ticket.spec} />}
      {tab === "tests" && <Tests tests={ticket.tests} />}
      {tab === "activity" && <Activity items={ticket.activity} />}
    </div>
  );
}

function Spec({ spec }: { spec: string[] }) {
  if (spec.length === 0) return <Empty>No acceptance criteria yet.</Empty>;
  return (
    <ul className="flex flex-col gap-1 text-[12px]">
      {spec.map((s, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="codicon codicon-check text-fg-muted shrink-0" />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function Tests({ tests }: { tests: TestSummary }) {
  const total = tests.passed + tests.failed + tests.missing;
  if (total === 0) return <Empty>No tests discovered yet.</Empty>;
  return (
    <div className="flex gap-4 text-[12px]">
      <span className="flex items-center gap-1 text-green">
        <span className="codicon codicon-pass" />
        {tests.passed} passed
      </span>
      <span className={`flex items-center gap-1 ${tests.failed ? "text-red" : "text-fg-muted"}`}>
        <span className="codicon codicon-error" />
        {tests.failed} failed
      </span>
      <span className="flex items-center gap-1 text-fg-muted">
        <span className="codicon codicon-circle-large-outline" />
        {tests.missing} missing
      </span>
    </div>
  );
}

const ACTIVITY_ICON: Record<ActivityKind, string> = {
  pickup: "codicon-arrow-small-right",
  plan: "codicon-checklist",
  phase: "codicon-milestone",
  close: "codicon-check-all",
  commit: "codicon-git-commit",
};

function Activity({ items }: { items: Ticket["activity"] }) {
  if (items.length === 0) return <Empty>No activity yet.</Empty>;
  return (
    <ul className="flex flex-col gap-1.5 text-[12px]">
      {items.map((a, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className={`codicon ${ACTIVITY_ICON[a.kind]} text-fg-muted shrink-0`} />
          <span className="flex-1">{a.text}</span>
          <span className="text-fg-muted text-[10px] font-mono shrink-0">{a.when}</span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-fg-muted italic">{children}</p>;
}
