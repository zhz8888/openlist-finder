//! OpenList 服务层模块
//!
//! 封装与 OpenList 服务器的 HTTP 交互逻辑，提供文件操作的高级 API。
//! 所有方法都是异步的，使用 `reqwest` 客户端发送 HTTP 请求。

use crate::models::openlist::*;

/// OpenList 服务结构体
///
/// 封装与 OpenList 服务器的所有交互操作，包括认证、文件浏览、文件操作等。
/// 内部维护一个 `reqwest::Client` 实例用于 HTTP 请求。
pub struct OpenListService {
    /// HTTP 客户端实例
    client: reqwest::Client,
}

impl OpenListService {
    /// 创建新的 OpenListService 实例
    ///
    /// # 返回值
    /// 返回配置好的 OpenListService 实例
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    /// 登录到 OpenList 服务器
    ///
    /// 向 OpenList 服务器发送登录请求，获取认证令牌。
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `username` - 用户名
    /// * `password` - 密码
    /// * `otp_code` - 一次性密码（可选，用于双因素认证）
    ///
    /// # 返回值
    /// * `Ok(String)` - 认证成功令牌
    /// * `Err(String)` - 认证失败原因
    ///
    /// # API 端点
    /// `POST /api/auth/login`
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

    /// 测试与 OpenList 服务器的连接
    ///
    /// 通过调用 `/api/me` 接口验证服务器地址和认证令牌是否有效。
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    ///
    /// # 返回值
    /// * `Ok(ServerTestResult)` - 连接测试结果，包含成功状态和服务器版本
    /// * `Err(String)` - 连接失败原因
    ///
    /// # API 端点
    /// `GET /api/me`
    pub async fn test_connection(&self, url: &str, token: &str) -> Result<ServerTestResult, String> {
        let response = self.client
            .get(format!("{}/api/me", url.trim_end_matches('/')))
            .header("Authorization", token)
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if response.status().is_success() {
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

    /// 列出指定目录下的文件和子目录
    ///
    /// 调用 OpenList 的 `/api/fs/list` 接口获取目录内容。
    /// 自动为没有路径信息的文件构建完整路径。
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `path` - 要列出的目录路径
    ///
    /// # 返回值
    /// * `Ok(FileListResponse)` - 文件列表响应，包含文件信息和目录元数据
    /// * `Err(String)` - 请求失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/list`
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
        // 为没有路径信息的文件构建完整路径
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

    /// 重命名文件或目录
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `dir` - 文件所在目录路径
    /// * `old_name` - 原文件名
    /// * `new_name` - 新文件名
    ///
    /// # 返回值
    /// * `Ok(FileOperationResult)` - 操作结果
    /// * `Err(String)` - 操作失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/rename`
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

    /// 删除文件或目录
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `dir` - 文件所在目录路径
    /// * `names` - 要删除的文件名列表
    ///
    /// # 返回值
    /// * `Ok(FileOperationResult)` - 操作结果
    /// * `Err(String)` - 操作失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/remove`
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

    /// 复制文件或目录
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `src_dir` - 源目录路径
    /// * `dst_dir` - 目标目录路径
    /// * `names` - 要复制的文件名列表
    ///
    /// # 返回值
    /// * `Ok(FileOperationResult)` - 操作结果
    /// * `Err(String)` - 操作失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/copy`
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

    /// 移动文件或目录
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `src_dir` - 源目录路径
    /// * `dst_dir` - 目标目录路径
    /// * `names` - 要移动的文件名列表
    ///
    /// # 返回值
    /// * `Ok(FileOperationResult)` - 操作结果
    /// * `Err(String)` - 操作失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/move`
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

    /// 获取单个文件或目录的详细信息
    ///
    /// # 参数
    /// * `url` - OpenList 服务器地址
    /// * `token` - 认证令牌
    /// * `path` - 文件/目录的完整路径
    ///
    /// # 返回值
    /// * `Ok(FileInfo)` - 文件详细信息
    /// * `Err(String)` - 请求失败原因
    ///
    /// # API 端点
    /// `POST /api/fs/get`
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

    /// 解析文件操作响应
    ///
    /// 从 OpenList API 响应中提取操作结果，包括状态码和消息。
    ///
    /// # 参数
    /// * `response` - HTTP 响应对象
    ///
    /// # 返回值
    /// * `Ok(FileOperationResult)` - 操作结果
    /// * `Err(String)` - 解析失败或操作失败原因
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
