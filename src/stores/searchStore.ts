import { create } from "zustand";
import type { IndexSyncProgress, MeilisearchDoc } from "@/types";

export type IndexAvailabilityStatus = 
  | "unknown"
  | "checking"
  | "available"
  | "indexing"
  | "unavailable"
  | "error";

interface SearchState {
  query: string;
  results: MeilisearchDoc[];
  isSearching: boolean;
  searchError: string | null;
  indexProgress: IndexSyncProgress;
  indexStatus: IndexAvailabilityStatus;
  indexErrorMessage: string | null;
  setQuery: (query: string) => void;
  setResults: (results: MeilisearchDoc[]) => void;
  setSearching: (searching: boolean) => void;
  setSearchError: (error: string | null) => void;
  setIndexProgress: (progress: Partial<IndexSyncProgress>) => void;
  resetIndexProgress: () => void;
  setIndexStatus: (status: IndexAvailabilityStatus) => void;
  setIndexErrorMessage: (message: string | null) => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: "",
  results: [],
  isSearching: false,
  searchError: null,
  indexProgress: {
    total: 0,
    indexed: 0,
    percentage: 0,
    isRunning: false,
  },
  indexStatus: "unknown",
  indexErrorMessage: null,

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setSearching: (searching) => set({ isSearching: searching }),
  setSearchError: (error) => set({ searchError: error }),
  setIndexProgress: (progress) => {
    set((state) => ({
      indexProgress: { ...state.indexProgress, ...progress },
    }));
  },
  resetIndexProgress: () => {
    set({
      indexProgress: {
        total: 0,
        indexed: 0,
        percentage: 0,
        isRunning: false,
      },
    });
  },
  setIndexStatus: (status) => set({ indexStatus: status }),
  setIndexErrorMessage: (message) => set({ indexErrorMessage: message }),
}));
