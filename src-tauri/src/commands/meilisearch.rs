use crate::models::meilisearch::*;
use crate::services::meilisearch::MeilisearchService;

#[tauri::command]
pub async fn test_meilisearch_connection(host: String, api_key: String) -> Result<bool, String> {
    let service = MeilisearchService::new();
    service.test_connection(&host, &api_key).await
}

#[tauri::command]
pub async fn meilisearch_create_index(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new();
    service.create_or_update_index(&host, &api_key, &index_uid).await
}

#[tauri::command]
pub async fn meilisearch_add_documents(host: String, api_key: String, index_uid: String, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new();
    service.add_documents(&host, &api_key, &index_uid, docs).await
}

#[tauri::command]
pub async fn meilisearch_search(host: String, api_key: String, index_uid: String, query: String, limit: Option<i64>, offset: Option<i64>) -> Result<SearchResult, String> {
    let service = MeilisearchService::new();
    service.search(&host, &api_key, &index_uid, &query, limit, offset).await
}

#[tauri::command]
pub async fn meilisearch_get_stats(host: String, api_key: String, index_uid: String) -> Result<IndexStats, String> {
    let service = MeilisearchService::new();
    service.get_index_stats(&host, &api_key, &index_uid).await
}

#[tauri::command]
pub async fn meilisearch_update_filterable(host: String, api_key: String, index_uid: String) -> Result<TaskInfo, String> {
    let service = MeilisearchService::new();
    service.update_filterable_attributes(&host, &api_key, &index_uid).await
}
