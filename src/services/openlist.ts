import { invoke } from "@tauri-apps/api/core";
import type {
  FileListResponse,
  FileOperationResult,
  ServerTestResult,
  FileInfo,
} from "@/types";

function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && 
    "__TAURI_INTERNALS__" in window;
}

function checkTauriEnvironment(): void {
  if (!isTauriAvailable()) {
    throw new Error("Tauri API 不可用。请在 Tauri 环境中运行此应用，或使用 `npm run tauri dev` 启动开发模式。");
  }
}

function isTokenInvalidatedError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorMessage.toLowerCase().includes("invalidated") || 
         errorMessage.toLowerCase().includes("token expired") ||
         errorMessage.toLowerCase().includes("unauthorized") ||
         errorMessage.toLowerCase().includes("401");
}

export async function executeWithTokenRefresh<T>(
  operation: () => Promise<T>,
  serverId: string,
  serverUrl: string,
  username: string,
  password: string,
  updateServerToken: (serverId: string, newToken: string) => Promise<void>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isTokenInvalidatedError(error) && username && password) {
      console.log(`[OpenList] Token 已失效，正在重新登录服务器: ${serverUrl}`);
      try {
        const newToken = await loginToOpenlist(serverUrl, username, password);
        await updateServerToken(serverId, newToken);
        console.log(`[OpenList] Token 刷新成功，重试操作`);
        return await operation();
      } catch (loginError) {
        console.error(`[OpenList] Token 刷新失败:`, loginError);
        throw loginError;
      }
    }
    throw error;
  }
}

export function validateServerUrl(url: string): { valid: boolean; error?: string; normalizedUrl?: string } {
  if (!url || url.trim() === "") {
    return { valid: false, error: "服务器地址不能为空" };
  }

  let normalizedUrl = url.trim();
  
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return { valid: false, error: "仅支持 HTTP 或 HTTPS 协议" };
    }
    if (!urlObj.hostname || urlObj.hostname === "") {
      return { valid: false, error: "服务器地址格式不正确，缺少主机名" };
    }
    return { valid: true, normalizedUrl: normalizedUrl.replace(/\/+$/, "") };
  } catch {
    return { valid: false, error: "服务器地址格式不正确，请使用有效的 URL（如 https://example.com）" };
  }
}

export async function testConnection(url: string, token: string): Promise<ServerTestResult> {
  checkTauriEnvironment();
  return invoke("test_openlist_connection", { url, token });
}

export async function loginToOpenlist(url: string, username: string, password: string, otpCode?: string): Promise<string> {
  checkTauriEnvironment();
  return invoke("login_to_openlist", { url, username, password, otpCode: otpCode || null });
}

export async function listDirectory(url: string, token: string, path: string): Promise<FileListResponse> {
  checkTauriEnvironment();
  return invoke("list_directory", { url, token, path });
}

export async function renameFile(url: string, token: string, dir: string, oldName: string, newName: string): Promise<FileOperationResult> {
  checkTauriEnvironment();
  return invoke("rename_file", { url, token, dir, oldName, newName });
}

export async function deleteFiles(url: string, token: string, dir: string, names: string[]): Promise<FileOperationResult> {
  checkTauriEnvironment();
  return invoke("delete_files", { url, token, dir, names });
}

export async function copyFiles(url: string, token: string, srcDir: string, dstDir: string, names: string[]): Promise<FileOperationResult> {
  checkTauriEnvironment();
  return invoke("copy_files", { url, token, srcDir, dstDir, names });
}

export async function moveFiles(url: string, token: string, srcDir: string, dstDir: string, names: string[]): Promise<FileOperationResult> {
  checkTauriEnvironment();
  return invoke("move_files", { url, token, srcDir, dstDir, names });
}

export async function getFileInfo(url: string, token: string, path: string): Promise<FileInfo> {
  checkTauriEnvironment();
  return invoke("get_file_info", { url, token, path });
}
