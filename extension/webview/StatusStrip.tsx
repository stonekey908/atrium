import type { GitInfo, InitPayload } from "./types";

/**
 * Slim always-on status strip below the header (STO-2170): real workspace git
 * state, the Linear data source, and the open-folder count. Cells adapt — the
 * git cell drops when the workspace isn't a repo, the Linear cell drops with no
 * source. The richer tsc/vitest/build cells from the original spec aren't shown:
 * the cockpit is a passive reader and doesn't run those; VS Code's own status
 * bar already carries native git/diagnostics.
 */
export function StatusStrip({ init }: { init: InitPayload }) {
  return (
    <div className="flex items-center gap-3 px-3 h-6 border-b border-border shrink-0 text-[11px] text-fg-muted">
      {init.git && <GitCell git={init.git} />}
      <LinearCell source={init.source} generatedAt={init.generatedAt} />
      {typeof init.testFiles === "number" && (
        <span className="flex items-center gap-1 shrink-0" title="Unit-test files discovered in the workspace">
          <span className="codicon codicon-beaker text-[11px]" />
          {init.testFiles} tests
        </span>
      )}
      <span className="ml-auto flex items-center gap-1" title="Open workspace folders">
        <span className="codicon codicon-folder-opened" />
        {init.folders.length}
      </span>
    </div>
  );
}

function GitCell({ git }: { git: GitInfo }) {
  return (
    <span
      className="flex items-center gap-1.5 min-w-0"
      title={`Branch ${git.branch}${git.dirty ? " · uncommitted changes" : " · clean"}`}
    >
      <span className="codicon codicon-git-branch shrink-0" />
      <span className="font-mono truncate max-w-[260px]">{git.branch}</span>
      {git.dirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow shrink-0" title="uncommitted changes" />}
      {git.ahead > 0 && (
        <span className="flex items-center text-yellow shrink-0" title={`${git.ahead} unpushed commit(s)`}>
          <span className="codicon codicon-arrow-up text-[10px]" />
          {git.ahead}
        </span>
      )}
      {git.behind > 0 && (
        <span className="flex items-center shrink-0" title={`${git.behind} commit(s) behind upstream`}>
          <span className="codicon codicon-arrow-down text-[10px]" />
          {git.behind}
        </span>
      )}
    </span>
  );
}

function LinearCell({ source, generatedAt }: { source?: "snapshot" | "live"; generatedAt?: string }) {
  if (!source) return null;
  if (source === "live") {
    return (
      <span className="flex items-center gap-1 text-green shrink-0" title="Pulled live from Linear">
        <span className="w-1.5 h-1.5 rounded-full bg-green" />
        Linear live
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 shrink-0"
      title="Committed snapshot — set atrium.linear.apiKey for live data (SETUP.md)"
    >
      <span className="codicon codicon-database text-[10px]" />
      snapshot{generatedAt ? ` · ${generatedAt}` : ""}
    </span>
  );
}
