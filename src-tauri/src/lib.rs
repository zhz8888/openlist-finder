//! OpenList Finder - OpenList 服务器管理工具
//!
//! 这是一个基于 Tauri 2.0 构建的桌面应用程序，用于管理和浏览 OpenList 服务器上的文件。
//! 提供文件浏览、搜索、复制、移动、重命名、删除等功能，并支持 Meilisearch 全文检索集成。
//!
//! # 架构概览
//!
//! - `commands/` - Tauri 命令处理器，负责处理前端 RPC 调用
//! - `models/` - 数据模型定义，用于 API 请求/响应序列化
//! - `services/` - 业务逻辑层，封装 HTTP 请求和数据处理
//!
//! # 主要功能模块
//!
//! - OpenList 服务器管理：登录、连接测试、文件操作
//! - Meilisearch 集成：索引管理、文档同步、全文搜索
//! - 系统密钥环：安全存储敏感信息（Token、API Key 等）
//! - 日志管理：应用日志收集、查询和清理
//! - MCP 服务器：提供 AI 助手通过 HTTP 连接的接口

mod commands;
mod models;
mod services;

use std::sync::{Arc, RwLock};

use crate::models::openlist::ServerConfig;
use services::log_manager::{LogManager, LogManagerLayer};
use tauri::Manager;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// 问候命令（示例命令，用于测试 Tauri 通信）
///
/// # 参数
/// * `name` - 被问候的名称
///
/// # 返回值
/// 返回格式化的问候语字符串
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 启动 MCP HTTP 服务器
///
/// 在后台线程中运行 MCP（Model Context Protocol）HTTP(SSE) 服务器，
/// 供 AI 助手通过 HTTP 连接进行通信。
///
/// # 返回值
/// * `Ok(String)` - MCP 服务器停止后的消息
/// * `Err(String)` - 服务器任务执行失败时的错误信息
#[tauri::command]
async fn start_mcp_http_server(port: u16, app: tauri::AppHandle) -> Result<String, String> {
    let servers = commands::server_config::load_servers(app.clone())
        .map_err(|e| format!("Failed to load servers: {}", e))?;
    let config: Arc<RwLock<Vec<ServerConfig>>> = Arc::new(RwLock::new(servers));

    tokio::task::spawn_blocking(move || {
        commands::mcp_server::run_http_server(port, config);
    })
    .await
    .map_err(|e| format!("MCP HTTP server task failed: {}", e))?;
    Ok("MCP HTTP server stopped".to_string())
}

/// 应用程序入口点
///
/// 初始化日志系统、注册 Tauri 插件、配置命令处理器，并启动主窗口。
///
/// # 日志系统
/// 使用 `tracing` + `tracing-subscriber` 构建日志系统，包含：
/// - `LogManagerLayer` - 自定义日志层，将日志存储在内存中供前端查询
/// - `fmt::layer` - 控制台输出层，使用紧凑格式
///
/// # 插件注册
/// - `tauri-plugin-opener` - 打开外部链接和文件
/// - `tauri-plugin-http` - HTTP 请求支持
/// - `tauri-plugin-store` - 键值对持久化存储
/// - `tauri-plugin-dialog` - 系统对话框支持
/// - `tauri-plugin-shell` - Shell 命令执行
/// - `tauri-plugin-fs` - 文件系统操作
///
/// # 窗口配置
/// 主窗口最小尺寸设置为 800x600 逻辑像素。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 创建日志管理器实例
    let log_manager = LogManager::new();
    let log_manager_for_layer = log_manager.clone();

    // 配置日志层：自定义存储层 + 控制台输出层
    let log_layer = LogManagerLayer::new(
        log_manager_for_layer.get_log_manager(),
        10000, // 最大保留 10000 条日志
    );

    tracing_subscriber::registry()
        .with(log_layer)
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(false)
                .compact(),
        )
        .init();

    tracing::info!("OpenList Finder application starting");
    tracing::debug!("Initializing Tauri builder with plugins");
    tracing::info!("Loading application configuration");

    // 构建 Tauri 应用
    tauri::Builder::default()
        // 注册插件
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // 注册日志管理器为 Tauri 状态
        .manage(log_manager)
        // 注册命令处理器
        .invoke_handler(tauri::generate_handler![
            greet,
            start_mcp_http_server,
            commands::openlist::login_to_openlist,
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
            commands::meilisearch::meilisearch_delete_index,
            commands::meilisearch::meilisearch_delete_all_documents,
            commands::meilisearch::meilisearch_get_task_status,
            commands::keyring::keyring_get_key,
            commands::keyring::keyring_set_key,
            commands::keyring::keyring_delete_key,
            commands::keyring::keyring_generate_key,
            commands::log::get_logs,
            commands::log::clear_logs,
            commands::log::forward_frontend_log,
            commands::server_config::load_servers,
            commands::server_config::save_servers,
            commands::server_config::add_server,
            commands::server_config::update_server,
            commands::server_config::remove_server,
            commands::server_config::set_default_server,
            commands::sync::start_auto_sync,
            commands::sync::stop_auto_sync,
            commands::sync::get_sync_status,
            commands::sync::trigger_sync,
        ])
        // 窗口初始化配置
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
