import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ServerConfig } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ServerState {
  servers: ServerConfig[];
  activeServerId: string | null;
  addServer: (name: string, url: string, token: string) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, data: Partial<ServerConfig>) => void;
  setActiveServer: (id: string) => void;
  setDefaultServer: (id: string) => void;
  getActiveServer: () => ServerConfig | undefined;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: [],
      activeServerId: null,

      addServer: (name, url, token) => {
        const newServer: ServerConfig = {
          id: uuidv4(),
          name,
          url: url.replace(/\/+$/, ""),
          token,
          isDefault: get().servers.length === 0,
          createdAt: new Date().toISOString(),
        };
        set((state) => {
          const servers = [...state.servers, newServer];
          const activeServerId = state.activeServerId || newServer.id;
          return { servers, activeServerId };
        });
      },

      removeServer: (id) => {
        set((state) => {
          const servers = state.servers.filter((s) => s.id !== id);
          let activeServerId = state.activeServerId;
          if (activeServerId === id) {
            const defaultServer = servers.find((s) => s.isDefault);
            activeServerId = defaultServer?.id || servers[0]?.id || null;
          }
          return { servers, activeServerId };
        });
      },

      updateServer: (id, data) => {
        set((state) => ({
          servers: state.servers.map((s) => (s.id === id ? { ...s, ...data } : s)),
        }));
      },

      setActiveServer: (id) => {
        set({ activeServerId: id });
      },

      setDefaultServer: (id) => {
        set((state) => ({
          servers: state.servers.map((s) => ({
            ...s,
            isDefault: s.id === id,
          })),
          activeServerId: id,
        }));
      },

      getActiveServer: () => {
        const state = get();
        return state.servers.find((s) => s.id === state.activeServerId);
      },
    }),
    {
      name: "openlist-servers",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
