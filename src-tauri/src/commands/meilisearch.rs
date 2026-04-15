use crate::models::meilisearch::*;
use crate::services::meilisearch::MeilisearchService;

#[tauri::command]
pub async fn test_meilisearch_connection(host: String, api_key: String) -> Result<bool, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.test_connection().await
}

#[tauri::command]
pub async fn meilisearch_create_index(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.create_or_update_index(&index_uid).await
}

#[tauri::command]
pub async fn meilisearch_add_documents(host: String, api_key: String, index_uid: String, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.add_documents(&index_uid, docs).await
}

#[tauri::command]
pub async fn meilisearch_search(host: String, api_key: String, index_uid: String, query: String, limit: Option<i64>, offset: Option<i64>) -> Result<SearchResult, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.search(&index_uid, &query, limit.map(|l| l as usize), offset.map(|o| o as usize)).await
}

#[tauri::command]
pub async fn meilisearch_get_stats(host: String, api_key: String, index_uid: String) -> Result<IndexStats, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.get_index_stats(&index_uid).await
}

#[tauri::command]
pub async fn meilisearch_update_filterable(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.update_filterable_attributes(&index_uid).await
}

#[tauri::command]
pub async fn meilisearch_delete_index(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.delete_index(&index_uid).await
}

#[tauri::command]
pub async fn meilisearch_delete_all_documents(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.delete_all_documents(&index_uid).await
}

#[tauri::command]
pub async fn meilisearch_get_task_status(host: String, api_key: String, task_uid: i64) -> Result<String, String> {
    let service = MeilisearchService::new(&host, &api_key);
    service.get_task_status(task_uid).await
}
