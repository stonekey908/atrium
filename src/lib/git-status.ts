import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

const GIT_CHANGED_EVENT = "git-changed";

/**
 * Live git status of the session's working directory.
 *
 * Mirrors the Rust `GitStatus` struct (camelCase via serde rename_all).
 *
 * - `isRepo === false` → caller should hide the branch chip
 * - `branch === null` while `isRepo === true` → detached HEAD
 * - `ahead === null && behind === null` → no upstream configured (not an error)
 */
export type GitStatus = {
  isRepo: boolean;
  branch: string | null;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
};

export async function fetchGitStatus(path?: string): Promise<GitStatus> {
  return invoke<GitStatus>("get_git_status", { path });
}

/**
 * Fetches git status on mount, on window-focus regain, and whenever the
 * Rust-side fs-watcher emits `git-changed` (debounced 500ms upstream).
 *
 * Acceptance criteria: working-tree edits and `git checkout` from a terminal
 * propagate to the BranchChip within ~1s.
 */
export function useGitStatus(path?: string): {
  status: GitStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchGitStatus(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [path]);

  useEffect(() => {
    void refresh();

    let unlistenFocus: (() => void) | undefined;
    let unlistenFs: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) void refresh();
      })
      .then((u) => {
        unlistenFocus = u;
      });

    void listen(GIT_CHANGED_EVENT, () => {
      void refresh();
    }).then((u) => {
      unlistenFs = u;
    });

    return () => {
      unlistenFocus?.();
      unlistenFs?.();
    };
  }, [refresh]);

  return { status, error, refresh };
}
