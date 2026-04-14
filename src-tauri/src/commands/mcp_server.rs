use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    pub fn get_tools() -> Vec<McpTool> {
        vec![
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
            McpTool {
                name: "sync_index".to_string(),
                description: "Sync file index to Meilisearch (experimental feature must be enabled)".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" },
                        "path": { "type": "string", "description": "Root path to sync" }
                    },
                    "required": ["server_id", "path"]
                }),
            },
            McpTool {
                name: "get_index_status".to_string(),
                description: "Get Meilisearch index status (experimental feature must be enabled)".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "server_id": { "type": "string" }
                    },
                    "required": ["server_id"]
                }),
            },
        ]
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
