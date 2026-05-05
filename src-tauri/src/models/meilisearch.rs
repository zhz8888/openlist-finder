//! Meilisearch 数据模型模块
//!
//! 定义与 Meilisearch 搜索引擎交互所需的数据结构，包括文档模型、搜索结果、
//! 索引统计和任务信息等。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Meilisearch 配置结构体
///
/// 存储 Meilisearch 服务器的连接配置和同步策略。
///
/// # 字段说明
/// * `host` - Meilisearch 服务器地址
/// * `api_key` - API 认证密钥
/// * `index_prefix` - 索引名称前缀（用于多服务器隔离）
/// * `sync_strategy` - 同步策略（manual/auto/realtime）
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeilisearchConfig {
    /// Meilisearch 服务器地址
    pub host: String,
    /// API 认证密钥
    pub api_key: String,
    /// 索引名称前缀
    pub index_prefix: String,
    /// 同步策略
    pub sync_strategy: String,
}

/// Meilisearch 文档结构体
///
/// 表示存储在 Meilisearch 索引中的单个文档（文件或目录）。
/// 每个文档对应 OpenList 服务器上的一个文件/目录条目。
///
/// # 字段说明
/// * `id` - 文档唯一标识（server_id + 文件路径的组合）
/// * `name` - 文件/目录名称
/// * `dir_path` - 文件所在目录路径
/// * `size` - 文件大小（字节）
/// * `modified` - 最后修改时间
/// * `doc_type` - 文档类型（file/dir）
/// * `is_dir` - 是否为目录
/// * `server_id` - 所属 OpenList 服务器 ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeilisearchDoc {
    /// 文档唯一标识
    pub id: String,
    /// 文件/目录名称
    pub name: String,
    /// 文件所在目录路径
    pub dir_path: String,
    /// 文件大小（字节）
    pub size: i64,
    /// 最后修改时间
    pub modified: String,
    /// 文档类型
    #[serde(rename = "type")]
    pub doc_type: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 所属 OpenList 服务器 ID
    pub server_id: String,
}

/// Meilisearch 搜索结果结构体
///
/// 表示 Meilisearch 搜索 API 返回的搜索结果。
///
/// # 字段说明
/// * `hits` - 匹配的文档列表
/// * `query` - 原始搜索查询
/// * `processing_time_ms` - 搜索处理耗时（毫秒）
/// * `limit` - 返回结果数量限制
/// * `offset` - 结果偏移量
/// * `estimated_total_hits` - 估计的总匹配数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// 匹配的文档列表
    pub hits: Vec<MeilisearchDoc>,
    /// 原始搜索查询
    pub query: String,
    /// 搜索处理耗时（毫秒）
    pub processing_time_ms: i64,
    /// 返回结果数量限制
    pub limit: i64,
    /// 结果偏移量
    pub offset: i64,
    /// 估计的总匹配数
    pub estimated_total_hits: i64,
}

/// 索引统计信息结构体
///
/// 表示 Meilisearch 索引的统计信息，包括文档数量、索引状态和字段分布。
///
/// # 字段说明
/// * `number_of_documents` - 索引中的文档总数
/// * `is_indexing` - 索引是否正在执行索引操作
/// * `field_distribution` - 字段值分布统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    /// 索引中的文档总数
    pub number_of_documents: i64,
    /// 索引是否正在执行索引操作
    pub is_indexing: bool,
    /// 字段值分布统计
    pub field_distribution: HashMap<String, i64>,
}

/// Meilisearch 任务信息结构体
///
/// 表示 Meilisearch 异步任务的状态信息，如索引创建、文档添加等。
///
/// # 字段说明
/// * `uid` - 任务唯一标识
/// * `index_uid` - 关联的索引名称
/// * `status` - 任务状态（enqueued/processing/succeeded/failed）
/// * `task_type` - 任务类型（indexCreation/documentAddition等）
/// * `enqueued_at` - 任务入队时间
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    /// 任务唯一标识
    pub uid: i64,
    /// 关联的索引名称
    pub index_uid: String,
    /// 任务状态
    pub status: String,
    /// 任务类型
    #[serde(rename = "type")]
    pub task_type: String,
    /// 任务入队时间
    pub enqueued_at: String,
}

/// 索引同步进度结构体
///
/// 表示 OpenList 服务器文件同步到 Meilisearch 的进度信息。
///
/// # 字段说明
/// * `total` - 需要同步的文件总数
/// * `indexed` - 已同步的文件数量
/// * `percentage` - 同步进度百分比（0-100）
/// * `is_running` - 同步是否正在进行中
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSyncProgress {
    /// 需要同步的文件总数
    pub total: i64,
    /// 已同步的文件数量
    pub indexed: i64,
    /// 同步进度百分比
    pub percentage: f64,
    /// 同步是否正在进行中
    pub is_running: bool,
}
