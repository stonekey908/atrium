/**
 * BranchChip — monospace branch indicator in the TitleBar crumb.
 *
 * Visual elements (left → right):
 *   [git fork glyph]  branch-name  [↑N ↓N]  [amber dirty dot]
 *
 * `branch === null` renders "detached" in muted style. The chip is hidden
 * entirely by the parent when the cwd is not a git repo.
 */
export type BranchChipProps = {
  branch: string | null;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
  /** Optional tooltip override; falls back to a generated summary. */
  title?: string;
};

export function BranchChip({ branch, dirty, ahead, behind, title }: BranchChipProps) {
  const showAhead = ahead !== null && ahead > 0;
  const showBehind = behind !== null && behind > 0;
  const label = branch ?? "detached";
  const isDetached = branch === null;
  const tooltip = title ?? defaultTooltip({ branch, dirty, ahead, behind });

  return (
    <span
      title={tooltip}
      data-testid="branch-chip"
      className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-2xs text-foreground"
    >
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
      <span className={isDetached ? "truncate text-muted-foreground" : "truncate"}>{label}</span>
      {(showAhead || showBehind) && (
        <span data-testid="ahead-behind" className="ml-0.5 inline-flex gap-1 text-muted-foreground">
          {showAhead && <span data-testid="ahead">↑{ahead}</span>}
          {showBehind && <span data-testid="behind">↓{behind}</span>}
        </span>
      )}
      {dirty && (
        <span
          data-testid="dirty-dot"
          aria-label="working tree has uncommitted changes"
          className="ml-0.5 block h-1.5 w-1.5 rounded-full bg-amber"
        />
      )}
    </span>
  );
}

function defaultTooltip({ branch, dirty, ahead, behind }: Omit<BranchChipProps, "title">): string {
  const parts: string[] = [];
  parts.push(branch ?? "detached HEAD");
  if (dirty) parts.push("uncommitted changes");
  if (ahead !== null || behind !== null) {
    const a = ahead ?? 0;
    const b = behind ?? 0;
    if (a === 0 && b === 0) parts.push("up to date with upstream");
    else parts.push(`${a} ahead, ${b} behind upstream`);
  } else {
    parts.push("no upstream");
  }
  return parts.join(" · ");
}
