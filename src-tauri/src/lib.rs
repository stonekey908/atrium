use std::path::PathBuf;
use tauri::Manager;

mod git_status;
mod git_watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![git_status::get_git_status])
        .setup(|app| {
            // Watch the workspace root, not the binary's cwd. When run via
            // `cargo run` from src-tauri/, std::env::current_dir() points to
            // src-tauri, which is too narrow — file edits in the project root
            // would never trigger the watcher.
            match resolve_watch_root() {
                Ok(root) => match git_watcher::start(app.handle(), &root) {
                    Ok(watcher) => {
                        app.manage(watcher);
                    }
                    Err(e) => eprintln!("git_watcher start failed: {e}"),
                },
                Err(e) => eprintln!("watch root resolution failed: {e}"),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Resolve the directory to watch: prefer the git repo root; fall back to cwd.
fn resolve_watch_root() -> std::io::Result<PathBuf> {
    let cwd = std::env::current_dir()?;
    Ok(git_toplevel_from(&cwd).unwrap_or(cwd))
}

fn git_toplevel_from(cwd: &std::path::Path) -> Option<PathBuf> {
    let out = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(cwd)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(PathBuf::from(s))
    }
}
