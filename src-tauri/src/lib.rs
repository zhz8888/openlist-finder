mod commands;
mod config;
mod models;
mod services;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_mcp_server() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        commands::mcp_server::run_stdio_server();
    }).await.map_err(|e| format!("MCP server task failed: {}", e))?;
    Ok("MCP server stopped".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_mcp_server,
            commands::openlist::test_openlist_connection,
            commands::openlist::list_directory,
            commands::openlist::rename_file,
            commands::openlist::delete_files,
            commands::openlist::copy_files,
            commands::openlist::move_files,
            commands::openlist::get_file_info,
            commands::meilisearch::test_meilisearch_connection,
            commands::meilisearch::meilisearch_create_index,
            commands::meilisearch::meilisearch_add_documents,
            commands::meilisearch::meilisearch_search,
            commands::meilisearch::meilisearch_get_stats,
            commands::meilisearch::meilisearch_update_filterable,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
