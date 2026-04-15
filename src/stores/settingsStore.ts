import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MeilisearchConfig, ThemeConfig, MCPConfig } from "@/types";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

interface SettingsState {
  meilisearch: MeilisearchConfig;
  theme: ThemeConfig;
  sidebarCollapsed: boolean;
  mcp: MCPConfig;
  updateMeilisearch: (config: Partial<MeilisearchConfig>) => void;
  setTheme: (theme: ThemeConfig) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  getResolvedTheme: () => "light" | "dark";
  updateMCP: (config: Partial<MCPConfig>) => void;
  resetMCP: () => void;
}

const defaultMCPConfig: MCPConfig = {
  enabled: false,
  serverName: "openlist-finder",
  serverVersion: "0.1.0",
  logLevel: "info",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      meilisearch: {
        host: "",
        apiKey: "",
        indexPrefix: "openlist",
        syncStrategy: "manual",
      },
      theme: {
        mode: "system",
      },
      sidebarCollapsed: false,
      mcp: { ...defaultMCPConfig },

      updateMeilisearch: (config) => {
        set((state) => ({
          meilisearch: { ...state.meilisearch, ...config },
        }));
      },

      setTheme: (theme) => {
        set({ theme });
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      getResolvedTheme: () => {
        const { theme } = get();
        if (theme.mode === "system") {
          return getSystemTheme();
        }
        return theme.mode;
      },

      updateMCP: (config) => {
        set((state) => ({
          mcp: { ...state.mcp, ...config },
        }));
      },

      resetMCP: () => {
        set({ mcp: { ...defaultMCPConfig } });
      },
    }),
    {
      name: "openlist-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

async function migrateToTauriStore() {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { defaults: {} });
    const persistKey = "openlist-settings";
    const localData = localStorage.getItem(persistKey);
    if (localData) {
      await store.set(persistKey, localData);
      await store.save();
    }
  } catch {}
}

if (typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
  migrateToTauriStore();
}
