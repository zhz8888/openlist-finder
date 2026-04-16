import { invoke } from "@tauri-apps/api/core";

function checkTauriEnvironment(): void {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("Tauri API 不可用。请在 Tauri 环境中运行此应用。");
  }
}

export interface KeyringResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

export async function getKey(): Promise<string | null> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_get_key");
  if (!result.success) {
    throw new Error(result.error || "获取密钥失败");
  }
  return result.data;
}

export async function setKey(key: string): Promise<void> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_set_key", { key });
  if (!result.success) {
    throw new Error(result.error || "设置密钥失败");
  }
}

export async function deleteKey(): Promise<void> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_delete_key");
  if (!result.success) {
    throw new Error(result.error || "删除密钥失败");
  }
}

export async function generateKey(): Promise<string> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_generate_key");
  if (!result.success || !result.data) {
    throw new Error(result.error || "生成密钥失败");
  }
  return result.data;
}
