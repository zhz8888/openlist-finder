use serde::{Deserialize, Serialize};
use std::sync::{Mutex, Arc};
use chrono::Local;
use tracing::{Event, Subscriber, Level};
use tracing_subscriber::layer::{Context, Layer};

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

    pub fn get_log_manager(&self) -> Arc<Mutex<Vec<LogEntry>>> {
        self.logs.clone()
    }
}

pub struct LogManagerLayer {
    logs: Arc<Mutex<Vec<LogEntry>>>,
    max_logs: usize,
}

impl LogManagerLayer {
    pub fn new(logs: Arc<Mutex<Vec<LogEntry>>>, max_logs: usize) -> Self {
        Self { logs, max_logs }
    }

    fn add_log(&self, level: &str, target: &str, message: &str) {
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
}

impl<S> Layer<S> for LogManagerLayer
where
    S: Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let level = match *event.metadata().level() {
            Level::TRACE => "TRACE",
            Level::DEBUG => "DEBUG",
            Level::INFO => "INFO",
            Level::WARN => "WARN",
            Level::ERROR => "ERROR",
        };

        let target = event.metadata().target().to_string();
        
        let mut visitor = JsonVisitor::new();
        event.record(&mut visitor);
        let message = visitor.message.unwrap_or_else(|| event.metadata().name().to_string());

        self.add_log(level, &target, &message);
    }
}

struct JsonVisitor {
    message: Option<String>,
}

impl JsonVisitor {
    fn new() -> Self {
        Self { message: None }
    }
}

impl tracing::field::Visit for JsonVisitor {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if self.message.is_none() {
            self.message = Some(format!("{}: {}", field.name(), value));
        } else {
            self.message = Some(format!("{} {}: {}", self.message.as_ref().unwrap(), field.name(), value));
        }
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if self.message.is_none() {
            self.message = Some(format!("{}: {:?}", field.name(), value));
        } else {
            self.message = Some(format!("{} {}: {:?}", self.message.as_ref().unwrap(), field.name(), value));
        }
    }
}
