use keyring::Entry;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "openlist-finder";
const KEYRING_USER: &str = "encryption-key";

fn get_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| format!("创建密钥链条目失败: {}", e))
}

fn get_fallback_path() -> Result<PathBuf, String> {
    let app_data_dir = dirs::data_local_dir()
        .ok_or_else(|| "无法获取应用数据目录".to_string())?
        .join("openlist-finder");
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    
    Ok(app_data_dir.join("encryption.key"))
}

fn read_fallback_key() -> Result<Option<String>, String> {
    let path = get_fallback_path()?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取密钥文件失败: {}", e))?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

fn write_fallback_key(key: &str) -> Result<(), String> {
    let path = get_fallback_path()?;
    fs::write(&path, key)
        .map_err(|e| format!("写入密钥文件失败: {}", e))?;
    Ok(())
}

fn delete_fallback_key() -> Result<(), String> {
    let path = get_fallback_path()?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("删除密钥文件失败: {}", e))?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyringResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
    pub fallback_used: bool,
}

#[tauri::command]
pub fn keyring_get_key() -> Result<KeyringResult, String> {
    match get_entry() {
        Ok(entry) => {
            match entry.get_password() {
                Ok(password) => Ok(KeyringResult {
                    success: true,
                    data: Some(password),
                    error: None,
                    fallback_used: false,
                }),
                Err(keyring::Error::NoEntry) => Ok(KeyringResult {
                    success: true,
                    data: None,
                    error: None,
                    fallback_used: false,
                }),
                Err(e) => {
                    eprintln!("[Keyring] 系统密钥链不可用: {}，尝试降级方案", e);
                    match read_fallback_key() {
                        Ok(Some(key)) => Ok(KeyringResult {
                            success: true,
                            data: Some(key),
                            error: None,
                            fallback_used: true,
                        }),
                        Ok(None) => Ok(KeyringResult {
                            success: true,
                            data: None,
                            error: None,
                            fallback_used: true,
                        }),
                        Err(fallback_err) => Err(format!("获取密钥失败，降级方案也失败: {} (原始错误: {})", fallback_err, e)),
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("[Keyring] 创建密钥链条目失败: {}，尝试降级方案", e);
            match read_fallback_key() {
                Ok(Some(key)) => Ok(KeyringResult {
                    success: true,
                    data: Some(key),
                    error: None,
                    fallback_used: true,
                }),
                Ok(None) => Ok(KeyringResult {
                    success: true,
                    data: None,
                    error: None,
                    fallback_used: true,
                }),
                Err(fallback_err) => Err(format!("获取密钥失败，降级方案也失败: {} (原始错误: {})", fallback_err, e)),
            }
        }
    }
}

#[tauri::command]
pub fn keyring_set_key(key: String) -> Result<KeyringResult, String> {
    match get_entry() {
        Ok(entry) => {
            match entry.set_password(&key) {
                Ok(()) => Ok(KeyringResult {
                    success: true,
                    data: None,
                    error: None,
                    fallback_used: false,
                }),
                Err(e) => {
                    eprintln!("[Keyring] 系统密钥链写入失败: {}，使用降级方案", e);
                    write_fallback_key(&key)?;
                    Ok(KeyringResult {
                        success: true,
                        data: None,
                        error: None,
                        fallback_used: true,
                    })
                }
            }
        }
        Err(e) => {
            eprintln!("[Keyring] 创建密钥链条目失败: {}，使用降级方案", e);
            write_fallback_key(&key)?;
            Ok(KeyringResult {
                success: true,
                data: None,
                error: None,
                fallback_used: true,
            })
        }
    }
}

#[tauri::command]
pub fn keyring_delete_key() -> Result<KeyringResult, String> {
    let mut keyring_deleted = false;
    let mut fallback_deleted = false;

    if let Ok(entry) = get_entry() {
        if entry.delete_credential().is_ok() {
            keyring_deleted = true;
        }
    }

    if delete_fallback_key().is_ok() {
        fallback_deleted = true;
    }

    if !keyring_deleted && !fallback_deleted {
        return Err("删除密钥失败".to_string());
    }

    Ok(KeyringResult {
        success: true,
        data: None,
        error: None,
        fallback_used: !keyring_deleted,
    })
}

#[tauri::command]
pub fn keyring_generate_key() -> Result<KeyringResult, String> {
    let mut rng = rand::thread_rng();
    let key: String = (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..62);
            match idx {
                0..=25 => (b'a' + idx) as char,
                26..=51 => (b'A' + idx - 26) as char,
                _ => (b'0' + idx - 52) as char,
            }
        })
        .collect();

    match get_entry() {
        Ok(entry) => {
            match entry.set_password(&key) {
                Ok(()) => Ok(KeyringResult {
                    success: true,
                    data: Some(key),
                    error: None,
                    fallback_used: false,
                }),
                Err(e) => {
                    eprintln!("[Keyring] 系统密钥链写入失败: {}，使用降级方案", e);
                    write_fallback_key(&key)?;
                    Ok(KeyringResult {
                        success: true,
                        data: Some(key),
                        error: None,
                        fallback_used: true,
                    })
                }
            }
        }
        Err(e) => {
            eprintln!("[Keyring] 创建密钥链条目失败: {}，使用降级方案", e);
            write_fallback_key(&key)?;
            Ok(KeyringResult {
                success: true,
                data: Some(key),
                error: None,
                fallback_used: true,
            })
        }
    }
}
