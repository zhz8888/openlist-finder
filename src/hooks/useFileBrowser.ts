import { useCallback, useMemo } from "react";
import { useServerStore, useFileBrowserStore } from "@/stores";
import { listDirectory, executeWithTokenRefresh } from "@/services/openlist";
import { logger } from "@/utils/logger";
import type { FileInfo, SortConfig } from "@/types";

function sortFiles(files: FileInfo[], sortConfig: SortConfig): FileInfo[] {
  return [...files].sort((a, b) => {
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
}

export function useFileBrowser() {
  const { getActiveServer } = useServerStore();
  const {
    currentPath,
    files,
    selectedFiles,
    sortConfig,
    isLoading,
    error,
    setFiles,
    setLoading,
    setError,
    setCurrentPath,
    toggleFileSelection,
    clearSelection,
    navigateToDirectory,
    navigateUp,
    navigateToPath,
    setSortConfig,
  } = useFileBrowserStore();

  const sortedFiles = useMemo(() => sortFiles(files, sortConfig), [files, sortConfig]);

  const loadFiles = useCallback(async (path?: string) => {
    const server = getActiveServer();
    if (!server) {
      logger.warn("[OpenList] No active server selected");
      setError("[OpenList] 未选择活动服务器");
      return;
    }

    const targetPath = path || currentPath;
    setLoading(true);
    setError(null);

    try {
      logger.debug(`[OpenList] Loading directory: ${server.url}${targetPath}`);
      const response = await executeWithTokenRefresh(
        () => listDirectory(server.url, server.token, targetPath)
      );
      logger.debug(`[OpenList] Directory loaded: ${response.content.length} items`);
      setFiles(response.content);
      if (path) {
        setCurrentPath(path);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenList] Failed to load directory: ${errorMsg}`);
      setError(`[OpenList] ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [getActiveServer, currentPath, setFiles, setLoading, setError, setCurrentPath]);

  return {
    currentPath,
    files: sortedFiles,
    rawFiles: files,
    selectedFiles,
    sortConfig,
    isLoading,
    error,
    loadFiles,
    toggleFileSelection,
    clearSelection,
    navigateToDirectory,
    navigateUp,
    navigateToPath,
    setSortConfig,
  };
}
