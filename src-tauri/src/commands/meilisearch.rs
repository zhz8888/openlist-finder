//! Meilisearch 命令模块
//!
//! 本模块提供与 Meilisearch 搜索引擎交互的 Tauri 命令。这些命令支持索引管理、
//! 文档操作、全文搜索和索引统计等功能。
//!
//! 主要功能:
//! - 服务器连接测试
//! - 索引创建、删除和统计
//! - 文档添加和批量导入
//! - 全文搜索(支持分页和过滤)
//! - 异步任务状态查询

use crate::models::meilisearch::*;
use crate::services::meilisearch::MeilisearchService;

/// 测试 Meilisearch 服务器连接
///
/// 验证提供的 Meilisearch 服务器地址和 API 密钥是否有效。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
///
/// # 返回值
///
/// 成功时返回 `true` 表示连接正常,失败时返回错误信息
#[tauri::command]
pub async fn test_meilisearch_connection(host: String, api_key: String) -> Result<bool, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.test_connection().await
}

/// 创建或更新 Meilisearch 索引
///
/// 如果索引不存在则创建新索引,如果已存在则更新索引配置。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
///
/// # 返回值
///
/// 成功时返回 `TaskInfo` 包含异步任务信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_create_index(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.create_or_update_index(&index_uid).await
}

/// 向索引中添加文档
///
/// 将文档批量添加到指定的 Meilisearch 索引中。如果文档已存在(基于主键),
/// 则会更新现有文档。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
/// * `docs` - 要添加的文档列表
///
/// # 返回值
///
/// 成功时返回 `TaskInfo` 包含异步任务信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_add_documents(host: String, api_key: String, index_uid: String, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.add_documents(&index_uid, docs).await
}

/// 搜索索引中的文档
///
/// 在指定索引中执行全文搜索,返回匹配的文档列表。支持分页参数。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
/// * `query` - 搜索查询字符串
/// * `limit` - 可选的返回结果数量限制
/// * `offset` - 可选的分页偏移量
///
/// # 返回值
///
/// 成功时返回 `SearchResult` 包含搜索结果,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_search(host: String, api_key: String, index_uid: String, query: String, limit: Option<i64>, offset: Option<i64>) -> Result<SearchResult, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.search(&index_uid, &query, limit.map(|l| l as usize), offset.map(|o| o as usize)).await
}

/// 获取索引统计信息
///
/// 返回指定索引的统计数据,包括文档数量、字段信息等。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
///
/// # 返回值
///
/// 成功时返回 `IndexStats` 包含索引统计信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_get_stats(host: String, api_key: String, index_uid: String) -> Result<IndexStats, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.get_index_stats(&index_uid).await
}

/// 更新索引的可过滤属性
///
/// 配置索引的 `filterableAttributes`,使指定字段支持过滤和分面搜索。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
///
/// # 返回值
///
/// 成功时返回 `TaskInfo` 包含异步任务信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_update_filterable(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.update_filterable_attributes(&index_uid).await
}

/// 删除索引
///
/// 完全删除指定的索引及其所有文档和配置。此操作不可逆。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
///
/// # 返回值
///
/// 成功时返回 `TaskInfo` 包含异步任务信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_delete_index(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.delete_index(&index_uid).await
}

/// 删除索引中的所有文档
///
/// 清空指定索引中的所有文档,但保留索引配置(如可过滤属性等)。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `index_uid` - 索引唯一标识符
///
/// # 返回值
///
/// 成功时返回 `TaskInfo` 包含异步任务信息,失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_delete_all_documents(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.delete_all_documents(&index_uid).await
}

/// 获取异步任务状态
///
/// 查询指定任务的执行状态。Meilisearch 的索引操作(如添加文档、更新配置等)
/// 都是异步执行的,可通过此接口查询任务是否完成。
///
/// # 参数
///
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 密钥
/// * `task_uid` - 任务唯一标识符
///
/// # 返回值
///
/// 成功时返回任务状态字符串(如 "succeeded", "failed", "processing" 等),失败时返回错误信息
#[tauri::command]
pub async fn meilisearch_get_task_status(host: String, api_key: String, task_uid: i64) -> Result<String, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.get_task_status(task_uid).await
}
