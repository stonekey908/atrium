import { useState } from "react";
import { vscode } from "./vscode";
import { waveStages, isCurrentSprint, resolveActiveTicket } from "./sprint";
import { computeRollup } from "./rollup";
import type {
  ActivityKind,
  InitPayload,
  Priority,
  Spike,
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
      {init.error && <LoadBanner message={init.error} />}
      <Pipeline stages={init.stages} />
      <ActiveWork waves={init.waves} branch={init.branch} />
      <RollupBar waves={init.waves} spikes={init.spikes ?? []} />
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

function LoadBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-yellow/10 text-[12px] text-yellow shrink-0"
    >
      <span className="codicon codicon-warning shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
}

/** Where the board data came from + how fresh it is. Live = a green dot;
 *  snapshot = the date so you know whether to Refresh / regenerate. */
function SourceChip({ source, generatedAt }: { source?: "snapshot" | "live"; generatedAt?: string }) {
  if (!source) return null;
  if (source === "live") {
    return (
      <span className="flex items-center gap-1 text-green text-[11px]" title="Pulled live from Linear">
        <span className="w-1.5 h-1.5 rounded-full bg-green" />
        live
      </span>
    );
  }
  return (
    <span
      className="text-fg-muted text-[11px]"
      title="Committed snapshot — Refresh after I regenerate it, or set a Linear API key (SETUP.md) for live data"
    >
      snapshot{generatedAt ? ` · ${generatedAt}` : ""}
    </span>
  );
}

/** Tier-2 "what am I doing right now": the ticket matched from the current branch
 *  (or the first in-progress one). Hidden when nothing is active. */
function ActiveWork({ waves, branch }: { waves: Wave[]; branch: string }) {
  const active = resolveActiveTicket(waves, branch);
  if (!active) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 text-[12px] bg-active/5">
      <span className="codicon codicon-debug-start text-link shrink-0" />
      <span className="uppercase text-[9px] tracking-wide text-fg-muted shrink-0">Working on</span>
      <span className="font-mono text-[11px] text-fg-muted shrink-0">{active.id}</span>
      <span className="truncate">{active.title}</span>
      <span className="ml-auto shrink-0">
        <StateIcon state={active.state} />
      </span>
    </div>
  );
}

/** Project-wide "where am I overall" glance: segmented progress + counts + spikes. */
function RollupBar({ waves, spikes }: { waves: Wave[]; spikes: Spike[] }) {
  const r = computeRollup(waves);
  if (r.total === 0) return null;
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0 text-[11px] text-fg-muted">
      <span className="font-mono text-fg text-[12px] shrink-0">{r.pct}%</span>
      <SegmentedBar done={r.done} doing={r.doing} review={r.review} todo={r.todo} className="flex-1 min-w-[80px]" />
      <span className="font-mono shrink-0">
        {r.done}/{r.total} done
      </span>
      {r.active > 0 && (
        <span className="flex items-center gap-1 text-blue shrink-0" title="In progress + in review">
          <span className="codicon codicon-sync" />
          {r.active} active
        </span>
      )}
      {spikes.length > 0 && (
        <span className="flex items-center gap-1 text-orange shrink-0" title="Open spikes gating waves">
          <span className="codicon codicon-warning" />
          {spikes.length} spike{spikes.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/** Stacked done / doing / todo bar (todo is the uncovered remainder). */
function SegmentedBar({
  done,
  doing,
  review,
  todo,
  className = "",
}: {
  done: number;
  doing: number;
  review: number;
  todo: number;
  className?: string;
}) {
  const total = done + doing + review + todo || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <span className={`h-1.5 rounded-full overflow-hidden flex bg-border ${className}`}>
      <span className="block h-full bg-green" style={{ width: seg(done) }} />
      <span className="block h-full bg-yellow" style={{ width: seg(doing) }} />
      <span className="block h-full bg-blue" style={{ width: seg(review) }} />
    </span>
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
      <SourceChip source={init.source} generatedAt={init.generatedAt} />
      <button
        type="button"
        aria-label="Refresh board"
        title="Refresh board"
        className="flex items-center text-fg-muted hover:text-fg"
        onClick={() => vscode.postMessage({ type: "refresh" })}
      >
        <span className="codicon codicon-refresh" />
      </button>
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
  const doing = wave.tickets.filter((t) => t.state === "doing").length;
  const review = wave.tickets.filter((t) => t.state === "review").length;
  const todo = wave.tickets.filter((t) => t.state === "todo").length;
  const current = isCurrentSprint(wave.stage);
  const passN = wave.passN ?? 1;
  return (
    <section className={`border-b border-border ${current ? "bg-active/5" : ""}`}>
      <button
        className="w-full flex items-center gap-1.5 px-2 h-7 hover:bg-hover text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
        <span className="font-semibold text-[11px] uppercase tracking-wide truncate">{wave.name}</span>
        {current && (
          <span className="flex items-center gap-1 px-1.5 rounded-full bg-active text-active-fg text-[9px] uppercase tracking-wide shrink-0">
            <span className="codicon codicon-debug-start text-[9px]" />
            Current sprint
          </span>
        )}
        {wave.gatedBy && (
          <span
            className="flex items-center gap-1 px-1.5 rounded-full bg-orange/15 text-orange text-[9px] uppercase tracking-wide shrink-0"
            title={`Blocked by spike ${wave.gatedBy}`}
          >
            <span className="codicon codicon-warning text-[9px]" />
            Gated by {wave.gatedBy}
          </span>
        )}
        {passN > 1 && (
          <span
            className="flex items-center gap-1 px-1.5 rounded-full bg-yellow/15 text-yellow text-[9px] uppercase tracking-wide shrink-0"
            title="UAT loop-backs"
          >
            <span className="codicon codicon-history text-[9px]" />
            Pass {passN}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-fg-muted text-[11px] shrink-0">
          <span className="font-mono">
            {done}/{wave.tickets.length}
          </span>
          <SegmentedBar done={done} doing={doing} review={review} todo={todo} className="w-16" />
        </span>
      </button>
      {wave.stage && <WaveStageStrip stage={wave.stage} />}
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

/** Per-sprint mini-pipeline: where this wave sits on Plan → … → Release. */
function WaveStageStrip({ stage }: { stage: string }) {
  return (
    <div className="flex items-center gap-1 pl-5 pr-3 pb-1.5 -mt-0.5 overflow-x-auto">
      {waveStages(stage).map((s, i) => (
        <span key={s.key} className="flex items-center shrink-0">
          <span
            className={`text-[9px] uppercase tracking-wide ${
              s.status === "active"
                ? "text-link font-semibold"
                : s.status === "done"
                  ? "text-fg-muted"
                  : "text-fg-muted/50"
            }`}
          >
            {s.label}
          </span>
          {i < 5 && <span className="codicon codicon-chevron-right text-fg-muted/30 text-[9px]" />}
        </span>
      ))}
    </div>
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
  const toggle = () => setOpen((o) => !o);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={`grid grid-cols-[16px_minmax(0,auto)_1fr_auto_auto] items-center gap-2 pl-5 pr-3 h-[26px] text-left text-[13px] cursor-pointer hover:bg-hover ${
          open
            ? "bg-active text-active-fg"
            : ticket.state === "review"
              ? "bg-blue/[0.07]"
              : ticket.state === "doing"
                ? "bg-yellow/[0.07]"
                : ""
        }`}
      >
        <StateIcon state={ticket.state} />
        <span className="font-mono text-[11px] text-fg-muted">{ticket.id}</span>
        <span className="truncate">{ticket.title}</span>
        <span className={`text-[10px] uppercase tracking-wide ${PRIORITY[ticket.priority].cls}`}>
          {PRIORITY[ticket.priority].label}
        </span>
        {ticket.url ? (
          <button
            type="button"
            aria-label={`Open ${ticket.id} in Linear`}
            title="Open in Linear"
            className="flex items-center text-fg-muted hover:text-link"
            onClick={(e) => {
              e.stopPropagation();
              vscode.postMessage({ type: "openLinear", url: ticket.url });
            }}
          >
            <span className="codicon codicon-link-external text-[12px]" />
          </button>
        ) : (
          <span />
        )}
      </div>
      {open && <TicketDetail ticket={ticket} />}
    </div>
  );
}

function StateIcon({ state }: { state: TicketState }) {
  if (state === "done") return <span className="codicon codicon-pass-filled text-green" title="done" />;
  if (state === "review")
    return <span className="codicon codicon-git-pull-request text-blue" title="in review" />;
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
