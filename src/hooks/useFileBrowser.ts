import { useCallback } from "react";
import { useServerStore, useFileBrowserStore } from "@/stores";
import { listDirectory, executeWithTokenRefresh } from "@/services/openlist";

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
      setError("[OpenList] 未选择活动服务器");
      return;
    }

    const targetPath = path || currentPath;
    setLoading(true);
    setError(null);

    try {
      const response = await executeWithTokenRefresh(
        () => listDirectory(server.url, server.token, targetPath)
      );
      setFiles(response.content);
      if (path) {
        setCurrentPath(path);
      }
    } catch (err) {
      setError(`[OpenList] ${err instanceof Error ? err.message : String(err)}`);
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
