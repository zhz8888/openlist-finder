import { createIndex, updateFilterable } from "@/services/meilisearch";
import { logger } from "@/utils/logger";
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
      logger.debug(`[IndexManager] Creating index "${indexUid}" (server: ${serverName}), attempt ${attempt}/${maxRetries}`);

      const taskInfo = await createIndex(host, apiKey, indexUid);

      logger.debug(`[IndexManager] Index "${indexUid}" creation request submitted, task UID: ${taskInfo.uid}`);

      await delay(1000);

      try {
        await updateFilterable(host, apiKey, indexUid);
        logger.debug(`[IndexManager] Filterable attributes for index "${indexUid}" updated`);
      } catch (filterError) {
        logger.warn(`[IndexManager] Failed to update filterable attributes for index "${indexUid}" (non-fatal): ${filterError instanceof Error ? filterError.message : String(filterError)}`);
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`[IndexManager] Index "${indexUid}" creation failed (attempt ${attempt}/${maxRetries}): ${errorMsg}`);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        logger.debug(`[IndexManager] Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
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
    logger.debug("[IndexManager] Skipping index creation: incomplete parameters");
    return [];
  }

  logger.info(`[IndexManager] Starting index creation for ${servers.length} servers`);

  const results: IndexCreationResult[] = [];

  for (const server of servers) {
    const indexUid = generateIndexUid(indexPrefix, server.id);
    const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  logger.info(`[IndexManager] Index creation completed: ${successCount} succeeded, ${failCount} failed`);

  return results;
}

export async function createIndexForServer(
  host: string,
  apiKey: string,
  indexPrefix: string,
  server: ServerConfig
): Promise<IndexCreationResult> {
  if (!host || !apiKey) {
    logger.debug("[IndexManager] Skipping index creation: Meilisearch configuration incomplete");
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
  logger.info(`[IndexManager] Creating index "${indexUid}" for new server "${server.name}"`);

  const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);

  if (result.success) {
    logger.info(`[IndexManager] Index creation successful for server "${server.name}"`);
  } else {
    logger.error(`[IndexManager] Index creation failed for server "${server.name}": ${result.error}`);
  }

  return result;
}

export { generateIndexUid };
