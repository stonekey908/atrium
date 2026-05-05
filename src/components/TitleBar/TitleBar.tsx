import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * TitleBar — Atrium's 36px chrome bar above the AppShell.
 *
 * Layout (left → right):
 *   [ macOS traffic lights (OS-rendered, overlay) ]
 *   workspace · `/` · branch chip · `·` · session title
 *   ────────────── flex spacer ──────────────
 *   [ model pill ]  [ context-budget pill ]
 *
 * macOS: `titleBarStyle: "Overlay"` + `hiddenTitle: true` (set in tauri.conf.json)
 * keeps the real traffic lights at top-left and hides the OS title text. We pad
 * the bar's left edge by 76px so our breadcrumb doesn't collide with them.
 *
 * Drag: we wire a manual `mousedown` → `getCurrentWindow().startDragging()`
 * handler. `data-tauri-drag-region` works in most cases but proved flaky with
 * `titleBarStyle: "Overlay"` on macOS, so the manual call is the source of
 * truth. Children opt out via the `noDrag` helper.
 *
 * Scope (T-005 / STO-2096): static. Real branch / session / model / token data
 * lands in T-008 (git status) and Wave 1 (CLI bridge → context budget).
 */
export function TitleBar() {
  const onDragStart = (e: React.MouseEvent) => {
    // Primary button only — ignore right-click + middle-click.
    if (e.button !== 0) return;
    // Skip if the user clicked an interactive child (pills, buttons, links).
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    void getCurrentWindow().startDragging();
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={onDragStart}
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background pr-3 text-sm"
      style={{ paddingLeft: 76 }}
    >
      {/* Breadcrumb — workspace / branch / session */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted"
          aria-hidden
        >
          <span className="block h-1.5 w-1.5 rounded-full bg-foreground" />
        </span>
        <span className="text-foreground">Stonekey</span>
        <span className="text-muted-foreground" aria-hidden>
          /
        </span>
        <BranchChip name="feat/wave-0-visual-layer" />
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <span className="truncate text-muted-foreground">T-005 title bar</span>
      </div>

      <div className="flex-1" />

      {/* Pills opt out of drag so they remain clickable when wired up later. */}
      <div className="flex items-center gap-2" data-no-drag data-tauri-drag-region="false">
        <Pill dotClassName="bg-emerald" label="Claude Opus 4.7" />
        <Pill label="14,820 / 200k" mono />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable pieces — kept in this file for now; promote to shared
 * primitives when a second consumer shows up. */
/* ------------------------------------------------------------------ */

type PillProps = {
  /** Optional left-side dot. Pass a Tailwind colour class (e.g. `bg-emerald`). */
  dotClassName?: string;
  label: string;
  /** Render the label in mono. */
  mono?: boolean;
  /** Optional shortcut text rendered in muted mono after the label. */
  shortcut?: string;
};

function Pill({ dotClassName, label, mono = false, shortcut }: PillProps) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs">
      {dotClassName ? (
        <span className={`block h-1.5 w-1.5 rounded-full ${dotClassName}`} aria-hidden />
      ) : null}
      <span className={mono ? "font-mono text-2xs text-foreground" : "text-foreground"}>
        {label}
      </span>
      {shortcut ? (
        <span className="font-mono text-2xs text-muted-foreground">{shortcut}</span>
      ) : null}
    </span>
  );
}

function BranchChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-2xs text-foreground">
      <svg
        width="9"
        height="9"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <circle cx="4.5" cy="3.5" r="1.5" />
        <circle cx="4.5" cy="12.5" r="1.5" />
        <circle cx="11.5" cy="6.5" r="1.5" />
        <path d="M4.5 5v6" />
        <path d="M11.5 8c0 2-3 3-7 3" />
      </svg>
      <span className="truncate">{name}</span>
    </span>
  );
}
