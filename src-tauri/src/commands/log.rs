//! 日志命令模块
//!
//! 本模块提供查询和管理应用日志的 Tauri 命令。支持从 LogManager 中
//! 获取日志、清空日志以及接收前端转发的日志条目。
//!
//! 主要功能:
//! - 分页查询日志(支持按级别过滤)
//! - 清空所有日志
//! - 接收前端日志并存储

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::services::log_manager::LogManager;

/// 获取日志请求结构体
///
/// 包含日志查询的分页参数和可选的级别过滤器。
#[derive(Debug, Deserialize)]
pub struct GetLogsRequest {
    /// 可选的日志级别过滤器,如 "INFO", "ERROR" 等
    pub level: Option<String>,
    
    /// 分页偏移量,从第几条日志开始返回
    pub offset: usize,
    
    /// 分页限制,最多返回多少条日志
    pub limit: usize,
}

/// 获取日志响应结构体
///
/// 包含查询到的日志列表和符合条件的日志总数。
#[derive(Debug, Serialize)]
pub struct GetLogsResponse {
    /// 当前页的日志条目列表
    pub logs: Vec<crate::services::log_manager::LogEntry>,
    
    /// 符合条件的日志总数(用于分页计算)
    pub total: usize,
}

/// 前端日志条目结构体
///
/// 表示从前端转发的日志记录,包含时间戳、级别和消息。
/// 该结构体用于接收前端产生的日志并存储到 LogManager 中。
#[derive(Debug, Deserialize)]
pub struct FrontendLogEntry {
    /// 日志时间戳(由前端生成,后端暂不使用)
    #[allow(dead_code)]
    pub timestamp: String,
    
    /// 日志级别
    pub level: String,
    
    /// 日志消息内容
    pub message: String,
}

/// 获取日志列表
///
/// 从 LogManager 中查询日志,支持按级别过滤和分页。
///
/// # 参数
///
/// * `log_manager` - LogManager 的状态引用,由 Tauri 注入
/// * `request` - 查询请求,包含级别过滤器、偏移量和限制
///
/// # 返回值
///
/// 成功时返回 `GetLogsResponse`,包含日志列表和总数
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

/// 清空所有日志
///
/// 移除 LogManager 中缓存的所有日志条目。
///
/// # 参数
///
/// * `log_manager` - LogManager 的状态引用,由 Tauri 注入
///
/// # 返回值
///
/// 成功时返回空结果,失败时返回错误信息
#[tauri::command]
pub fn clear_logs(log_manager: State<LogManager>) -> Result<(), String> {
    log_manager.clear_logs();
    Ok(())
}

/// 转发前端日志
///
/// 接收前端产生的日志条目,并将其存储到 LogManager 中。
/// 日志的来源标记为 "frontend"。
///
/// # 参数
///
/// * `log_manager` - LogManager 的状态引用,由 Tauri 注入
/// * `log_entry` - 前端日志条目,包含时间戳、级别和消息
///
/// # 返回值
///
/// 成功时返回空结果,失败时返回错误信息
#[tauri::command]
pub fn forward_frontend_log(
    log_manager: State<LogManager>,
    log_entry: FrontendLogEntry,
) -> Result<(), String> {
    log_manager.add_log(
        &log_entry.level,
        "frontend",
        &log_entry.message,
    );
    Ok(())
}
