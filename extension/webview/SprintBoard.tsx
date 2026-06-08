import { useState } from "react";
import { vscode } from "./vscode";
import { boardToColumns, type KanbanColumn } from "./sprint";
import { PRIORITY } from "./ui";
import type { SyncState, Ticket, TicketState, Wave } from "./types";

const DND_MIME = "application/x-atrium-card";
interface DragPayload {
  id: string;
  linearId?: string;
  fromState: TicketState;
  sortOrder: number;
}

function parseDrag(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DND_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export interface SprintBoardCallbacks {
  /** True when a live Linear key is set; gates all drag interactions. */
  canWrite?: boolean;
  /** Drag a card to another column (STO-2469). */
  onMove?: (id: string, linearId: string | undefined, fromState: TicketState, toState: TicketState) => void;
  /** Drag a card within its column to reprioritize (STO-2470). */
  onReorder?: (id: string, linearId: string | undefined, fromSortOrder: number, toSortOrder: number) => void;
}

/**
 * The spotlight kanban for the current sprint. Read-only layout over
 * `boardToColumns`, plus, when a live key is set, drag-to-status across columns
 * (STO-2469) and drag-to-reorder within a column (STO-2470). Without a key the
 * board is read-only and cards aren't draggable (STO-2468).
 */
export function SprintBoard({
  wave,
  syncOf,
  canWrite = false,
  onMove,
  onReorder,
}: { wave: Wave; syncOf?: (id: string) => SyncState } & SprintBoardCallbacks) {
  const columns = boardToColumns(wave);
  const [overCol, setOverCol] = useState<TicketState | null>(null);
  const count = (k: TicketState) => columns.find((c) => c.key === k)!.tickets.length;

  return (
    <section className="border-b border-border shrink-0 bg-active/[0.03]">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 text-[12px]">
        <span className="codicon codicon-layout text-link" />
        <span className="uppercase text-[9px] tracking-wide text-fg-muted">Current sprint</span>
        <span className="font-semibold truncate">{wave.name}</span>
        {!canWrite && (
          <span
            className="flex items-center gap-1 text-fg-muted text-[10px] shrink-0"
            title="Set atrium.linear.apiKey to drag cards and sync to Linear (SETUP.md)"
          >
            <span className="codicon codicon-lock text-[10px]" />
            read-only
          </span>
        )}
        {/* Wave-plan breakdown (STO-2173): done / in flight / in review / to do. */}
        <span className="ml-auto flex items-center gap-2.5 font-mono text-[10px] text-fg-muted shrink-0">
          <Tally dot="bg-green" n={count("done")} label="done" />
          <Tally dot="bg-yellow" n={count("doing")} label="in flight" />
          <Tally dot="bg-blue" n={count("review")} label="in review" />
          <Tally dot="bg-border" n={count("todo")} label="to do" />
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 px-3 pb-2">
        {columns.map((col) => (
          <Column
            key={col.key}
            col={col}
            canWrite={canWrite}
            syncOf={syncOf}
            isOver={overCol === col.key}
            setOver={setOverCol}
            onMove={onMove}
            onReorder={onReorder}
          />
        ))}
      </div>
      {/* UAT phase row (STO-2173): the wave's acceptance pass after Build. */}
      <div className="flex items-center gap-2 mx-3 mb-3 px-2 py-1 rounded bg-yellow/10 text-[11px] text-yellow">
        <span className="codicon codicon-question text-[12px]" />
        <span className="uppercase text-[9px] tracking-wide">UAT</span>
        <span className="text-fg-muted">{wave.name} · acceptance pass after Build</span>
        <span className="ml-auto px-1.5 rounded-full bg-yellow/20 text-[9px] uppercase tracking-wide">Phase</span>
      </div>
    </section>
  );
}

function Tally({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1" title={`${n} ${label}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {n}
    </span>
  );
}

function Column({
  col,
  canWrite,
  syncOf,
  isOver,
  setOver,
  onMove,
  onReorder,
}: {
  col: KanbanColumn;
  canWrite: boolean;
  syncOf?: (id: string) => SyncState;
  isOver: boolean;
  setOver: (s: TicketState | null) => void;
} & SprintBoardCallbacks) {
  /** Drop on the column body (not on a card) → move a card here from elsewhere. */
  const onColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    if (!canWrite) return;
    const p = parseDrag(e);
    if (p && p.fromState !== col.key) onMove?.(p.id, p.linearId, p.fromState, col.key);
  };

  /** Drop on a card → reorder before it (same column) or move into this column. */
  const onCardDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    if (!canWrite) return;
    const p = parseDrag(e);
    if (!p) return;
    if (p.fromState !== col.key) {
      onMove?.(p.id, p.linearId, p.fromState, col.key);
      return;
    }
    const target = col.tickets[index];
    if (p.id === target.id) return;
    const targetOrder = target.sortOrder ?? 0;
    const above = col.tickets[index - 1];
    const newOrder = index === 0 ? targetOrder - 1 : ((above.sortOrder ?? 0) + targetOrder) / 2;
    onReorder?.(p.id, p.linearId, p.sortOrder, newOrder);
  };

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[10px] uppercase tracking-wide text-fg-muted">
        <span className="truncate">{col.label}</span>
        <span className="font-mono">{col.tickets.length}</span>
      </div>
      <div
        data-col={col.key}
        onDragOver={(e) => {
          if (!canWrite) return;
          e.preventDefault();
          setOver(col.key);
        }}
        onDragLeave={() => setOver(null)}
        onDrop={onColumnDrop}
        className={`flex flex-col gap-1.5 min-h-[40px] rounded p-1 transition-colors ${
          isOver ? "bg-active/20 outline outline-1 outline-link" : "bg-bg/40"
        }`}
      >
        {col.tickets.map((t, i) => (
          <KanbanCard
            key={t.id}
            ticket={t}
            sync={syncOf?.(t.id) ?? "idle"}
            draggable={canWrite}
            fromState={col.key}
            onDrop={(e) => onCardDrop(i, e)}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanCard({
  ticket,
  sync = "idle",
  draggable = false,
  fromState,
  onDrop,
}: {
  ticket: Ticket;
  sync?: SyncState;
  draggable?: boolean;
  fromState?: TicketState;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const onDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = {
      id: ticket.id,
      linearId: ticket.linearId,
      fromState: fromState ?? ticket.state,
      sortOrder: ticket.sortOrder ?? 0,
    };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={`group rounded border border-border bg-bg px-2 py-1.5 text-[12px] hover:border-fg-muted ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-fg-muted shrink-0">{ticket.id}</span>
        <SyncBadge sync={sync} />
        <span className={`ml-auto text-[9px] uppercase tracking-wide shrink-0 ${PRIORITY[ticket.priority].cls}`}>
          {PRIORITY[ticket.priority].label}
        </span>
        {ticket.url && (
          <button
            type="button"
            aria-label={`Open ${ticket.id} in Linear`}
            title="Open in Linear"
            className="flex items-center text-fg-muted hover:text-link opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              vscode.postMessage({ type: "openLinear", url: ticket.url });
            }}
          >
            <span className="codicon codicon-link-external text-[11px]" />
          </button>
        )}
      </div>
      <div className="mt-0.5 leading-snug line-clamp-2">{ticket.title}</div>
    </div>
  );
}

/** Tiny write-back indicator. Hidden when idle; driven by useBoardMutations. */
function SyncBadge({ sync }: { sync: SyncState }) {
  if (sync === "idle") return null;
  const map: Record<Exclude<SyncState, "idle">, { icon: string; cls: string; title: string }> = {
    syncing: { icon: "codicon-sync codicon-modifier-spin", cls: "text-fg-muted", title: "syncing to Linear…" },
    synced: { icon: "codicon-check", cls: "text-green", title: "synced to Linear" },
    failed: { icon: "codicon-error", cls: "text-red", title: "sync failed — reverted" },
    conflict: { icon: "codicon-warning", cls: "text-orange", title: "changed in Linear — refresh" },
  };
  const m = map[sync];
  return <span className={`codicon ${m.icon} text-[11px] ${m.cls} shrink-0`} title={m.title} />;
}
