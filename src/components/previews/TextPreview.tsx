import { useState, useCallback, useEffect } from "react";
import type { PreviewProps } from "./types";
import { getFileInfo, executeWithTokenRefresh } from "@/services/openlist";

export function TextPreview({ file, serverUrl }: PreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    if (!serverUrl || !file.path) return;

    setIsLoading(true);
    setError(null);

    try {
      const info = await executeWithTokenRefresh(
        () => getFileInfo(serverUrl, "", file.path!)
      );
      setContent(info.content ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, file.path]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="loading loading-spinner loading-sm"></span>
        <span className="ml-2 text-sm opacity-70">正在加载内容...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-[var(--color-danger)]">
        <p>{error}</p>
        <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={loadContent}>
          重试
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <p className="text-center text-sm opacity-50 py-8">无文本内容可供预览</p>
    );
  }

  return (
    <pre className="p-3 text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)]">
      {content}
    </pre>
  );
}