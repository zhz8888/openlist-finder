import { useState, useCallback, useEffect, useRef } from "react";
import { useFileBrowser } from "@/hooks";
import { useServerStore, useSettingsStore, useSearchStore, useFileBrowserStore, useToastStore } from "@/stores";
import type { IndexAvailabilityStatus } from "@/stores/searchStore";
import { renameFile, deleteFiles, copyFiles, moveFiles, getFileInfo, executeWithTokenRefresh } from "@/services/openlist";
import { search as searchMeilisearch, getStats } from "@/services/meilisearch";
import { Breadcrumb, SortHeader } from "./Breadcrumb";
import { logger } from "@/utils/logger";
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

function isTextFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  const textExts = ["txt", "text", "json", "xml", "yaml", "yml", "markdown", "md", "csv", "log", "ini", "conf", "cfg", "sh", "bat", "ps1", "py", "js", "ts", "jsx", "tsx", "css", "html", "sql", "env", "gitignore", "toml", "rs", "go", "java", "c", "cpp", "h", "hpp", "vue", "svelte"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return textExts.includes(ext);
}

function isImageFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "avif"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return imageExts.includes(ext);
}

function getFileIcon(file: FileInfo) {
  if (file.isDir) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

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
  const [renameModal, setRenameModal] = useState<{ file: FileInfo; newName: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<FileInfo[] | null>(null);
  const [pathModal, setPathModal] = useState<{ files: FileInfo[]; operation: "copy" | "move"; targetPath: string } | null>(null);
  const [previewModal, setPreviewModal] = useState<FileInfo | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editModal, setEditModal] = useState<{ file: FileInfo; content: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    const interval = setInterval(checkIndex, 5000);
    return () => clearInterval(interval);
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
      setPreviewContent(null);
      if (isTextFile(file)) {
        loadPreviewContent(file);
      }
    }
  }, [navigateToDirectory, loadFiles, currentPath]);

  const loadPreviewContent = useCallback(async (file: FileInfo) => {
    const server = getActiveServer();
    if (!server || !file.path) return;
    setPreviewLoading(true);
    try {
      logger.debug(`[OpenList] Loading preview content for "${file.name}"`);
      const info = await executeWithTokenRefresh(
        () => getFileInfo(server.url, server.token, file.path!)
      );
      if (info.content) {
        logger.debug(`[OpenList] Preview content loaded for "${file.name}"`);
        setPreviewContent(info.content);
      } else {
        logger.debug(`[OpenList] No text content for preview of "${file.name}"`);
        setPreviewContent("（无文本内容可供预览）");
      }
    } catch {
      logger.error(`[OpenList] Failed to load preview content for "${file.name}"`);
      setPreviewContent("（加载文件内容失败）");
    } finally {
      setPreviewLoading(false);
    }
  }, [getActiveServer]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileInfo) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameModal || !renameModal.file.path) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      logger.info(`[OpenList] Renaming file "${renameModal.file.name}" to "${renameModal.newName}"`);
      await executeWithTokenRefresh(
        () => renameFile(server.url, server.token, renameModal.file.path!.replace(/\/[^/]+$/, "") || "/", renameModal.file.name, renameModal.newName)
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
    try {
      const fileNames = deleteModal.map((f) => f.name);
      logger.info(`[OpenList] Deleting ${deleteModal.length} file(s): ${fileNames.join(", ")}`);
      await executeWithTokenRefresh(
        () => deleteFiles(server.url, server.token, deleteModal[0].path!.replace(/\/[^/]+$/, "") || "/", fileNames)
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
      if (pathModal.operation === "copy") {
        logger.info(`[OpenList] Copying ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
        await executeWithTokenRefresh(
          () => copyFiles(server.url, server.token, srcDir, pathModal.targetPath, fileNames)
        );
        logger.info(`[OpenList] ${pathModal.files.length} file(s) copied successfully`);
        addToast("success", `已复制 ${pathModal.files.length} 个文件到 ${pathModal.targetPath}`);
      } else {
        logger.info(`[OpenList] Moving ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
        await executeWithTokenRefresh(
          () => moveFiles(server.url, server.token, srcDir, pathModal.targetPath, fileNames)
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

  const handleEditFile = useCallback((file: FileInfo) => {
    const server = getActiveServer();
    if (!server) return;
    setEditModal({ file, content: previewContent || "" });
    setPreviewModal(null);
  }, [getActiveServer, previewContent]);

  const handleSaveEdit = useCallback(async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      addToast("info", `保存文件 "${editModal.file.name}" 的功能不受 OpenList API 支持。请使用重命名或删除后重新上传。`);
      setEditModal(null);
    } finally {
      setEditSaving(false);
    }
  }, [editModal, addToast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
                    <th>大小</th>
                    <th>修改时间</th>
                    <th>类型</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((doc) => {
                    const file = convertDocToFileInfo(doc);
                    return (
                      <tr
                        key={doc.id}
                        className="hover cursor-pointer"
                        onDoubleClick={() => {
                          if (file.isDir) {
                            handleClearSearch();
                            loadFiles(file.path);
                          } else {
                            setPreviewModal(file);
                            setPreviewContent(null);
                            if (isTextFile(file)) {
                              loadPreviewContent(file);
                            }
                          }
                        }}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            {getFileIcon(file)}
                            <span className={file.isDir ? "font-medium" : ""}>{file.name}</span>
                          </div>
                        </td>
                        <td className="text-xs text-[var(--color-neutral)]">{doc.dir_path || "/"}</td>
                        <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "—" : formatFileSize(file.size)}</td>
                        <td className="text-xs text-[var(--color-neutral)]">{formatDate(file.modified)}</td>
                        <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "文件夹" : "文件"}</td>
                      </tr>
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
                <SortHeader field="size" label="大小" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="modified" label="修改时间" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="type" label="类型" currentSort={sortConfig} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.path}
                  className={`hover cursor-pointer ${selectedFiles.has(file.name) ? "active" : ""}`}
                  onClick={() => toggleFileSelection(file.name)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selectedFiles.has(file.name)}
                        onChange={() => toggleFileSelection(file.name)}
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
                  <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "—" : formatFileSize(file.size)}</td>
                  <td className="text-xs text-[var(--color-neutral)]">{formatDate(file.modified)}</td>
                  <td className="text-xs text-[var(--color-neutral)]">{file.isDir ? "文件夹" : file.type || "文件"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu && (
        <div
          className="dropdown-content menu bg-[var(--color-bg)] rounded-lg z-50 w-52 p-2 shadow-lg border border-[var(--color-border)] fixed context-menu"
          style={{ "--ctx-x": `${contextMenu.x}px`, "--ctx-y": `${contextMenu.y}px` } as React.CSSProperties}
          role="menu"
          aria-label="文件右键菜单"
        >
          <li role="menuitem"><button type="button" onClick={() => { setPreviewModal(contextMenu.file); setPreviewContent(null); if (isTextFile(contextMenu.file)) loadPreviewContent(contextMenu.file); setContextMenu(null); }}>查看</button></li>
          {!contextMenu.file.isDir && isTextFile(contextMenu.file) && (
            <li role="menuitem"><button type="button" onClick={() => { setEditModal({ file: contextMenu.file, content: "" }); setContextMenu(null); }}>编辑</button></li>
          )}
          <li role="menuitem"><button type="button" onClick={() => { setRenameModal({ file: contextMenu.file, newName: contextMenu.file.name }); setContextMenu(null); }}>重命名</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setDeleteModal([contextMenu.file]); setContextMenu(null); }}>删除</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setPathModal({ files: [contextMenu.file], operation: "copy", targetPath: "" }); setContextMenu(null); }}>复制</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setPathModal({ files: [contextMenu.file], operation: "move", targetPath: "" }); setContextMenu(null); }}>移动</button></li>
        </div>
      )}

      {renameModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
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
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setRenameModal(null)}>关闭</button></form>
        </dialog>
      )}

      {deleteModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
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
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setDeleteModal(null)}>关闭</button></form>
        </dialog>
      )}

      {pathModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{pathModal.operation === "copy" ? "复制" : "移动"}文件</h3>
            <p className="py-2 text-sm">目标目录路径：</p>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="/目标目录"
              value={pathModal.targetPath}
              onChange={(e) => setPathModal({ ...pathModal, targetPath: e.target.value })}
              aria-label="目标目录路径"
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setPathModal(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleCopyMove}>{pathModal.operation === "copy" ? "复制" : "移动"}</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setPathModal(null)}>关闭</button></form>
        </dialog>
      )}

      {previewModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">{previewModal.name}</h3>
            <div className="py-4">
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <p><strong>路径：</strong> {previewModal.path}</p>
                <p><strong>大小：</strong> {formatFileSize(previewModal.size)}</p>
                <p><strong>修改时间：</strong> {formatDate(previewModal.modified)}</p>
                <p><strong>类型：</strong> {previewModal.type || "未知"}</p>
              </div>

              {isImageFile(previewModal) && (
                <div className="border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-github-surface)]">
                  <img
                    src={`${getActiveServer()?.url}/d${previewModal.path}`}
                    alt={previewModal.name}
                    className="max-w-full max-h-96 mx-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.innerHTML = "<p class='text-center text-sm opacity-50 py-8'>图片预览不可用</p>";
                    }}
                  />
                </div>
              )}

              {isTextFile(previewModal) && (
                <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)]">
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="ml-2 text-sm opacity-70">正在加载内容...</span>
                    </div>
                  ) : previewContent ? (
                    <pre className="p-3 text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono">
                      {previewContent}
                    </pre>
                  ) : (
                    <p className="text-center text-sm opacity-50 py-8">预览不可用</p>
                  )}
                </div>
              )}

              {!isTextFile(previewModal) && !isImageFile(previewModal) && (
                <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-github-surface)] text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm opacity-50 mt-2">此文件类型不支持预览</p>
                </div>
              )}
            </div>
            <div className="modal-action">
              {isTextFile(previewModal) && (
                <button type="button" className="btn btn-sm" onClick={() => handleEditFile(previewModal)}>编辑</button>
              )}
              <button type="button" className="btn" onClick={() => { setPreviewModal(null); setPreviewContent(null); }}>关闭</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => { setPreviewModal(null); setPreviewContent(null); }}>关闭</button></form>
        </dialog>
      )}

      {editModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">编辑：{editModal.file.name}</h3>
            <p className="text-xs opacity-50 mt-1">{editModal.file.path}</p>
            <div className="mt-4">
              <textarea
                ref={textareaRef}
                className="textarea textarea-bordered w-full font-mono text-xs leading-relaxed"
                rows={20}
                value={editModal.content}
                onChange={(e) => setEditModal({ ...editModal, content: e.target.value })}
                aria-label="文件内容编辑器"
                placeholder="正在加载文件内容..."
              />
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? <span className="loading loading-spinner loading-xs"></span> : "保存"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setEditModal(null)}>关闭</button></form>
        </dialog>
      )}
    </div>
  );
}
