//! Recursive fs-watcher on the workspace, debounced 500ms.
//!
//! Any debounced filesystem change emits a `git-changed` Tauri event. The
//! frontend listens for it and re-runs `get_git_status`. This keeps the
//! BranchChip's dirty dot / branch name / ahead-behind in sync within 1s of
//! a working-tree edit or a `git checkout` from the terminal drawer.
//!
//! Scope (this slice): one watcher started on app setup, watches
//! `std::env::current_dir()`. When STO-2162 (Open-from-folder) lands the
//! watcher will be re-targeted on folder open.
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, Debouncer, RecommendedCache};
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 500;
pub const GIT_CHANGED_EVENT: &str = "git-changed";

/// Owned by Tauri state so the underlying watcher thread stays alive for the
/// app lifetime. The struct is intentionally opaque.
pub struct GitWatcher {
    _debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
}

/// Start a recursive, debounced watcher on `path` and emit `git-changed`
/// on every debounced batch of events.
pub fn start(app: &AppHandle, path: &Path) -> Result<GitWatcher, String> {
    let (tx, rx) = channel();

    let mut debouncer = new_debouncer(Duration::from_millis(DEBOUNCE_MS), None, tx)
        .map_err(|e| format!("failed to create fs debouncer: {e}"))?;

    debouncer
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| format!("failed to watch {}: {e}", path.display()))?;

    // Forward debounced batches as Tauri events from a background thread.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        for batch in rx {
            if batch.is_err() {
                continue;
            }
            if let Err(e) = app_handle.emit(GIT_CHANGED_EVENT, ()) {
                eprintln!("[git_watcher] emit failed: {e}");
            }
        }
    });

    Ok(GitWatcher {
        _debouncer: debouncer,
    })
}
