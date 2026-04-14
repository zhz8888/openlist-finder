import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MeilisearchConfig, ExperimentalFeatures, ThemeConfig } from "@/types";

interface SettingsState {
  meilisearch: MeilisearchConfig;
  experimental: ExperimentalFeatures;
  theme: ThemeConfig;
  updateMeilisearch: (config: Partial<MeilisearchConfig>) => void;
  setExperimental: (features: Partial<ExperimentalFeatures>) => void;
  setTheme: (theme: ThemeConfig) => void;
  getResolvedTheme: () => "light" | "dark";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      meilisearch: {
        host: "",
        apiKey: "",
        indexPrefix: "openlist",
        syncStrategy: "manual",
      },
      experimental: {
        meilisearch: false,
      },
      theme: {
        mode: "system",
      },

      updateMeilisearch: (config) => {
        set((state) => ({
          meilisearch: { ...state.meilisearch, ...config },
        }));
      },

      setExperimental: (features) => {
        set((state) => ({
          experimental: { ...state.experimental, ...features },
        }));
      },

      setTheme: (theme) => {
        set({ theme });
      },

      getResolvedTheme: () => {
        const { theme } = get();
        if (theme.mode === "system") {
          return getSystemTheme();
        }
        return theme.mode;
      },
    }),
    {
      name: "openlist-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
