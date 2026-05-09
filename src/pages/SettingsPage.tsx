import { useState, useCallback } from "react";
import { useServerStore, useSettingsStore, useToastStore } from "@/stores";
import { testConnection, validateServerUrl } from "@/services/openlist";
import { testConnection as testMeilisearchConnection } from "@/services/meilisearch";
import { createIndexesForAllServers, createIndexForServer } from "@/services/indexManager";
import { PasswordInput } from "@/components";
import { logger } from "@/utils/logger";
import type { ThemeConfig, MCPLogLevel, ServerConfig } from "@/types";

export function SettingsPage() {
  const { servers, addServer, removeServer, updateServer } = useServerStore();
  const { meilisearch, theme, mcp, updateMeilisearch, setTheme, updateMCP, resetMCP } = useSettingsStore();
  const addToast = useToastStore((s) => s.addToast);

  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerToken, setNewServerToken] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [meilisearchTestResult, setMeilisearchTestResult] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editTestResult, setEditTestResult] = useState<string | null>(null);
  const [mcpExpanded, setMcpExpanded] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        addToast("success", "配置已复制到剪贴板");
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          addToast("success", "配置已复制到剪贴板");
        } catch {
          addToast("error", "复制失败，请手动复制");
        }
        document.body.removeChild(textArea);
      }
    } catch {
      addToast("error", "复制失败，请手动复制");
    }
  }, [addToast]);

  const handleAddServer = useCallback(async () => {
    if (!newServerName || !newServerUrl || !newServerToken) return;
    try {
      logger.info(`[AddServer] Starting to add server: ${newServerName} (${newServerUrl})`);
      const validation = validateServerUrl(newServerUrl);
      if (!validation.valid) {
        logger.error(`[AddServer] URL validation failed: ${validation.error}`);
        setTestResult(`错误：${validation.error}`);
        return;
      }

      const newServerId = await addServer(newServerName, validation.normalizedUrl || newServerUrl, newServerToken);
      logger.info(`[AddServer] Server added successfully, ID: ${newServerId}`);

      setNewServerName("");
      setNewServerUrl("");
      setNewServerToken("");

      if (meilisearch.host && meilisearch.apiKey && newServerId) {
        logger.info(`[AddServer] Creating index for new server...`);
        addToast("info", "正在为新服务器创建索引...");
        const indexResult = await createIndexForServer(
          meilisearch.host,
          meilisearch.apiKey,
          meilisearch.indexPrefix,
          {
            id: newServerId,
            name: newServerName,
            url: validation.normalizedUrl || newServerUrl,
            token: newServerToken,
            createdAt: new Date().toISOString(),
          } as ServerConfig
        );

        if (indexResult.success) {
          logger.info(`[AddServer] Index "${indexResult.indexUid}" created successfully`);
          setTestResult(`服务器添加成功！索引 "${indexResult.indexUid}" 已创建`);
          addToast("success", `索引 "${indexResult.indexUid}" 创建成功`);
        } else {
          logger.warn(`[AddServer] Index creation failed: ${indexResult.error}`);
          setTestResult(`服务器添加成功，但索引创建失败: ${indexResult.error}`);
          addToast("warning", `索引创建失败: ${indexResult.error}`);
        }
      } else {
        logger.info(`[AddServer] Meilisearch not configured, skipping index creation`);
        setTestResult("服务器添加成功！（Meilisearch 未配置，跳过索引创建）");
        addToast("success", "服务器添加成功");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[AddServer] Exception: ${errorMsg}`);
      setTestResult(`错误：${errorMsg}`);
    }
  }, [newServerName, newServerUrl, newServerToken, meilisearch, addServer, addToast]);

  const handleTestConnection = useCallback(async () => {
    if (!newServerUrl || !newServerToken) return;
    try {
      logger.info(`[OpenListConnectionTest] Starting connection test: ${newServerUrl}`);
      const validation = validateServerUrl(newServerUrl);
      if (!validation.valid) {
        logger.error(`[OpenListConnectionTest] URL validation failed: ${validation.error}`);
        setTestResult(`错误：${validation.error}`);
        return;
      }
      const result = await testConnection(validation.normalizedUrl || newServerUrl, newServerToken);
      if (result.success) {
        logger.info(`[OpenListConnectionTest] Connection successful: ${validation.normalizedUrl || newServerUrl}`);
      } else {
        logger.warn(`[OpenListConnectionTest] Connection failed: ${result.message}`);
      }
      setTestResult(result.success ? "连接成功！" : `失败：${result.message}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenListConnectionTest] Exception: ${errorMsg}`);
      setTestResult(`错误：${errorMsg}`);
    }
  }, [newServerUrl, newServerToken]);

  const handleTestMeilisearch = useCallback(async () => {
    if (!meilisearch.host || !meilisearch.apiKey) return;
    try {
      logger.info(`[MeilisearchConnectionTest] Starting connection test: ${meilisearch.host}`);
      const result = await testMeilisearchConnection(meilisearch.host, meilisearch.apiKey);
      if (result) {
        logger.info(`[MeilisearchConnectionTest] Connection successful, creating indexes for all servers...`);
        setMeilisearchTestResult("连接成功！正在为所有服务器创建索引...");
        addToast("info", "Meilisearch 连接成功，正在创建索引...");

        if (servers.length > 0) {
          logger.debug(`[MeilisearchIndexCreation] Starting index creation for ${servers.length} servers`);
          const indexResults = await createIndexesForAllServers(
            meilisearch.host,
            meilisearch.apiKey,
            meilisearch.indexPrefix,
            servers
          );

          const successCount = indexResults.filter((r) => r.success).length;
          const failCount = indexResults.filter((r) => !r.success).length;

          if (failCount === 0) {
            logger.info(`[MeilisearchIndexCreation] All successful, total ${successCount} indexes`);
            setMeilisearchTestResult(`连接成功！已为 ${successCount} 个服务器创建索引`);
            addToast("success", `已为 ${successCount} 个服务器创建索引`);
          } else {
            const failedNames = indexResults
              .filter((r) => !r.success)
              .map((r) => r.serverName)
              .join(", ");
            logger.warn(`[MeilisearchIndexCreation] ${successCount} succeeded, ${failCount} failed: ${failedNames}`);
            setMeilisearchTestResult(
              `连接成功！${successCount} 个索引创建成功，${failCount} 个失败: ${failedNames}`
            );
            addToast("warning", `${failCount} 个索引创建失败，请查看日志`);
          }
        } else {
          logger.info(`[MeilisearchIndexCreation] No servers added yet`);
          setMeilisearchTestResult("连接成功！当前没有已添加的服务器");
          addToast("success", "Meilisearch 连接成功");
        }
      } else {
        logger.error(`[MeilisearchConnectionTest] Connection failed`);
        setMeilisearchTestResult("连接失败");
        addToast("error", "Meilisearch 连接失败");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[MeilisearchConnectionTest] Exception: ${errorMsg}`);
      setMeilisearchTestResult(`错误：${errorMsg}`);
      addToast("error", `Meilisearch 连接错误：${errorMsg}`);
    }
  }, [meilisearch, servers, addToast]);

  const handleStartEdit = useCallback((serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;
    setEditingServer(serverId);
    setEditName(server.name);
    setEditUrl(server.url);
    setEditToken(server.token || "");
    setEditTestResult(null);
  }, [servers]);

  const handleTestEditConnection = useCallback(async () => {
    if (!editUrl || !editToken) return;
    try {
      logger.info(`[OpenListEditConnectionTest] Starting connection test: ${editUrl}`);
      const validation = validateServerUrl(editUrl);
      if (!validation.valid) {
        logger.error(`[OpenListEditConnectionTest] URL validation failed: ${validation.error}`);
        setEditTestResult(`错误：${validation.error}`);
        return;
      }
      const result = await testConnection(validation.normalizedUrl || editUrl, editToken);
      if (result.success) {
        logger.info(`[OpenListEditConnectionTest] Connection successful: ${validation.normalizedUrl || editUrl}`);
      } else {
        logger.warn(`[OpenListEditConnectionTest] Connection failed: ${result.message}`);
      }
      setEditTestResult(result.success ? "连接成功！" : `失败：${result.message}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[OpenListEditConnectionTest] Exception: ${errorMsg}`);
      setEditTestResult(`错误：${errorMsg}`);
    }
  }, [editUrl, editToken]);

  const handleSaveEdit = useCallback(() => {
    if (!editingServer) return;
    logger.info(`[UpdateServer] Updating server ${editingServer} with new token`);
    updateServer(editingServer, { name: editName, url: editUrl.replace(/\/+$/, ""), token: editToken });
    logger.info(`[UpdateServer] Server updated successfully`);
    setEditingServer(null);
    addToast("success", "服务器配置已更新");
  }, [editingServer, editName, editUrl, editToken, updateServer, addToast]);

  const handleRemoveServer = useCallback(async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    const serverName = server?.name || "服务器";
    try {
      logger.info(`[RemoveServer] Removing server: ${serverName} (${serverId})`);
      await removeServer(serverId);
      logger.info(`[RemoveServer] Server removed successfully: ${serverName}`);
      addToast("success", `已删除服务器 "${serverName}"`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[RemoveServer] Failed to remove server: ${errorMsg}`);
      addToast("error", `删除服务器失败：${errorMsg}`);
    }
  }, [servers, removeServer, addToast]);

  const handleThemeChange = useCallback((mode: "light" | "dark" | "system") => {
    setTheme({ mode } as ThemeConfig);
  }, [setTheme]);

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-y-auto">
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">设置</h1>
          <a href="#/" className="btn btn-ghost btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </a>
        </div>

        <div className="space-y-8">
          <section className="card bg-[var(--color-github-surface)] mb-12">
            <div className="card-body">
              <h2 className="card-title text-lg">OpenList 服务器</h2>

              <div className="space-y-3 mt-2">
                {servers.map((server) => (
                  <div key={server.id} className="flex items-center gap-2 bg-[var(--color-bg)] rounded-lg p-3">
                    {editingServer === server.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="名称"
                        />
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="地址"
                        />
                        <PasswordInput
                          value={editToken}
                          onChange={setEditToken}
                          placeholder="Token"
                        />
                        {editTestResult && (
                          <div className={`result-message ${editTestResult.includes("成功") ? "result-success" : "result-error"}`}>
                            <div className="result-icon">
                              {editTestResult.includes("成功") ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                            <div className="result-text">{editTestResult}</div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                            保存
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={handleTestEditConnection}
                            disabled={!editUrl || !editToken}
                          >
                            测试连接
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingServer(null)}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{server.name}</div>
                          <div className="text-xs text-[var(--color-neutral)] truncate">{server.url}</div>
                        </div>
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleStartEdit(server.id)}>编辑</button>
                          <button type="button" className="btn btn-ghost btn-xs text-[var(--color-danger)]" onClick={() => handleRemoveServer(server.id)}>删除</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="divider divider-start text-[var(--color-fg)] font-medium">添加新服务器</div>

              <div className="space-y-2 mt-2">
                <input type="text" className="input input-bordered w-full" value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="服务器名称" />
                <input type="text" className="input input-bordered w-full" value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} placeholder="服务器地址（例如：https://example.com）" />
                <PasswordInput
                  value={newServerToken}
                  onChange={setNewServerToken}
                  placeholder="Token"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn btn-primary" onClick={handleAddServer} disabled={!newServerName || !newServerUrl || !newServerToken}>添加服务器</button>
                  <button type="button" className="btn btn-ghost test-connection-btn" onClick={handleTestConnection} disabled={!newServerUrl || !newServerToken}>测试连接</button>
                </div>
                {testResult && (
                  <div className={`result-message ${testResult.includes("成功") ? "result-success" : "result-error"}`}>
                    <div className="result-icon">
                      {testResult.includes("成功") ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="result-text">{testResult}</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card bg-[var(--color-github-surface)] mb-12">
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
                  <PasswordInput
                    value={meilisearch.apiKey}
                    onChange={(value) => updateMeilisearch({ apiKey: value })}
                    placeholder="API 密钥"
                  />
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={meilisearch.indexPrefix}
                    onChange={(e) => updateMeilisearch({ indexPrefix: e.target.value })}
                    placeholder="索引前缀"
                  />
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">同步策略</span>
                    </label>
                    <select
                      className="select select-bordered w-full select-with-outline"
                      value={meilisearch.syncStrategy}
                      onChange={(e) => updateMeilisearch({ syncStrategy: e.target.value as "manual" | "auto" })}
                      title="同步策略"
                      aria-label="同步策略"
                    >
                      <option value="manual">手动</option>
                      <option value="auto">自动</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" className="btn btn-primary" onClick={() => addToast("success", "Meilisearch 配置已保存")}>
                      保存配置
                    </button>
                    <button type="button" className="btn btn-ghost test-connection-btn" onClick={handleTestMeilisearch} disabled={!meilisearch.host || !meilisearch.apiKey}>
                      测试连接
                    </button>
                  </div>
                  {meilisearchTestResult && (
                    <div className={`result-message ${meilisearchTestResult.includes("成功") ? "result-success" : "result-error"}`}>
                      <div className="result-icon">
                        {meilisearchTestResult.includes("成功") ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="result-text">{meilisearchTestResult}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

          <section className="card bg-[var(--color-github-surface)] mb-12">
            <div className="card-body">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h2 className="card-title text-lg">MCP 服务器配置</h2>
                  <p className="text-sm text-[var(--color-fg)]/70">
                    配置 Model Context Protocol 服务器，供 AI 助手通过 stdio 连接使用
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={`text-sm font-medium toggle-status-label ${mcp.enabled ? "toggle-status-enabled" : "toggle-status-disabled"}`}
                    onClick={() => updateMCP({ enabled: !mcp.enabled })}
                    aria-pressed={mcp.enabled ? "true" : "false"}
                    aria-label={mcp.enabled ? "点击禁用MCP服务器" : "点击启用MCP服务器"}
                  >
                    {mcp.enabled ? "已启用" : "已禁用"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost border border-[var(--color-border)]"
                    onClick={() => setMcpExpanded(!mcpExpanded)}
                    aria-expanded={mcpExpanded ? "true" : "false"}
                    aria-label={mcpExpanded ? "收起配置" : "展开配置"}
                  >
                    <span>{mcpExpanded ? "收起" : "展开"}</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 transition-transform duration-200 ${mcpExpanded ? "rotate-180" : ""}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {mcpExpanded && (
                <div className="space-y-4 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">服务器名称</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={mcp.serverName}
                        onChange={(e) => updateMCP({ serverName: e.target.value })}
                        placeholder="MCP 服务器名称"
                        disabled={!mcp.enabled}
                      />
                      <label className="label">
                        <span className="label-text-alt text-[var(--color-fg)]/60">显示给连接的 AI 助手</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">服务器版本</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={mcp.serverVersion}
                        onChange={(e) => updateMCP({ serverVersion: e.target.value })}
                        placeholder="例如：0.1.0"
                        disabled={!mcp.enabled}
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">日志级别</span>
                      </label>
                      <select
                        className="select select-bordered w-full select-with-outline"
                        value={mcp.logLevel}
                        onChange={(e) => updateMCP({ logLevel: e.target.value as MCPLogLevel })}
                        disabled={!mcp.enabled}
                        title="日志级别"
                        aria-label="日志级别"
                      >
                        <option value="debug">Debug（调试）</option>
                        <option value="info">Info（信息）</option>
                        <option value="warn">Warn（警告）</option>
                        <option value="error">Error（错误）</option>
                      </select>
                      <label className="label">
                        <span className="label-text-alt text-[var(--color-fg)]/60">控制 MCP 服务器的日志输出级别</span>
                      </label>
                    </div>

                    <div className="bg-[var(--color-bg)] rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-[var(--color-fg)]">Claude Desktop 配置示例</h3>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            const config = {
                              mcpServers: {
                                [mcp.serverName]: {
                                  command: "path/to/openlist-finder",
                                  args: ["--mcp"]
                                }
                              }
                            };
                            copyToClipboard(JSON.stringify(config, null, 2));
                          }}
                          disabled={!mcp.enabled}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          复制
                        </button>
                      </div>
                      <p className="text-sm text-[var(--color-fg)]/70 mb-3">
                        将以下配置添加到 Claude Desktop 的配置文件中：
                      </p>
                      <pre className="bg-[var(--color-github-surface-hover)] p-4 rounded-lg text-xs overflow-x-auto font-mono text-[var(--color-fg)] border-2 border-[var(--color-border)] shadow-inner">
{JSON.stringify({
  mcpServers: {
    [mcp.serverName]: {
      command: "path/to/openlist-finder",
      args: ["--mcp"]
    }
  }
}, null, 2)}
                      </pre>
                      <div className="mt-3 text-xs text-[var(--color-fg)]/70">
                        <p className="font-medium mb-1">配置文件位置：</p>
                        <p>macOS: <code className="bg-[var(--color-github-surface-hover)] px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
                        <p className="mt-1">Windows: <code className="bg-[var(--color-github-surface-hover)] px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        className="btn btn-ghost reset-default-btn"
                        onClick={resetMCP}
                        disabled={!mcp.enabled}
                      >
                        重置为默认
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card bg-[var(--color-github-surface)] mb-12" role="region" aria-labelledby="theme-heading">
            <div className="card-body">
              <h2 className="card-title text-lg" id="theme-heading">主题</h2>
              <p className="text-sm text-[var(--color-neutral)] mb-4">选择您偏好的颜色主题</p>
              <div
                role="radiogroup"
                aria-label="主题选择"
                className="flex gap-3 flex-wrap"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme.mode === "light" ? "true" : "false"}
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
                  aria-checked={theme.mode === "dark" ? "true" : "false"}
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
                  aria-checked={theme.mode === "system" ? "true" : "false"}
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
              <p className="text-xs text-[var(--color-neutral)] mt-2" aria-live="polite">
                当前：{theme.mode === "system" ? "跟随系统设置" : `使用${theme.mode === "light" ? "浅色" : "深色"}主题`}
              </p>
            </div>
          </section>

          <section className="card bg-[var(--color-github-surface)] mb-12">
            <div className="card-body">
              <h2 className="card-title text-lg">系统工具</h2>
              <p className="text-sm text-[var(--color-neutral)] mb-4">查看应用程序日志和诊断信息</p>
              <a
                href="#/logs"
                className="btn btn-outline gap-3 justify-start h-auto py-4 px-4 log-viewer-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">查看程序日志</div>
                  <div className="text-xs text-[var(--color-fg)]/60 font-normal">查看 DEBUG、INFO、WARNING、ERROR 等各级日志</div>
                </div>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
