import { useCallback } from "react";
import { useServerStore, useFileBrowserStore } from "@/stores";
import { listDirectory, executeWithTokenRefresh } from "@/services/openlist";
import { logger } from "@/utils/logger";

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
    getSortedFiles,
    setSortConfig,
  } = useFileBrowserStore();

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
    files: getSortedFiles(),
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
