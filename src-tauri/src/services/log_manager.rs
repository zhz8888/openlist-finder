use serde::{Deserialize, Serialize};
use std::sync::{Mutex, Arc};
use chrono::Local;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct LogManager {
    logs: Arc<Mutex<Vec<LogEntry>>>,
    max_logs: usize,
}

impl LogManager {
    pub fn new() -> Self {
        Self {
            logs: Arc::new(Mutex::new(Vec::new())),
            max_logs: 10000,
        }
    }

    #[allow(dead_code)]
    pub fn add_log(&self, level: &str, target: &str, message: &str) {
        let mut logs = self.logs.lock().unwrap();
        
        if logs.len() >= self.max_logs {
            logs.remove(0);
        }

        logs.push(LogEntry {
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
            level: level.to_string(),
            target: target.to_string(),
            message: message.to_string(),
        });
    }

    pub fn get_logs(&self, level_filter: Option<&str>, offset: usize, limit: usize) -> Vec<LogEntry> {
        let logs = self.logs.lock().unwrap();
        
        let filtered: Vec<LogEntry> = match level_filter {
            Some(level) => logs.iter()
                .filter(|log| log.level == level)
                .cloned()
                .collect(),
            None => logs.clone(),
        };

        let start = offset.min(filtered.len());
        let end = (offset + limit).min(filtered.len());
        
        filtered[start..end].to_vec()
    }

    pub fn get_total_count(&self, level_filter: Option<&str>) -> usize {
        let logs = self.logs.lock().unwrap();
        
        match level_filter {
            Some(level) => logs.iter().filter(|log| log.level == level).count(),
            None => logs.len(),
        }
    }

    pub fn clear_logs(&self) {
        let mut logs = self.logs.lock().unwrap();
        logs.clear();
    }
}
