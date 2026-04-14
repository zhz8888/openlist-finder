export interface ExperimentalFeatures {
  meilisearch: boolean;
}

export interface ThemeConfig {
  mode: "light" | "dark" | "system";
}

export interface AppSettings {
  servers: import("./openlist").ServerConfig[];
  activeServerId: string | null;
  meilisearch: import("./meilisearch").MeilisearchConfig;
  experimental: ExperimentalFeatures;
  theme: ThemeConfig;
}

export type SortField = "name" | "size" | "modified" | "type";
export type SortOrder = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}
