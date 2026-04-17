use crate::models::meilisearch::*;
use meilisearch_sdk::client::Client;
use meilisearch_sdk::task_info::TaskInfo as SdkTaskInfo;
use meilisearch_sdk::tasks::Task as SdkTask;

pub struct MeilisearchService {
    client: Client,
}

impl MeilisearchService {
    pub fn new(host: &str, api_key: &str) -> Self {
        let client = Client::new(host, Some(api_key))
            .expect("Failed to create Meilisearch client");
        Self { client }
    }

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

    pub async fn create_or_update_index(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let task = self.client
            .create_index(index_uid, Some("id"))
            .await
            .map_err(|e| format!("Failed to create index: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    pub async fn add_documents(&self, index_uid: &str, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| format!("Failed to add documents: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

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

    pub async fn update_filterable_attributes(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let filterable_attributes = ["name", "dir_path", "type", "is_dir", "server_id"];
        
        let task = index
            .set_filterable_attributes(&filterable_attributes)
            .await
            .map_err(|e| format!("Failed to update settings: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    pub async fn delete_index(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .delete()
            .await
            .map_err(|e| format!("Failed to delete index: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

    pub async fn delete_all_documents(&self, index_uid: &str) -> Result<TaskInfo, String> {
        let index = self.client.index(index_uid);
        let task = index
            .delete_all_documents()
            .await
            .map_err(|e| format!("Failed to delete all documents: {}", e))?;
        
        Ok(self.convert_task_info(task))
    }

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
