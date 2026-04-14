import { invoke } from "@tauri-apps/api/core";
import type {
  FileListResponse,
  FileOperationResult,
  ServerTestResult,
  FileInfo,
} from "@/types";

export async function testConnection(url: string, token: string): Promise<ServerTestResult> {
  return invoke("test_openlist_connection", { url, token });
}

export async function listDirectory(url: string, token: string, path: string): Promise<FileListResponse> {
  return invoke("list_directory", { url, token, path });
}

export async function renameFile(url: string, token: string, dir: string, oldName: string, newName: string): Promise<FileOperationResult> {
  return invoke("rename_file", { url, token, dir, oldName, newName });
}

export async function deleteFiles(url: string, token: string, dir: string, names: string[]): Promise<FileOperationResult> {
  return invoke("delete_files", { url, token, dir, names });
}

export async function copyFiles(url: string, token: string, srcDir: string, dstDir: string, names: string[]): Promise<FileOperationResult> {
  return invoke("copy_files", { url, token, srcDir, dstDir, names });
}

export async function moveFiles(url: string, token: string, srcDir: string, dstDir: string, names: string[]): Promise<FileOperationResult> {
  return invoke("move_files", { url, token, srcDir, dstDir, names });
}

export async function getFileInfo(url: string, token: string, path: string): Promise<FileInfo> {
  return invoke("get_file_info", { url, token, path });
}
