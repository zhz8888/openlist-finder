import { createIndex, updateFilterable } from "@/services/meilisearch";
import type { ServerConfig, TaskInfo } from "@/types";

export interface IndexCreationResult {
  serverId: string;
  serverName: string;
  indexUid: string;
  success: boolean;
  error?: string;
  taskInfo?: TaskInfo;
  retryCount: number;
}

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

function generateIndexUid(indexPrefix: string, serverId: string): string {
  const prefix = indexPrefix && indexPrefix.trim() ? indexPrefix.trim() : "openlist";
  return `${prefix}-${serverId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createIndexWithRetry(
  host: string,
  apiKey: string,
  indexUid: string,
  serverId: string,
  serverName: string,
  maxRetries: number = MAX_RETRY_COUNT
): Promise<IndexCreationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[IndexManager] Creating index "${indexUid}" for server "${serverName}" (${serverId}), attempt ${attempt}/${maxRetries}`);

      const taskInfo = await createIndex(host, apiKey, indexUid);

      console.log(`[IndexManager] Index "${indexUid}" creation request submitted, task UID: ${taskInfo.uid}`);

      await delay(1000);

      try {
        await updateFilterable(host, apiKey, indexUid);
        console.log(`[IndexManager] Filterable attributes for index "${indexUid}" updated`);
      } catch (filterError) {
        console.warn(`[IndexManager] Failed to update filterable attributes (non-fatal):`, filterError);
      }

      return {
        serverId,
        serverName,
        indexUid,
        success: true,
        taskInfo,
        retryCount: attempt - 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[IndexManager] Index "${indexUid}" creation failed (attempt ${attempt}/${maxRetries}):`, lastError.message);

      if (attempt < maxRetries) {
        console.log(`[IndexManager] Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return {
    serverId,
    serverName,
    indexUid,
    success: false,
    error: lastError?.message || "未知错误",
    retryCount: maxRetries,
  };
}

export async function createIndexesForAllServers(
  host: string,
  apiKey: string,
  indexPrefix: string,
  servers: ServerConfig[]
): Promise<IndexCreationResult[]> {
  if (!host || !apiKey || servers.length === 0) {
    console.log("[IndexManager] Skipping index creation: incomplete parameters");
    return [];
  }

  console.log(`[IndexManager] Starting index creation for ${servers.length} servers`);

  const results: IndexCreationResult[] = [];

  for (const server of servers) {
    const indexUid = generateIndexUid(indexPrefix, server.id);
    const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`[IndexManager] Index creation completed: ${successCount} succeeded, ${failCount} failed`);

  return results;
}

export async function createIndexForServer(
  host: string,
  apiKey: string,
  indexPrefix: string,
  server: ServerConfig
): Promise<IndexCreationResult> {
  if (!host || !apiKey) {
    console.log("[IndexManager] Skipping index creation: Meilisearch configuration incomplete");
    return {
      serverId: server.id,
      serverName: server.name,
      indexUid: "",
      success: false,
      error: "Meilisearch configuration incomplete",
      retryCount: 0,
    };
  }

  const indexUid = generateIndexUid(indexPrefix, server.id);
  console.log(`[IndexManager] Creating index "${indexUid}" for new server "${server.name}"`);

  const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);

  if (result.success) {
    console.log(`[IndexManager] Index creation successful for server "${server.name}"`);
  } else {
    console.error(`[IndexManager] Index creation failed for server "${server.name}":`, result.error);
  }

  return result;
}

export { generateIndexUid };
