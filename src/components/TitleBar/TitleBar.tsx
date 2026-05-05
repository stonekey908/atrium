import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * TitleBar — Atrium's 36px chrome bar above the AppShell.
 *
 * Layout (left → right):
 *   [ traffic lights ]  workspace · `/` · branch chip · `·` · session title
 *   ────────────── flex spacer ──────────────
 *   [ model pill ]  [ context-budget pill ]
 *
 * Window is borderless (`decorations: false` in tauri.conf.json), so we render
 * our own macOS-style traffic lights wired to `close / minimize / toggleMaximize`
 * via the Tauri 2 window API.
 *
 * Drag: a manual `mousedown` → `getCurrentWindow().startDragging()` handler on
 * the bar. Children that should not drag (the traffic lights, the pills) opt
 * out via `data-no-drag`.
 *
 * Scope (T-005 / STO-2096): static breadcrumb + pills. Real branch / session /
 * model / token data lands in T-008 (git status) and Wave 1 (CLI bridge).
 */
export function TitleBar() {
  const onDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    void getCurrentWindow().startDragging();
  };

  return (
    <header
      onMouseDown={onDragStart}
      className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background pl-3 pr-3 text-sm"
    >
      <TrafficLights />

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

      <div className="flex items-center gap-2" data-no-drag>
        <Pill dotClassName="bg-emerald" label="Claude Opus 4.7" />
        <Pill label="14,820 / 200k" mono />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Traffic lights — borderless-window window controls.                 */
/* ------------------------------------------------------------------ */

function TrafficLights() {
  const win = () => getCurrentWindow();
  return (
    <div
      data-no-drag
      className="group/lights flex items-center gap-2 pl-1"
      aria-label="Window controls"
    >
      <TrafficLight
        title="Close"
        className="bg-[#FF5F57] hover:brightness-95"
        onClick={() => void win().close()}
      >
        <CloseGlyph />
      </TrafficLight>
      <TrafficLight
        title="Minimize"
        className="bg-[#FFBD2E] hover:brightness-95"
        onClick={() => void win().minimize()}
      >
        <MinimizeGlyph />
      </TrafficLight>
      <TrafficLight
        title="Toggle maximize"
        className="bg-[#28C940] hover:brightness-95"
        onClick={() => void win().toggleMaximize()}
      >
        <MaximizeGlyph />
      </TrafficLight>
    </div>
  );
}

function TrafficLight({
  title,
  className,
  onClick,
  children,
}: {
  title: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`relative flex h-3 w-3 items-center justify-center rounded-full text-[#00000088] transition ${className}`}
    >
      {/* Glyphs are hidden until the user hovers any traffic light (parent group). */}
      <span className="opacity-0 group-hover/lights:opacity-100 transition">{children}</span>
    </button>
  );
}

function CloseGlyph() {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.2">
      <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" />
      <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" />
    </svg>
  );
}
function MinimizeGlyph() {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.2">
      <line x1="1.5" y1="4" x2="6.5" y2="4" />
    </svg>
  );
}
function MaximizeGlyph() {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
      <path d="M1.4 1.4 L1.4 5 L5 1.4 Z M6.6 6.6 L6.6 3 L3 6.6 Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable pieces (Pill, BranchChip) — promote when reused.           */
/* ------------------------------------------------------------------ */

type PillProps = {
  dotClassName?: string;
  label: string;
  mono?: boolean;
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
