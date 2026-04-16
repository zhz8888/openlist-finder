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
      console.log(`[IndexManager] 为服务器 "${serverName}" (${serverId}) 创建索引 "${indexUid}"，尝试 ${attempt}/${maxRetries}`);

      const taskInfo = await createIndex(host, apiKey, indexUid);

      console.log(`[IndexManager] 索引 "${indexUid}" 创建请求已提交，任务 UID: ${taskInfo.uid}`);

      await delay(1000);

      try {
        await updateFilterable(host, apiKey, indexUid);
        console.log(`[IndexManager] 索引 "${indexUid}" 的可过滤属性已更新`);
      } catch (filterError) {
        console.warn(`[IndexManager] 更新可过滤属性失败（非致命错误）:`, filterError);
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
      console.warn(`[IndexManager] 索引 "${indexUid}" 创建失败（尝试 ${attempt}/${maxRetries}）:`, lastError.message);

      if (attempt < maxRetries) {
        console.log(`[IndexManager] 等待 ${RETRY_DELAY_MS / 1000} 秒后重试...`);
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
    console.log("[IndexManager] 跳过索引创建：参数不完整");
    return [];
  }

  console.log(`[IndexManager] 开始为 ${servers.length} 个服务器创建索引`);

  const results: IndexCreationResult[] = [];

  for (const server of servers) {
    const indexUid = generateIndexUid(indexPrefix, server.id);
    const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`[IndexManager] 索引创建完成：成功 ${successCount} 个，失败 ${failCount} 个`);

  return results;
}

export async function createIndexForServer(
  host: string,
  apiKey: string,
  indexPrefix: string,
  server: ServerConfig
): Promise<IndexCreationResult> {
  if (!host || !apiKey) {
    console.log("[IndexManager] 跳过索引创建：Meilisearch 配置不完整");
    return {
      serverId: server.id,
      serverName: server.name,
      indexUid: "",
      success: false,
      error: "Meilisearch 配置不完整",
      retryCount: 0,
    };
  }

  const indexUid = generateIndexUid(indexPrefix, server.id);
  console.log(`[IndexManager] 为新服务器 "${server.name}" 创建索引 "${indexUid}"`);

  const result = await createIndexWithRetry(host, apiKey, indexUid, server.id, server.name);

  if (result.success) {
    console.log(`[IndexManager] 服务器 "${server.name}" 索引创建成功`);
  } else {
    console.error(`[IndexManager] 服务器 "${server.name}" 索引创建失败:`, result.error);
  }

  return result;
}

export { generateIndexUid };
