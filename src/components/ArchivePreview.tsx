import { useState, useCallback, useEffect } from "react";
import type { FileInfo } from "@/types";

interface ArchiveEntry {
  name: string;
  size: number;
  type: "file" | "directory";
  path: string;
  content?: string;
}

interface ArchivePreviewProps {
  file: FileInfo;
  serverUrl: string;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function ArchivePreview({ file, serverUrl }: ArchivePreviewProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null);
  const [viewingContent, setViewingContent] = useState(false);

  const archiveUrl = `${serverUrl}/d${file.path}`;

  // 加载压缩包文件列表
  const loadArchiveEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 尝试通过服务器API获取压缩包内容列表
      // 注意：这里需要根据实际的服务器API来实现
      // 目前使用模拟数据展示UI结构
      const response = await fetch(archiveUrl, {
        method: "HEAD",
      });

      if (!response.ok) {
        throw new Error("无法访问压缩包文件");
      }

      // TODO: 实际项目中需要调用服务器的解压API
      // 这里提供一个示例结构，实际应该从服务器获取
      setEntries([
        {
          name: "示例文件.txt",
          size: 1024,
          type: "file",
          path: "示例文件.txt",
        },
        {
          name: "文件夹",
          size: 0,
          type: "directory",
          path: "文件夹/",
        },
      ]);

      setError("当前版本暂不支持压缩包内容预览，请下载后查看");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [archiveUrl]);

  // 查看文件内容
  const viewFileContent = useCallback(async (entry: ArchiveEntry) => {
    setSelectedEntry(entry);
    setViewingContent(true);

    // TODO: 实际项目中需要调用服务器的解压单个文件API
    // entry.content = await fetchArchiveFileContent(archiveUrl, entry.path);
  }, [archiveUrl]);

  // 返回列表
  const backToList = useCallback(() => {
    setSelectedEntry(null);
    setViewingContent(false);
  }, []);

  useEffect(() => {
    loadArchiveEntries();
  }, [loadArchiveEntries]);

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)]">
      {/* 头部信息 */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {viewingContent && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={backToList}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回
              </button>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h4 className="font-medium">{file.name}</h4>
          </div>
          <span className="text-xs opacity-50">{formatFileSize(file.size)}</span>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-h-80 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="ml-2 text-sm opacity-70">正在加载压缩包内容...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm opacity-50 mt-2">{error}</p>
            <button
              type="button"
              className="btn btn-sm btn-primary mt-4"
              onClick={() => window.open(archiveUrl, "_blank")}
            >
              下载压缩包
            </button>
          </div>
        )}

        {!isLoading && !error && viewingContent && selectedEntry && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-sm">{selectedEntry.name}</h5>
              <span className="text-xs opacity-50">{formatFileSize(selectedEntry.size)}</span>
            </div>
            {selectedEntry.content ? (
              <pre className="p-3 text-xs bg-[var(--color-base)] rounded-lg overflow-auto max-h-60 whitespace-pre-wrap break-words font-mono">
                {selectedEntry.content}
              </pre>
            ) : (
              <p className="text-sm opacity-50 text-center py-4">该文件类型暂不支持预览</p>
            )}
          </div>
        )}

        {!isLoading && !error && !viewingContent && entries.length > 0 && (
          <table className="table w-full text-sm">
            <thead className="bg-[var(--color-base)] sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">文件名</th>
                <th className="px-4 py-2 text-right">大小</th>
                <th className="px-4 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index} className="border-t border-[var(--color-border)] hover:bg-[var(--color-base)]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {entry.type === "directory" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-neutral)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <span>{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-xs opacity-50">
                    {entry.type === "directory" ? "—" : formatFileSize(entry.size)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {entry.type === "file" && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => viewFileContent(entry)}
                      >
                        查看
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm opacity-50">压缩包为空</p>
          </div>
        )}
      </div>
    </div>
  );
}
