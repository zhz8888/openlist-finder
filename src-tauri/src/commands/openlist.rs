use crate::models::openlist::*;
use crate::services::openlist::OpenListService;

#[tauri::command]
pub async fn login_to_openlist(url: String, username: String, password: String, otp_code: Option<String>) -> Result<String, String> {
    let service = OpenListService::new();
    service.login(&url, &username, &password, otp_code).await
}

#[tauri::command]
pub async fn test_openlist_connection(url: String, token: String) -> Result<ServerTestResult, String> {
    let service = OpenListService::new();
    service.test_connection(&url, &token).await
}

#[tauri::command]
pub async fn list_directory(url: String, token: String, path: String) -> Result<FileListResponse, String> {
    let service = OpenListService::new();
    service.list_directory(&url, &token, &path).await
}

#[tauri::command]
pub async fn rename_file(url: String, token: String, dir: String, old_name: String, new_name: String) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.rename(&url, &token, &dir, &old_name, &new_name).await
}

#[tauri::command]
pub async fn delete_files(url: String, token: String, dir: String, names: Vec<String>) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.delete(&url, &token, &dir, names).await
}

#[tauri::command]
pub async fn copy_files(url: String, token: String, src_dir: String, dst_dir: String, names: Vec<String>) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.copy(&url, &token, &src_dir, &dst_dir, names).await
}

#[tauri::command]
pub async fn move_files(url: String, token: String, src_dir: String, dst_dir: String, names: Vec<String>) -> Result<FileOperationResult, String> {
    let service = OpenListService::new();
    service.move_files(&url, &token, &src_dir, &dst_dir, names).await
}

#[tauri::command]
pub async fn get_file_info(url: String, token: String, path: String) -> Result<FileInfo, String> {
    let service = OpenListService::new();
    service.get_file_info(&url, &token, &path).await
}
