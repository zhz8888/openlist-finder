import { useState } from "react";
import { useServerStore, useSettingsStore } from "@/stores";
import { testConnection } from "@/services/openlist";
import { testConnection as testMeilisearchConnection } from "@/services/meilisearch";
import type { ThemeConfig } from "@/types";

export function SettingsPage() {
  const { servers, addServer, removeServer, updateServer, setDefaultServer } = useServerStore();
  const { meilisearch, experimental, theme, updateMeilisearch, setExperimental, setTheme } = useSettingsStore();

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
        setTestResult("Server added successfully!");
      } else {
        setTestResult(`Connection test failed: ${result.message}`);
      }
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestConnection = async () => {
    if (!newServerUrl || !newServerToken) return;
    try {
      const result = await testConnection(newServerUrl, newServerToken);
      setTestResult(result.success ? "Connection successful!" : `Failed: ${result.message}`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestMeilisearch = async () => {
    if (!meilisearch.host || !meilisearch.apiKey) return;
    try {
      const result = await testMeilisearchConnection(meilisearch.host, meilisearch.apiKey);
      setMeilisearchTestResult(result ? "Connection successful!" : "Connection failed");
    } catch (err) {
      setMeilisearchTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
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

  return (
    <div className="flex h-screen bg-base-100">
      <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <a href="#/" className="btn btn-ghost btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </a>
        </div>

        <div className="space-y-8">
          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">OpenList Servers</h2>

              <div className="space-y-3 mt-2">
                {servers.map((server) => (
                  <div key={server.id} className="flex items-center gap-2 bg-base-100 rounded-lg p-3">
                    {editingServer === server.id ? (
                      <div className="flex-1 space-y-2">
                        <input type="text" className="input input-bordered input-sm w-full" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                        <input type="text" className="input input-bordered input-sm w-full" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="URL" />
                        <input type="password" className="input input-bordered input-sm w-full" value={editToken} onChange={(e) => setEditToken(e.target.value)} placeholder="Token" />
                        <div className="flex gap-2">
                          <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingServer(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="font-medium">{server.name}</div>
                          <div className="text-xs opacity-60">{server.url}</div>
                        </div>
                        <div className="flex gap-1">
                          {server.isDefault ? (
                            <span className="badge badge-primary badge-sm">Default</span>
                          ) : (
                            <button className="btn btn-ghost btn-xs" onClick={() => setDefaultServer(server.id)}>Set Default</button>
                          )}
                          <button className="btn btn-ghost btn-xs" onClick={() => handleStartEdit(server.id)}>Edit</button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => removeServer(server.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="divider">Add New Server</div>

              <div className="space-y-2">
                <input type="text" className="input input-bordered w-full" value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="Server Name" />
                <input type="text" className="input input-bordered w-full" value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} placeholder="Server URL (e.g., https://example.com)" />
                <input type="password" className="input input-bordered w-full" value={newServerToken} onChange={(e) => setNewServerToken(e.target.value)} placeholder="Access Token" />
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={handleAddServer} disabled={!newServerName || !newServerUrl || !newServerToken}>Add Server</button>
                  <button className="btn btn-ghost" onClick={handleTestConnection} disabled={!newServerUrl || !newServerToken}>Test Connection</button>
                </div>
                {testResult && (
                  <div className={`alert ${testResult.includes("success") ? "alert-success" : "alert-error"} text-sm`}>
                    {testResult}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">Experimental Features</h2>
              <p className="text-sm opacity-70">Enable experimental features that are still in development.</p>
              <div className="form-control mt-2">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={experimental.meilisearch}
                    onChange={(e) => setExperimental({ meilisearch: e.target.checked })}
                  />
                  <div>
                    <span className="label-text font-medium">Meilisearch Integration</span>
                    <p className="text-xs opacity-60">Enable file search and indexing via Meilisearch</p>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {experimental.meilisearch && (
            <section className="card bg-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg">
                  Meilisearch Configuration
                  <span className="badge badge-warning badge-sm">Experimental</span>
                </h2>
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={meilisearch.host}
                    onChange={(e) => updateMeilisearch({ host: e.target.value })}
                    placeholder="Meilisearch Host (e.g., http://localhost:7700)"
                  />
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={meilisearch.apiKey}
                    onChange={(e) => updateMeilisearch({ apiKey: e.target.value })}
                    placeholder="API Key"
                  />
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={meilisearch.indexPrefix}
                    onChange={(e) => updateMeilisearch({ indexPrefix: e.target.value })}
                    placeholder="Index Prefix (default: openlist)"
                  />
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Sync Strategy</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={meilisearch.syncStrategy}
                      onChange={(e) => updateMeilisearch({ syncStrategy: e.target.value as "manual" | "auto" })}
                      title="Sync Strategy"
                      aria-label="Sync Strategy"
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Automatic</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={handleTestMeilisearch} disabled={!meilisearch.host || !meilisearch.apiKey}>
                      Test Connection
                    </button>
                  </div>
                  {meilisearchTestResult && (
                    <div className={`alert ${meilisearchTestResult.includes("success") ? "alert-success" : "alert-error"} text-sm`}>
                      {meilisearchTestResult}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">Theme</h2>
              <div className="form-control mt-2">
                <label className="label">
                  <span className="label-text">Appearance</span>
                </label>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`btn btn-sm ${theme.mode === mode ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setTheme({ mode } as ThemeConfig)}
                    >
                      {mode === "light" ? "☀️ Light" : mode === "dark" ? "🌙 Dark" : "💻 System"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
