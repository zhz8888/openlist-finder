export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, MCPSchemaProperty>;
    required?: string[];
  };
}

export interface MCPSchemaProperty {
  type: "string" | "integer" | "array" | "boolean" | "number";
  description?: string;
  items?: { type: string };
}

export type MCPToolName =
  | "list_directory"
  | "search_files"
  | "rename_file"
  | "delete_files"
  | "copy_files"
  | "move_files"
  | "view_file"
  | "sync_index"
  | "index_status";

export interface ListDirectoryParams {
  server_id: string;
  path: string;
}

export interface SearchFilesParams {
  server_id: string;
  query: string;
  limit?: number;
  offset?: number;
  index_prefix?: string;
}

export interface RenameFileParams {
  server_id: string;
  dir: string;
  old_name: string;
  new_name: string;
}

export interface DeleteFilesParams {
  server_id: string;
  dir: string;
  names: string[];
}

export interface CopyFilesParams {
  server_id: string;
  src_dir: string;
  dst_dir: string;
  names: string[];
}

export interface MoveFilesParams {
  server_id: string;
  src_dir: string;
  dst_dir: string;
  names: string[];
}

export interface ViewFileParams {
  server_id: string;
  path: string;
}

export type MCPToolParams =
  | ListDirectoryParams
  | SearchFilesParams
  | RenameFileParams
  | DeleteFilesParams
  | CopyFilesParams
  | MoveFilesParams
  | ViewFileParams;

export interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: MCPToolParams;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type MCPLogLevel = "debug" | "info" | "warn" | "error";

export interface MCPConfig {
  enabled: boolean;
  serverName: string;
  serverVersion: string;
  logLevel: MCPLogLevel;
}
