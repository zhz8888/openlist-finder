use crate::models::meilisearch::*;

pub struct MeilisearchService {
    client: reqwest::Client,
}

impl MeilisearchService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn test_connection(&self, host: &str, api_key: &str) -> Result<bool, String> {
        let url = format!("{}/health", host.trim_end_matches('/'));
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        Ok(response.status().is_success())
    }

    pub async fn create_or_update_index(&self, host: &str, api_key: &str, index_uid: &str) -> Result<TaskInfo, String> {
        let url = format!("{}/indexes/{}", host.trim_end_matches('/'), index_uid);
        let body = serde_json::json!({
            "uid": index_uid,
            "primaryKey": "id"
        });

        let response = self.client
            .patch(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to create index: {} - {}", status, text));
        }

        response.json().await.map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn add_documents(&self, host: &str, api_key: &str, index_uid: &str, docs: Vec<MeilisearchDoc>) -> Result<TaskInfo, String> {
        let url = format!("{}/indexes/{}/documents", host.trim_end_matches('/'), index_uid);

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&docs)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to add documents: {} - {}", status, text));
        }

        response.json().await.map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn search(&self, host: &str, api_key: &str, index_uid: &str, query: &str, limit: Option<i64>, offset: Option<i64>) -> Result<SearchResult, String> {
        let url = format!("{}/indexes/{}/search", host.trim_end_matches('/'), index_uid);
        let body = serde_json::json!({
            "q": query,
            "limit": limit.unwrap_or(20),
            "offset": offset.unwrap_or(0),
        });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Search failed: {} - {}", status, text));
        }

        let raw: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;

        Ok(SearchResult {
            hits: serde_json::from_value(raw.get("hits").cloned().unwrap_or_default()).unwrap_or_default(),
            query: raw.get("query").and_then(|q| q.as_str()).unwrap_or("").to_string(),
            processing_time_ms: raw.get("processingTimeMs").and_then(|t| t.as_i64()).unwrap_or(0),
            limit: raw.get("limit").and_then(|l| l.as_i64()).unwrap_or(20),
            offset: raw.get("offset").and_then(|o| o.as_i64()).unwrap_or(0),
            estimated_total_hits: raw.get("estimatedTotalHits").and_then(|t| t.as_i64()).unwrap_or(0),
        })
    }

    pub async fn get_index_stats(&self, host: &str, api_key: &str, index_uid: &str) -> Result<IndexStats, String> {
        let url = format!("{}/indexes/{}/stats", host.trim_end_matches('/'), index_uid);

        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("Failed to get stats: {}", status));
        }

        response.json().await.map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn update_filterable_attributes(&self, host: &str, api_key: &str, index_uid: &str) -> Result<TaskInfo, String> {
        let url = format!("{}/indexes/{}/settings/filterable-attributes", host.trim_end_matches('/'), index_uid);
        let body = serde_json::json!(["name", "dir_path", "type", "is_dir", "server_id"]);

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to update settings: {} - {}", status, text));
        }

        response.json().await.map_err(|e| format!("Parse error: {}", e))
    }
}
