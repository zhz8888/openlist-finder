import { useState } from "react";
import { useServerStore, useSettingsStore } from "@/stores";
import { testConnection } from "@/services/openlist";
import { testConnection as testMeilisearchConnection } from "@/services/meilisearch";
import type { ThemeConfig } from "@/types";

export function SettingsPage() {
  const { servers, addServer, removeServer, updateServer, setDefaultServer } = useServerStore();
  const { meilisearch, theme, updateMeilisearch, setTheme } = useSettingsStore();

  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerToken, setNewServerToken] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [meilisearchTestResult, setMeilisearchTestResult] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editToken, setEditToken] = useState("");

  const handleAddServer = async () => {
    if (!newServerName || !newServerUrl || !newServerToken) return;
    try {
      const result = await testConnection(newServerUrl, newServerToken);
      if (result.success) {
        addServer(newServerName, newServerUrl, newServerToken);
        setNewServerName("");
        setNewServerUrl("");
        setNewServerToken("");
        setTestResult("服务器添加成功！");
      } else {
        setTestResult(`连接测试失败：${result.message}`);
      }
    } catch (err) {
      setTestResult(`错误：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestConnection = async () => {
    if (!newServerUrl || !newServerToken) return;
    try {
      const result = await testConnection(newServerUrl, newServerToken);
      setTestResult(result.success ? "连接成功！" : `失败：${result.message}`);
    } catch (err) {
      setTestResult(`错误：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestMeilisearch = async () => {
    if (!meilisearch.host || !meilisearch.apiKey) return;
    try {
      const result = await testMeilisearchConnection(meilisearch.host, meilisearch.apiKey);
      setMeilisearchTestResult(result ? "连接成功！" : "连接失败");
    } catch (err) {
      setMeilisearchTestResult(`错误：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleStartEdit = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;
    setEditingServer(serverId);
    setEditName(server.name);
    setEditUrl(server.url);
    setEditToken(server.token);
  };

  const handleSaveEdit = () => {
    if (!editingServer) return;
    updateServer(editingServer, { name: editName, url: editUrl.replace(/\/+$/, ""), token: editToken });
    setEditingServer(null);
  };

  const handleThemeChange = (mode: "light" | "dark" | "system") => {
    setTheme({ mode } as ThemeConfig);
  };

  return (
    <div className="flex h-screen bg-base-100">
      <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-base-content">设置</h1>
          <a href="#/" className="btn btn-ghost btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </a>
        </div>

        <div className="space-y-8">
          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">OpenList 服务器</h2>

              <div className="space-y-3 mt-2">
                {servers.map((server) => (
                  <div key={server.id} className="flex items-center gap-2 bg-base-100 rounded-lg p-3">
                    {editingServer === server.id ? (
                      <div className="flex-1 space-y-2">
                        <input type="text" className="input input-bordered input-sm w-full" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="名称" />
                        <input type="text" className="input input-bordered input-sm w-full" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="地址" />
                        <input type="password" className="input input-bordered input-sm w-full" value={editToken} onChange={(e) => setEditToken(e.target.value)} placeholder="令牌" />
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEdit}>保存</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingServer(null)}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{server.name}</div>
                          <div className="text-xs text-neutral truncate">{server.url}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0 flex-wrap">
                          {server.isDefault ? (
                            <span className="badge badge-primary badge-sm">默认</span>
                          ) : (
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDefaultServer(server.id)}>设为默认</button>
                          )}
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleStartEdit(server.id)}>编辑</button>
                          <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeServer(server.id)}>删除</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="divider">添加新服务器</div>

              <div className="bg-base-100 rounded-lg p-4 space-y-3">
                <input type="text" className="input input-bordered w-full" value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="服务器名称" />
                <input type="text" className="input input-bordered w-full" value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} placeholder="服务器地址（例如：https://example.com）" />
                <input type="password" className="input input-bordered w-full" value={newServerToken} onChange={(e) => setNewServerToken(e.target.value)} placeholder="访问令牌" />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={handleAddServer} disabled={!newServerName || !newServerUrl || !newServerToken}>添加服务器</button>
                  <button type="button" className="btn btn-ghost" onClick={handleTestConnection} disabled={!newServerUrl || !newServerToken}>测试连接</button>
                </div>
                {testResult && (
                  <div className={`alert ${testResult.includes("成功") ? "alert-success" : "alert-error"} text-sm`}>
                    {testResult}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">Meilisearch 配置</h2>
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={meilisearch.host}
                    onChange={(e) => updateMeilisearch({ host: e.target.value })}
                    placeholder="Meilisearch 地址（例如：http://localhost:7700）"
                  />
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={meilisearch.apiKey}
                    onChange={(e) => updateMeilisearch({ apiKey: e.target.value })}
                    placeholder="API 密钥"
                  />
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={meilisearch.indexPrefix}
                    onChange={(e) => updateMeilisearch({ indexPrefix: e.target.value })}
                    placeholder="索引前缀（默认：openlist）"
                  />
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">同步策略</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={meilisearch.syncStrategy}
                      onChange={(e) => updateMeilisearch({ syncStrategy: e.target.value as "manual" | "auto" })}
                      title="同步策略"
                      aria-label="同步策略"
                    >
                      <option value="manual">手动</option>
                      <option value="auto">自动</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost" onClick={handleTestMeilisearch} disabled={!meilisearch.host || !meilisearch.apiKey}>
                      测试连接
                    </button>
                  </div>
                  {meilisearchTestResult && (
                    <div className={`alert ${meilisearchTestResult.includes("成功") ? "alert-success" : "alert-error"} text-sm`}>
                      {meilisearchTestResult}
                    </div>
                  )}
                </div>
              </div>
            </section>

          <section className="card bg-base-200" role="region" aria-labelledby="theme-heading">
            <div className="card-body">
              <h2 className="card-title text-lg" id="theme-heading">主题</h2>
              <p className="text-sm text-secondary mb-4">选择您偏好的颜色主题</p>
              <div
                role="radiogroup"
                aria-label="主题选择"
                className="flex gap-3 flex-wrap"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={Boolean(theme.mode === "light")}
                  className={`theme-btn ${theme.mode === "light" ? "theme-btn-active" : ""}`}
                  onClick={() => handleThemeChange("light")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      handleThemeChange("dark");
                    }
                  }}
                  tabIndex={theme.mode === "light" ? 0 : -1}
                >
                  <span className="theme-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4"></circle>
                      <path d="M12 2v2"></path>
                      <path d="M12 20v2"></path>
                      <path d="m4.93 4.93 1.41 1.41"></path>
                      <path d="m17.66 17.66 1.41 1.41"></path>
                      <path d="M2 12h2"></path>
                      <path d="M20 12h2"></path>
                      <path d="m6.34 17.66-1.41 1.41"></path>
                      <path d="m19.07 4.93-1.41 1.41"></path>
                    </svg>
                  </span>
                  <span className="theme-label">浅色主题</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={Boolean(theme.mode === "dark")}
                  className={`theme-btn ${theme.mode === "dark" ? "theme-btn-active" : ""}`}
                  onClick={() => handleThemeChange("dark")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      handleThemeChange("system");
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      handleThemeChange("light");
                    }
                  }}
                  tabIndex={theme.mode === "dark" ? 0 : -1}
                >
                  <span className="theme-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                    </svg>
                  </span>
                  <span className="theme-label">深色主题</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={Boolean(theme.mode === "system")}
                  className={`theme-btn ${theme.mode === "system" ? "theme-btn-active" : ""}`}
                  onClick={() => handleThemeChange("system")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      handleThemeChange("dark");
                    }
                  }}
                  tabIndex={theme.mode === "system" ? 0 : -1}
                >
                  <span className="theme-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="3" rx="2"></rect>
                      <line x1="8" x2="16" y1="21" y2="3"></line>
                      <path d="M12 17v4"></path>
                      <path d="M8 21h8"></path>
                    </svg>
                  </span>
                  <span className="theme-label">跟随系统</span>
                </button>
              </div>
              <p className="text-xs text-secondary mt-2" aria-live="polite">
                当前：{theme.mode === "system" ? "跟随系统设置" : `使用${theme.mode === "light" ? "浅色" : "深色"}主题`}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
