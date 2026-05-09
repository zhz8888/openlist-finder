import { invoke } from "@tauri-apps/api/core";
import type {
  MeilisearchDoc,
  SearchResult,
  IndexStats,
  TaskInfo,
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

export interface MeilisearchTestResult {
  success: boolean;
  message: string;
}

export async function testConnection(host: string, apiKey: string): Promise<MeilisearchTestResult> {
  checkTauriEnvironment();
  try {
    const result = await invoke<boolean>("test_meilisearch_connection", { host, apiKey });
    return { success: result, message: result ? "连接成功" : "连接失败" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: errorMsg };
  }
}

export async function createIndex(host: string, apiKey: string, indexUid: string): Promise<TaskInfo> {
  checkTauriEnvironment();
  return invoke("meilisearch_create_index", { host, apiKey, indexUid });
}

export async function addDocuments(host: string, apiKey: string, indexUid: string, docs: MeilisearchDoc[]): Promise<TaskInfo> {
  checkTauriEnvironment();
  return invoke("meilisearch_add_documents", { host, apiKey, indexUid, docs });
}

export async function search(host: string, apiKey: string, indexUid: string, query: string, limit?: number, offset?: number): Promise<SearchResult> {
  checkTauriEnvironment();
  return invoke("meilisearch_search", { host, apiKey, indexUid, query, limit, offset });
}

export async function getStats(host: string, apiKey: string, indexUid: string): Promise<IndexStats> {
  checkTauriEnvironment();
  return invoke("meilisearch_get_stats", { host, apiKey, indexUid });
}

export async function updateFilterable(host: string, apiKey: string, indexUid: string): Promise<TaskInfo> {
  checkTauriEnvironment();
  return invoke("meilisearch_update_filterable", { host, apiKey, indexUid });
}
