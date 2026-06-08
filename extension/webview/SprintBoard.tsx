import { vscode } from "./vscode";
import { boardToColumns, type KanbanColumn } from "./sprint";
import { PRIORITY } from "./ui";
import type { SyncState, Ticket, Wave } from "./types";

/**
 * The spotlight kanban for the current sprint. Slice 1 is read-only layout over
 * `boardToColumns`; slice 2 adds drag-to-status + per-card sync badges, slice 3
 * adds drag-to-reorder. Sits above the W0.6 wave list (the "horizon").
 */
export function SprintBoard({
  wave,
  syncOf,
}: {
  wave: Wave;
  /** Per-ticket write-back status (slice 2). Defaults to idle for now. */
  syncOf?: (id: string) => SyncState;
}) {
  const columns = boardToColumns(wave);
  const total = wave.tickets.length;
  return (
    <section className="border-b border-border shrink-0 bg-active/[0.03]">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 text-[12px]">
        <span className="codicon codicon-layout text-link" />
        <span className="uppercase text-[9px] tracking-wide text-fg-muted">Current sprint</span>
        <span className="font-semibold truncate">{wave.name}</span>
        <span className="ml-auto font-mono text-[11px] text-fg-muted shrink-0">{total} tickets</span>
      </div>
      <div className="grid grid-cols-4 gap-2 px-3 pb-3">
        {columns.map((col) => (
          <Column key={col.key} col={col} syncOf={syncOf} />
        ))}
      </div>
    </section>
  );
}

function Column({ col, syncOf }: { col: KanbanColumn; syncOf?: (id: string) => SyncState }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[10px] uppercase tracking-wide text-fg-muted">
        <span className="truncate">{col.label}</span>
        <span className="font-mono">{col.tickets.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[40px] rounded bg-bg/40 p-1">
        {col.tickets.map((t) => (
          <KanbanCard key={t.id} ticket={t} sync={syncOf?.(t.id) ?? "idle"} />
        ))}
      </div>
    </div>
  );
}

export function KanbanCard({ ticket, sync = "idle" }: { ticket: Ticket; sync?: SyncState }) {
  return (
    <div className="group rounded border border-border bg-bg px-2 py-1.5 text-[12px] hover:border-fg-muted">
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

/** Tiny write-back indicator. Hidden when idle; slice 2 drives the rest. */
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
