import { invoke } from "@tauri-apps/api/core";

type LogLevel = "log" | "error" | "warn" | "info" | "debug";

interface FrontendLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

function formatLogMessage(_level: LogLevel, args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function forwardToTauri(level: LogLevel, args: unknown[]): void {
  try {
    const message = formatLogMessage(level, args);
    const logEntry: FrontendLogEntry = {
      timestamp: new Date().toISOString(),
      level: level === "error" ? "ERROR" : "INFO",
      message: message,
    };

    invoke("forward_frontend_log", { logEntry }).catch((err) => {
      originalConsole.debug("[LogForwarder] 转发日志到 Tauri 失败:", err);
    });
  } catch (error) {
    originalConsole.debug("[LogForwarder] 拦截日志时发生错误:", error);
  }
}

let isInitialized = false;

export function initLogForwarder(): void {
  if (isInitialized) return;

  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return;
  }

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    forwardToTauri("log", args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    forwardToTauri("error", args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    forwardToTauri("warn", args);
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    forwardToTauri("info", args);
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    forwardToTauri("debug", args);
  };

  isInitialized = true;
  originalConsole.log("[LogForwarder] 前端日志转发已启用");
}
