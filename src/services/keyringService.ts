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
  fallback_used: boolean;
}

export async function getKey(): Promise<string | null> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_get_key");
  if (!result.success) {
    throw new Error(result.error || "获取密钥失败");
  }
  if (result.fallback_used) {
    console.warn("[Keyring] Using fallback key storage (lower security)");
  }
  return result.data;
}

export async function setKey(key: string): Promise<boolean> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_set_key", { key });
  if (!result.success) {
    throw new Error(result.error || "Failed to set key");
  }
  if (result.fallback_used) {
    console.warn("[Keyring] Using fallback key storage (lower security)");
  }
  return result.fallback_used;
}

export async function deleteKey(): Promise<void> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_delete_key");
  if (!result.success) {
    throw new Error(result.error || "Failed to delete key");
  }
}

export async function generateKey(): Promise<string> {
  checkTauriEnvironment();
  const result = await invoke<KeyringResult>("keyring_generate_key");
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to generate key");
  }
  if (result.fallback_used) {
    console.warn("[Keyring] Using fallback key storage (lower security)");
  }
  return result.data;
}
