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

    pub async fn login(&self, url: &str, username: &str, password: &str, otp_code: Option<String>) -> Result<String, String> {
        let api_path = format!("{}/api/auth/login", url.trim_end_matches('/'));
        let body = LoginRequest {
            username: username.to_string(),
            password: password.to_string(),
            otp_code,
        };

        let response = self.client
            .post(&api_path)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("登录请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("登录失败 (HTTP {}): {}", status, error_text));
        }

        let data: LoginResponse = response.json().await.map_err(|e| format!("解析登录响应失败: {}", e))?;
        
        if data.code != 200 {
            return Err(format!("登录失败: {}", data.message));
        }

        Ok(data.data.token)
    }

    pub async fn test_connection(&self, url: &str, token: &str) -> Result<ServerTestResult, String> {
        let response = self.client
            .get(format!("{}/api/me", url.trim_end_matches('/')))
            .header("Authorization", token)
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if response.status().is_success() {
            let status = response.status();
            let body: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
            let code = body.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
            
            if code == 200 {
                let version = body.get("data").and_then(|d| d.get("version")).and_then(|v| v.as_str()).map(|s| s.to_string());
                Ok(ServerTestResult {
                    success: true,
                    message: "Connection successful".to_string(),
                    version,
                })
            } else {
                let message = body.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
                Ok(ServerTestResult {
                    success: false,
                    message: message.to_string(),
                    version: None,
                })
            }
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
        let body = serde_json::json!({
            "path": path,
            "password": "",
            "page": 1,
            "per_page": 0,
            "refresh": false
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        if code != 200 {
            let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
            return Err(format!("OpenList API error (code {}): {}", code, message));
        }

        let content = data.get("data").and_then(|d| d.get("content"))
            .cloned()
            .unwrap_or(serde_json::Value::Array(vec![]));

        let mut files: Vec<FileInfo> = serde_json::from_value(content).unwrap_or_default();
        let base_path = path.trim_end_matches('/');
        for file in &mut files {
            if file.path.is_none() {
                file.path = Some(format!("{}/{}", base_path, file.name));
            }
        }
        let total = data.get("data").and_then(|d| d.get("total")).and_then(|t| t.as_i64()).unwrap_or(0);
        let readme = data.get("data").and_then(|d| d.get("readme")).and_then(|r| r.as_str()).map(|s| s.to_string());
        let header = data.get("data").and_then(|d| d.get("header")).and_then(|h| h.as_str()).map(|s| s.to_string());
        let write = data.get("data").and_then(|d| d.get("write")).and_then(|w| w.as_bool());
        let provider = data.get("data").and_then(|d| d.get("provider")).and_then(|p| p.as_str()).map(|s| s.to_string());

        Ok(FileListResponse {
            content: files,
            total,
            readme,
            header,
            write,
            provider,
        })
    }

    pub async fn rename(&self, url: &str, token: &str, dir: &str, old_name: &str, new_name: &str) -> Result<FileOperationResult, String> {
        let api_path = format!("{}/api/fs/rename", url.trim_end_matches('/'));
        let dir = dir.trim_end_matches('/');
        let source_path = format!("{}/{}", dir, old_name);
        let body = serde_json::json!({
            "path": source_path,
            "name": new_name,
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

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

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

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

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

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

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

        self.parse_operation_response(response).await
    }

    pub async fn get_file_info(&self, url: &str, token: &str, path: &str) -> Result<FileInfo, String> {
        let api_path = format!("{}/api/fs/get", url.trim_end_matches('/'));
        let body = serde_json::json!({
            "path": path,
            "password": "",
            "page": 1,
            "per_page": 0,
            "refresh": false
        });

        let response = self.client
            .post(&api_path)
            .header("Authorization", token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        if code != 200 {
            let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
            return Err(format!("OpenList API error (code {}): {}", code, message));
        }

        let file_info: FileInfo = serde_json::from_value(
            data.get("data").cloned().ok_or("No data in response")?
        ).map_err(|e| format!("Parse error: {}", e))?;

        Ok(file_info)
    }

    async fn parse_operation_response(&self, response: reqwest::Response) -> Result<FileOperationResult, String> {
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned HTTP {}: {}", status, error_text));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
        let code = data.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
        let message = data.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error").to_string();

        if code != 200 {
            return Err(format!("OpenList API error (code {}): {}", code, message));
        }

        Ok(FileOperationResult {
            success: code == 200,
            message,
        })
    }
}
