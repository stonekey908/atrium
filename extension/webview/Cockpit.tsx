import { useState } from "react";
import { vscode } from "./vscode";
import { waveStages, resolveActiveTicket, currentSprint } from "./sprint";
import { computeRollup } from "./rollup";
import { computePipeline, loopBacks, demoteState, type CockpitView, type PipelineStage } from "./views";
import { SprintBoard } from "./SprintBoard";
import { StatusStrip } from "./StatusStrip";
import { PlanView } from "./PlanView";
import { DesignView } from "./DesignView";
import { setDrag, getDrag } from "./dnd";
import { useBoardMutations } from "./useBoardMutations";
import { PRIORITY, StateIcon, Empty, AuditRibbon } from "./ui";
import type {
  ActivityKind,
  InitPayload,
  Spike,
  TestSummary,
  Ticket,
  Wave,
  WriteState,
} from "./types";

/** Persisted (per-webview) manual current-sprint override; null = auto. */
function readSprintOverride(): string | null {
  const s = vscode.getState() as { sprintOverride?: string | null } | undefined;
  return s?.sprintOverride ?? null;
}
function persistSprintOverride(name: string | null): void {
  const s = (vscode.getState() as Record<string, unknown> | undefined) ?? {};
  vscode.setState({ ...s, sprintOverride: name });
}

/** Shown in the sprint slot when every ticket is done (no active sprint). */
function NoSprint() {
  return (
    <div className="mx-auto w-full max-w-[1100px] shrink-0 px-3 py-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-green/[0.06] text-[12px]">
        <span className="codicon codicon-check-all text-green shrink-0" />
        <span className="font-semibold">All shipped — no active sprint.</span>
        <span className="text-fg-muted truncate">
          Drag a ticket up to start one, or pin a wave below as the current sprint.
        </span>
      </div>
    </div>
  );
}

export function Cockpit({ init }: { init: InitPayload }) {
  const [view, setView] = useState<CockpitView>("board");
  // Manual override for which wave is the current sprint (persisted), in case the
  // data-driven pick is wrong. null = auto.
  const [sprintOverride, setSprintOverride] = useState<string | null>(() => readSprintOverride());
  const setOverride = (name: string | null) => {
    setSprintOverride(name);
    persistSprintOverride(name);
  };
  // Optimistic write-back layers local moves over the host's board; drag is only
  // enabled in live mode (a key is set), so the board never fakes a sync.
  const { displayWaves, syncOf, move, reorder, moveToWave } = useBoardMutations(init.waves);
  const canWrite = init.source === "live";
  const sprint = currentSprint(displayWaves, sprintOverride);
  const pinned = !!sprintOverride && sprint?.name === sprintOverride;
  const hasWork = displayWaves.some((w) => w.tickets.length > 0);
  // Plan reads the optimistic board too, so moves reflect everywhere.
  const liveInit = { ...init, waves: displayWaves };
  return (
    <div className="flex flex-col h-full bg-bg text-fg select-none">
      <Header init={init} />
      <StatusStrip init={init} />
      <ViewTabs view={view} setView={setView} />
      {init.error && <LoadBanner message={init.error} />}
      {view === "board" && (
        <>
          <Pipeline stages={computePipeline(displayWaves)} />
          <ReturnStrip waves={displayWaves} />
          <ActiveWork waves={displayWaves} branch={init.branch} />
          <RollupBar waves={displayWaves} spikes={init.spikes ?? []} />
          {/* The sprint kanban stays pinned; only the horizon list below scrolls.
              Drag a card down into a wave to demote it, or a wave ticket up to
              promote it into the sprint. Current sprint is data-driven (the wave
              with active work) with a manual pin override. */}
          {sprint ? (
            <div className="mx-auto w-full max-w-[1100px] shrink-0">
              <SprintBoard
                wave={sprint}
                syncOf={syncOf}
                canWrite={canWrite}
                onMove={move}
                onReorder={reorder}
                onMoveToWave={moveToWave}
                pinned={pinned}
                onUnpin={() => setOverride(null)}
              />
            </div>
          ) : hasWork ? (
            <NoSprint />
          ) : null}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1100px]">
              {displayWaves
                .filter((w) => w !== sprint)
                .map((w) => (
                  <WaveSection
                    key={w.name}
                    wave={w}
                    canWrite={canWrite}
                    onMoveToWave={moveToWave}
                    onPinSprint={() => setOverride(w.name)}
                  />
                ))}
            </div>
          </div>
        </>
      )}
      {view === "plan" && <PlanView init={liveInit} />}
      {view === "design" && <DesignView init={init} />}
    </div>
  );
}

const VIEW_TABS: { key: CockpitView; label: string; icon: string }[] = [
  { key: "board", label: "Board", icon: "codicon-layout" },
  { key: "plan", label: "Plan", icon: "codicon-checklist" },
  { key: "design", label: "Design", icon: "codicon-symbol-color" },
];

function ViewTabs({ view, setView }: { view: CockpitView; setView: (v: CockpitView) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 h-8 border-b border-border shrink-0">
      {VIEW_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setView(t.key)}
          aria-pressed={view === t.key}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[12px] ${
            view === t.key ? "bg-active text-active-fg" : "text-fg-muted hover:text-fg"
          }`}
        >
          <span className={`codicon ${t.icon} text-[12px]`} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Loop-back return-strip (STO-2177): the most recent wave that bounced back. */
function ReturnStrip({ waves }: { waves: Wave[] }) {
  const looped = loopBacks(waves);
  if (looped.length === 0) return null;
  const w = looped[0];
  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-border shrink-0 text-[11px] bg-yellow/5 text-yellow">
      <span className="codicon codicon-discard text-[12px]" />
      <span className="text-fg-muted">
        <span className="font-semibold text-fg">{w.name}</span> looped back · now on Pass {w.passN}
      </span>
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
      <button
        type="button"
        aria-label="Refresh board"
        title="Refresh board"
        className="ml-auto flex items-center text-fg-muted hover:text-fg"
        onClick={() => vscode.postMessage({ type: "refresh" })}
      >
        <span className="codicon codicon-refresh" />
      </button>
    </div>
  );
}

/** Tier-1 project pipeline (STO-2174): each stage's state + wave count derived
 *  from where the waves actually sit. */
function Pipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
      {stages.map((s, i) => (
        <span key={s.key} className="flex items-center shrink-0">
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
              s.state === "active"
                ? "bg-active text-active-fg"
                : s.state === "done"
                  ? "text-fg"
                  : "text-fg-muted"
            }`}
            title={s.waves.length > 0 ? s.waves.map((w) => w.name).join(", ") : `No waves at ${s.label}`}
          >
            <span className={`codicon ${stageIcon(s.state)}`} />
            {s.label}
            {s.waves.length > 0 && <span className="font-mono opacity-70">{s.waves.length}</span>}
          </span>
          {i < stages.length - 1 && <span className="codicon codicon-chevron-right text-fg-muted opacity-50" />}
        </span>
      ))}
    </div>
  );
}

function stageIcon(state: PipelineStage["state"]): string {
  if (state === "done") return "codicon-pass-filled text-green";
  if (state === "active") return "codicon-circle-large-filled";
  return "codicon-circle-large-outline";
}

function WaveSection({
  wave,
  canWrite = false,
  onMoveToWave,
  onPinSprint,
}: {
  wave: Wave;
  canWrite?: boolean;
  onMoveToWave?: (id: string, linearId: string | undefined, toWaveLabel: string, toState?: WriteState) => void;
  onPinSprint?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [isOver, setIsOver] = useState(false);
  const done = wave.tickets.filter((t) => t.state === "done").length;
  const doing = wave.tickets.filter((t) => t.state === "doing").length;
  const review = wave.tickets.filter((t) => t.state === "review").length;
  const todo = wave.tickets.filter((t) => t.state === "todo").length;
  const passN = wave.passN ?? 1;

  const droppable = canWrite && !!wave.label && !!onMoveToWave;

  // A card dropped from another wave (e.g. the sprint) moves here (demote).
  // Pulling active work out of the sprint un-starts it (review/doing → todo);
  // done/todo keep their state.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    if (!droppable) return;
    const p = getDrag(e);
    if (!p || p.fromWaveLabel === wave.label) return;
    onMoveToWave!(p.id, p.linearId, wave.label!, demoteState(p.fromState));
  };

  return (
    <section
      onDragOver={droppable ? (e) => { e.preventDefault(); if (!isOver) setIsOver(true); } : undefined}
      // Only clear the highlight when the pointer truly leaves the section — not
      // when it crosses a child row — so the drop target doesn't flicker/jitter.
      onDragLeave={
        droppable ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false); } : undefined
      }
      onDrop={droppable ? onDrop : undefined}
      className={`border-b border-border transition-colors ${
        isOver ? "outline outline-1 -outline-offset-1 outline-link bg-active/10" : ""
      }`}
    >
      <div className="group w-full flex items-center gap-1.5 px-2 h-7 hover:bg-hover">
        <button className="flex items-center gap-1.5 min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
          <span className="font-semibold text-[11px] uppercase tracking-wide truncate">{wave.name}</span>
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
        </button>
        {onPinSprint && (
          <button
            type="button"
            onClick={onPinSprint}
            title="Make this the current sprint"
            aria-label={`Pin ${wave.name} as the current sprint`}
            className="flex items-center text-fg-muted hover:text-link opacity-0 group-hover:opacity-100 shrink-0"
          >
            <span className="codicon codicon-pin text-[12px]" />
          </button>
        )}
        <span className="flex items-center gap-2 text-fg-muted text-[11px] shrink-0">
          <span className="font-mono">
            {done}/{wave.tickets.length}
          </span>
          <SegmentedBar done={done} doing={doing} review={review} todo={todo} className="w-16" />
        </span>
      </div>
      {wave.stage && <WaveStageStrip stage={wave.stage} />}
      {open && (
        <div>
          {wave.tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} draggable={canWrite} fromWaveLabel={wave.label} />
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

function TicketRow({
  ticket,
  draggable = false,
  fromWaveLabel,
}: {
  ticket: Ticket;
  draggable?: boolean;
  fromWaveLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) =>
                setDrag(e, {
                  id: ticket.id,
                  linearId: ticket.linearId,
                  fromState: ticket.state,
                  fromWaveLabel,
                  sortOrder: ticket.sortOrder ?? 0,
                })
            : undefined
        }
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={`grid grid-cols-[16px_minmax(0,auto)_1fr_auto_auto_auto] items-center gap-2 pl-5 pr-3 h-[26px] text-left text-[13px] cursor-pointer hover:bg-hover ${
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
        {/* Audit-trail ribbon (STO-2172) — only when the ticket has a trail. */}
        {ticket.activity.length > 0 ? <AuditRibbon activity={ticket.activity} /> : <span />}
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
    <div className="flex flex-col gap-2">
      <div className="pb-1.5 border-b border-border">
        <AuditRibbon activity={items} labeled />
      </div>
      <ul className="flex flex-col gap-1.5 text-[12px]">
        {items.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={`codicon ${ACTIVITY_ICON[a.kind]} text-fg-muted shrink-0`} />
            <span className="flex-1">{a.text}</span>
            <span className="text-fg-muted text-[10px] font-mono shrink-0">{a.when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

