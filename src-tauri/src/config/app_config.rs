use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub servers: Vec<ServerEntry>,
    pub active_server_id: Option<String>,
    pub meilisearch: MeilisearchEntry,
    pub experimental: ExperimentalConfig,
    pub theme: ThemeConfigEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerEntry {
    pub id: String,
    pub name: String,
    pub url: String,
    pub token: String,
    pub is_default: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeilisearchEntry {
    pub host: String,
    pub api_key: String,
    pub index_prefix: String,
    pub sync_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentalConfig {
    pub meilisearch: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfigEntry {
    pub mode: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            servers: vec![],
            active_server_id: None,
            meilisearch: MeilisearchEntry {
                host: String::new(),
                api_key: String::new(),
                index_prefix: "openlist".to_string(),
                sync_strategy: "manual".to_string(),
            },
            experimental: ExperimentalConfig {
                meilisearch: false,
            },
            theme: ThemeConfigEntry {
                mode: "system".to_string(),
            },
        }
    }
}
