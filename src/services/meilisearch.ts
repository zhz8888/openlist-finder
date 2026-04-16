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

export async function testConnection(host: string, apiKey: string): Promise<boolean> {
  checkTauriEnvironment();
  return invoke("test_meilisearch_connection", { host, apiKey });
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
