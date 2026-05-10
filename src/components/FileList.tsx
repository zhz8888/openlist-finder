import { useState, useCallback, useEffect, useRef, useLayoutEffect, memo, Suspense } from "react";
import { createPortal } from "react-dom";
import { useFileBrowser } from "@/hooks";
import { useServerStore, useSettingsStore, useSearchStore, useFileBrowserStore, useToastStore } from "@/stores";
import type { IndexAvailabilityStatus } from "@/stores/searchStore";
import { renameFile, deleteFiles, copyFiles, moveFiles, executeWithTokenRefresh } from "@/services/openlist";
import { search as searchMeilisearch, getStats } from "@/services/meilisearch";
import { Breadcrumb, SortHeader, FolderTree } from "./index";
import { previewRegistry, UnsupportedPreview } from "./previews";
import { logger } from "@/utils/logger";
import { getFileTypeDescription, getFileIcon } from "@/utils/fileTypes";
import type { FileInfo, SortField, MeilisearchDoc } from "@/types";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

interface FileRowProps {
  file: FileInfo;
  isSelected: boolean;
  onToggleSelection: (name: string) => void;
  onDoubleClick: (file: FileInfo) => void;
  onContextMenu: (e: React.MouseEvent, file: FileInfo) => void;
}

const FileRow = memo(function FileRow({
  file,
  isSelected,
  onToggleSelection,
  onDoubleClick,
  onContextMenu,
}: FileRowProps) {
  return (
    <tr
      className={`hover cursor-pointer ${isSelected ? "active" : ""}`}
      onClick={() => onToggleSelection(file.name)}
      onDoubleClick={() => onDoubleClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
    >
      <td>
        <label>
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={isSelected}
            onChange={() => onToggleSelection(file.name)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`选择 ${file.name}`}
          />
        </label>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {getFileIcon(file)}
          <span className={file.isDir ? "font-medium" : ""}>{file.name}</span>
        </div>
      </td>
      <td className="text-xs text-[var(--color-neutral)]">{formatDate(file.modified)}</td>
      <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "—" : formatFileSize(file.size)}</td>
      <td className="text-xs text-[var(--color-neutral)]">{getFileTypeDescription(file)}</td>
    </tr>
  );
});

interface SearchResultRowProps {
  doc: MeilisearchDoc;
  file: FileInfo;
  onOpen: (file: FileInfo) => void;
}

const SearchResultRow = memo(function SearchResultRow({
  doc,
  file,
  onOpen,
}: SearchResultRowProps) {
  const handleDoubleClick = () => onOpen(file);

  return (
    <tr
      key={doc.id}
      className="hover cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      <td>
        <div className="flex items-center gap-2">
          {getFileIcon(file)}
          <span className={file.isDir ? "font-medium" : ""}>{file.name}</span>
        </div>
      </td>
      <td className="text-xs text-[var(--color-neutral)]">{doc.dir_path || "/"}</td>
      <td className="text-xs text-[var(--color-neutral)]">{formatDate(file.modified)}</td>
      <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "—" : formatFileSize(file.size)}</td>
      <td className="text-xs text-[var(--color-neutral)]">{getFileTypeDescription(file)}</td>
    </tr>
  );
});

function convertDocToFileInfo(doc: MeilisearchDoc): FileInfo {
  return {
    name: doc.name,
    size: doc.size,
    modified: doc.modified,
    isDir: doc.is_dir,
    type: 0,
    path: doc.dir_path ? `${doc.dir_path}/${doc.name}`.replace(/\/+/g, "/") : `/${doc.name}`,
  };
}

export function FileList() {
  const { getActiveServer } = useServerStore();
  const { meilisearch } = useSettingsStore();
  const { 
    query, 
    setQuery, 
    results, 
    setResults, 
    isSearching, 
    searchError, 
    setSearchError,
    indexStatus,
    indexErrorMessage,
    setIndexStatus,
    setIndexErrorMessage,
  } = useSearchStore();
  const currentPath = useFileBrowserStore((s) => s.currentPath);
  const addToast = useToastStore((s) => s.addToast);
  const {
    files,
    selectedFiles,
    sortConfig,
    isLoading,
    error,
    loadFiles,
    toggleFileSelection,
    clearSelection,
    navigateToDirectory,
    setSortConfig,
  } = useFileBrowser();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileInfo } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [renameModal, setRenameModal] = useState<{ file: FileInfo; newName: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<FileInfo[] | null>(null);
  const [pathModal, setPathModal] = useState<{ files: FileInfo[]; operation: "copy" | "move"; targetPath: string; excludePaths: string[] } | null>(null);
  const [previewModal, setPreviewModal] = useState<FileInfo | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadFilesRef = useRef(loadFiles);
  const fileListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFilesRef.current = loadFiles;
  }, [loadFiles]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFilesRef.current("/");
    }
  }, []);

  const checkIndexAvailability = useCallback(async (): Promise<IndexAvailabilityStatus> => {
    const server = getActiveServer();
    if (!server || !meilisearch.host || !meilisearch.apiKey) {
      return "unavailable";
    }

    try {
      const prefix = meilisearch.indexPrefix || "openlist";
      const indexUid = `${prefix}-${server.id}`;
      logger.debug(`[Meilisearch] Checking index status for "${indexUid}"`);
      const stats = await getStats(meilisearch.host, meilisearch.apiKey, indexUid);
      
      if (stats.isIndexing) {
        logger.debug(`[Meilisearch] Index "${indexUid}" is currently indexing`);
        return "indexing";
      }
      
      if (stats.numberOfDocuments === 0) {
        logger.debug(`[Meilisearch] Index "${indexUid}" has no documents`);
        return "unavailable";
      }
      
      logger.debug(`[Meilisearch] Index "${indexUid}" available with ${stats.numberOfDocuments} documents`);
      return "available";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Meilisearch] Failed to check index status: ${msg}`);
      setIndexErrorMessage(msg);
      return "error";
    }
  }, [getActiveServer, meilisearch, setIndexErrorMessage]);

  useEffect(() => {
    const checkIndex = async () => {
      setIndexStatus("checking");
      const status = await checkIndexAvailability();
      setIndexStatus(status);
    };

    checkIndex();
  }, [checkIndexAvailability, setIndexStatus]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig({
      field,
      order: sortConfig.field === field && sortConfig.order === "asc" ? "desc" : "asc",
    });
  }, [sortConfig, setSortConfig]);

  const handleDoubleClick = useCallback((file: FileInfo) => {
    if (file.isDir) {
      navigateToDirectory(file.name);
      const newPath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
      loadFiles(newPath);
    } else {
      setPreviewModal(file);
    }
  }, [navigateToDirectory, loadFiles, currentPath]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileInfo) => {
    e.preventDefault();
    // 设置初始位置，稍后在渲染时进行边界调整
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  // 复制下载链接到剪贴板
  const copyDownloadLink = useCallback(async (file: FileInfo) => {
    if (!file.path || file.isDir) return;
    const server = getActiveServer();
    if (!server) return;

    const downloadLink = `${server.url}/d${file.path}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(downloadLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = downloadLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
        } catch {
          addToast("error", "复制链接失败，请手动复制");
          return;
        }
        document.body.removeChild(textArea);
      }
      addToast("success", "下载链接已复制到剪贴板");
    } catch {
      addToast("error", "复制链接失败，请手动复制");
    }
  }, [getActiveServer, addToast]);

  // 在DOM更新后计算菜单的最终位置，确保显示在鼠标右下方且不超出可视区域
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    // 获取菜单的实际尺寸
    const menuWidth = contextMenuRef.current.offsetWidth;
    const menuHeight = contextMenuRef.current.offsetHeight;
    
    // 鼠标位置作为基准点（clientX/Y 相对于视口，适合 fixed 定位）
    const mouseX = contextMenu.x;
    const mouseY = contextMenu.y;
    
    // 可视区域尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 计算菜单位置：从鼠标位置开始，显示在第四象限（右下方）
    // 添加一个小偏移（5px）避免菜单紧贴鼠标指针
    let left = mouseX + 5;
    let top = mouseY + 5;
    
    // 检查右边界，如果超出则向左调整
    if (left + menuWidth > viewportWidth) {
      left = Math.max(0, viewportWidth - menuWidth - 10); // 留10px边距
    }
    
    // 检查下边界，如果超出则向上调整
    if (top + menuHeight > viewportHeight) {
      top = Math.max(0, viewportHeight - menuHeight - 10); // 留10px边距
    }
    
    // 直接设置样式，避免额外的 re-render
    contextMenuRef.current.style.left = `${left}px`;
    contextMenuRef.current.style.top = `${top}px`;
  }, [contextMenu]);

  const handleRename = useCallback(async () => {
    if (!renameModal || !renameModal.file.path) return;
    const server = getActiveServer();
    if (!server) return;
    const filePath = renameModal.file.path;
    try {
      logger.info(`[OpenList] Renaming file "${renameModal.file.name}" to "${renameModal.newName}"`);
      await executeWithTokenRefresh(
        () => renameFile(server.url, server.token, {
          dir: filePath.replace(/\/[^/]+$/, "") || "/",
          oldName: renameModal.file.name,
          newName: renameModal.newName
        })
      );
      logger.info(`[OpenList] File renamed successfully`);
      setRenameModal(null);
      addToast("success", `已重命名文件 "${renameModal.file.name}" 为 "${renameModal.newName}"`);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenList] Rename failed: ${msg}`);
      addToast("error", `[OpenList] 重命名失败：${msg}`);
    }
  }, [renameModal, getActiveServer, loadFiles, addToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteModal || !deleteModal[0]?.path) return;
    const server = getActiveServer();
    if (!server) return;
    const filePath = deleteModal[0].path;
    try {
      const fileNames = deleteModal.map((f) => f.name);
      logger.info(`[OpenList] Deleting ${deleteModal.length} file(s): ${fileNames.join(", ")}`);
      await executeWithTokenRefresh(
        () => deleteFiles(server.url, server.token, filePath.replace(/\/[^/]+$/, "") || "/", fileNames)
      );
      logger.info(`[OpenList] ${deleteModal.length} file(s) deleted successfully`);
      setDeleteModal(null);
      clearSelection();
      addToast("success", `已删除 ${deleteModal.length} 个文件`);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenList] Delete failed: ${msg}`);
      addToast("error", `[OpenList] 删除失败：${msg}`);
    }
  }, [deleteModal, getActiveServer, loadFiles, clearSelection, addToast]);

  const handleCopyMove = useCallback(async () => {
    if (!pathModal || !pathModal.files[0].path) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      const srcDir = pathModal.files[0].path.replace(/\/[^/]+$/, "") || "/";
      const fileNames = pathModal.files.map((f) => f.name);
      const request = { srcDir, dstDir: pathModal.targetPath, names: fileNames };
      if (pathModal.operation === "copy") {
        logger.info(`[OpenList] Copying ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
        await executeWithTokenRefresh(
          () => copyFiles(server.url, server.token, request)
        );
        logger.info(`[OpenList] ${pathModal.files.length} file(s) copied successfully`);
        addToast("success", `已复制 ${pathModal.files.length} 个文件到 ${pathModal.targetPath}`);
      } else {
        logger.info(`[OpenList] Moving ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
        await executeWithTokenRefresh(
          () => moveFiles(server.url, server.token, request)
        );
        logger.info(`[OpenList] ${pathModal.files.length} file(s) moved successfully`);
        addToast("success", `已移动 ${pathModal.files.length} 个文件到 ${pathModal.targetPath}`);
      }
      setPathModal(null);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenList] ${pathModal.operation === "copy" ? "Copy" : "Move"} failed: ${msg}`);
      addToast("error", `[OpenList] ${pathModal.operation === "copy" ? "复制" : "移动"}失败：${msg}`);
    }
  }, [pathModal, getActiveServer, loadFiles, addToast]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setIsSearchMode(false);
      setResults([]);
      return;
    }

    if (indexStatus !== "available") {
      logger.warn("[Meilisearch] Search attempted but index not available");
      addToast("warning", "[Meilisearch] 搜索功能暂时不可用，请等待索引构建完成后再试");
      return;
    }

    const server = getActiveServer();
    if (!server) return;
    try {
      const prefix = meilisearch.indexPrefix || "openlist";
      const indexUid = `${prefix}-${server.id}`;
      logger.info(`[Meilisearch] Searching for "${query}" in index "${indexUid}"`);
      const result = await searchMeilisearch(meilisearch.host, meilisearch.apiKey, indexUid, query);
      logger.info(`[Meilisearch] Search completed: ${result.hits.length} results`);
      setResults(result.hits);
      setIsSearchMode(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Meilisearch] Search failed: ${msg}`);
      setSearchError(msg);
      addToast("error", `[Meilisearch] 搜索失败：${msg}`);
    }
  }, [meilisearch, query, getActiveServer, setResults, setSearchError, addToast, indexStatus]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearchMode(false);
    setSearchError(null);
  }, [setQuery, setResults, setSearchError]);

  const handleOpenSearchResult = useCallback((file: FileInfo) => {
    if (file.isDir) {
      handleClearSearch();
      loadFiles(file.path);
    } else {
      setPreviewModal(file);
    }
  }, [handleClearSearch, loadFiles, setPreviewModal]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" ref={fileListRef}>
      <Breadcrumb />

      <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)] flex gap-2">
          <input
            type="text"
            placeholder={indexStatus === "available" ? "搜索文件..." : "搜索功能暂时不可用..."}
            className="input input-bordered input-sm flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            aria-label="搜索文件"
            disabled={indexStatus !== "available"}
          />
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={handleSearch} 
            disabled={isSearching || indexStatus !== "available"}
          >
            {isSearching ? <span className="loading loading-spinner loading-xs"></span> : "搜索"}
          </button>
          <button 
            type="button" 
            className="btn btn-ghost btn-sm" 
            onClick={() => {
              handleClearSearch();
              loadFiles();
            }}
            title="刷新"
            aria-label="刷新"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isSearchMode && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearSearch}>
              清除
            </button>
          )}
        </div>

      {indexStatus === "checking" && (
        <div className="result-message result-info mx-4 mt-2">
          <div className="result-icon">
            <span className="loading loading-spinner loading-xs"></span>
          </div>
          <div className="result-text">正在检查索引状态...</div>
        </div>
      )}

      {(indexStatus === "error" || indexStatus === "unavailable") && (
        <div className="result-message result-warning mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="result-text">
            搜索功能暂时不可用，当前为<strong>直连模式</strong>，可正常进行文件操作
          </div>
        </div>
      )}

      {indexStatus === "indexing" && (
        <div className="result-message result-warning mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="result-text">[Meilisearch] 搜索功能暂时不可用，请等待索引构建完成后再试</div>
        </div>
      )}

      {indexStatus === "unavailable" && (
        <div className="result-message result-warning mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="result-text">[Meilisearch] 搜索功能暂时不可用，请等待索引构建完成后再试</div>
        </div>
      )}

      {indexStatus === "error" && (
        <div className="result-message result-error mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="result-text">
            <div>Meilisearch 服务不可用</div>
            {indexErrorMessage && <div className="text-xs opacity-70 mt-1">{indexErrorMessage}</div>}
          </div>
        </div>
      )}

      {searchError && (
        <div className="result-message result-error mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="result-text">
            <div>[Meilisearch] {searchError}</div>
            <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={() => setSearchError(null)}>关闭</button>
          </div>
        </div>
      )}

      {error && (
        <div className="result-message result-error mx-4 mt-2">
          <div className="result-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="result-text">
            <div>{error}</div>
            <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={() => loadFiles()}>重试</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isSearchMode ? (
          results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-neutral-muted)]">
              <p>未找到匹配 "{query}" 的文件</p>
              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={handleClearSearch}>返回文件列表</button>
            </div>
          ) : (
            <div>
              <div className="px-4 py-2 text-sm text-[var(--color-neutral)]">
                搜索结果：找到 {results.length} 个匹配项
              </div>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>路径</th>
                    <th>修改时间</th>
                    <th>大小</th>
                    <th>类型</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((doc) => {
                    const file = convertDocToFileInfo(doc);
                    return (
                      <SearchResultRow
                        key={doc.id}
                        doc={doc}
                        file={file}
                        onOpen={handleOpenSearchResult}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-neutral-muted)]">
            <p>未找到文件</p>
          </div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-8" aria-label="全选">
                  <label>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={selectedFiles.size === files.length && files.length > 0}
                      onChange={() => {
                        if (selectedFiles.size === files.length) {
                          clearSelection();
                        } else {
                          clearSelection();
                          files.forEach((f) => toggleFileSelection(f.name));
                        }
                      }}
                      aria-label="全选文件"
                    />
                  </label>
                </th>
                <SortHeader field="name" label="名称" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="modified" label="修改时间" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="size" label="大小" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="type" label="类型" currentSort={sortConfig} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  isSelected={selectedFiles.has(file.name)}
                  onToggleSelection={toggleFileSelection}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="dropdown-content menu bg-[var(--color-bg)] rounded-lg z-50 w-52 p-2 shadow-lg border border-[var(--color-border)] fixed context-menu"
          role="menu"
          aria-label="文件右键菜单"
        >
          <li role="menuitem"><button type="button" onClick={() => { setPreviewModal(contextMenu.file); setContextMenu(null); }}>查看</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setRenameModal({ file: contextMenu.file, newName: contextMenu.file.name }); setContextMenu(null); }}>重命名</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setDeleteModal([contextMenu.file]); setContextMenu(null); }}>删除</button></li>
          <li role="menuitem"><button type="button" onClick={() => {
            const srcDir = contextMenu.file.path?.replace(/\/[^/]+$/, "") || "/";
            setPathModal({ files: [contextMenu.file], operation: "copy", targetPath: "/", excludePaths: [srcDir] });
            setContextMenu(null);
          }}>复制</button></li>
          <li role="menuitem"><button type="button" onClick={() => {
            const srcDir = contextMenu.file.path?.replace(/\/[^/]+$/, "") || "/";
            setPathModal({ files: [contextMenu.file], operation: "move", targetPath: "/", excludePaths: [srcDir] });
            setContextMenu(null);
          }}>移动</button></li>
          {!contextMenu.file.isDir && (
            <li role="menuitem"><button type="button" onClick={() => { copyDownloadLink(contextMenu.file); setContextMenu(null); }}>
              下载
            </button></li>
          )}
        </div>,
        document.body
      )}

      {renameModal && (
        <div className="file-modal-overlay">
          <div className="file-modal-box">
            <h3 className="font-bold text-lg">重命名文件</h3>
            <p className="py-2 text-sm text-[var(--color-neutral)]">当前名称：{renameModal.file.name}</p>
            <input
              type="text"
              className="input input-bordered w-full"
              value={renameModal.newName}
              onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              aria-label="新文件名称"
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setRenameModal(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleRename}>重命名</button>
            </div>
          </div>
          <div className="file-modal-backdrop" onClick={() => setRenameModal(null)}></div>
        </div>
      )}

      {deleteModal && (
        <div className="file-modal-overlay">
          <div className="file-modal-box">
            <h3 className="font-bold text-lg text-[var(--color-danger)]">确认删除</h3>
            <p className="py-2">确定要删除以下文件吗？</p>
            <ul className="list-disc list-inside text-sm">
              {deleteModal.map((f) => <li key={f.name}>{f.name}</li>)}
            </ul>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal(null)}>取消</button>
              <button type="button" className="btn btn-error" onClick={handleDelete}>删除</button>
            </div>
          </div>
          <div className="file-modal-backdrop" onClick={() => setDeleteModal(null)}></div>
        </div>
      )}

      {pathModal && (
        <div className="file-modal-overlay">
          <div className="file-modal-box max-w-2xl">
            <h3 className="font-bold text-lg">{pathModal.operation === "copy" ? "复制到" : "移动到"}文件夹</h3>
            <p className="py-2 text-sm text-[var(--color-neutral)]">
              已选择 {pathModal.files.length} 个文件/文件夹
            </p>
            
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">目标文件夹：</p>
              <FolderTree
                selectedPath={pathModal.targetPath}
                onPathSelect={(path) => setPathModal({ ...pathModal, targetPath: path })}
                excludePaths={pathModal.excludePaths}
              />
            </div>

            <div className="text-xs text-[var(--color-neutral-muted)] mb-2">
              当前选择：<span className="font-mono">{pathModal.targetPath}</span>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setPathModal(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleCopyMove}>{pathModal.operation === "copy" ? "复制" : "移动"}</button>
            </div>
          </div>
          <div className="file-modal-backdrop" onClick={() => setPathModal(null)}></div>
        </div>
      )}

      {previewModal && (
        <div className="file-modal-overlay">
          <div className="file-modal-box max-w-3xl">
            <h3 className="font-bold text-lg">{previewModal.name}</h3>
            <div className="py-4">
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <p><strong>路径：</strong> {previewModal.path}</p>
                <p><strong>大小：</strong> {formatFileSize(previewModal.size)}</p>
                <p><strong>修改时间：</strong> {formatDate(previewModal.modified)}</p>
                <p><strong>类型：</strong> {getFileTypeDescription(previewModal)}</p>
              </div>

              {/* 动态预览组件 */}
              {(() => {
                const entry = previewRegistry.match(previewModal);
                if (entry && entry.definition.component) {
                  const Component = entry.definition.component;
                  return (
                    <Suspense fallback={<div className="flex items-center justify-center py-8"><span className="loading loading-spinner loading-lg"></span></div>}>
                      <Component file={previewModal} serverUrl={getActiveServer()?.url || ""} />
                    </Suspense>
                  );
                }
                return <UnsupportedPreview file={previewModal} serverUrl={getActiveServer()?.url || ""} />;
              })()}
            </div>
            <div className="modal-action">
              {!previewModal.isDir && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => copyDownloadLink(previewModal)}>
                  下载
                </button>
              )}
              <button type="button" className="btn" onClick={() => setPreviewModal(null)}>关闭</button>
            </div>
          </div>
          <div className="file-modal-backdrop" onClick={() => setPreviewModal(null)}></div>
        </div>
      )}
    </div>
  );
}
