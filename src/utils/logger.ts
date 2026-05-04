import { invoke } from "@tauri-apps/api/core";

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

/**
 * 将前端日志发送到后端日志系统
 */
async function sendLogToBackend(level: LogLevel, message: string): Promise<void> {
  try {
    await invoke("forward_frontend_log", {
      logEntry: {
        timestamp: new Date().toISOString(),
        level,
        message,
      },
    });
  } catch (err) {
    console.error("Failed to forward log to backend:", err);
  }
}

/**
 * 日志记录器
 */
export const logger = {
  trace: (message: string) => sendLogToBackend("TRACE", message),
  debug: (message: string) => sendLogToBackend("DEBUG", message),
  info: (message: string) => sendLogToBackend("INFO", message),
  warn: (message: string) => sendLogToBackend("WARN", message),
  error: (message: string) => sendLogToBackend("ERROR", message),
  critical: (message: string) => sendLogToBackend("CRITICAL", message),
};
