//! Meilisearch 服务层模块
//!
//! 封装与 Meilisearch 搜索引擎的交互逻辑，提供索引管理、文档操作和搜索功能。
//! 使用 `meilisearch-sdk` 作为底层客户端。

use crate::models::meilisearch::*;
use meilisearch_sdk::client::Client;
use meilisearch_sdk::task_info::TaskInfo as SdkTaskInfo;
use meilisearch_sdk::tasks::Task as SdkTask;

/// Meilisearch 服务结构体
///
/// 封装与 Meilisearch 服务器的所有交互操作，包括连接测试、索引管理、
/// 文档操作、搜索和任务状态查询等。
pub struct MeilisearchService {
    /// Meilisearch 客户端实例
    client: Client,
}

impl MeilisearchService {
    /// 创建新的 MeilisearchService 实例
    ///
    /// # 参数
    /// * `host` - Meilisearch 服务器地址
    /// * `api_key` - API 认证密钥
    ///
    /// # 返回值
    /// 返回配置好的 MeilisearchService 实例
    ///
    /// # 错误
    /// 如果客户端创建失败，将触发 panic
    pub fn new(host: &str, api_key: &str) -> Self {
        let client = Client::new(host, Some(api_key))
            .expect("Failed to create Meilisearch client");
        Self { client }
    }

    /// 测试与 Meilisearch 服务器的连接
    ///
    /// 分两步验证连接：
    /// 1. 调用健康端点（`/health`）验证服务是否可用
    /// 2. 调用版本端点（`/version`）验证 API Key 权限
    ///
    /// # 返回值
    /// * `Ok(true)` - 连接成功
    /// * `Err(String)` - 连接失败原因
    pub async fn test_connection(&self) -> Result<bool, String> {
        // 首先测试健康端点（不需要认证）
        self.client
            .health()
            .await
            .map_err(|e: meilisearch_sdk::errors::Error| format!("Meilisearch 服务不可用: {}", e))?;
        
        // 然后测试 API Key 权限（通过获取版本信息来验证）
        let version = self.client
            .get_version()
            .await
            .map_err(|e: meilisearch_sdk::errors::Error| {
                let error_msg = e.to_string();
                if error_msg.contains("403") || error_msg.contains("Forbidden") || error_msg.contains("invalid API key") {
                    format!("API Key 无效或权限不足，请检查配置")
                } else {
                    format!("连接测试失败: {}", error_msg)
                }
            })?;
        
        // 验证成功，返回版本信息
        tracing::info!("Meilisearch 连接成功，版本: {}", version.pkg_version);
        Ok(true)
    }

    /// 创建或更新索引
    ///
    /// 创建一个新的 Meilisearch 索引，使用 `id` 字段作为主键。
    /// 如果索引已存在，此操作将返回一个任务。
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    ///
    /// # 返回值
    /// * `Ok(TaskInfo)` - 异步任务信息
    /// * `Err(String)` - 创建失败原因
    pub async fn create_or_update_index(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let task = self.client
            .create_index(index_uid, Some("id"))
            .await
            .map_err(|e| format!("Failed to create index: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    /// 添加文档到索引
    ///
    /// 将一批文档添加到指定的 Meilisearch 索引中。
    /// 文档使用 `id` 字段作为唯一标识符，重复的 `id` 将被更新。
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    /// * `docs` - 要添加的文档列表
    ///
    /// # 返回值
    /// * `Ok(TaskInfo)` - 异步任务信息
    /// * `Err(String)` - 添加失败原因
    pub async fn add_documents(&self, index_uid: &str, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| format!("Failed to add documents: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    /// 执行全文搜索
    ///
    /// 在指定的 Meilisearch 索引中执行全文搜索。
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    /// * `query` - 搜索查询字符串
    /// * `limit` - 返回结果数量限制（默认 20）
    /// * `offset` - 结果偏移量（默认 0）
    ///
    /// # 返回值
    /// * `Ok(SearchResult)` - 搜索结果，包含匹配的文档列表和元数据
    /// * `Err(String)` - 搜索失败原因
    pub async fn search(&self, index_uid: &str, query: &str, limit: Option<usize>, offset: Option<usize>) -> Result<SearchResult, String> {
        let index = self.client.index(index_uid);
        
        let search_result = index
            .search()
            .with_query(query)
            .with_limit(limit.unwrap_or(20))
            .with_offset(offset.unwrap_or(0))
            .execute::<MeilisearchDoc>()
            .await
            .map_err(|e| format!("Search failed: {}", e))?;
        
        let hits: Vec<MeilisearchDoc> = search_result.hits.into_iter().map(|h| h.result).collect();
        
        Ok(SearchResult {
            hits,
            query: search_result.query,
            processing_time_ms: search_result.processing_time_ms as i64,
            limit: search_result.limit.unwrap_or(20) as i64,
            offset: search_result.offset.unwrap_or(0) as i64,
            estimated_total_hits: search_result.estimated_total_hits.unwrap_or(0) as i64,
        })
    }

    /// 获取索引统计信息
    ///
    /// 返回指定索引的文档数量、索引状态和字段分布统计。
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    ///
    /// # 返回值
    /// * `Ok(IndexStats)` - 索引统计信息
    /// * `Err(String)` - 获取失败原因
    pub async fn get_index_stats(&self, index_uid: &str) -> Result<IndexStats, String> {
        let index = self.client.index(index_uid);
        let stats = index
            .get_stats()
            .await
            .map_err(|e| format!("Failed to get stats: {}", e))?;
        
        Ok(IndexStats {
            number_of_documents: stats.number_of_documents as i64,
            is_indexing: stats.is_indexing,
            field_distribution: stats.field_distribution
                .into_iter()
                .map(|(k, v)| (k, v as i64))
                .collect(),
        })
    }

    /// 更新索引的可过滤属性
    ///
    /// 设置索引的可过滤属性列表，用于支持搜索时的过滤功能。
    /// 当前配置的过滤属性包括：`name`、`dir_path`、`type`、`is_dir`、`server_id`。
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    ///
    /// # 返回值
    /// * `Ok(TaskInfo)` - 异步任务信息
    /// * `Err(String)` - 更新失败原因
    pub async fn update_filterable_attributes(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let filterable_attributes = ["name", "dir_path", "type", "is_dir", "server_id"];
        
        let task = index
            .set_filterable_attributes(&filterable_attributes)
            .await
            .map_err(|e| format!("Failed to update settings: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    /// 删除索引
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    ///
    /// # 返回值
    /// * `Ok(TaskInfo)` - 异步任务信息
    /// * `Err(String)` - 删除失败原因
    pub async fn delete_index(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .delete()
            .await
            .map_err(|e| format!("Failed to delete index: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    /// 删除索引中的所有文档
    ///
    /// # 参数
    /// * `index_uid` - 索引唯一标识符
    ///
    /// # 返回值
    /// * `Ok(TaskInfo)` - 异步任务信息
    /// * `Err(String)` - 删除失败原因
    pub async fn delete_all_documents(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .delete_all_documents()
            .await
            .map_err(|e| format!("Failed to delete all documents: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    /// 获取任务状态
    ///
    /// 查询指定任务的当前状态（enqueued/processing/succeeded/failed）。
    ///
    /// # 参数
    /// * `task_uid` - 任务唯一标识
    ///
    /// # 返回值
    /// * `Ok(String)` - 任务状态字符串
    /// * `Err(String)` - 查询失败或任务不存在
    pub async fn get_task_status(&self, task_uid: i64) -> Result<String, String> {
        let tasks = self.client
            .get_tasks()
            .await
            .map_err(|e| format!("Failed to get tasks: {}", e))?;
        
        let task_id = task_uid as u32;
        let task = tasks.results.into_iter().find(|t| {
            match t {
                SdkTask::Enqueued { content } => content.uid == task_id,
                SdkTask::Processing { content } => content.uid == task_id,
                SdkTask::Succeeded { content } => content.uid == task_id,
                SdkTask::Failed { content } => content.task.uid == task_id,
            }
        });
        
        if let Some(task) = task {
            let status = match task {
                SdkTask::Enqueued { .. } => "enqueued",
                SdkTask::Processing { .. } => "processing",
                SdkTask::Succeeded { .. } => "succeeded",
                SdkTask::Failed { .. } => "failed",
            };
            Ok(status.to_string())
        } else {
            Err(format!("Task {} not found", task_uid))
        }
    }

    /// 将 SDK 的任务信息转换为内部 TaskInfo 结构体
    ///
    /// # 参数
    /// * `task` - Meilisearch SDK 的任务信息
    ///
    /// # 返回值
    /// 转换后的 TaskInfo 实例
    fn convert_task_info(&self, task: SdkTaskInfo) -> TaskInfo {
        TaskInfo {
            uid: task.task_uid as i64,
            index_uid: task.index_uid.unwrap_or_default(),
            status: task.status,
            task_type: "unknown".to_string(),
            enqueued_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}
