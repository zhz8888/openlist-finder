use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeilisearchConfig {
    pub host: String,
    pub api_key: String,
    pub index_prefix: String,
    pub sync_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeilisearchDoc {
    pub id: String,
    pub name: String,
    pub dir_path: String,
    pub size: i64,
    pub modified: String,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub is_dir: bool,
    pub server_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<MeilisearchDoc>,
    pub query: String,
    pub processing_time_ms: i64,
    pub limit: i64,
    pub offset: i64,
    pub estimated_total_hits: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub number_of_documents: i64,
    pub is_indexing: bool,
    pub field_distribution: HashMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub uid: i64,
    pub index_uid: String,
    pub status: String,
    #[serde(rename = "type")]
    pub task_type: String,
    pub enqueued_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSyncProgress {
    pub total: i64,
    pub indexed: i64,
    pub percentage: f64,
    pub is_running: bool,
}
