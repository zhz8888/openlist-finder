//! 密钥环管理模块
//!
//! 本模块提供安全的密钥存储和检索功能,用于管理加密密钥。采用双层策略:
//! 优先使用系统密钥链(如 macOS Keychain、Windows Credential Manager),
//! 当系统密钥链不可用时自动降级到文件存储方案。
//!
//! 主要功能:
//! - 系统密钥链集成(通过 keyring crate)
//! - 文件存储降级方案
//! - 密钥自动生成(64位随机字符串)
//! - 密钥的增删查操作
//!
//! # 安全说明
//!
//! - 系统密钥链提供操作系统级别的安全保护
//! - 降级方案将密钥存储在本地文件中,安全性较低
//! - 建议在生产环境中优先使用系统密钥链

use keyring::Entry;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 系统密钥链服务名称
const KEYRING_SERVICE: &str = "openlist-finder";

/// 系统密钥链用户标识
const KEYRING_USER: &str = "encryption-key";

/// 获取系统密钥链条目
///
/// 创建一个指向指定服务和用户的密钥链条目引用。
///
/// # 返回值
///
/// 成功时返回 `Entry` 实例,失败时返回错误信息
fn get_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| format!("创建密钥链条目失败: {}", e))
}

/// 获取降级方案的密钥文件路径
///
/// 返回本地应用数据目录下的 `openlist-finder/encryption.key` 文件路径。
/// 如果目录不存在,会自动创建。
///
/// # 返回值
///
/// 成功时返回密钥文件的绝对路径,失败时返回错误信息
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

/// 从降级方案文件中读取密钥
///
/// 读取 `encryption.key` 文件内容并去除空白字符。
///
/// # 返回值
///
/// - `Ok(Some(key))`: 成功读取密钥
/// - `Ok(None)`: 密钥文件不存在
/// - `Err(...)`: 读取失败
fn read_fallback_key() -> Result<Option<String>, String> {
    let path = get_fallback_path()?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取密钥文件失败: {}", e))?;
        // 去除可能的空白字符(换行符、空格等)
        let trimmed = content.trim().to_string();
        eprintln!("[Keyring] 从降级方案读取密钥,长度: {}", trimmed.len());
        Ok(Some(trimmed))
    } else {
        eprintln!("[Keyring] 降级方案密钥文件不存在");
        Ok(None)
    }
}

/// 将密钥写入降级方案文件
///
/// 将密钥字符串写入 `encryption.key` 文件。
///
/// # 参数
///
/// * `key` - 要存储的密钥字符串
fn write_fallback_key(key: &str) -> Result<(), String> {
    let path = get_fallback_path()?;
    fs::write(&path, key)
        .map_err(|e| format!("写入密钥文件失败: {}", e))?;
    eprintln!("[Keyring] 密钥已写入降级方案文件,长度: {}", key.len());
    Ok(())
}

/// 删除降级方案密钥文件
///
/// 从文件系统中移除 `encryption.key` 文件(如果存在)。
fn delete_fallback_key() -> Result<(), String> {
    let path = get_fallback_path()?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("删除密钥文件失败: {}", e))?;
    }
    Ok(())
}

/// 密钥环操作结果结构体
///
/// 包含操作是否成功、返回数据、错误信息以及是否使用了降级方案。
#[derive(Debug, Serialize, Deserialize)]
pub struct KeyringResult {
    /// 操作是否成功
    pub success: bool,
    
    /// 返回的数据(如获取到的密钥或生成的密钥)
    pub data: Option<String>,
    
    /// 错误信息(操作失败时)
    pub error: Option<String>,
    
    /// 是否使用了降级方案(文件存储而非系统密钥链)
    pub fallback_used: bool,
}

/// 获取密钥
///
/// 尝试从系统密钥链获取密钥。如果系统密钥链不可用或没有条目,
/// 则自动降级到文件存储方案。
///
/// # 返回值
///
/// 成功时返回 `KeyringResult`,包含获取到的密钥(如果有)。
/// 如果系统密钥链和降级方案都失败,返回错误。
#[tauri::command]
pub fn keyring_get_key() -> Result<KeyringResult, String> {
    // 首先尝试从系统密钥链获取
    match get_entry() {
        Ok(entry) => {
            match entry.get_password() {
                Ok(password) => {
                    eprintln!("[Keyring] 从系统密钥链成功获取密钥");
                    Ok(KeyringResult {
                        success: true,
                        data: Some(password),
                        error: None,
                        fallback_used: false,
                    })
                }
                Err(keyring::Error::NoEntry) => {
                    eprintln!("[Keyring] 系统密钥链中无条目，尝试降级方案");
                    // 系统密钥链中没有条目，尝试 fallback
                    match read_fallback_key() {
                        Ok(Some(key)) => {
                            eprintln!("[Keyring] 从降级方案成功获取密钥");
                            Ok(KeyringResult {
                                success: true,
                                data: Some(key),
                                error: None,
                                fallback_used: true,
                            })
                        }
                        Ok(None) => {
                            eprintln!("[Keyring] 降级方案中也无密钥");
                            Ok(KeyringResult {
                                success: true,
                                data: None,
                                error: None,
                                fallback_used: true,
                            })
                        }
                        Err(fallback_err) => {
                            eprintln!("[Keyring] 降级方案读取失败: {}", fallback_err);
                            Err(format!("获取密钥失败，降级方案也失败: {}", fallback_err))
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Keyring] 系统密钥链不可用: {}，尝试降级方案", e);
                    match read_fallback_key() {
                        Ok(Some(key)) => {
                            eprintln!("[Keyring] 从降级方案成功获取密钥");
                            Ok(KeyringResult {
                                success: true,
                                data: Some(key),
                                error: None,
                                fallback_used: true,
                            })
                        }
                        Ok(None) => {
                            eprintln!("[Keyring] 降级方案中也无密钥");
                            Ok(KeyringResult {
                                success: true,
                                data: None,
                                error: None,
                                fallback_used: true,
                            })
                        }
                        Err(fallback_err) => {
                            eprintln!("[Keyring] 降级方案读取失败: {}", fallback_err);
                            Err(format!("获取密钥失败，降级方案也失败: {} (原始错误: {})", fallback_err, e))
                        }
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("[Keyring] 创建密钥链条目失败: {}，尝试降级方案", e);
            match read_fallback_key() {
                Ok(Some(key)) => {
                    eprintln!("[Keyring] 从降级方案成功获取密钥");
                    Ok(KeyringResult {
                        success: true,
                        data: Some(key),
                        error: None,
                        fallback_used: true,
                    })
                }
                Ok(None) => {
                    eprintln!("[Keyring] 降级方案中也无密钥");
                    Ok(KeyringResult {
                        success: true,
                        data: None,
                        error: None,
                        fallback_used: true,
                    })
                }
                Err(fallback_err) => {
                    eprintln!("[Keyring] 降级方案读取失败: {}", fallback_err);
                    Err(format!("获取密钥失败，降级方案也失败: {} (原始错误: {})", fallback_err, e))
                }
            }
        }
    }
}

/// 设置密钥
///
/// 将提供的密钥存储到系统密钥链中。如果系统密钥链不可用,
/// 则自动降级到文件存储方案。
///
/// # 参数
///
/// * `key` - 要存储的密钥字符串
///
/// # 返回值
///
/// 成功时返回 `KeyringResult`,指示是否使用了降级方案
#[tauri::command]
pub fn keyring_set_key(key: String) -> Result<KeyringResult, String> {
    eprintln!("[Keyring] 开始设置密钥，长度: {}", key.len());
    eprintln!("[Keyring] 密钥前缀: {}...", &key[..8.min(key.len())]);
    
    match get_entry() {
        Ok(entry) => {
            match entry.set_password(&key) {
                Ok(()) => {
                    eprintln!("[Keyring] 密钥已成功写入系统密钥链");
                    Ok(KeyringResult {
                        success: true,
                        data: None,
                        error: None,
                        fallback_used: false,
                    })
                }
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

/// 删除密钥
///
/// 从系统密钥链和降级方案文件中删除密钥。会尝试删除两个位置的密钥,
/// 即使其中一个删除失败也会继续尝试另一个。
///
/// # 返回值
///
/// 成功时返回 `KeyringResult`。如果两个位置都删除失败,返回错误
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

/// 生成并存储新密钥
///
/// 自动生成一个 64 位的随机字符串(包含大小写字母和数字),
/// 并将其存储到系统密钥链或降级方案文件中。
///
/// # 返回值
///
/// 成功时返回 `KeyringResult`,包含生成的密钥和是否使用了降级方案
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
