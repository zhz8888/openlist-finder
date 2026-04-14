use crate::models::openlist::*;

pub struct OpenListService {
    client: reqwest::Client,
}

impl OpenListService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn test_connection(&self, url: &str, token: &str) -> Result<ServerTestResult, String> {
        let response = self.client
            .get(format!("{}/api/public/settings", url.trim_end_matches('/')))
            .header("Authorization", token)
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if response.status().is_success() {
            Ok(ServerTestResult {
                success: true,
                message: "Connection successful".to_string(),
                version: None,
            })
        } else {
            Ok(ServerTestResult {
                success: false,
                message: format!("Server returned status: {}", response.status()),
                version: None,
            })
        }
    }

    pub async fn list_directory(&self, url: &str, token: &str, path: &str) -> Result<FileListResponse, String> {
        let api_path = format!("{}/api/fs/list", url.trim_end_matches('/'));
        let response = self.client
            .get(&api_path)
            .query(&[("path", path)])
            .header("Authorization", token)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Server returned status: {}", response.status()));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        if code != 200 {
            let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
            return Err(message.to_string());
        }

        let content = data.get("data").and_then(|d| d.get("content"))
            .cloned()
            .unwrap_or(serde_json::Value::Array(vec![]));

        let files: Vec<FileInfo> = serde_json::from_value(content).unwrap_or_default();
        let total = data.get("data").and_then(|d| d.get("total")).and_then(|t| t.as_i64()).unwrap_or(0);

        Ok(FileListResponse {
            content: files,
            total,
            path: path.to_string(),
        })
    }

    pub async fn rename(&self, url: &str, token: &str, dir: &str, old_name: &str, new_name: &str) -> Result<FileOperationResult, String> {
        let api_path = format!("{}/api/fs/rename", url.trim_end_matches('/'));
        let body = serde_json::json!({
            "dir": dir,
            "old_name": old_name,
            "new_name": new_name,
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        self.parse_operation_response(response).await
    }

    pub async fn delete(&self, url: &str, token: &str, dir: &str, names: Vec<String>) -> Result<FileOperationResult, String> {
        let api_path = format!("{}/api/fs/remove", url.trim_end_matches('/'));
        let body = serde_json::json!({
            "dir": dir,
            "names": names,
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        self.parse_operation_response(response).await
    }

    pub async fn copy(&self, url: &str, token: &str, src_dir: &str, dst_dir: &str, names: Vec<String>) -> Result<FileOperationResult, String> {
        let api_path = format!("{}/api/fs/copy", url.trim_end_matches('/'));
        let body = serde_json::json!({
            "src_dir": src_dir,
            "dst_dir": dst_dir,
            "names": names,
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        self.parse_operation_response(response).await
    }

    pub async fn move_files(&self, url: &str, token: &str, src_dir: &str, dst_dir: &str, names: Vec<String>) -> Result<FileOperationResult, String> {
        let api_path = format!("{}/api/fs/move", url.trim_end_matches('/'));
        let body = serde_json::json!({
            "src_dir": src_dir,
            "dst_dir": dst_dir,
            "names": names,
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        self.parse_operation_response(response).await
    }

    pub async fn get_file_info(&self, url: &str, token: &str, path: &str) -> Result<FileInfo, String> {
        let api_path = format!("{}/api/fs/get", url.trim_end_matches('/'));
        let response = self.client
            .get(&api_path)
            .query(&[("path", path)])
            .header("Authorization", token)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Server returned status: {}", response.status()));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        if code != 200 {
            let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
            return Err(message.to_string());
        }

        let file_info: FileInfo = serde_json::from_value(
            data.get("data").cloned().ok_or("No data in response")?
        ).map_err(|e| format!("Parse error: {}", e))?;

        Ok(file_info)
    }

    async fn parse_operation_response(&self, response: reqwest::Response) -> Result<FileOperationResult, String> {
        if !response.status().is_success() {
            return Err(format!("Server returned status: {}", response.status()));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error").to_string();

        Ok(FileOperationResult {
            success: code == 200,
            message,
        })
    }
}
