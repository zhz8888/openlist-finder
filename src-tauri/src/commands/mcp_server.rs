use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead, Write};
use crate::commands::openlist;
use crate::commands::meilisearch;

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<i64>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

pub struct McpServer;

impl McpServer {
    pub fn get_tools(experimental_enabled: bool) -> Vec<McpTool> {
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
                description: "Search files using Meilisearch (experimental feature must be enabled)".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query" },
                        "limit": { "type": "integer", "description": "Max results" },
                        "offset": { "type": "integer", "description": "Result offset" }
                    },
                    "required": ["query"]
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

        if experimental_enabled {
            tools.push(McpTool {
                name: "sync_index".to_string(),
                description: "Sync file index to Meilisearch (requires experimental Meilisearch feature)".to_string(),
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
                description: "Get Meilisearch index status (requires experimental Meilisearch feature)".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" }
                    },
                    "required": ["server_id"]
                }),
            });
        }

        tools
    }

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

    pub fn handle_tools_list(id: Option<i64>, experimental_enabled: bool) -> JsonRpcResponse {
        let tools: Vec<Value> = Self::get_tools(experimental_enabled).into_iter().map(|t| {
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

    pub async fn handle_tool_call(id: Option<i64>, params: Option<Value>) -> JsonRpcResponse {
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
                match openlist::list_directory(server_url, "".to_string(), path).await {
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
                let limit = Some(arguments.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as i64);
                let offset = Some(arguments.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as i64);
                let host = arguments.get("host").and_then(|v| v.as_str()).unwrap_or("http://localhost:7700");
                let api_key = arguments.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
                let index_uid = arguments.get("index_uid").and_then(|v| v.as_str()).unwrap_or("openlist");
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
                match openlist::rename_file(server_url, "".to_string(), dir, old_name, new_name).await {
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
                match openlist::delete_files(server_url, "".to_string(), dir, names).await {
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
                match openlist::copy_files(server_url, "".to_string(), src_dir, dst_dir, names).await {
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
                match openlist::move_files(server_url, "".to_string(), src_dir, dst_dir, names).await {
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
                match openlist::get_file_info(server_url, "".to_string(), path).await {
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
                match openlist::get_file_info(server_url.clone(), "".to_string(), path.clone()).await {
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
                    "content": [{ "type": "text", "text": format!("{} requires experimental Meilisearch feature to be enabled in application settings.", tool_name) }],
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

pub fn run_stdio_server() {
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
                    "tools/list" => McpServer::handle_tools_list(request.id, false),
                    "tools/call" => rt.block_on(McpServer::handle_tool_call(request.id, request.params)),
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
