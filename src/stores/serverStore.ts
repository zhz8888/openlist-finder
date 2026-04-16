import { create } from "zustand";
import type { ServerConfig } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  loadServers,
  saveServers,
  isTauriStoreAvailable,
  type StoredServerConfig,
} from "@/services/tauriStoreService";

interface ServerState {
  servers: ServerConfig[];
  activeServerId: string | null;
  isInitialized: boolean;
  addServer: (name: string, url: string, token: string) => Promise<string>;
  removeServer: (id: string) => Promise<void>;
  updateServer: (id: string, data: Partial<ServerConfig>) => Promise<void>;
  setActiveServer: (id: string) => void;
  setDefaultServer: (id: string) => Promise<void>;
  getActiveServer: () => ServerConfig | undefined;
  initialize: () => Promise<void>;
}

function toStoredServerConfig(server: ServerConfig): StoredServerConfig {
  return {
    id: server.id,
    name: server.name,
    url: server.url,
    token: server.token,
    isDefault: server.isDefault,
    createdAt: server.createdAt,
  };
}

function toServerConfig(stored: StoredServerConfig): ServerConfig {
  return {
    id: stored.id,
    name: stored.name,
    url: stored.url,
    token: stored.token,
    isDefault: stored.isDefault,
    createdAt: stored.createdAt,
  };
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
        set({
          servers: storedServers.map(toServerConfig),
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

  addServer: async (name, url, token) => {
    const newServer: ServerConfig = {
      id: uuidv4(),
      name,
      url: url.replace(/\/+$/, ""),
      token,
      isDefault: get().servers.length === 0,
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
      const defaultServer = newServers.find((s) => s.isDefault);
      activeServerId = defaultServer?.id || newServers[0]?.id || null;
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

  setActiveServer: (id) => {
    set({ activeServerId: id });
  },

  setDefaultServer: async (id) => {
    const newServers = get().servers.map((s) => ({
      ...s,
      isDefault: s.id === id,
    }));

    set({
      servers: newServers,
      activeServerId: id,
    });

    if (isTauriStoreAvailable()) {
      await saveServers(newServers.map(toStoredServerConfig));
    }
  },

  getActiveServer: () => {
    const state = get();
    return state.servers.find((s) => s.id === state.activeServerId);
  },
}));
