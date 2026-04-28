import { load } from "@tauri-apps/plugin-store";
import type { MeilisearchConfig, ThemeConfig, MCPConfig } from "@/types";

const SERVERS_STORE_FILE = "servers.json";
const SETTINGS_STORE_FILE = "settings.json";
const SERVERS_KEY = "openlist-servers";
const SETTINGS_KEY = "openlist-settings";

let serversStore: ReturnType<typeof load> | null = null;
let settingsStore: ReturnType<typeof load> | null = null;

async function getServersStore() {
  if (!serversStore) {
    serversStore = load(SERVERS_STORE_FILE, { defaults: {} });
  }
  return serversStore;
}

async function getSettingsStore() {
  if (!settingsStore) {
    settingsStore = load(SETTINGS_STORE_FILE, { defaults: {} });
  }
  return settingsStore;
}

export interface StoredServerConfig extends Record<string, unknown> {
  id: string;
  name: string;
  url: string;
  token: string;
  username?: string;
  password?: string;
  createdAt: string;
}

export interface StoredSettings {
  meilisearch: MeilisearchConfig;
  theme: ThemeConfig;
  sidebarCollapsed: boolean;
  mcp: MCPConfig;
}

export async function loadServers(): Promise<StoredServerConfig[]> {
  try {
    const store = await getServersStore();
    const data = await store.get<StoredServerConfig[]>(SERVERS_KEY);
    
    if (!data || !Array.isArray(data)) {
      console.log("[TauriStore] No server data found");
      return [];
    }

    console.log(`[TauriStore] Found ${data.length} server configurations`);
    return data;
  } catch (error) {
    console.error("[TauriStore] Failed to load server data:", error);
    return [];
  }
}

export async function saveServers(servers: StoredServerConfig[]): Promise<void> {
  try {
    const store = await getServersStore();
    await store.set(SERVERS_KEY, servers);
    await store.save();
    console.log(`[TauriStore] Server data saved successfully (${servers.length} servers)`);
  } catch (error) {
    console.error("[TauriStore] Failed to save server data:", error);
    throw error;
  }
}

export async function loadSettings(): Promise<StoredSettings | null> {
  try {
    const store = await getSettingsStore();
    const data = await store.get<StoredSettings>(SETTINGS_KEY);
    
    if (!data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error("[TauriStore] Failed to load settings data:", error);
    return null;
  }
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  try {
    const store = await getSettingsStore();
    await store.set(SETTINGS_KEY, settings);
    await store.save();
    console.log("[TauriStore] Settings data saved successfully");
  } catch (error) {
    console.error("[TauriStore] Failed to save settings data:", error);
    throw error;
  }
}

export async function clearServers(): Promise<void> {
  try {
    const store = await getServersStore();
    await store.delete(SERVERS_KEY);
    await store.save();
  } catch (error) {
    console.error("Failed to clear servers from Tauri Store:", error);
    throw error;
  }
}

export async function clearSettings(): Promise<void> {
  try {
    const store = await getSettingsStore();
    await store.delete(SETTINGS_KEY);
    await store.save();
  } catch (error) {
    console.error("Failed to clear settings from Tauri Store:", error);
    throw error;
  }
}

export function isTauriStoreAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
