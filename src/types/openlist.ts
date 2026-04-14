export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  token: string;
  isDefault: boolean;
  createdAt: string;
}

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
  isDir: boolean;
  type: string;
  path: string;
}

export interface FileListResponse {
  content: FileInfo[];
  total: number;
  path: string;
}

export interface FileDetail {
  name: string;
  size: number;
  modified: string;
  isDir: boolean;
  type: string;
  path: string;
  content?: string;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
}

export interface CopyMoveRequest {
  srcDir: string;
  dstDir: string;
  names: string[];
}

export interface RenameRequest {
  dir: string;
  oldName: string;
  newName: string;
}

export interface ServerTestResult {
  success: boolean;
  message: string;
  version?: string;
}
