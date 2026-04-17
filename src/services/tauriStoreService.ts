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

function maskSensitiveData(data: string): string {
  if (!data || data.length <= 8) return "***";
  return `${data.substring(0, 4)}...${data.substring(data.length - 4)}`;
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

    console.log(`[TauriStore] Found ${data.length} server configurations, starting decryption`);
    
    const decryptedServers: StoredServerConfig[] = [];
    let decryptSuccessCount = 0;
    let decryptFailedCount = 0;

    for (const server of data) {
      try {
        const fieldsToDecrypt = ["token"];
        if (server.username) fieldsToDecrypt.push("username");
        if (server.password) fieldsToDecrypt.push("password");
        const decrypted = await decryptObject<StoredServerConfig>(server, fieldsToDecrypt);
        decryptedServers.push(decrypted);
        decryptSuccessCount++;
        console.log(`[TauriStore] Server "${server.name}" decrypted successfully`);
      } catch (error) {
        decryptFailedCount++;
        console.error(
          `[TauriStore] Server "${server.name}" (ID: ${server.id}) decryption failed:`,
          error
        );
        console.error("[TauriStore] Raw data:", JSON.stringify({
          ...server,
          token: server.token ? maskSensitiveData(String(server.token)) : undefined,
          username: server.username ? maskSensitiveData(String(server.username)) : undefined,
          password: server.password ? maskSensitiveData(String(server.password)) : undefined,
        }, null, 2));
        decryptedServers.push(server as StoredServerConfig);
      }
    }

    console.log(
      `[TauriStore] Decryption complete: ${decryptSuccessCount} succeeded, ${decryptFailedCount} failed`
    );

    return decryptedServers;
  } catch (error) {
    console.error("[TauriStore] Failed to load server data:", error);
    return [];
  }
}

export async function saveServers(servers: StoredServerConfig[]): Promise<void> {
  try {
    const store = await getServersStore();
    
    const encryptedServers = await Promise.all(
      servers.map(async (server) => {
        const fieldsToEncrypt = ["token"];
        if (server.username) fieldsToEncrypt.push("username");
        if (server.password) fieldsToEncrypt.push("password");
        return await encryptObject<StoredServerConfig>(server, fieldsToEncrypt);
      })
    );

    await store.set(SERVERS_KEY, encryptedServers);
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

    const decrypted = { ...data };
    if (decrypted.meilisearch && decrypted.meilisearch.apiKey) {
      try {
        decrypted.meilisearch = {
          ...decrypted.meilisearch,
          apiKey: await decrypt(decrypted.meilisearch.apiKey),
        };
      } catch (error) {
        console.error("[TauriStore] Failed to decrypt Meilisearch API Key:", error);
      }
    }

    return decrypted;
  } catch (error) {
    console.error("[TauriStore] Failed to load settings data:", error);
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
