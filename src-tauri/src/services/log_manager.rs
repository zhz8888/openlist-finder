//! 日志管理服务模块
//!
//! 本模块提供应用级别的日志收集、查询和管理功能。通过内存缓存机制存储应用运行期间
//! 产生的日志条目,支持按级别过滤、分页查询和日志清理等操作。
//!
//! 主要功能:
//! - 日志条目的内存缓存管理
//! - 按日志级别过滤查询
//! - 分页查询支持
//! - 集成tracing框架作为Layer
//! - 自动清理过期日志(基于最大容量限制)

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer};

/// 日志条目结构体
///
/// 表示单条日志记录,包含时间戳、级别、目标模块和消息内容。
/// 该结构体实现了序列化和反序列化,可用于前后端数据传输。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// 日志时间戳,格式: "YYYY-MM-DD HH:MM:SS.mmm"
    pub timestamp: String,

    /// 日志级别,可选值: "TRACE", "DEBUG", "INFO", "WARN", "ERROR"
    pub level: String,

    /// 日志来源模块路径,如 "openlist_finder::services::openlist"
    pub target: String,

    /// 日志消息内容
    pub message: String,
}

/// 日志管理器
///
/// 负责管理内存中的日志缓存,提供日志的添加、查询、过滤和清理功能。
/// 使用 `Arc<Mutex<Vec<LogEntry>>>` 实现线程安全的日志存储。
///
/// # 示例
///
/// ```ignore
/// let log_manager = LogManager::new();
/// log_manager.add_log("INFO", "my_module", "Application started");
/// let logs = log_manager.get_logs(None, 0, 100);
/// ```
#[derive(Clone)]
pub struct LogManager {
    /// 日志条目缓存,使用Mutex保证线程安全,使用VecDeque实现O(1)的首尾操作
    logs: Arc<Mutex<VecDeque<LogEntry>>>,

    /// 最大日志条数限制,超出后自动移除最旧的日志
    max_logs: usize,
}

impl LogManager {
    /// 创建新的日志管理器实例
    ///
    /// 默认最大日志条数为 10000 条。当达到上限时,最旧的日志会被自动移除。
    ///
    /// # 返回值
    ///
    /// 返回初始化后的 `LogManager` 实例
    pub fn new() -> Self {
        Self {
            logs: Arc::new(Mutex::new(VecDeque::new())),
            max_logs: 10000,
        }
    }

    /// 添加一条日志记录
    ///
    /// 将新的日志条目添加到缓存中。如果当前日志数量已达到 `max_logs` 限制,
    /// 则自动移除最旧的一条日志(队列头部)。
    ///
    /// # 参数
    ///
    /// * `level` - 日志级别字符串,如 "INFO", "ERROR" 等
    /// * `target` - 日志来源模块路径
    /// * `message` - 日志消息内容
    pub fn add_log(&self, level: &str, target: &str, message: &str) {
        let mut logs = self.logs.lock().unwrap();

        // 达到容量上限时,使用 VecDeque::pop_front() O(1) 移除最旧的日志
        if logs.len() >= self.max_logs {
            logs.pop_front();
        }

        logs.push_back(LogEntry {
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
            level: level.to_string(),
            target: target.to_string(),
            message: message.to_string(),
        });
    }

    /// 获取日志列表(支持过滤和分页)
    ///
    /// 根据指定的日志级别过滤日志,并返回指定偏移量和限制的日志分页数据。
    ///
    /// # 参数
    ///
    /// * `level_filter` - 可选的日志级别过滤器,`None` 表示返回所有级别日志
    /// * `offset` - 分页偏移量,从第几条开始返回
    /// * `limit` - 分页限制,最多返回多少条日志
    ///
    /// # 返回值
    ///
    /// 返回过滤并分页后的日志条目向量
    pub fn get_logs(
        &self,
        level_filter: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Vec<LogEntry> {
        let logs = self.logs.lock().unwrap();

        // 根据级别过滤日志
        let filtered: Vec<LogEntry> = match level_filter {
            Some(level) => logs
                .iter()
                .filter(|log| log.level == level)
                .cloned()
                .collect(),
            None => logs.clone().into(),
        };

        // 计算分页范围
        let start = offset.min(filtered.len());
        let end = (offset + limit).min(filtered.len());

        filtered[start..end].to_vec()
    }

    /// 获取日志总数(支持按级别过滤)
    ///
    /// # 参数
    ///
    /// * `level_filter` - 可选的日志级别过滤器,`None` 表示统计所有级别
    ///
    /// # 返回值
    ///
    /// 返回符合条件的日志总数
    pub fn get_total_count(&self, level_filter: Option<&str>) -> usize {
        let logs = self.logs.lock().unwrap();

        match level_filter {
            Some(level) => logs.iter().filter(|log| log.level == level).count(),
            None => logs.len(),
        }
    }

    /// 清空所有日志
    ///
    /// 移除内存中缓存的所有日志条目,释放内存空间。
    pub fn clear_logs(&self) {
        let mut logs = self.logs.lock().unwrap();
        logs.clear();
    }

    /// 获取日志缓存的共享引用
    ///
    /// 返回 `Arc<Mutex<Vec<LogEntry>>>` 的克隆,允许其他组件(如 LogManagerLayer)
    /// 共享访问同一份日志缓存。
    ///
    /// # 返回值
    ///
    /// 返回日志缓存的共享引用
    pub fn get_log_manager(&self) -> Arc<Mutex<VecDeque<LogEntry>>> {
        self.logs.clone()
    }
}

/// 日志管理器 Layer
///
/// 实现 `tracing_subscriber::layer::Layer` trait,用于集成到 tracing 框架中。
/// 当应用产生日志事件时,该 Layer 会自动捕获并存储到 LogManager 的缓存中。
///
/// # 使用示例
///
/// ```ignore
/// use tracing_subscriber::prelude::*;
///
/// let log_manager = LogManager::new();
/// let layer = LogManagerLayer::new(log_manager.get_log_manager(), 10000);
///
/// tracing_subscriber::registry()
///     .with(layer)
///     .init();
/// ```
pub struct LogManagerLayer {
    /// 共享的日志缓存引用,使用 VecDeque 实现高效的队首操作
    logs: Arc<Mutex<VecDeque<LogEntry>>>,

    /// 最大日志条数限制
    max_logs: usize,
}

impl LogManagerLayer {
    /// 创建新的日志管理器 Layer
    ///
    /// # 参数
    ///
    /// * `logs` - 共享的日志缓存引用,通常从 LogManager 获取
    /// * `max_logs` - 最大日志条数限制
    ///
    /// # 返回值
    ///
    /// 返回初始化后的 `LogManagerLayer` 实例
    pub fn new(logs: Arc<Mutex<VecDeque<LogEntry>>>, max_logs: usize) -> Self {
        Self { logs, max_logs }
    }

    /// 添加日志记录到缓存
    ///
    /// 内部方法,用于将解析后的日志信息添加到缓存中。
    /// 当达到容量上限时,自动移除最旧的日志。
    ///
    /// # 参数
    ///
    /// * `level` - 日志级别字符串
    /// * `target` - 日志来源模块路径
    /// * `message` - 日志消息内容
    fn add_log(&self, level: &str, target: &str, message: &str) {
        let mut logs = self.logs.lock().unwrap();

        // 达到容量上限时,使用 VecDeque::pop_front() O(1) 移除最旧的日志
        if logs.len() >= self.max_logs {
            logs.pop_front();
        }

        logs.push_back(LogEntry {
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
            level: level.to_string(),
            target: target.to_string(),
            message: message.to_string(),
        });
    }
}

/// 实现 tracing Layer trait
///
/// 当事件发生时,该 Layer 会:
/// 1. 提取事件元数据(级别、目标模块)
/// 2. 使用 JsonVisitor 解析事件字段和消息
/// 3. 将解析后的日志信息添加到缓存中
impl<S> Layer<S> for LogManagerLayer
where
    S: Subscriber,
{
    /// 处理日志事件
    ///
    /// 当 tracing 框架产生事件时调用此方法。该方法会解析事件的级别、目标和消息内容,
    /// 并将其存储到日志缓存中。
    ///
    /// # 参数
    ///
    /// * `event` - 日志事件引用,包含事件的所有元数据和字段
    /// * `_ctx` - Layer 上下文,此处未使用
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        // 提取日志级别
        let level = match *event.metadata().level() {
            Level::TRACE => "TRACE",
            Level::DEBUG => "DEBUG",
            Level::INFO => "INFO",
            Level::WARN => "WARN",
            Level::ERROR => "ERROR",
        };

        // 提取目标模块
        let target = event.metadata().target().to_string();

        // 使用 JsonVisitor 解析事件消息
        let mut visitor = JsonVisitor::new();
        event.record(&mut visitor);
        let message = visitor
            .message
            .unwrap_or_else(|| event.metadata().name().to_string());

        // 添加到缓存
        self.add_log(level, &target, &message);
    }
}

/// JSON 字段访问器
///
/// 实现 `tracing::field::Visit` trait,用于解析 tracing 事件中的字段信息。
/// 该访问器会遍历事件的所有字段,并将它们格式化为可读的消息字符串。
struct JsonVisitor {
    /// 收集到的消息内容
    message: Option<String>,
}

impl JsonVisitor {
    /// 创建新的 JSON 字段访问器
    ///
    /// # 返回值
    ///
    /// 返回初始化后的 `JsonVisitor` 实例,初始消息为 `None`
    fn new() -> Self {
        Self { message: None }
    }
}

/// 实现 tracing 字段访问 trait
///
/// 该实现负责提取事件中的字符串和调试格式字段,并将它们拼接成完整的消息。
impl tracing::field::Visit for JsonVisitor {
    /// 记录字符串字段
    ///
    /// 当事件包含字符串类型的字段时调用。如果是第一个字段,直接存储;
    /// 否则将新字段追加到现有消息后面。
    ///
    /// # 参数
    ///
    /// * `field` - 字段元数据,包含字段名称
    /// * `value` - 字段的字符串值
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if self.message.is_none() {
            self.message = Some(format!("{}: {}", field.name(), value));
        } else {
            self.message = Some(format!(
                "{} {}: {}",
                self.message.as_ref().unwrap(),
                field.name(),
                value
            ));
        }
    }

    /// 记录调试格式字段
    ///
    /// 当事件包含非字符串类型的字段时调用。使用 `Debug` trait 格式化字段值,
    /// 并追加到现有消息中。
    ///
    /// # 参数
    ///
    /// * `field` - 字段元数据,包含字段名称
    /// * `value` - 字段的调试格式值
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if self.message.is_none() {
            self.message = Some(format!("{}: {:?}", field.name(), value));
        } else {
            self.message = Some(format!(
                "{} {}: {:?}",
                self.message.as_ref().unwrap(),
                field.name(),
                value
            ));
        }
    }
}
