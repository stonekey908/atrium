use tauri::Manager;

mod git_status;
mod git_watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![git_status::get_git_status])
        .setup(|app| {
            // Start the fs-watcher on the session's cwd. Failure is non-fatal —
            // the BranchChip falls back to focus-only refresh.
            match std::env::current_dir() {
                Ok(cwd) => match git_watcher::start(app.handle(), &cwd) {
                    Ok(watcher) => {
                        app.manage(watcher);
                    }
                    Err(e) => eprintln!("git_watcher start failed: {e}"),
                },
                Err(e) => eprintln!("cwd resolution failed: {e}"),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
