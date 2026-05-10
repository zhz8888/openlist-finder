import { create } from "zustand";
import type { MeilisearchConfig, ThemeConfig, MCPConfig } from "@/types";
import {
  loadSettings,
  saveSettings,
  isTauriStoreAvailable,
  type StoredSettings,
} from "@/services/tauriStoreService";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

const defaultMCPConfig: MCPConfig = {
  enabled: false,
  serverName: "openlist-finder",
  serverVersion: "0.1.0",
  logLevel: "info",
  httpPort: 18792,
};

interface SettingsState {
  meilisearch: MeilisearchConfig;
  theme: ThemeConfig;
  sidebarCollapsed: boolean;
  mcp: MCPConfig;
  isInitialized: boolean;
  updateMeilisearch: (config: Partial<MeilisearchConfig>) => Promise<void>;
  setTheme: (theme: ThemeConfig) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  getResolvedTheme: () => "light" | "dark";
  updateMCP: (config: Partial<MCPConfig>) => Promise<void>;
  resetMCP: () => Promise<void>;
  initialize: () => Promise<void>;
}

const defaultSettings: Omit<SettingsState, "initialize" | "updateMeilisearch" | "setTheme" | "setSidebarCollapsed" | "getResolvedTheme" | "updateMCP" | "resetMCP"> = {
  meilisearch: {
    host: "",
    apiKey: "",
    indexPrefix: "",
    syncStrategy: "manual",
  },
  theme: {
    mode: "system",
  },
  sidebarCollapsed: false,
  mcp: { ...defaultMCPConfig },
  isInitialized: false,
};

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...defaultSettings,

  initialize: async () => {
    if (get().isInitialized) return;

    if (isTauriStoreAvailable()) {
      try {
        const storedSettings = await loadSettings();
        if (storedSettings) {
          set({
            meilisearch: storedSettings.meilisearch || defaultSettings.meilisearch,
            theme: storedSettings.theme || defaultSettings.theme,
            sidebarCollapsed: storedSettings.sidebarCollapsed ?? defaultSettings.sidebarCollapsed,
            mcp: storedSettings.mcp || defaultSettings.mcp,
            isInitialized: true,
          });
        } else {
          set({ isInitialized: true });
        }
      } catch (error) {
        console.error("Failed to initialize settings from Tauri Store:", error);
        set({ isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }
  },

  updateMeilisearch: async (config) => {
    const newMeilisearch = { ...get().meilisearch, ...config };
    set({ meilisearch: newMeilisearch });

    if (isTauriStoreAvailable()) {
      const currentState = get();
      const settings: StoredSettings = {
        meilisearch: newMeilisearch,
        theme: currentState.theme,
        sidebarCollapsed: currentState.sidebarCollapsed,
        mcp: currentState.mcp,
      };
      await saveSettings(settings);
    }
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

  updateMCP: async (config) => {
    const newMCP = { ...get().mcp, ...config };
    set({ mcp: newMCP });

    if (isTauriStoreAvailable()) {
      const currentState = get();
      const settings: StoredSettings = {
        meilisearch: currentState.meilisearch,
        theme: currentState.theme,
        sidebarCollapsed: currentState.sidebarCollapsed,
        mcp: newMCP,
      };
      await saveSettings(settings);
    }
  },

  resetMCP: async () => {
    set({ mcp: { ...defaultMCPConfig } });

    if (isTauriStoreAvailable()) {
      const currentState = get();
      const settings: StoredSettings = {
        meilisearch: currentState.meilisearch,
        theme: currentState.theme,
        sidebarCollapsed: currentState.sidebarCollapsed,
        mcp: { ...defaultMCPConfig },
      };
      await saveSettings(settings);
    }
  },
}));
