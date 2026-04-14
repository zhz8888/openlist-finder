import { invoke } from "@tauri-apps/api/core";
import type {
  MeilisearchDoc,
  SearchResult,
  IndexStats,
  TaskInfo,
} from "@/types";

export async function testConnection(host: string, apiKey: string): Promise<boolean> {
  return invoke("test_meilisearch_connection", { host, apiKey });
}

export async function createIndex(host: string, apiKey: string, indexUid: string): Promise<TaskInfo> {
  return invoke("meilisearch_create_index", { host, apiKey, indexUid });
}

export async function addDocuments(host: string, apiKey: string, indexUid: string, docs: MeilisearchDoc[]): Promise<TaskInfo> {
  return invoke("meilisearch_add_documents", { host, apiKey, indexUid, docs });
}

export async function search(host: string, apiKey: string, indexUid: string, query: string, limit?: number, offset?: number): Promise<SearchResult> {
  return invoke("meilisearch_search", { host, apiKey, indexUid, query, limit, offset });
}

export async function getStats(host: string, apiKey: string, indexUid: string): Promise<IndexStats> {
  return invoke("meilisearch_get_stats", { host, apiKey, indexUid });
}

export async function updateFilterable(host: string, apiKey: string, indexUid: string): Promise<TaskInfo> {
  return invoke("meilisearch_update_filterable", { host, apiKey, indexUid });
}
