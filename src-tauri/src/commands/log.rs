use serde::{Deserialize, Serialize};
use tauri::State;
use crate::services::log_manager::LogManager;

#[derive(Debug, Deserialize)]
pub struct GetLogsRequest {
    pub level: Option<String>,
    pub offset: usize,
    pub limit: usize,
}

#[derive(Debug, Serialize)]
pub struct GetLogsResponse {
    pub logs: Vec<crate::services::log_manager::LogEntry>,
    pub total: usize,
}

#[tauri::command]
pub fn get_logs(
    log_manager: State<LogManager>,
    request: GetLogsRequest,
) -> Result<GetLogsResponse, String> {
    let total = log_manager.get_total_count(request.level.as_deref());
    let logs = log_manager.get_logs(
        request.level.as_deref(),
        request.offset,
        request.limit,
    );

    Ok(GetLogsResponse { logs, total })
}

#[tauri::command]
pub fn clear_logs(log_manager: State<LogManager>) -> Result<(), String> {
    log_manager.clear_logs();
    Ok(())
}
