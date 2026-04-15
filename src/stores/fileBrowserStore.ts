import { create } from "zustand";
import type { FileInfo, SortConfig } from "@/types";

interface FileBrowserState {
  currentPath: string;
  files: FileInfo[];
  selectedFiles: Set<string>;
  sortConfig: SortConfig;
  isLoading: boolean;
  error: string | null;
  setCurrentPath: (path: string) => void;
  setFiles: (files: FileInfo[]) => void;
  setSelectedFiles: (files: Set<string>) => void;
  toggleFileSelection: (fileName: string) => void;
  clearSelection: () => void;
  setSortConfig: (config: SortConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  navigateToDirectory: (dirName: string) => void;
  navigateUp: () => void;
  navigateToPath: (path: string) => void;
  getSortedFiles: () => FileInfo[];
}

export const useFileBrowserStore = create<FileBrowserState>()((set, get) => ({
  currentPath: "/",
  files: [],
  selectedFiles: new Set<string>(),
  sortConfig: { field: "name", order: "asc" },
  isLoading: false,
  error: null,

  setCurrentPath: (path) => set({ currentPath: path, selectedFiles: new Set() }),
  setFiles: (files) => set({ files }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),

  toggleFileSelection: (fileName) => {
    set((state) => {
      const newSelection = new Set(state.selectedFiles);
      if (newSelection.has(fileName)) {
        newSelection.delete(fileName);
      } else {
        newSelection.add(fileName);
      }
      return { selectedFiles: newSelection };
    });
  },

  clearSelection: () => set({ selectedFiles: new Set() }),

  setSortConfig: (config) => set({ sortConfig: config }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  navigateToDirectory: (dirName) => {
    const state = get();
    const newPath = state.currentPath === "/" ? `/${dirName}` : `${state.currentPath}/${dirName}`;
    set({ currentPath: newPath, selectedFiles: new Set() });
  },

  navigateUp: () => {
    const state = get();
    if (state.currentPath === "/") return;
    const parts = state.currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? "/" : `/${parts.join("/")}`;
    set({ currentPath: newPath, selectedFiles: new Set() });
  },

  navigateToPath: (path) => {
    set({ currentPath: path, selectedFiles: new Set() });
  },

  getSortedFiles: () => {
    const state = get();
    const { files, sortConfig } = state;
    const sorted = [...files].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      switch (sortConfig.field) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "modified":
          cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case "type":
          cmp = a.type - b.type;
          break;
      }
      return sortConfig.order === "asc" ? cmp : -cmp;
    });
    return sorted;
  },
}));
