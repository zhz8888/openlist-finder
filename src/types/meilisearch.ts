export interface MeilisearchConfig {
  host: string;
  apiKey: string;
  indexPrefix: string;
  syncStrategy: "manual" | "auto";
  syncInterval?: number;
}

export interface MeilisearchDoc {
  id: string;
  name: string;
  dir_path: string;
  size: number;
  modified: string;
  type: string;
  is_dir: boolean;
  server_id: string;
}

export interface SearchResult {
  hits: MeilisearchDoc[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
}

export interface IndexStats {
  numberOfDocuments: number;
  isIndexing: boolean;
  fieldDistribution: Record<string, number>;
}

export interface TaskInfo {
  uid: number;
  indexUid: string;
  status: "enqueued" | "processing" | "succeeded" | "failed" | "canceled";
  type: string;
  enqueuedAt: string;
}

export interface IndexSyncProgress {
  total: number;
  indexed: number;
  percentage: number;
  isRunning: boolean;
}
