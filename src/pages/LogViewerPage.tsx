import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

const LOG_LEVELS = ["ALL", "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
const PAGE_SIZE = 50;

const LEVEL_COLORS: Record<string, string> = {
  TRACE: "text-base-content/50",
  DEBUG: "text-base-content/70",
  INFO: "text-blue-600",
  WARN: "text-yellow-600",
  ERROR: "text-red-600",
  CRITICAL: "text-red-700 font-bold",
};

const LEVEL_BADGE: Record<string, string> = {
  TRACE: "badge-trace",
  DEBUG: "badge-debug",
  INFO: "badge-info",
  WARN: "badge-warning",
  ERROR: "badge-error",
  CRITICAL: "badge-critical",
};

export function LogViewerPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const loadLogs = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      const levelFilter = selectedLevel === "ALL" ? null : selectedLevel;
      
      const result = await invoke<{ logs: LogEntry[]; total: number }>("get_logs", {
        request: {
          level: levelFilter,
          offset: currentOffset,
          limit: PAGE_SIZE,
        },
      });
      
      if (reset) {
        setLogs(result.logs);
        setOffset(PAGE_SIZE);
      } else {
        setLogs((prev) => [...prev, ...result.logs]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
      setTotal(result.total);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`加载日志失败: ${errorMsg}`);
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedLevel, offset, loading]);

  useEffect(() => {
    setOffset(0);
    loadLogs(true);
  }, [selectedLevel]);

  const handleScroll = useCallback(() => {
    const container = logContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    autoScrollRef.current = isNearBottom;
    
    if (isNearBottom && offset < total && !loading) {
      loadLogs();
    }
  }, [offset, total, loading, loadLogs]);

  const copyLog = async (log: LogEntry, index: number) => {
    try {
      const text = `[${log.timestamp}] [${log.level}] [${log.target}] ${log.message}`;
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      console.error("Failed to copy log");
    }
  };

  const clearLogs = async () => {
    try {
      setError(null);
      await invoke("clear_logs");
      setLogs([]);
      setOffset(0);
      setTotal(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`清空日志失败: ${errorMsg}`);
      console.error("Failed to clear logs:", err);
    }
  };

  const hasMore = offset < total;

  return (
    <div className="flex h-screen bg-base-100">
      <div className="flex-1 overflow-hidden p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-base-content">日志查看器</h1>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空日志
            </button>
            <a href="#/settings" className="btn btn-ghost btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回设置
            </a>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setError(null)}>
              关闭
            </button>
          </div>
        )}

        <div className="card bg-base-200 mb-4">
          <div className="card-body py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-base-content/70">日志等级：</span>
              <div className="flex gap-2 flex-wrap">
                {LOG_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`btn btn-xs ${
                      selectedLevel === level
                        ? "btn-primary"
                        : "btn-ghost"
                    }`}
                    onClick={() => setSelectedLevel(level)}
                  >
                    {level === "ALL" ? "全部" : level}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-sm text-base-content/60">
                共 {total} 条日志
              </div>
            </div>
          </div>
        </div>

        <div
          ref={logContainerRef}
          className="bg-base-200 rounded-lg overflow-hidden"
          style={{ height: "calc(100vh - 280px)" }}
          onScroll={handleScroll}
        >
          <div className="overflow-y-auto h-full">
            {logs.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-full text-base-content/50">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>暂无日志记录</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-base-300">
                {logs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className="px-4 py-2 hover:bg-base-300/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-base-content/50 font-mono shrink-0 pt-0.5">
                        {log.timestamp}
                      </span>
                      <span className={`badge badge-sm ${LEVEL_BADGE[log.level] || "badge-ghost"} shrink-0`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-base-content/60 font-mono shrink-0 max-w-[150px] truncate" title={log.target}>
                        {log.target}
                      </span>
                      <span className={`text-sm flex-1 break-all ${LEVEL_COLORS[log.level] || "text-base-content"}`}>
                        {log.message}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => copyLog(log, index)}
                        title="复制日志"
                      >
                        {copiedIndex === index ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="px-4 py-4 text-center">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                )}
                {!hasMore && logs.length > 0 && (
                  <div className="px-4 py-4 text-center text-sm text-base-content/50">
                    已加载全部日志
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
