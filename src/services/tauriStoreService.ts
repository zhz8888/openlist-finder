import { load } from "@tauri-apps/plugin-store";
import type { MeilisearchConfig, ThemeConfig, MCPConfig } from "@/types";
import { encrypt, decrypt, encryptObject, decryptObject } from "@/utils/crypto";

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
      return [];
    }

    const decryptedServers = await Promise.all(
      data.map(async (server) => {
        try {
          return await decryptObject<StoredServerConfig>(server, ["token"]);
        } catch (error) {
          console.error("[TauriStore] 服务器数据解密失败:", error, server);
          return server as StoredServerConfig;
        }
      })
    );

    return decryptedServers;
  } catch (error) {
    console.error("[TauriStore] 加载服务器数据失败:", error);
    return [];
  }
}

export async function saveServers(servers: StoredServerConfig[]): Promise<void> {
  try {
    const store = await getServersStore();
    
    const encryptedServers = await Promise.all(
      servers.map(async (server) => 
        await encryptObject<StoredServerConfig>(server, ["token"])
      )
    );

    await store.set(SERVERS_KEY, encryptedServers);
    await store.save();
    console.log("[TauriStore] 服务器数据保存成功");
  } catch (error) {
    console.error("[TauriStore] 保存服务器数据失败:", error);
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

    const decrypted = { ...data };
    if (decrypted.meilisearch && decrypted.meilisearch.apiKey) {
      try {
        decrypted.meilisearch = {
          ...decrypted.meilisearch,
          apiKey: await decrypt(decrypted.meilisearch.apiKey),
        };
      } catch (error) {
        console.error("[TauriStore] Meilisearch API Key 解密失败:", error);
      }
    }

    return decrypted;
  } catch (error) {
    console.error("[TauriStore] 加载设置数据失败:", error);
    return null;
  }
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  try {
    const store = await getSettingsStore();
    
    const encryptedSettings = {
      ...settings,
      meilisearch: settings.meilisearch ? {
        ...settings.meilisearch,
        apiKey: settings.meilisearch.apiKey ? await encrypt(settings.meilisearch.apiKey) : "",
      } : settings.meilisearch,
    };

    await store.set(SETTINGS_KEY, encryptedSettings);
    await store.save();
    console.log("[TauriStore] 设置数据保存成功");
  } catch (error) {
    console.error("[TauriStore] 保存设置数据失败:", error);
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
