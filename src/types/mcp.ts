export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
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

export type MCPAuthType = "none" | "api_key" | "basic";

export interface MCPConfig {
  enabled: boolean;
  host: string;
  port: number;
  authType: MCPAuthType;
  apiKey: string;
  username: string;
  password: string;
}
