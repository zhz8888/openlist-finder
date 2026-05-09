//! 服务器配置管理命令模块
//!
//! 本模块提供 OpenList 服务器配置的增删改查功能,使用 Tauri Store 插件
//! 持久化存储服务器配置信息。
//!
//! 主要功能:
//! - 加载所有服务器配置
//! - 保存服务器配置列表
//! - 添加新服务器
//! - 更新服务器信息
//! - 删除服务器
//! - 设置默认服务器

use crate::models::openlist::ServerConfig;
use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

/// 存储文件名称
const SERVERS_STORE_FILE: &str = "servers.json";

/// 存储键名
const SERVERS_KEY: &str = "openlist-servers";

/// 加载所有服务器配置
///
/// 从 Tauri Store 中读取所有已保存的服务器配置。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
///
/// # 返回值
///
/// 成功时返回服务器配置列表,失败时返回错误信息
#[tauri::command]
pub fn load_servers(app: tauri::AppHandle) -> Result<Vec<ServerConfig>, String> {
    let store = app
        .store(SERVERS_STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let servers = match store.get(SERVERS_KEY) {
        Some(value) => {
            let arr = value.as_array().cloned().unwrap_or_default();
            arr.into_iter()
                .filter_map(|v| serde_json::from_value::<ServerConfig>(v).ok())
                .collect::<Vec<_>>()
        }
        None => Vec::new(),
    };

    Ok(servers)
}

/// 保存所有服务器配置
///
/// 将服务器配置列表写入 Tauri Store 进行持久化存储。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
/// * `servers` - 要保存的服务器配置列表
///
/// # 返回值
///
/// 成功时返回空结果,失败时返回错误信息
#[tauri::command]
pub fn save_servers(app: tauri::AppHandle, servers: Vec<ServerConfig>) -> Result<(), String> {
    let store = app
        .store(SERVERS_STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let value = serde_json::to_value(&servers)
        .map_err(|e| format!("Failed to serialize servers: {}", e))?;

    store.set(SERVERS_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// 添加新服务器
///
/// 创建新的服务器配置并添加到列表中。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
/// * `server` - 要添加的服务器配置
///
/// # 返回值
///
/// 成功时返回空结果,失败时返回错误信息
#[tauri::command]
pub fn add_server(app: tauri::AppHandle, server: ServerConfig) -> Result<(), String> {
    let mut servers = load_servers(app.clone())?;
    servers.push(server);
    save_servers(app, servers)
}

/// 更新服务器配置
///
/// 根据服务器 ID 更新现有服务器配置的信息。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
/// * `id` - 要更新的服务器 ID
/// * `data` - 要更新的字段数据
///
/// # 返回值
///
/// 成功时返回空结果,如果找不到指定 ID 的服务器则返回错误
#[tauri::command]
pub fn update_server(
    app: tauri::AppHandle,
    id: String,
    data: ServerConfigUpdate,
) -> Result<(), String> {
    let mut servers = load_servers(app.clone())?;

    let server = servers
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Server with id '{}' not found", id))?;

    if let Some(name) = data.name {
        server.name = name;
    }
    if let Some(url) = data.url {
        server.url = url;
    }
    if let Some(token) = data.token {
        server.token = token;
    }
    if let Some(username) = data.username {
        server.username = Some(username);
    }
    if let Some(password) = data.password {
        server.password = Some(password);
    }
    if let Some(is_default) = data.is_default {
        server.is_default = is_default;
    }

    save_servers(app, servers)
}

/// 删除服务器
///
/// 根据服务器 ID 从列表中移除指定的服务器配置。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
/// * `id` - 要删除的服务器 ID
///
/// # 返回值
///
/// 成功时返回空结果,如果找不到指定 ID 的服务器则返回错误
#[tauri::command]
pub fn remove_server(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut servers = load_servers(app.clone())?;

    let initial_len = servers.len();
    servers.retain(|s| s.id != id);

    if servers.len() == initial_len {
        return Err(format!("Server with id '{}' not found", id));
    }

    save_servers(app, servers)
}

/// 设置默认服务器
///
/// 将指定服务器设为默认服务器,同时取消其他服务器的默认状态。
///
/// # 参数
///
/// * `app` - Tauri 应用句柄,由 Tauri 注入
/// * `id` - 要设为默认的服务器 ID
///
/// # 返回值
///
/// 成功时返回空结果,如果找不到指定 ID 的服务器则返回错误
#[tauri::command]
pub fn set_default_server(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut servers = load_servers(app.clone())?;

    for server in servers.iter_mut() {
        server.is_default = server.id == id;
    }

    save_servers(app, servers)
}

/// 服务器配置更新结构体
///
/// 包含所有可更新的字段,使用 `Option` 类型表示可选更新。
/// 只有非 `None` 的字段才会被更新。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfigUpdate {
    /// 服务器显示名称
    pub name: Option<String>,
    /// 服务器 API 地址
    pub url: Option<String>,
    /// 认证令牌
    pub token: Option<String>,
    /// 用户名
    pub username: Option<String>,
    /// 密码
    pub password: Option<String>,
    /// 是否为默认服务器
    pub is_default: Option<bool>,
}
