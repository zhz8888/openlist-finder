import { useState, useCallback, useEffect, useRef } from "react";
import { useFileBrowser } from "@/hooks";
import { useServerStore, useSettingsStore, useSearchStore, useFileBrowserStore, useToastStore } from "@/stores";
import { renameFile, deleteFiles, copyFiles, moveFiles, getFileInfo } from "@/services/openlist";
import { search as searchMeilisearch } from "@/services/meilisearch";
import { Breadcrumb, SortHeader } from "./Breadcrumb";
import type { FileInfo, SortField } from "@/types";

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
  const textTypes = ["text", "json", "xml", "yaml", "yml", "markdown", "md", "csv", "log", "ini", "conf", "cfg", "sh", "bat", "ps1", "py", "js", "ts", "jsx", "tsx", "css", "html", "sql", "env", "gitignore", "toml", "rs"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return textTypes.some((t) => ext === t || file.type?.includes(t));
}

function isImageFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return imageExts.includes(ext) || file.type?.startsWith("image/");
}

function getFileIcon(file: FileInfo) {
  if (file.isDir) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function FileList() {
  const { getActiveServer } = useServerStore();
  const { experimental, meilisearch } = useSettingsStore();
  const { query, setQuery, setResults, isSearching, setSearchError } = useSearchStore();
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!server) return;
    setPreviewLoading(true);
    try {
      const info = await getFileInfo(server.url, server.token, file.path);
      if (info.content) {
        setPreviewContent(info.content);
      } else {
        setPreviewContent("(No text content available for preview)");
      }
    } catch {
      setPreviewContent("(Failed to load file content)");
    } finally {
      setPreviewLoading(false);
    }
  }, [getActiveServer]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileInfo) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameModal) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      await renameFile(server.url, server.token, renameModal.file.path.replace(/\/[^/]+$/, "") || "/", renameModal.file.name, renameModal.newName);
      setRenameModal(null);
      addToast("success", `Renamed "${renameModal.file.name}" to "${renameModal.newName}"`);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Rename failed: ${msg}`);
    }
  }, [renameModal, getActiveServer, loadFiles, addToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteModal) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      await deleteFiles(server.url, server.token, deleteModal[0].path.replace(/\/[^/]+$/, "") || "/", deleteModal.map((f) => f.name));
      setDeleteModal(null);
      clearSelection();
      addToast("success", `Deleted ${deleteModal.length} file(s)`);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Delete failed: ${msg}`);
    }
  }, [deleteModal, getActiveServer, loadFiles, clearSelection, addToast]);

  const handleCopyMove = useCallback(async () => {
    if (!pathModal) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      const srcDir = pathModal.files[0].path.replace(/\/[^/]+$/, "") || "/";
      if (pathModal.operation === "copy") {
        await copyFiles(server.url, server.token, srcDir, pathModal.targetPath, pathModal.files.map((f) => f.name));
        addToast("success", `Copied ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
      } else {
        await moveFiles(server.url, server.token, srcDir, pathModal.targetPath, pathModal.files.map((f) => f.name));
        addToast("success", `Moved ${pathModal.files.length} file(s) to ${pathModal.targetPath}`);
      }
      setPathModal(null);
      loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `${pathModal.operation === "copy" ? "Copy" : "Move"} failed: ${msg}`);
    }
  }, [pathModal, getActiveServer, loadFiles, addToast]);

  const handleSearch = useCallback(async () => {
    if (!experimental.meilisearch || !query.trim()) return;
    const server = getActiveServer();
    if (!server) return;
    try {
      const indexUid = `${meilisearch.indexPrefix}-${server.id}`;
      const result = await searchMeilisearch(meilisearch.host, meilisearch.apiKey, indexUid, query);
      setResults(result.hits);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg);
      addToast("error", `Search failed: ${msg}`);
    }
  }, [experimental.meilisearch, query, getActiveServer, meilisearch, setResults, setSearchError, addToast]);

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
      addToast("info", `File content save for "${editModal.file.name}" is not supported by OpenList API. Use rename or delete+upload instead.`);
      setEditModal(null);
    } finally {
      setEditSaving(false);
    }
  }, [editModal, addToast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Breadcrumb />

      {experimental.meilisearch && (
        <div className="px-4 py-2 bg-base-100 border-b border-base-300 flex gap-2">
          <input
            type="text"
            placeholder="Search files..."
            className="input input-bordered input-sm flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            aria-label="Search files"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <span className="loading loading-spinner loading-xs"></span> : "Search"}
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-error mx-4 mt-2">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => loadFiles()}>Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-50">
            <p>No files found</p>
          </div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-8" aria-label="Select all">
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
                      aria-label="Select all files"
                    />
                  </label>
                </th>
                <SortHeader field="name" label="Name" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="size" label="Size" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="modified" label="Modified" currentSort={sortConfig} onSort={handleSort} />
                <SortHeader field="type" label="Type" currentSort={sortConfig} onSort={handleSort} />
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
                        aria-label={`Select ${file.name}`}
                      />
                    </label>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <span className={file.isDir ? "font-medium" : ""}>{file.name}</span>
                    </div>
                  </td>
                  <td className="text-xs opacity-70">{file.isDir ? "—" : formatFileSize(file.size)}</td>
                  <td className="text-xs opacity-70">{formatDate(file.modified)}</td>
                  <td className="text-xs opacity-70">{file.isDir ? "Directory" : file.type || "File"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu && (
        <div
          className="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300 fixed context-menu"
          style={{ "--ctx-x": `${contextMenu.x}px`, "--ctx-y": `${contextMenu.y}px` } as React.CSSProperties}
          role="menu"
          aria-label="File context menu"
        >
          <li role="menuitem"><button type="button" onClick={() => { setPreviewModal(contextMenu.file); setPreviewContent(null); if (isTextFile(contextMenu.file)) loadPreviewContent(contextMenu.file); setContextMenu(null); }}>View</button></li>
          {!contextMenu.file.isDir && isTextFile(contextMenu.file) && (
            <li role="menuitem"><button type="button" onClick={() => { setEditModal({ file: contextMenu.file, content: "" }); setContextMenu(null); }}>Edit</button></li>
          )}
          <li role="menuitem"><button type="button" onClick={() => { setRenameModal({ file: contextMenu.file, newName: contextMenu.file.name }); setContextMenu(null); }}>Rename</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setDeleteModal([contextMenu.file]); setContextMenu(null); }}>Delete</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setPathModal({ files: [contextMenu.file], operation: "copy", targetPath: "" }); setContextMenu(null); }}>Copy</button></li>
          <li role="menuitem"><button type="button" onClick={() => { setPathModal({ files: [contextMenu.file], operation: "move", targetPath: "" }); setContextMenu(null); }}>Move</button></li>
        </div>
      )}

      {renameModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Rename File</h3>
            <p className="py-2 text-sm opacity-70">Current: {renameModal.file.name}</p>
            <input
              type="text"
              className="input input-bordered w-full"
              value={renameModal.newName}
              onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              aria-label="New file name"
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setRenameModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setRenameModal(null)}>close</button></form>
        </dialog>
      )}

      {deleteModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Confirm Delete</h3>
            <p className="py-2">Are you sure you want to delete the following files?</p>
            <ul className="list-disc list-inside text-sm">
              {deleteModal.map((f) => <li key={f.name}>{f.name}</li>)}
            </ul>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="button" className="btn btn-error" onClick={handleDelete}>Delete</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setDeleteModal(null)}>close</button></form>
        </dialog>
      )}

      {pathModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{pathModal.operation === "copy" ? "Copy" : "Move"} Files</h3>
            <p className="py-2 text-sm">Target directory path:</p>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="/target/directory"
              value={pathModal.targetPath}
              onChange={(e) => setPathModal({ ...pathModal, targetPath: e.target.value })}
              aria-label="Target directory path"
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setPathModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCopyMove}>{pathModal.operation === "copy" ? "Copy" : "Move"}</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setPathModal(null)}>close</button></form>
        </dialog>
      )}

      {previewModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">{previewModal.name}</h3>
            <div className="py-4">
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <p><strong>Path:</strong> {previewModal.path}</p>
                <p><strong>Size:</strong> {formatFileSize(previewModal.size)}</p>
                <p><strong>Modified:</strong> {formatDate(previewModal.modified)}</p>
                <p><strong>Type:</strong> {previewModal.type || "Unknown"}</p>
              </div>

              {isImageFile(previewModal) && (
                <div className="border border-base-300 rounded-lg p-2 bg-base-200">
                  <img
                    src={`${getActiveServer()?.url}/d${previewModal.path}`}
                    alt={previewModal.name}
                    className="max-w-full max-h-96 mx-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.innerHTML = "<p class='text-center text-sm opacity-50 py-8'>Image preview not available</p>";
                    }}
                  />
                </div>
              )}

              {isTextFile(previewModal) && (
                <div className="border border-base-300 rounded-lg bg-base-200">
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="ml-2 text-sm opacity-70">Loading content...</span>
                    </div>
                  ) : previewContent ? (
                    <pre className="p-3 text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono">
                      {previewContent}
                    </pre>
                  ) : (
                    <p className="text-center text-sm opacity-50 py-8">No preview available</p>
                  )}
                </div>
              )}

              {!isTextFile(previewModal) && !isImageFile(previewModal) && (
                <div className="border border-base-300 rounded-lg p-4 bg-base-200 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm opacity-50 mt-2">Preview not available for this file type</p>
                </div>
              )}
            </div>
            <div className="modal-action">
              {isTextFile(previewModal) && (
                <button type="button" className="btn btn-sm" onClick={() => handleEditFile(previewModal)}>Edit</button>
              )}
              <button type="button" className="btn" onClick={() => { setPreviewModal(null); setPreviewContent(null); }}>Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => { setPreviewModal(null); setPreviewContent(null); }}>close</button></form>
        </dialog>
      )}

      {editModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">Edit: {editModal.file.name}</h3>
            <p className="text-xs opacity-50 mt-1">{editModal.file.path}</p>
            <div className="mt-4">
              <textarea
                ref={textareaRef}
                className="textarea textarea-bordered w-full font-mono text-xs leading-relaxed"
                rows={20}
                value={editModal.content}
                onChange={(e) => setEditModal({ ...editModal, content: e.target.value })}
                aria-label="File content editor"
                placeholder="Loading file content..."
              />
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? <span className="loading loading-spinner loading-xs"></span> : "Save"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={() => setEditModal(null)}>close</button></form>
        </dialog>
      )}
    </div>
  );
}
