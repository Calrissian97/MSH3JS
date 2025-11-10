#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter, Listener};
    // Helper to extract valid file path(s) from CLI args
    fn extract_file_args() -> Vec<String> {
        std::env::args()
            .skip(1) // Skip exe path
            .filter(|arg| {
                let path = std::path::Path::new(arg);
                path.exists() && path.is_file()
            })
            .collect()
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let files = extract_file_args();
            if !files.is_empty() {
                let app_handle = app.handle().clone();
                let event_handle = app_handle.clone();
                // Listen for a signal from the frontend that it is ready.
                app_handle.listen("frontend-ready", move |_event| {
                    // Once the frontend is ready, emit the event with the file paths.
                    event_handle.emit("open-file", &files).unwrap();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
