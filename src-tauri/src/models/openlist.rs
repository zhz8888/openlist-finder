use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub token: String,
    pub is_default: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub size: i64,
    pub modified: String,
    pub is_dir: bool,
    #[serde(rename = "type")]
    pub file_type: i32,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub sign: Option<String>,
    #[serde(default)]
    pub thumb: Option<String>,
    #[serde(default)]
    pub hash_info: Option<serde_json::Value>,
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListResponse {
    pub content: Vec<FileInfo>,
    pub total: i64,
    #[serde(default)]
    pub readme: Option<String>,
    #[serde(default)]
    pub header: Option<String>,
    #[serde(default)]
    pub write: Option<bool>,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub message: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyMoveRequest {
    pub src_dir: String,
    pub dst_dir: String,
    pub names: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameRequest {
    pub dir: String,
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerTestResult {
    pub success: bool,
    pub message: String,
    pub version: Option<String>,
}
