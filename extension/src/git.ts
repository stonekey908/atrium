/**
 * Real git status for the cockpit status strip (STO-2170). Shells out to `git`
 * in the workspace root — mirrors the old Tauri `get_git_status` command. Kept
 * tiny and failure-tolerant: any error (not a repo, no git) returns null and the
 * strip simply drops its git cells.
 */
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);

export interface GitStatus {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, timeout: 3000 });
  return stdout.trim();
}

/** Reads branch + dirty + ahead/behind for the repo at `cwd`. Null if not a repo. */
export async function getGitStatus(cwd: string): Promise<GitStatus | null> {
  try {
    const branch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const porcelain = await git(cwd, ["status", "--porcelain"]);
    let ahead = 0;
    let behind = 0;
    try {
      // left-right count against the upstream; throws when there's no upstream.
      const counts = await git(cwd, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
      const [b, a] = counts.split(/\s+/).map((n) => Number(n) || 0);
      behind = b;
      ahead = a;
    } catch {
      /* no upstream configured — leave ahead/behind at 0 */
    }
    return { branch, dirty: porcelain.length > 0, ahead, behind };
  } catch {
    return null;
  }
}
