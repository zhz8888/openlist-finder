//! OpenList 命令模块
//!
//! 本模块提供与 OpenList 服务器交互的 Tauri 命令。这些命令作为前端与后端服务层
//! 之间的桥梁,处理用户认证、文件浏览、文件操作等请求。
//!
//! 主要功能:
//! - 用户登录认证
//! - 服务器连接测试
//! - 目录浏览和文件列表获取
//! - 文件重命名、删除、复制、移动操作
//! - 文件详情查询

use crate::models::openlist::*;
use crate::services::openlist::OpenListService;

/// 登录到 OpenList 服务器
///
/// 使用提供的用户名和密码进行认证,获取访问令牌。支持可选的 OTP 验证码
/// (用于双因素认证场景)。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `username` - 用户名
/// * `password` - 密码
/// * `otp_code` - 可选的 OTP 验证码(用于双因素认证)
///
/// # 返回值
///
/// 成功时返回访问令牌字符串,失败时返回错误信息
#[tauri::command]
pub async fn login_to_openlist(url: String, username: String, password: String, otp_code: Option<String>) -> Result<String, String> {
    let service = OpenListService::new();
    service.login(&url, &username, &password, otp_code).await
}

/// 测试 OpenList 服务器连接
///
/// 验证提供的服务器地址和访问令牌是否有效,并返回服务器测试结果。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
///
/// # 返回值
///
/// 成功时返回 `ServerTestResult` 包含连接状态和服务器信息,失败时返回错误信息
#[tauri::command]
pub async fn test_openlist_connection(url: String, token: String) -> Result<ServerTestResult, String> {
    let service = OpenListService::new();
    service.test_connection(&url, &token).await
}

/// 列出目录内容
///
/// 获取指定路径下的文件和文件夹列表。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `path` - 要列出的目录路径
///
/// # 返回值
///
/// 成功时返回 `FileListResponse` 包含文件列表,失败时返回错误信息
#[tauri::command]
pub async fn list_directory(url: String, token: String, path: String) -> Result<FileListResponse, String> {
    let service = OpenListService::new();
    service.list_directory(&url, &token, &path).await
}

/// 重命名文件
///
/// 将指定目录中的文件从旧名称重命名为新名称。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `request` - 重命名请求,包含目录路径、旧名称和新名称
///
/// # 返回值
///
/// 成功时返回 `FileOperationResult` 包含操作结果,失败时返回错误信息
#[tauri::command]
pub async fn rename_file(url: String, token: String, request: RenameRequest) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.rename(&url, &token, &request.dir, &request.old_name, &request.new_name).await
}

/// 删除文件
///
/// 批量删除指定目录中的一个或多个文件。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `dir` - 文件所在目录路径
/// * `names` - 要删除的文件名列表
///
/// # 返回值
///
/// 成功时返回 `FileOperationResult` 包含操作结果,失败时返回错误信息
#[tauri::command]
pub async fn delete_files(url: String, token: String, dir: String, names: Vec<String>) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.delete(&url, &token, &dir, names).await
}

/// 复制文件
///
/// 将一个或多个文件从源目录复制到目标目录。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `request` - 复制请求,包含源目录、目标目录和文件名列表
///
/// # 返回值
///
/// 成功时返回 `FileOperationResult` 包含操作结果,失败时返回错误信息
#[tauri::command]
pub async fn copy_files(url: String, token: String, request: CopyMoveRequest) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.copy(&url, &token, &request.src_dir, &request.dst_dir, request.names).await
}

/// 移动文件
///
/// 将一个或多个文件从源目录移动到目标目录。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `request` - 移动请求,包含源目录、目标目录和文件名列表
///
/// # 返回值
///
/// 成功时返回 `FileOperationResult` 包含操作结果,失败时返回错误信息
#[tauri::command]
pub async fn move_files(url: String, token: String, request: CopyMoveRequest) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.move_files(&url, &token, &request.src_dir, &request.dst_dir, request.names).await
}

/// 获取文件信息
///
/// 获取指定路径下文件的详细信息,包括文件大小、修改时间、类型等元数据。
///
/// # 参数
///
/// * `url` - OpenList 服务器地址
/// * `token` - 访问令牌
/// * `path` - 文件路径
///
/// # 返回值
///
/// 成功时返回 `FileInfo` 包含文件详细信息,失败时返回错误信息
#[tauri::command]
pub async fn get_file_info(url: String, token: String, path: String) -> Result<FileInfo, String> {
    let service = OpenListService::new();
    service.get_file_info(&url, &token, &path).await
}
