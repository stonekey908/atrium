import { useState, useEffect, useRef } from "react";
import { vscode } from "./vscode";
import { resolveActiveTicket, currentSprint } from "./sprint";
import { computeRollup } from "./rollup";
import { loopBacks, demoteState, type CockpitView } from "./views";
import { SprintBoard } from "./SprintBoard";
import { StatusStrip } from "./StatusStrip";
import { PrdView } from "./PrdView";
import { DesignView } from "./DesignView";
import { setDrag, getDrag } from "./dnd";
import { useBoardMutations } from "./useBoardMutations";
import { TicketModal } from "./TicketModal";
import { HelpModal } from "./HelpModal";
import { PRIORITY, StateIcon, AuditRibbon } from "./ui";
import { applyTicketView, filterTickets, isFiltering, DEFAULT_VIEW, type TicketView, type SortKey, type FilterStatus } from "./ticketView";
import { activeTickets, isCanceled } from "./types";
import type { InitPayload, Priority, Spike, Ticket, TicketState, Wave, WriteState } from "./types";

/** Collapse-set sentinel for the "Completed" group. */
const COMPLETED_KEY = "__completed__";

/** A wave whose active tickets are all done — bundled into the Completed group.
 *  Canceled/Duplicate tickets are ignored (a shipped wave with a canceled ticket
 *  still counts as done). */
function isWaveDone(wave: Wave): boolean {
  const active = activeTickets(wave.tickets);
  return active.length > 0 && active.every((t) => t.state === "done");
}

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

/** Status chips for the filter bar — colour-coded to match the kanban / StateIcon. */
/** Status filter options (the four kanban columns + Canceled, hidden by default
 *  until checked). Drives the Status dropdown — `view.states` is FilterStatus[]. */
const STATUS_OPTIONS: { key: FilterStatus; label: string; dot: string }[] = [
  { key: "todo", label: "To do", dot: "bg-fg-muted" },
  { key: "doing", label: "Doing", dot: "bg-yellow" },
  { key: "review", label: "Review", dot: "bg-blue" },
  { key: "done", label: "Done", dot: "bg-green" },
  { key: "canceled", label: "Canceled", dot: "bg-fg-muted/40" },
];
const PRIORITY_OPTIONS: { key: Priority; label: string; cls: string }[] = (["urgent", "high", "med", "low"] as Priority[]).map(
  (p) => ({ key: p, label: PRIORITY[p].label, cls: PRIORITY[p].cls }),
);
/** "Default" = the order Linear gives us (drag-to-reorder on the kanban writes it). */
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "Default" },
  { key: "priority", label: "Priority" },
  { key: "state", label: "Status" },
  { key: "id", label: "ID" },
];

const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** A compact multi-select dropdown for one filter axis — keeps the toolbar on a
 *  single line. Shows "All" when nothing is picked (no narrowing on that axis),
 *  a count when some are. Closes on outside-click / Esc. */
function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; dot?: string; cls?: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1 h-6 px-2 rounded border ${
          selected.length > 0 ? "border-link text-fg" : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"
        }`}
      >
        <span>{label}</span>
        <span className={selected.length > 0 ? "px-1 rounded-full bg-active text-active-fg text-[9px]" : "text-fg-muted/60"}>
          {selected.length > 0 ? selected.length : "All"}
        </span>
        <span className="codicon codicon-chevron-down text-[10px]" />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 mt-1 z-30 min-w-[150px] rounded border border-border bg-bg shadow-lg py-1">
          {options.map((o) => {
            const on = selected.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onChange(toggle(selected, o.key))}
                className="w-full flex items-center gap-2 px-2 h-6 text-left text-[11px] hover:bg-hover"
              >
                <span className={`codicon ${on ? "codicon-check text-link" : ""} text-[11px] w-3.5 shrink-0`} />
                {o.dot && <span className={`w-1.5 h-1.5 rounded-full ${o.dot} shrink-0`} />}
                <span className={`truncate ${o.cls ?? ""}`}>{o.label}</span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left text-[10px] text-fg-muted hover:text-fg px-2 pt-1 mt-1 border-t border-border"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Global sort/filter toolbar above the wave lists, on a single line: a text
 *  search, categorised Status + Priority dropdowns (multi-select; "All" when
 *  empty), a sort dropdown, and the collapse-all toggle. */
function TicketFilterBar({
  view,
  onChange,
  showCollapseAll,
  allCollapsed,
  onToggleAll,
}: {
  view: TicketView;
  onChange: (v: TicketView) => void;
  showCollapseAll: boolean;
  allCollapsed: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-bg border-b border-border flex items-center gap-2 px-2 py-1.5 text-[11px]">
      <div className="flex items-center gap-1 h-6 px-1.5 rounded border border-border focus-within:border-fg-muted shrink-0">
        <span className="codicon codicon-search text-[11px] text-fg-muted" />
        <input
          value={view.search}
          onChange={(e) => onChange({ ...view, search: e.target.value })}
          placeholder="Filter tickets…"
          aria-label="Filter tickets by id or title"
          className="bg-transparent outline-none w-24 placeholder:text-fg-muted/60"
        />
        {view.search && (
          <button
            type="button"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => onChange({ ...view, search: "" })}
            className="flex items-center text-fg-muted hover:text-fg"
          >
            <span className="codicon codicon-close text-[11px]" />
          </button>
        )}
      </div>

      <FilterDropdown
        label="Status"
        options={STATUS_OPTIONS}
        selected={view.states}
        onChange={(states) => onChange({ ...view, states })}
      />
      <FilterDropdown
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={view.priorities}
        onChange={(priorities) => onChange({ ...view, priorities })}
      />

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {isFiltering(view) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_VIEW)}
            title="Clear all filters"
            className="flex items-center gap-1 text-fg-muted hover:text-fg"
          >
            <span className="codicon codicon-clear-all text-[12px]" />
            Clear
          </button>
        )}
        <label
          className="flex items-center gap-1 text-fg-muted"
          title="Sort tickets within each wave. Default = the order from Linear (set by drag-to-reorder on the kanban)."
        >
          <span className="codicon codicon-sort-precedence text-[12px]" />
          Sort
          <select
            aria-label="Sort tickets"
            value={view.sort}
            onChange={(e) => onChange({ ...view, sort: e.target.value as SortKey })}
            className="bg-transparent border-none text-fg-muted hover:text-fg cursor-pointer focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {showCollapseAll && (
          <button type="button" onClick={onToggleAll} className="flex items-center gap-1 text-fg-muted hover:text-fg">
            <span className={`codicon ${allCollapsed ? "codicon-unfold" : "codicon-fold"} text-[12px]`} />
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Shown when an active filter matches nothing across every wave. */
function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-fg-muted">
      <span className="codicon codicon-search-stop" />
      <span>No tickets match the current filter.</span>
      <button type="button" onClick={onClear} className="text-link hover:underline">
        Clear
      </button>
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

  // Split waves: active (outstanding tickets) vs completed (all done). Completed
  // ones get bundled under one "Completed" group so active work has room.
  const activeWaves = displayWaves.filter((w) => !isWaveDone(w));
  const completedWaves = displayWaves.filter(isWaveDone);

  // Controlled collapse for the whole list. Seed: the Completed group, every
  // completed wave, and the current sprint start collapsed (auto-collapse done +
  // the spotlighted sprint); the user can toggle individually or all at once.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set([COMPLETED_KEY, ...completedWaves.map((w) => w.name), sprint?.name].filter(Boolean) as string[]),
  );
  const isOpen = (name: string) => !collapsed.has(name);
  const toggleWave = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const allActiveCollapsed = activeWaves.length > 0 && activeWaves.every((w) => collapsed.has(w.name));
  const toggleAllActive = () =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const w of activeWaves) {
        if (allActiveCollapsed) next.delete(w.name);
        else next.add(w.name);
      }
      return next;
    });

  // Sort/filter lens for the wave ticket lists (global toolbar). In-memory so a
  // reopen starts clean. When a filter (not sort) is active, matching waves are
  // force-expanded and empty waves hidden so results are always visible.
  const [ticketView, setTicketView] = useState<TicketView>(DEFAULT_VIEW);
  const filtering = isFiltering(ticketView);
  const hasMatches = (w: Wave) => filterTickets(w.tickets, ticketView).length > 0;
  const visibleActive = filtering ? activeWaves.filter(hasMatches) : activeWaves;
  const visibleCompleted = filtering ? completedWaves.filter(hasMatches) : completedWaves;

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
          <ReturnStrip waves={displayWaves} />
          <ActiveWork waves={displayWaves} branch={init.branch} canWrite={canWrite} />
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
              {hasWork && (
                <TicketFilterBar
                  view={ticketView}
                  onChange={setTicketView}
                  showCollapseAll={activeWaves.length > 1 && !filtering}
                  allCollapsed={allActiveCollapsed}
                  onToggleAll={toggleAllActive}
                />
              )}
              {filtering && visibleActive.length === 0 && visibleCompleted.length === 0 && (
                <NoMatches onClear={() => setTicketView(DEFAULT_VIEW)} />
              )}
              {/* Every wave stays in the list — including the current sprint (badged,
                  collapsed by default) so it's never confusingly missing; the kanban
                  above is just a spotlight on it. A filter force-expands matches. */}
              {visibleActive.map((w) => (
                <WaveSection
                  key={w.name}
                  wave={w}
                  open={filtering ? true : isOpen(w.name)}
                  onToggle={() => toggleWave(w.name)}
                  isCurrent={w === sprint}
                  canWrite={canWrite}
                  view={ticketView}
                  onMoveToWave={moveToWave}
                  onPinSprint={w === sprint ? undefined : () => setOverride(w.name)}
                />
              ))}
              {visibleCompleted.length > 0 && (
                <CompletedGroup
                  waves={visibleCompleted}
                  open={filtering ? true : isOpen(COMPLETED_KEY)}
                  onToggleGroup={() => toggleWave(COMPLETED_KEY)}
                  isOpen={(name) => (filtering ? true : isOpen(name))}
                  onToggleWave={toggleWave}
                  canWrite={canWrite}
                  view={ticketView}
                  onMoveToWave={moveToWave}
                  onPinSprint={setOverride}
                />
              )}
            </div>
          </div>
        </>
      )}
      {view === "prd" && <PrdView init={liveInit} />}
      {view === "design" && <DesignView init={init} />}
    </div>
  );
}

const VIEW_TABS: { key: CockpitView; label: string; icon: string }[] = [
  { key: "board", label: "Board", icon: "codicon-layout" },
  { key: "prd", label: "PRD", icon: "codicon-book" },
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
function ActiveWork({ waves, branch, canWrite = false }: { waves: Wave[]; branch: string; canWrite?: boolean }) {
  // Clicking the strip opens the ticket modal (STO-2498 UAT), same as a row.
  const [open, setOpen] = useState(false);
  const active = resolveActiveTicket(waves, branch);
  if (!active) return null;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        title={`Open ${active.id} details`}
        aria-label={`Open ${active.id} details`}
        className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 text-[12px] bg-active/5 cursor-pointer hover:bg-hover"
      >
        <span className="codicon codicon-debug-start text-link shrink-0" />
        <span className="uppercase text-[9px] tracking-wide text-fg-muted shrink-0">Working on</span>
        <span className="font-mono text-[11px] text-fg-muted shrink-0">{active.id}</span>
        <span className="truncate">{active.title}</span>
        <span className="ml-auto shrink-0">
          <StateIcon state={active.state} />
        </span>
      </div>
      {open && <TicketModal ticket={active} canWrite={canWrite} onClose={() => setOpen(false)} />}
    </>
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
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0 text-[12px]">
      <span className="codicon codicon-symbol-structure text-link" />
      <span className="font-semibold">Atrium</span>
      <ProjectPicker init={init} />
      <span className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Help — conventions and agent briefing"
          title="Conventions + copy-able agent briefing"
          className="flex items-center text-fg-muted hover:text-fg"
          onClick={() => setHelpOpen(true)}
        >
          <span className="codicon codicon-question" />
        </button>
        <button
          type="button"
          aria-label="Refresh board"
          title="Refresh board"
          className="flex items-center text-fg-muted hover:text-fg"
          onClick={() => vscode.postMessage({ type: "refresh" })}
        >
          <span className="codicon codicon-refresh" />
        </button>
      </span>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

/** Which Linear project this window shows (STO-2486). In live mode it's a
 *  dropdown over every Linear project — for when auto-detect picks wrong or
 *  can't relate the folder to a project; picking one pins it for THIS workspace.
 *  Snapshot mode (no list) keeps the plain label. */
function ProjectPicker({ init }: { init: InitPayload }) {
  const projects = init.projects ?? [];
  if (projects.length === 0) {
    return <span className="text-fg-muted truncate">{init.project}</span>;
  }
  const matched = projects.includes(init.project);
  return (
    <span className="flex items-center gap-1 min-w-0">
      <select
        aria-label="Linear project"
        value={matched ? init.project : ""}
        onChange={(e) => {
          if (e.target.value) vscode.postMessage({ type: "selectProject", name: e.target.value });
        }}
        className="bg-transparent border border-transparent hover:border-border rounded px-1 py-0.5 text-[12px] text-fg-muted hover:text-fg cursor-pointer max-w-[260px] truncate focus:outline-none focus:border-link"
      >
        {!matched && (
          <option value="" disabled>
            Choose project…
          </option>
        )}
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {init.projectSource === "detected" && (
        <span
          className="codicon codicon-sparkle text-[11px] text-fg-muted shrink-0"
          title="Auto-detected from the workspace folder — pick another to pin it for this workspace"
        />
      )}
      {init.projectSource === "setting" && (
        <span
          className="codicon codicon-pin text-[11px] text-fg-muted shrink-0"
          title="Pinned via atrium.linear.projectName (workspace settings)"
        />
      )}
    </span>
  );
}

function WaveSection({
  wave,
  open,
  onToggle,
  isCurrent = false,
  canWrite = false,
  view = DEFAULT_VIEW,
  onMoveToWave,
  onPinSprint,
}: {
  wave: Wave;
  /** Controlled collapse — the parent owns it (for collapse-all / auto-collapse). */
  open: boolean;
  onToggle: () => void;
  isCurrent?: boolean;
  canWrite?: boolean;
  /** The cockpit-wide sort/filter lens applied to this wave's rows. */
  view?: TicketView;
  onMoveToWave?: (id: string, linearId: string | undefined, toWaveLabel: string, toState?: WriteState) => void;
  onPinSprint?: () => void;
}) {
  const [isOver, setIsOver] = useState(false);
  // Progress counts ignore canceled/duplicate tickets (they're not active work).
  const active = activeTickets(wave.tickets);
  const done = active.filter((t) => t.state === "done").length;
  const doing = active.filter((t) => t.state === "doing").length;
  const review = active.filter((t) => t.state === "review").length;
  const todo = active.filter((t) => t.state === "todo").length;
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
      className={`group/wave border-b border-border transition-colors ${
        isOver ? "outline outline-1 -outline-offset-1 outline-link bg-active/10" : ""
      }`}
    >
      <div className="group w-full flex items-center gap-1.5 px-2 h-7 hover:bg-hover">
        <button className="flex items-center gap-1.5 min-w-0 flex-1 text-left" onClick={onToggle}>
          <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
          <span className="font-semibold text-[11px] uppercase tracking-wide truncate">{wave.name}</span>
          {isCurrent && (
            <span
              className="flex items-center gap-1 px-1.5 rounded-full bg-active text-active-fg text-[9px] uppercase tracking-wide shrink-0"
              title="Current sprint — spotlighted in the kanban above"
            >
              <span className="codicon codicon-layout text-[9px]" />
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
            {done}/{active.length}
          </span>
          <SegmentedBar done={done} doing={doing} review={review} todo={todo} className="w-16" />
        </span>
      </div>
      <WaveDescription wave={wave} canWrite={canWrite} />
      {open && (
        <div>
          {applyTicketView(wave.tickets, view).map((t) => (
            <TicketRow key={t.id} ticket={t} draggable={canWrite} canWrite={canWrite} fromWaveLabel={wave.label} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The wave's succinct "what this wave entails" blurb (its Linear label
 * description), shown as one truncated line under the wave name — full text on
 * hover, so it never floods the board (STO-2574). Editable in live mode: Save
 * syncs to the Linear label description, then the board refreshes.
 */
function WaveDescription({ wave, canWrite }: { wave: Wave; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const canEdit = canWrite && !!wave.labelId;
  if (!wave.description && !canEdit) return null;

  if (editing) {
    return (
      <div className="px-2 pl-7 pb-1.5 flex items-start gap-1.5">
        <textarea
          aria-label={`Description for ${wave.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          className="flex-1 resize-y bg-bg text-fg border border-border rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-link"
        />
        <button
          type="button"
          onClick={() => {
            vscode.postMessage({ type: "saveWaveDescription", labelId: wave.labelId, description: draft });
            setEditing(false);
          }}
          className="text-[11px] px-1.5 py-0.5 rounded bg-active text-active-fg hover:opacity-90 shrink-0"
        >
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-fg-muted hover:text-fg shrink-0">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 pl-7 pb-1 flex items-center gap-1.5 text-[11px] text-fg-muted">
      {wave.description ? (
        <span className="truncate" title={wave.description}>
          {wave.description}
        </span>
      ) : (
        <span className="italic opacity-0 group-hover/wave:opacity-60">No description yet</span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setDraft(wave.description ?? "");
            setEditing(true);
          }}
          title="Edit wave description (syncs to the Linear label)"
          aria-label={`Edit description for ${wave.name}`}
          className="flex items-center text-fg-muted hover:text-link opacity-0 group-hover/wave:opacity-100 shrink-0"
        >
          <span className="codicon codicon-edit text-[10px]" />
        </button>
      )}
    </div>
  );
}

/** Bundles all fully-done waves under one collapsible "Completed" group, so the
 *  active waves above have room. Collapsed by default; each wave inside is also
 *  individually collapsible. */
function CompletedGroup({
  waves,
  open,
  onToggleGroup,
  isOpen,
  onToggleWave,
  canWrite,
  view = DEFAULT_VIEW,
  onMoveToWave,
  onPinSprint,
}: {
  waves: Wave[];
  open: boolean;
  onToggleGroup: () => void;
  isOpen: (name: string) => boolean;
  onToggleWave: (name: string) => void;
  canWrite: boolean;
  view?: TicketView;
  onMoveToWave?: (id: string, linearId: string | undefined, toWaveLabel: string, toState?: WriteState) => void;
  onPinSprint: (name: string) => void;
}) {
  const tickets = waves.reduce((n, w) => n + w.tickets.length, 0);
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={onToggleGroup}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-2 h-7 hover:bg-hover text-left"
      >
        <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
        <span className="codicon codicon-check-all text-green" />
        <span className="font-semibold text-[11px] uppercase tracking-wide">Completed</span>
        <span className="ml-auto flex items-center gap-2 text-fg-muted text-[11px] font-mono">
          {waves.length} wave{waves.length > 1 ? "s" : ""} · {tickets} done
        </span>
      </button>
      {open && (
        <div className="border-l-2 border-green/30 ml-2">
          {waves.map((w) => (
            <WaveSection
              key={w.name}
              wave={w}
              open={isOpen(w.name)}
              onToggle={() => onToggleWave(w.name)}
              canWrite={canWrite}
              view={view}
              onMoveToWave={onMoveToWave}
              onPinSprint={() => onPinSprint(w.name)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TicketRow({
  ticket,
  draggable = false,
  canWrite = false,
  fromWaveLabel,
}: {
  ticket: Ticket;
  draggable?: boolean;
  canWrite?: boolean;
  fromWaveLabel?: string;
}) {
  // Click opens the detail modal (STO-2494) — the old Spec/Tests/Activity
  // inline tabs are gone; full info lives in the modal, editing in Linear.
  const [open, setOpen] = useState(false);
  const canceled = isCanceled(ticket);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
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
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`grid grid-cols-[16px_minmax(0,auto)_1fr_auto_auto_auto] items-center gap-2 pl-5 pr-3 h-[26px] text-left text-[13px] cursor-pointer hover:bg-hover ${
          canceled
            ? "opacity-60"
            : ticket.state === "review"
              ? "bg-blue/[0.07]"
              : ticket.state === "doing"
                ? "bg-yellow/[0.07]"
                : ""
        }`}
      >
        {canceled ? (
          <span className="codicon codicon-circle-slash text-fg-muted" title={ticket.status} />
        ) : (
          <StateIcon state={ticket.state} />
        )}
        <span className="font-mono text-[11px] text-fg-muted">{ticket.id}</span>
        <span className="truncate flex items-center gap-1.5">
          {canceled && (
            <span className="shrink-0 px-1 rounded-full bg-fg-muted/15 text-fg-muted text-[9px] uppercase tracking-wide">
              {ticket.status}
            </span>
          )}
          <span className={`truncate ${canceled ? "line-through" : ""}`}>{ticket.title}</span>
        </span>
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
      {open && <TicketModal ticket={ticket} canWrite={canWrite} onClose={() => setOpen(false)} />}
    </div>
  );
}

