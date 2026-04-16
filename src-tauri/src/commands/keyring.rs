use keyring::Entry;
use rand::Rng;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "openlist-finder";
const KEYRING_USER: &str = "encryption-key";

fn get_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| format!("创建密钥链条目失败: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyringResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn keyring_get_key() -> Result<KeyringResult, String> {
    let entry = get_entry()?;
    match entry.get_password() {
        Ok(password) => Ok(KeyringResult {
            success: true,
            data: Some(password),
            error: None,
        }),
        Err(keyring::Error::NoEntry) => Ok(KeyringResult {
            success: true,
            data: None,
            error: None,
        }),
        Err(e) => Err(format!("获取密钥失败: {}", e)),
    }
}

#[tauri::command]
pub fn keyring_set_key(key: String) -> Result<KeyringResult, String> {
    let entry = get_entry()?;
    entry
        .set_password(&key)
        .map_err(|e| format!("设置密钥失败: {}", e))?;
    Ok(KeyringResult {
        success: true,
        data: None,
        error: None,
    })
}

#[tauri::command]
pub fn keyring_delete_key() -> Result<KeyringResult, String> {
    let entry = get_entry()?;
    entry
        .delete_credential()
        .map_err(|e| format!("删除密钥失败: {}", e))?;
    Ok(KeyringResult {
        success: true,
        data: None,
        error: None,
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

    let entry = get_entry()?;
    entry
        .set_password(&key)
        .map_err(|e| format!("保存生成的密钥失败: {}", e))?;

    Ok(KeyringResult {
        success: true,
        data: Some(key),
        error: None,
    })
}
