use serde::Serialize;
use std::path::{Path, PathBuf};
use tokio::process::Command;

/// Live git status of a working directory, surfaced to the title-bar BranchChip.
///
/// `is_repo == false` ⇒ caller should hide the chip entirely.
/// `branch == None` while `is_repo == true` ⇒ detached HEAD.
/// `ahead == None` && `behind == None` ⇒ no upstream configured (not an error).
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub dirty: bool,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
}

impl GitStatus {
    fn not_a_repo() -> Self {
        Self {
            is_repo: false,
            branch: None,
            dirty: false,
            ahead: None,
            behind: None,
        }
    }
}

#[tauri::command]
pub async fn get_git_status(path: Option<String>) -> Result<GitStatus, String> {
    let cwd = resolve_cwd(path)?;

    if !is_git_repo(&cwd).await {
        return Ok(GitStatus::not_a_repo());
    }

    let branch = read_branch(&cwd).await?;
    let dirty = read_dirty(&cwd).await?;
    let (ahead, behind) = read_ahead_behind(&cwd).await?;

    Ok(GitStatus {
        is_repo: true,
        branch,
        dirty,
        ahead,
        behind,
    })
}

fn resolve_cwd(path: Option<String>) -> Result<PathBuf, String> {
    match path {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p)),
        _ => std::env::current_dir().map_err(|e| format!("cwd resolution failed: {e}")),
    }
}

async fn is_git_repo(cwd: &Path) -> bool {
    let out = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(cwd)
        .output()
        .await;

    match out {
        Ok(o) if o.status.success() => {
            std::str::from_utf8(&o.stdout)
                .map(|s| s.trim() == "true")
                .unwrap_or(false)
        }
        _ => false,
    }
}

async fn read_branch(cwd: &Path) -> Result<Option<String>, String> {
    let out = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(cwd)
        .output()
        .await
        .map_err(|e| format!("spawn git rev-parse failed: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "git rev-parse failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Ok(parse_branch(&raw))
}

async fn read_dirty(cwd: &Path) -> Result<bool, String> {
    let out = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(cwd)
        .output()
        .await
        .map_err(|e| format!("spawn git status failed: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "git status failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    Ok(parse_porcelain(&String::from_utf8_lossy(&out.stdout)))
}

async fn read_ahead_behind(cwd: &Path) -> Result<(Option<u32>, Option<u32>), String> {
    let out = Command::new("git")
        .args(["rev-list", "--left-right", "--count", "@{u}...HEAD"])
        .current_dir(cwd)
        .output()
        .await
        .map_err(|e| format!("spawn git rev-list failed: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        if is_no_upstream_error(&stderr) {
            return Ok((None, None));
        }
        return Err(format!("git rev-list failed: {}", stderr.trim()));
    }

    Ok(parse_ahead_behind(&String::from_utf8_lossy(&out.stdout))
        .map(|(a, b)| (Some(a), Some(b)))
        .unwrap_or((None, None)))
}

/* ------------------------------------------------------------------ */
/* Parsers — exported (`pub`) for unit-testing without process spawn.  */
/* ------------------------------------------------------------------ */

pub fn parse_branch(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "HEAD" {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn parse_porcelain(porcelain: &str) -> bool {
    porcelain.lines().any(|line| !line.trim().is_empty())
}

/// `git rev-list --left-right --count @{u}...HEAD` prints `<behind>\t<ahead>`
/// (left = upstream, right = HEAD). Returned tuple is `(ahead, behind)`.
pub fn parse_ahead_behind(raw: &str) -> Option<(u32, u32)> {
    let mut parts = raw.split_whitespace();
    let behind = parts.next()?.parse::<u32>().ok()?;
    let ahead = parts.next()?.parse::<u32>().ok()?;
    Some((ahead, behind))
}

pub fn is_no_upstream_error(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    s.contains("no upstream")
        || s.contains("does not point to a valid object")
        || s.contains("unknown revision")
        || s.contains("ambiguous argument")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branch_main() {
        assert_eq!(parse_branch("main"), Some("main".to_string()));
    }

    #[test]
    fn branch_with_slashes() {
        assert_eq!(
            parse_branch("feat/sto-2099-titlebar-git-status\n"),
            Some("feat/sto-2099-titlebar-git-status".to_string())
        );
    }

    #[test]
    fn branch_detached_head() {
        assert_eq!(parse_branch("HEAD"), None);
    }

    #[test]
    fn branch_empty() {
        assert_eq!(parse_branch(""), None);
        assert_eq!(parse_branch("   \n"), None);
    }

    #[test]
    fn porcelain_clean() {
        assert!(!parse_porcelain(""));
        assert!(!parse_porcelain("\n  \n"));
    }

    #[test]
    fn porcelain_modified_file() {
        assert!(parse_porcelain(" M src/foo.rs\n"));
    }

    #[test]
    fn porcelain_untracked_file() {
        assert!(parse_porcelain("?? new.txt\n"));
    }

    #[test]
    fn porcelain_mixed() {
        assert!(parse_porcelain(" M src/foo.rs\n?? new.txt\nA  added.rs\n"));
    }

    #[test]
    fn ahead_behind_zero() {
        // git prints "0\t0" when in sync; we map (behind, ahead) -> (ahead, behind)
        assert_eq!(parse_ahead_behind("0\t0\n"), Some((0, 0)));
    }

    #[test]
    fn ahead_behind_typical() {
        // raw "1\t2" means 1 commit behind, 2 commits ahead
        assert_eq!(parse_ahead_behind("1\t2\n"), Some((2, 1)));
    }

    #[test]
    fn ahead_behind_only_ahead() {
        assert_eq!(parse_ahead_behind("0\t5\n"), Some((5, 0)));
    }

    #[test]
    fn ahead_behind_only_behind() {
        assert_eq!(parse_ahead_behind("3\t0\n"), Some((0, 3)));
    }

    #[test]
    fn ahead_behind_garbage() {
        assert_eq!(parse_ahead_behind("not numbers\n"), None);
        assert_eq!(parse_ahead_behind(""), None);
        assert_eq!(parse_ahead_behind("1\n"), None);
    }

    #[test]
    fn no_upstream_error_classification() {
        assert!(is_no_upstream_error(
            "fatal: no upstream configured for branch 'main'"
        ));
        assert!(is_no_upstream_error(
            "fatal: ambiguous argument '@{u}': unknown revision or path not in the working tree."
        ));
        assert!(!is_no_upstream_error("fatal: not a git repository"));
    }

    /* -- Integration tests against a real temp git repo. --------------- */

    use std::process::Command as StdCommand;
    use tempfile::tempdir;

    fn init_repo(dir: &Path) {
        StdCommand::new("git")
            .args(["init", "-q", "-b", "main"])
            .current_dir(dir)
            .status()
            .expect("git init");
        StdCommand::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(dir)
            .status()
            .expect("git config email");
        StdCommand::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(dir)
            .status()
            .expect("git config name");
        std::fs::write(dir.join("README.md"), "hello\n").expect("write README");
        StdCommand::new("git")
            .args(["add", "."])
            .current_dir(dir)
            .status()
            .expect("git add");
        StdCommand::new("git")
            .args(["commit", "-q", "-m", "init"])
            .current_dir(dir)
            .status()
            .expect("git commit");
    }

    #[tokio::test]
    async fn integration_clean_repo_no_upstream() {
        let tmp = tempdir().expect("tempdir");
        init_repo(tmp.path());

        let status = get_git_status(Some(tmp.path().to_string_lossy().to_string()))
            .await
            .expect("status");

        assert!(status.is_repo);
        assert_eq!(status.branch, Some("main".to_string()));
        assert!(!status.dirty);
        assert_eq!(status.ahead, None, "no upstream → ahead None");
        assert_eq!(status.behind, None, "no upstream → behind None");
    }

    #[tokio::test]
    async fn integration_dirty_repo() {
        let tmp = tempdir().expect("tempdir");
        init_repo(tmp.path());
        std::fs::write(tmp.path().join("README.md"), "changed\n").expect("write");

        let status = get_git_status(Some(tmp.path().to_string_lossy().to_string()))
            .await
            .expect("status");

        assert!(status.is_repo);
        assert!(status.dirty, "modified file → dirty true");
    }

    #[tokio::test]
    async fn integration_not_a_repo() {
        let tmp = tempdir().expect("tempdir");

        let status = get_git_status(Some(tmp.path().to_string_lossy().to_string()))
            .await
            .expect("status");

        assert!(!status.is_repo);
        assert_eq!(status.branch, None);
        assert!(!status.dirty);
        assert_eq!(status.ahead, None);
        assert_eq!(status.behind, None);
    }
}
