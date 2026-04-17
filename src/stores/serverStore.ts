import { create } from "zustand";
import type { ServerConfig } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  loadServers,
  saveServers,
  isTauriStoreAvailable,
  type StoredServerConfig,
} from "@/services/tauriStoreService";
import { loginToOpenlist } from "@/services/openlist";

interface ServerState {
  servers: ServerConfig[];
  activeServerId: string | null;
  isInitialized: boolean;
  addServer: (name: string, url: string, username: string, password: string) => Promise<string>;
  removeServer: (id: string) => Promise<void>;
  updateServer: (id: string, data: Partial<ServerConfig>) => Promise<void>;
  updateServerToken: (id: string, newToken: string) => Promise<void>;
  setActiveServer: (id: string) => void;
  getActiveServer: () => ServerConfig | undefined;
  initialize: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

function toStoredServerConfig(server: ServerConfig): StoredServerConfig {
  return {
    id: server.id,
    name: server.name,
    url: server.url,
    token: server.token,
    username: server.username,
    password: server.password,
    createdAt: server.createdAt,
  };
}

function toServerConfig(stored: StoredServerConfig): ServerConfig {
  return {
    id: stored.id,
    name: stored.name,
    url: stored.url,
    token: stored.token,
    username: stored.username,
    password: stored.password,
    createdAt: stored.createdAt,
  };
}

async function loginAndGetToken(url: string, username: string, password: string): Promise<string | null> {
  try {
    console.log(`[ServerStore] Logging in to server: ${url}, user: ${username}`);
    const token = await loginToOpenlist(url, username, password);
    console.log(`[ServerStore] Login successful, obtained new token`);
    return token;
  } catch (error) {
    console.error(`[ServerStore] Failed to login to server ${url}:`, error);
    return null;
  }
}

export const useServerStore = create<ServerState>()((set, get) => ({
  servers: [],
  activeServerId: null,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    if (isTauriStoreAvailable()) {
      try {
        const storedServers = await loadServers();
        const servers = storedServers.map(toServerConfig);
        
        // 自动登录刷新 token
        const refreshedServers = await Promise.all(
          servers.map(async (server) => {
            if (server.username && server.password) {
              const newToken = await loginAndGetToken(server.url, server.username, server.password);
              if (newToken) {
                return { ...server, token: newToken };
              }
            }
            return server;
          })
        );

        // 保存刷新后的 token
        await saveServers(refreshedServers.map(toStoredServerConfig));

        set({
          servers: refreshedServers,
          activeServerId: refreshedServers.length > 0 ? refreshedServers[0].id : null,
          isInitialized: true,
        });
      } catch (error) {
        console.error("Failed to initialize servers from Tauri Store:", error);
        set({ isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }
  },

  refreshTokens: async () => {
    const currentServers = get().servers;
    let hasChanges = false;

    const refreshedServers = await Promise.all(
      currentServers.map(async (server) => {
        if (server.username && server.password) {
          const newToken = await loginAndGetToken(server.url, server.username, server.password);
          if (newToken && newToken !== server.token) {
            hasChanges = true;
            return { ...server, token: newToken };
          }
        }
        return server;
      })
    );

    if (hasChanges) {
      set({ servers: refreshedServers });
      await saveServers(refreshedServers.map(toStoredServerConfig));
      console.log("[ServerStore] Token refresh completed");
    }
  },

  addServer: async (name, url, username, password) => {
    // 先登录获取 token
    const token = await loginToOpenlist(url, username, password);
    
    const newServer: ServerConfig = {
      id: uuidv4(),
      name,
      url: url.replace(/\/+$/, ""),
      token,
      username,
      password,
      createdAt: new Date().toISOString(),
    };

    const newServers = [...get().servers, newServer];
    set({
      servers: newServers,
      activeServerId: get().activeServerId || newServer.id,
    });

    if (isTauriStoreAvailable()) {
      await saveServers(newServers.map(toStoredServerConfig));
    }

    return newServer.id;
  },

  removeServer: async (id) => {
    const newServers = get().servers.filter((s) => s.id !== id);
    let activeServerId = get().activeServerId;
    
    if (activeServerId === id) {
      activeServerId = newServers[0]?.id || null;
    }

    set({ servers: newServers, activeServerId });

    if (isTauriStoreAvailable()) {
      await saveServers(newServers.map(toStoredServerConfig));
    }
  },

  updateServer: async (id, data) => {
    const newServers = get().servers.map((s) =>
      s.id === id ? { ...s, ...data } : s
    );
    set({ servers: newServers });

    if (isTauriStoreAvailable()) {
      await saveServers(newServers.map(toStoredServerConfig));
    }
  },

  updateServerToken: async (id, newToken) => {
    const newServers = get().servers.map((s) =>
      s.id === id ? { ...s, token: newToken } : s
    );
    set({ servers: newServers });

    if (isTauriStoreAvailable()) {
      await saveServers(newServers.map(toStoredServerConfig));
    }
  },

  setActiveServer: (id) => {
    set({ activeServerId: id });
  },

  getActiveServer: () => {
    const state = get();
    return state.servers.find((s) => s.id === state.activeServerId);
  },
}));
