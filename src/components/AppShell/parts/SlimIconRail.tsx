/**
 * SlimIconRail — 44px slim right rail of the Project Folder canvas.
 *
 * Five 30×30 icon buttons (User · Folder (active) · Clock with badge ·
 * Sparkline · Terminal). Matches `.r-rail` / `.r-icon` / `.r-icon .badge`
 * from v5 (`files/atrium-v5.html` lines ~613-643 + ~3595-3601).
 *
 * No interactivity — visual fidelity only. Buttons are still <button> so they
 * pick up keyboard focus when wired in later waves.
 */

import { type ReactNode } from "react";

/** Single icon button. Active variant gets `bg-accent text-foreground`. */
function RailIcon({
  label,
  active = false,
  badge,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "relative inline-flex h-[30px] w-[30px] items-center justify-center rounded-sm transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      ].join(" ")}
    >
      {children}
      {badge ? (
        <span
          className="absolute right-px top-px inline-flex h-[11px] min-w-[11px] items-center justify-center rounded-full bg-foreground px-0.5 font-mono text-[8.5px] font-medium leading-none text-background"
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function SlimIconRail() {
  // All glyphs share viewBox 0 0 16 16, stroke 1.4, 14×14 size — matches
  // `.r-icon svg { width: 14px; height: 14px; stroke-width: 1.4; }`.
  const svgProps = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    width: 14,
    height: 14,
  } as const;

  return (
    <aside
      className="flex flex-col items-center gap-0.5 border-l border-border bg-background px-1.5 py-2.5"
      aria-label="Workspace tools"
    >
      <RailIcon label="Profile">
        <svg {...svgProps}>
          <circle cx={8} cy={6} r={3} />
          <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" />
        </svg>
      </RailIcon>
      <RailIcon label="Folder" active>
        <svg {...svgProps}>
          <path d="M2 4a1 1 0 011-1h4l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
        </svg>
      </RailIcon>
      <RailIcon label="Recent" badge="7">
        <svg {...svgProps}>
          <circle cx={8} cy={8} r={5.5} />
          <path d="M8 5v3l2 2" />
        </svg>
      </RailIcon>
      <RailIcon label="Activity">
        <svg {...svgProps}>
          <path d="M2 8h3l1.5-3 3 6 1.5-3h3" />
        </svg>
      </RailIcon>
      <RailIcon label="Terminal">
        <svg {...svgProps}>
          <rect x={2} y={3} width={12} height={10} rx={1} />
          <polyline points="5 7 7 9 5 11" />
        </svg>
      </RailIcon>
    </aside>
  );
}
