//! 同步命令模块
//!
//! 提供自动同步相关的 Tauri 命令，包括启动、停止同步和获取同步状态。

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::models::meilisearch::{MeilisearchConfig, TaskInfo};
use crate::models::openlist::ServerConfig;
use crate::services::meilisearch::MeilisearchService;
use crate::services::openlist::OpenListService;

/// 全局同步运行状态
static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

/// 同步配置
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[allow(dead_code)]
pub struct SyncConfig {
    pub meilisearch: MeilisearchConfig,
    pub servers: Vec<ServerConfig>,
    pub interval_secs: u64,
}

/// 同步状态响应
#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncStatusResponse {
    pub is_running: bool,
    pub last_sync: Option<String>,
    pub documents_synced: u64,
    pub interval_secs: u64,
}

impl Default for SyncStatusResponse {
    fn default() -> Self {
        Self {
            is_running: false,
            last_sync: None,
            documents_synced: 0,
            interval_secs: 300,
        }
    }
}

/// 执行单次同步任务
fn do_sync(
    meilisearch_config: &MeilisearchConfig,
    server: &ServerConfig,
) -> Result<u64, String> {
    let runtime = tokio::runtime::Handle::current();
    runtime.block_on(async {
        let meili = MeilisearchService::new(&meilisearch_config.host, &meilisearch_config.api_key);
        let openlist = OpenListService::new();

        let index_uid = format!("{}_{}", meilisearch_config.index_prefix, server.id);

        // 确保索引存在
        meili.create_or_update_index(&index_uid).await?;
        tokio::time::sleep(Duration::from_secs(1)).await;

        // 收集所有文件（使用栈避免递归）
        let mut all_files = Vec::new();
        let mut dirs_to_process = vec!["/".to_string()];

        while let Some(dir_path) = dirs_to_process.pop() {
            let path = if dir_path.is_empty() { "/" } else { &dir_path };

            match openlist.list_directory(&server.url, &server.token, path).await {
                Ok(response) => {
                    for file in response.content {
                        if file.is_dir {
                            if let Some(sub_path) = file.path.as_ref() {
                                if sub_path != path {
                                    dirs_to_process.push(sub_path.clone());
                                }
                            }
                        } else {
                            all_files.push(file);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to list directory {}: {}", path, e);
                }
            }
        }

        if all_files.is_empty() {
            return Ok(0u64);
        }

        // 转换为 Meilisearch 文档
        let docs: Vec<_> = all_files
            .into_iter()
            .map(|file| {
                let path = file.path.as_ref().unwrap_or(&String::new()).clone();
                crate::models::meilisearch::MeilisearchDoc {
                    id: format!("{}:{}", server.id, path),
                    name: file.name.clone(),
                    dir_path: path.trim_end_matches('/').to_string(),
                    size: file.size,
                    modified: file.modified,
                    doc_type: if file.is_dir { "dir".to_string() } else { "file".to_string() },
                    is_dir: file.is_dir,
                    server_id: server.id.clone(),
                }
            })
            .collect();

        // 添加文档
        let doc_count = docs.len() as u64;
        meili.add_documents(&index_uid, docs).await?;
        Ok(doc_count)
    })
}

/// 在后台线程中运行同步循环
fn run_sync_loop(
    meilisearch_config: MeilisearchConfig,
    servers: Vec<ServerConfig>,
    interval_secs: u64,
) {
    std::thread::spawn(move || {
        // 初始化 tokio runtime 用于阻塞环境
        let _runtime = tokio::runtime::Runtime::new().unwrap();

        loop {
            if !SYNC_RUNNING.load(Ordering::SeqCst) {
                break;
            }

            for server in servers.iter() {
                if !SYNC_RUNNING.load(Ordering::SeqCst) {
                    break;
                }

                match do_sync(&meilisearch_config, server) {
                    Ok(count) => {
                        tracing::info!("Synced {} documents for server {}", count, server.id);
                    }
                    Err(e) => {
                        tracing::error!("Sync failed for server {}: {}", server.id, e);
                    }
                }
            }

            tracing::debug!("Auto sync completed, next sync in {} seconds", interval_secs);

            // 等待下一个间隔
            std::thread::sleep(Duration::from_secs(interval_secs));
        }

        SYNC_RUNNING.store(false, Ordering::SeqCst);
    });
}

/// 启动自动同步
#[tauri::command]
pub fn start_auto_sync(
    meilisearch_config: MeilisearchConfig,
    servers: Vec<ServerConfig>,
    interval_secs: Option<u64>,
) -> Result<bool, String> {
    if SYNC_RUNNING.load(Ordering::SeqCst) {
        return Err("Sync is already running".to_string());
    }

    let interval = interval_secs.unwrap_or(300).max(60);
    SYNC_RUNNING.store(true, Ordering::SeqCst);

    run_sync_loop(meilisearch_config, servers, interval);

    Ok(true)
}

/// 停止自动同步
#[tauri::command]
pub fn stop_auto_sync() -> Result<bool, String> {
    if !SYNC_RUNNING.load(Ordering::SeqCst) {
        return Err("Sync is not running".to_string());
    }

    SYNC_RUNNING.store(false, Ordering::SeqCst);
    Ok(true)
}

/// 获取同步状态
#[tauri::command]
pub fn get_sync_status() -> SyncStatusResponse {
    SyncStatusResponse {
        is_running: SYNC_RUNNING.load(Ordering::SeqCst),
        last_sync: None,
        documents_synced: 0,
        interval_secs: 300,
    }
}

/// 触发立即同步（手动同步）
#[tauri::command]
pub async fn trigger_sync(
    meilisearch_config: MeilisearchConfig,
    servers: Vec<ServerConfig>,
) -> Result<TaskInfo, String> {
    let index_uid = format!("{}_manual_sync", meilisearch_config.index_prefix);
    let meili = MeilisearchService::new(&meilisearch_config.host, &meilisearch_config.api_key);
    let openlist = OpenListService::new();

    // 确保索引存在
    meili.create_or_update_index(&index_uid).await?;
    tokio::time::sleep(Duration::from_secs(1)).await;

    let mut all_docs = Vec::new();

    for server in servers.iter() {
        let mut files = Vec::new();
        collect_all_files(&openlist, server, "/", &mut files).await?;

        for file in files {
            let path = file.path.as_ref().unwrap_or(&String::new()).clone();
            all_docs.push(crate::models::meilisearch::MeilisearchDoc {
                id: format!("{}:{}", server.id, path),
                name: file.name.clone(),
                dir_path: path.trim_end_matches('/').to_string(),
                size: file.size,
                modified: file.modified,
                doc_type: if file.is_dir { "dir".to_string() } else { "file".to_string() },
                is_dir: file.is_dir,
                server_id: server.id.clone(),
            });
        }
    }

    if !all_docs.is_empty() {
        meili.add_documents(&index_uid, all_docs).await
    } else {
        Ok(TaskInfo {
            uid: 0,
            index_uid: index_uid.clone(),
            status: "succeeded".to_string(),
            task_type: "documentAddition".to_string(),
            enqueued_at: chrono::Utc::now().to_rfc3339(),
        })
    }
}

/// 收集所有文件（使用栈避免递归）
async fn collect_all_files(
    openlist: &OpenListService,
    server: &ServerConfig,
    root_path: &str,
    files: &mut Vec<crate::models::openlist::FileInfo>,
) -> Result<(), String> {
    let mut dirs_to_process = vec![root_path.to_string()];

    while let Some(dir_path) = dirs_to_process.pop() {
        let path = if dir_path.is_empty() { "/" } else { &dir_path };

        let response = openlist
            .list_directory(&server.url, &server.token, path)
            .await?;

        for file in response.content {
            if file.is_dir {
                if let Some(sub_path) = file.path.as_ref() {
                    if sub_path != path {
                        dirs_to_process.push(sub_path.clone());
                    }
                }
            } else {
                files.push(file);
            }
        }
    }

    Ok(())
}