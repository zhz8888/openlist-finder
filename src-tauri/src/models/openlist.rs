//! OpenList 数据模型模块
//!
//! 定义与 OpenList API 交互所需的所有数据结构，包括请求、响应和实体模型。
//! 所有结构体都实现了 `Serialize` 和 `Deserialize` trait，用于 JSON 序列化/反序列化。

use serde::{Deserialize, Serialize};

/// 服务器配置结构体
///
/// 用于存储和管理 OpenList 服务器的连接信息。
/// 与前端 `ServerConfig` 类型对齐，支持多服务器管理和 MCP 集成。
///
/// # 字段说明
/// * `id` - 服务器唯一标识符（UUID）
/// * `name` - 服务器显示名称
/// * `url` - 服务器 API 地址（不含尾部斜杠）
/// * `token` - 认证令牌
/// * `created_at` - 创建时间（ISO 8601 格式）
/// * `username` - 用户名（预留，用于未来自动登录功能）
/// * `password` - 密码（预留，用于未来自动登录功能）
/// * `is_default` - 是否为默认服务器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// 服务器唯一标识符
    pub id: String,
    /// 服务器显示名称
    pub name: String,
    /// 服务器 API 地址
    pub url: String,
    /// 认证令牌
    pub token: String,
    /// 创建时间（ISO 8601 格式）
    #[serde(rename = "createdAt")]
    pub created_at: String,
    /// 用户名（预留，用于未来自动登录功能）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// 密码（预留，用于未来自动登录功能）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// 是否为默认服务器
    #[serde(default, rename = "isDefault")]
    pub is_default: bool,
}

/// OpenList 登录请求结构体
///
/// 用于向 OpenList 服务器发送登录请求。
///
/// # 字段说明
/// * `username` - 用户名
/// * `password` - 密码
/// * `otp_code` - 一次性密码（可选，用于双因素认证）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    /// 用户名
    pub username: String,
    /// 密码
    pub password: String,
    /// 一次性密码（可选，用于双因素认证）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub otp_code: Option<String>,
}

/// OpenList 登录响应结构体
///
/// OpenList API 返回的登录响应，包含状态码、消息和登录数据。
///
/// # 字段说明
/// * `code` - 响应状态码（200 表示成功）
/// * `message` - 响应消息
/// * `data` - 登录数据，包含认证令牌
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    /// 响应状态码（200 表示成功）
    pub code: i64,
    /// 响应消息
    pub message: String,
    /// 登录数据
    pub data: LoginData,
}

/// 登录数据结构体
///
/// 包含登录成功后返回的认证令牌。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginData {
    /// 认证令牌，用于后续 API 请求的身份验证
    pub token: String,
}

/// 文件信息结构体
///
/// 表示 OpenList 服务器上的单个文件或目录的元数据信息。
///
/// # 字段说明
/// * `name` - 文件/目录名称
/// * `size` - 文件大小（字节），目录通常为 0
/// * `modified` - 最后修改时间（ISO 8601 格式）
/// * `is_dir` - 是否为目录
/// * `file_type` - 文件类型标识（0=未知, 1=文件, 2=目录, 3=快捷方式等）
/// * `created` - 创建时间（可选）
/// * `sign` - 文件签名（用于下载验证）
/// * `thumb` - 缩略图 URL（图片/视频文件）
/// * `hash_info` - 文件哈希信息（JSON 对象）
/// * `path` - 文件完整路径
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// 文件/目录名称
    pub name: String,
    /// 文件大小（字节）
    pub size: i64,
    /// 最后修改时间
    pub modified: String,
    /// 是否为目录
    #[serde(rename(deserialize = "is_dir", serialize = "isDir"))]
    pub is_dir: bool,
    /// 文件类型标识
    #[serde(rename = "type")]
    pub file_type: i32,
    /// 创建时间（可选）
    #[serde(default)]
    pub created: Option<String>,
    /// 文件签名（用于下载验证）
    #[serde(default)]
    pub sign: Option<String>,
    /// 缩略图 URL
    #[serde(default)]
    pub thumb: Option<String>,
    /// 文件哈希信息
    #[serde(default)]
    pub hash_info: Option<serde_json::Value>,
    /// 文件完整路径
    #[serde(default)]
    pub path: Option<String>,
}

/// 文件列表响应结构体
///
/// OpenList `/api/fs/list` 接口返回的目录列表响应。
///
/// # 字段说明
/// * `content` - 文件/目录列表
/// * `total` - 总文件数（用于分页）
/// * `readme` - 目录 README 内容（可选）
/// * `header` - 目录头部信息（可选）
/// * `write` - 当前目录是否可写
/// * `provider` - 存储提供者类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListResponse {
    /// 文件/目录列表
    pub content: Vec<FileInfo>,
    /// 总文件数
    pub total: i64,
    /// 目录 README 内容
    #[serde(default)]
    pub readme: Option<String>,
    /// 目录头部信息
    #[serde(default)]
    pub header: Option<String>,
    /// 当前目录是否可写
    #[serde(default)]
    pub write: Option<bool>,
    /// 存储提供者类型
    #[serde(default)]
    pub provider: Option<String>,
}

/// 文件操作结果结构体
///
/// 表示文件操作（重命名、删除、复制、移动）的执行结果。
///
/// # 字段说明
/// * `success` - 操作是否成功
/// * `message` - 操作结果消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperationResult {
    /// 操作是否成功
    pub success: bool,
    /// 操作结果消息
    pub message: String,
}

/// 文件复制/移动请求结构体
///
/// 与前端 `CopyMoveRequest` 类型对齐，用于批量文件复制和移动操作。
///
/// # 字段说明
/// * `src_dir` - 源目录路径
/// * `dst_dir` - 目标目录路径
/// * `names` - 要操作的文件名列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyMoveRequest {
    /// 源目录路径
    #[serde(rename = "srcDir")]
    pub src_dir: String,
    /// 目标目录路径
    #[serde(rename = "dstDir")]
    pub dst_dir: String,
    /// 要操作的文件名列表
    pub names: Vec<String>,
}

/// 文件重命名请求结构体
///
/// 与前端 `RenameRequest` 类型对齐，用于文件重命名操作。
///
/// # 字段说明
/// * `dir` - 文件所在目录路径
/// * `old_name` - 原文件名
/// * `new_name` - 新文件名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameRequest {
    /// 文件所在目录路径
    pub dir: String,
    /// 原文件名
    #[serde(rename = "oldName")]
    pub old_name: String,
    /// 新文件名
    #[serde(rename = "newName")]
    pub new_name: String,
}

/// 服务器连接测试结果结构体
///
/// 表示 OpenList 服务器连接测试的结果。
///
/// # 字段说明
/// * `success` - 连接是否成功
/// * `message` - 连接结果消息
/// * `version` - 服务器版本号（连接成功时返回）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerTestResult {
    /// 连接是否成功
    pub success: bool,
    /// 连接结果消息
    pub message: String,
    /// 服务器版本号
    pub version: Option<String>,
}
