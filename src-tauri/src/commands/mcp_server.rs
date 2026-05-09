//! MCP (Model Context Protocol) 服务器模块
//!
//! 本模块实现 MCP 协议的 stdio 传输层服务器,允许 AI 助手通过标准输入/输出
//! 与 OpenList Finder 应用进行交互。支持文件浏览、搜索、文件操作等功能。
//!
//! 主要功能:
//! - JSON-RPC 2.0 协议支持
//! - MCP 工具定义和注册
//! - OpenList 文件操作(浏览、重命名、删除、复制、移动)
//! - Meilisearch 全文搜索
//! - 服务器配置管理
//!
//! # 协议流程
//!
//! 1. AI 助手发送 `initialize` 请求
//! 2. 服务器返回协议版本和能力声明
//! 3. AI 助手发送 `notifications/initialized` 通知
//! 4. AI 助手通过 `tools/list` 获取可用工具列表
//! 5. AI 助手通过 `tools/call` 调用具体工具

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead, Write};
use std::sync::{Arc, RwLock};
use crate::commands::openlist;
use crate::commands::meilisearch;
use crate::models::openlist::{CopyMoveRequest, RenameRequest, ServerConfig};

/// MCP 服务器配置类型别名
pub type McpServerConfig = Arc<RwLock<Vec<ServerConfig>>>;

/// JSON-RPC 请求结构体
///
/// 表示一个标准的 JSON-RPC 2.0 请求,包含协议版本、请求ID、方法名和参数。
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC 协议版本,固定为 "2.0"
    pub jsonrpc: String,
    
    /// 请求唯一标识符,用于匹配请求和响应。通知(no notification)可为 None
    pub id: Option<i64>,
    
    /// 要调用的方法名称
    pub method: String,
    
    /// 方法参数,可选
    pub params: Option<Value>,
}

/// JSON-RPC 响应结构体
///
/// 表示一个标准的 JSON-RPC 2.0 响应,包含成功结果或错误信息。
/// `result` 和 `error` 互斥,成功时 `result` 有值,失败时 `error` 有值。
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC 协议版本,固定为 "2.0"
    pub jsonrpc: String,
    
    /// 对应请求的ID
    pub id: Option<i64>,
    
    /// 成功时的返回结果
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    
    /// 失败时的错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 错误结构体
///
/// 包含错误码、错误消息和可选的附加数据。
/// 错误码遵循 JSON-RPC 2.0 规范:
/// - -32700: 解析错误
/// - -32600: 无效请求
/// - -32601: 方法未找到
/// - -32602: 无效参数
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    /// 错误码
    pub code: i64,
    
    /// 错误描述消息
    pub message: String,
    
    /// 可选的附加错误数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// MCP 工具定义结构体
///
/// 描述一个可供 AI 助手调用的工具,包含工具名称、描述和输入参数 schema。
#[derive(Debug, Serialize, Deserialize)]
pub struct McpTool {
    /// 工具名称,唯一标识
    pub name: String,
    
    /// 工具功能描述
    pub description: String,
    
    /// 输入参数的 JSON Schema,用于参数验证
    pub input_schema: Value,
}

/// MCP 服务器结构体
///
/// 提供 MCP 协议相关的静态方法,包括工具定义、请求处理等。
pub struct McpServer;

impl McpServer {
    /// 获取所有可用的 MCP 工具列表
    ///
    /// 返回定义的所有工具,包括:
    /// - `list_directory`: 列出目录内容
    /// - `search_files`: 搜索文件
    /// - `rename_file`: 重命名文件
    /// - `delete_files`: 删除文件
    /// - `copy_files`: 复制文件
    /// - `move_files`: 移动文件
    /// - `view_file`: 查看文件信息
    /// - `edit_file`: 编辑文件
    /// - `list_servers`: 列出服务器配置
    /// - `add_server`: 添加服务器
    /// - `remove_server`: 删除服务器
    /// - `sync_index`: 同步索引到 Meilisearch
    /// - `get_index_status`: 获取索引状态
    ///
    /// # 返回值
    ///
    /// 返回 `McpTool` 向量,包含所有可用工具的定义
    pub fn get_tools() -> Vec<McpTool> {
        let mut tools = vec![
            McpTool {
                name: "list_directory".to_string(),
                description: "List files and directories in a given path on an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string", "description": "The server ID" },
                        "path": { "type": "string", "description": "Directory path to list" }
                    },
                    "required": ["server_id", "path"]
                }),
            },
            McpTool {
                name: "search_files".to_string(),
                description: "Search files using Meilisearch".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string", "description": "Server ID for index name construction" },
                        "query": { "type": "string", "description": "Search query" },
                        "limit": { "type": "integer", "description": "Max results" },
                        "offset": { "type": "integer", "description": "Result offset" },
                        "index_prefix": { "type": "string", "description": "Index prefix (default: openlist)" }
                    },
                    "required": ["server_id", "query"]
                }),
            },
            McpTool {
                name: "rename_file".to_string(),
                description: "Rename a file or directory on an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "dir": { "type": "string", "description": "Parent directory" },
                        "old_name": { "type": "string" },
                        "new_name": { "type": "string" }
                    },
                    "required": ["server_id", "dir", "old_name", "new_name"]
                }),
            },
            McpTool {
                name: "delete_files".to_string(),
                description: "Delete files or directories on an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "dir": { "type": "string", "description": "Parent directory" },
                        "names": { "type": "array", "items": { "type": "string" }, "description": "Names to delete" }
                    },
                    "required": ["server_id", "dir", "names"]
                }),
            },
            McpTool {
                name: "copy_files".to_string(),
                description: "Copy files on an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "src_dir": { "type": "string" },
                        "dst_dir": { "type": "string" },
                        "names": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["server_id", "src_dir", "dst_dir", "names"]
                }),
            },
            McpTool {
                name: "move_files".to_string(),
                description: "Move files on an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "src_dir": { "type": "string" },
                        "dst_dir": { "type": "string" },
                        "names": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["server_id", "src_dir", "dst_dir", "names"]
                }),
            },
            McpTool {
                name: "view_file".to_string(),
                description: "Get file information from an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "path": { "type": "string", "description": "File path" }
                    },
                    "required": ["server_id", "path"]
                }),
            },
            McpTool {
                name: "edit_file".to_string(),
                description: "Edit a text file on an OpenList server by updating its content".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "path": { "type": "string", "description": "File path" },
                        "content": { "type": "string", "description": "New file content" }
                    },
                    "required": ["server_id", "path", "content"]
                }),
            },
            McpTool {
                name: "list_servers".to_string(),
                description: "List all configured OpenList servers".to_string(),
                input_schema: serde_json::json!({ "type": "object", "properties": {} }),
            },
            McpTool {
                name: "add_server".to_string(),
                description: "Add a new OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "url": { "type": "string" },
                        "token": { "type": "string" }
                    },
                    "required": ["name", "url", "token"]
                }),
            },
            McpTool {
                name: "remove_server".to_string(),
                description: "Remove an OpenList server".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" }
                    },
                    "required": ["server_id"]
                }),
            },
        ];

        tools.push(McpTool {
            name: "sync_index".to_string(),
            description: "Sync file index to Meilisearch".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string" },
                    "path": { "type": "string", "description": "Root path to sync" }
                },
                "required": ["server_id", "path"]
            }),
        });
        tools.push(McpTool {
            name: "get_index_status".to_string(),
            description: "Get Meilisearch index status".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string" }
                },
                "required": ["server_id"]
            }),
        });
        tools
    }

    /// 处理初始化请求
    ///
    /// 响应 AI 助手的 `initialize` 请求,返回协议版本、服务器能力和基本信息。
    ///
    /// # 参数
    ///
    /// * `id` - 请求ID,用于匹配响应
    ///
    /// # 返回值
    ///
    /// 返回包含协议版本和能力声明的 JSON-RPC 响应
    pub fn handle_initialize(id: Option<i64>) -> JsonRpcResponse {
        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": { "listChanged": false }
                },
                "serverInfo": {
                    "name": "openlist-finder",
                    "version": "0.1.0"
                }
            })),
            error: None,
        }
    }

    /// 处理工具列表请求
    ///
    /// 响应 AI 助手的 `tools/list` 请求,返回所有可用工具的定义。
    ///
    /// # 参数
    ///
    /// * `id` - 请求ID,用于匹配响应
    ///
    /// # 返回值
    ///
    /// 返回包含工具列表的 JSON-RPC 响应
    pub fn handle_tools_list(id: Option<i64>) -> JsonRpcResponse {
        let tools: Vec<Value> = Self::get_tools().into_iter().map(|t| {
            serde_json::json!({
                "name": t.name,
                "description": t.description,
                "inputSchema": t.input_schema
            })
        }).collect();

        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(serde_json::json!({ "tools": tools })),
            error: None,
        }
    }

    /// 根据 server_url 从配置中查找 token
    ///
    /// # 参数
    ///
    /// * `config` - 服务器配置
    /// * `server_url` - 服务器 URL
    ///
    /// # 返回值
    ///
    /// 返回找到的 token，如果未找到则返回空字符串
    fn find_token(config: &McpServerConfig, server_url: &str) -> String {
        if let Ok(config_read) = config.read() {
            config_read.iter()
                .find(|s| s.url == server_url)
                .map(|s| s.token.clone())
                .unwrap_or_default()
        } else {
            String::new()
        }
    }

    /// 处理工具调用请求
    ///
    /// 解析 AI 助手的 `tools/call` 请求,根据工具名称路由到相应的处理逻辑。
    /// 支持文件操作、搜索、服务器管理等所有已注册的工具。
    ///
    /// # 参数
    ///
    /// * `id` - 请求ID,用于匹配响应
    /// * `params` - 工具调用参数,包含工具名称和参数
    /// * `config` - MCP 服务器配置，包含服务器列表
    ///
    /// # 返回值
    ///
    /// 返回工具执行结果或错误信息的 JSON-RPC 响应
    pub async fn handle_tool_call(id: Option<i64>, params: Option<Value>, config: McpServerConfig) -> JsonRpcResponse {
        let params = match params {
            Some(p) => p,
            None => {
                return Self::handle_invalid_params(id, "Missing params for tools/call");
            }
        };

        let tool_name = match params.get("name").and_then(|v| v.as_str()) {
            Some(n) => n.to_string(),
            None => {
                return Self::handle_invalid_params(id, "Missing tool name");
            }
        };

        let arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));

        let result = match tool_name.as_str() {
            "list_directory" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let path = match arguments.get("path").and_then(|v| v.as_str()) {
                    Some(p) => p.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing path"),
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::list_directory(server_url, token, path).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "search_files" => {
                let query = match arguments.get("query").and_then(|v| v.as_str()) {
                    Some(q) => q.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing query"),
                };
                let server_id = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(s) => s.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let limit = Some(arguments.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as i64);
                let offset = Some(arguments.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as i64);
                let host = arguments.get("host").and_then(|v| v.as_str()).unwrap_or("http://localhost:7700");
                let api_key = arguments.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
                let index_prefix = arguments.get("index_prefix").and_then(|v| v.as_str()).unwrap_or("openlist");
                let index_uid = format!("{}-{}", index_prefix, server_id);
                match meilisearch::meilisearch_search(host.to_string(), api_key.to_string(), index_uid.to_string(), query, limit, offset).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "rename_file" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let dir = match arguments.get("dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing dir"),
                };
                let old_name = match arguments.get("old_name").and_then(|v| v.as_str()) {
                    Some(n) => n.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing old_name"),
                };
                let new_name = match arguments.get("new_name").and_then(|v| v.as_str()) {
                    Some(n) => n.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing new_name"),
                };
                let rename_request = RenameRequest {
                    dir,
                    old_name,
                    new_name,
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::rename_file(server_url, token, rename_request).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "delete_files" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let dir = match arguments.get("dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing dir"),
                };
                let names = match arguments.get("names").and_then(|v| v.as_array()) {
                    Some(arr) => arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>(),
                    None => return Self::handle_invalid_params(id, "Missing names"),
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::delete_files(server_url, token, dir, names).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "copy_files" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let src_dir = match arguments.get("src_dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing src_dir"),
                };
                let dst_dir = match arguments.get("dst_dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing dst_dir"),
                };
                let names = match arguments.get("names").and_then(|v| v.as_array()) {
                    Some(arr) => arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>(),
                    None => return Self::handle_invalid_params(id, "Missing names"),
                };
                let copy_request = CopyMoveRequest {
                    src_dir,
                    dst_dir,
                    names,
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::copy_files(server_url, token, copy_request).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "move_files" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let src_dir = match arguments.get("src_dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing src_dir"),
                };
                let dst_dir = match arguments.get("dst_dir").and_then(|v| v.as_str()) {
                    Some(d) => d.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing dst_dir"),
                };
                let names = match arguments.get("names").and_then(|v| v.as_array()) {
                    Some(arr) => arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>(),
                    None => return Self::handle_invalid_params(id, "Missing names"),
                };
                let move_request = CopyMoveRequest {
                    src_dir,
                    dst_dir,
                    names,
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::move_files(server_url, token, move_request).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "view_file" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let path = match arguments.get("path").and_then(|v| v.as_str()) {
                    Some(p) => p.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing path"),
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::get_file_info(server_url, token, path).await {
                    Ok(resp) => serde_json::json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&resp).unwrap_or_default() }]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "edit_file" => {
                let server_url = match arguments.get("server_id").and_then(|v| v.as_str()) {
                    Some(u) => u.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing server_id"),
                };
                let path = match arguments.get("path").and_then(|v| v.as_str()) {
                    Some(p) => p.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing path"),
                };
                let _content = match arguments.get("content").and_then(|v| v.as_str()) {
                    Some(c) => c.to_string(),
                    None => return Self::handle_invalid_params(id, "Missing content"),
                };
                let token = Self::find_token(&config, &server_url);
                match openlist::get_file_info(server_url.clone(), token, path.clone()).await {
                    Ok(_info) => {
                        serde_json::json!({
                            "content": [{ "type": "text", "text": format!("File edit requested for: {}. Note: Direct file content editing via API is not supported by OpenList. Use rename_file to rename or delete_files + upload to replace content.", path) }],
                            "isError": false
                        })
                    }
                    Err(e) => serde_json::json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                }
            }
            "list_servers" => {
                serde_json::json!({
                    "content": [{ "type": "text", "text": "Server list is managed by the OpenList Finder application. Use the Settings UI to manage servers." }]
                })
            }
            "add_server" => {
                serde_json::json!({
                    "content": [{ "type": "text", "text": "Server addition is managed by the OpenList Finder application. Use the Settings UI to add servers." }]
                })
            }
            "remove_server" => {
                serde_json::json!({
                    "content": [{ "type": "text", "text": "Server removal is managed by the OpenList Finder application. Use the Settings UI to remove servers." }]
                })
            }
            "sync_index" | "get_index_status" => {
                serde_json::json!({
                    "content": [{ "type": "text", "text": format!("{} requires Meilisearch to be configured in application settings.", tool_name) }],
                    "isError": true
                })
            }
            _ => {
                return Self::handle_method_not_found(id, &format!("Unknown tool: {}", tool_name));
            }
        };

        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    /// 处理方法未找到错误
    ///
    /// 当请求的方法不存在时,返回标准的 JSON-RPC 错误响应。
    ///
    /// # 参数
    ///
    /// * `id` - 请求ID,用于匹配响应
    /// * `method` - 未找到的方法名称
    ///
    /// # 返回值
    ///
    /// 返回错误码为 -32601 的 JSON-RPC 错误响应
    pub fn handle_method_not_found(id: Option<i64>, method: &str) -> JsonRpcResponse {
        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code: -32601,
                message: format!("Method not found: {}", method),
                data: None,
            }),
        }
    }

    /// 处理无效参数错误
    ///
    /// 当请求参数缺失或格式不正确时,返回标准的 JSON-RPC 错误响应。
    ///
    /// # 参数
    ///
    /// * `id` - 请求ID,用于匹配响应
    /// * `msg` - 错误描述消息
    ///
    /// # 返回值
    ///
    /// 返回错误码为 -32602 的 JSON-RPC 错误响应
    pub fn handle_invalid_params(id: Option<i64>, msg: &str) -> JsonRpcResponse {
        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code: -32602,
                message: msg.to_string(),
                data: None,
            }),
        }
    }
}

/// 运行 MCP stdio 服务器
///
/// 启动基于标准输入/输出的 MCP 服务器主循环。该函数会:
/// 1. 从 stdin 逐行读取 JSON-RPC 请求
/// 2. 解析请求并路由到相应的处理方法
/// 3. 将响应写入 stdout
/// 4. 刷新输出缓冲区确保响应立即发送
///
/// # 注意事项
///
/// - 该函数会阻塞当前线程,直到 stdin 关闭或发生错误
/// - 使用 tokio current_thread 运行时处理异步操作
/// - 空行会被自动跳过
/// - JSON 解析失败会返回解析错误响应
///
/// # 参数
///
/// * `config` - MCP 服务器配置，包含服务器列表
pub fn run_stdio_server(config: McpServerConfig) {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = stdin.lock();

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime");

    for line in reader.lines() {
        match line {
            Ok(input) => {
                let trimmed = input.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let request: JsonRpcRequest = match serde_json::from_str(trimmed) {
                    Ok(req) => req,
                    Err(_) => {
                        let response = JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id: None,
                            result: None,
                            error: Some(JsonRpcError {
                                code: -32700,
                                message: "Parse error".to_string(),
                                data: None,
                            }),
                        };
                        let _ = writeln!(stdout, "{}", serde_json::to_string(&response).unwrap_or_default());
                        let _ = stdout.flush();
                        continue;
                    }
                };

                let response = match request.method.as_str() {
                    "initialize" => McpServer::handle_initialize(request.id),
                    "notifications/initialized" => {
                        continue;
                    }
                    "tools/list" => McpServer::handle_tools_list(request.id),
                    "tools/call" => rt.block_on(McpServer::handle_tool_call(request.id, request.params, config.clone())),
                    "ping" => JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: request.id,
                        result: Some(serde_json::json!({})),
                        error: None,
                    },
                    _ => McpServer::handle_method_not_found(request.id, &request.method),
                };

                let _ = writeln!(stdout, "{}", serde_json::to_string(&response).unwrap_or_default());
                let _ = stdout.flush();
            }
            Err(_) => break,
        }
    }
}
