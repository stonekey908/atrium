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
}

/**
 * The spotlight kanban for the current sprint. Read-only layout over
 * `boardToColumns`, plus drag-to-status when a live key is set: dragging a card
 * to another column calls `onMove`, which optimistically moves it and asks the
 * host to write the new state to Linear (STO-2469). Without a key the board is
 * read-only and cards aren't draggable (STO-2468).
 */
export function SprintBoard({
  wave,
  syncOf,
  canWrite = false,
  onMove,
}: {
  wave: Wave;
  syncOf?: (id: string) => SyncState;
  /** True when a live Linear key is set; gates all drag interactions. */
  canWrite?: boolean;
  onMove?: (id: string, linearId: string | undefined, fromState: TicketState, toState: TicketState) => void;
}) {
  const columns = boardToColumns(wave);
  const [overCol, setOverCol] = useState<TicketState | null>(null);

  const onDrop = (toState: TicketState, e: React.DragEvent) => {
    e.preventDefault();
    setOverCol(null);
    if (!canWrite || !onMove) return;
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as DragPayload;
      if (p.fromState !== toState) onMove(p.id, p.linearId, p.fromState, toState);
    } catch {
      /* ignore malformed drag data */
    }
  };

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
        <span className="ml-auto font-mono text-[11px] text-fg-muted shrink-0">{wave.tickets.length} tickets</span>
      </div>
      <div className="grid grid-cols-4 gap-2 px-3 pb-3">
        {columns.map((col) => (
          <Column
            key={col.key}
            col={col}
            canWrite={canWrite}
            syncOf={syncOf}
            isOver={overCol === col.key}
            onDragOver={(e) => {
              if (!canWrite) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => onDrop(col.key, e)}
          />
        ))}
      </div>
    </section>
  );
}

function Column({
  col,
  canWrite,
  syncOf,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  col: KanbanColumn;
  canWrite: boolean;
  syncOf?: (id: string) => SyncState;
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[10px] uppercase tracking-wide text-fg-muted">
        <span className="truncate">{col.label}</span>
        <span className="font-mono">{col.tickets.length}</span>
      </div>
      <div
        data-col={col.key}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col gap-1.5 min-h-[40px] rounded p-1 transition-colors ${
          isOver ? "bg-active/20 outline outline-1 outline-link" : "bg-bg/40"
        }`}
      >
        {col.tickets.map((t) => (
          <KanbanCard key={t.id} ticket={t} sync={syncOf?.(t.id) ?? "idle"} draggable={canWrite} fromState={col.key} />
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
}: {
  ticket: Ticket;
  sync?: SyncState;
  draggable?: boolean;
  fromState?: TicketState;
}) {
  const onDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = { id: ticket.id, linearId: ticket.linearId, fromState: fromState ?? ticket.state };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
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
