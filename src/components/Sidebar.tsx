import { useServerStore, useSettingsStore, useSearchStore, useFileBrowserStore } from "@/stores";
import { useFileBrowser } from "@/hooks";

export function Sidebar() {
  const { servers, activeServerId, setActiveServer } = useServerStore();
  const { sidebarCollapsed, setSidebarCollapsed } = useSettingsStore();
  const { indexProgress } = useSearchStore();
  const { loadFiles } = useFileBrowser();
  const rawFiles = useFileBrowserStore((s) => s.files);
  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleServerSwitch = (id: string) => {
    setActiveServer(id);
    loadFiles("/");
  };

  const handleToggleCollapsed = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={`flex flex-col bg-[var(--color-github-surface)] border-r border-[var(--color-border)] sidebar-transition ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        {!sidebarCollapsed && <h2 className="font-bold text-sm truncate">OpenList Finder</h2>}
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={handleToggleCollapsed}
          title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-300" style={{ transform: `rotate(${sidebarCollapsed ? 180 : 0}deg)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {sidebarCollapsed ? (
        <div className="flex-1 flex flex-col items-center py-2 overflow-y-auto">
          <div className="flex flex-col items-center gap-1 w-full">
            {servers.map((s) => (
              <button
                  key={s.id}
                  className={`btn btn-ghost btn-sm btn-square w-10 h-10 ${s.id === activeServerId ? "btn-active" : ""}`}
                  onClick={() => handleServerSwitch(s.id)}
                  title={s.name}
                >
                  {s.name.charAt(0).toUpperCase()}
                </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 flex-1 overflow-y-auto sidebar-content">
          {activeServer ? (
            <div className="space-y-3">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs text-[var(--color-neutral)]">服务器</span>
                </label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={activeServerId || ""}
                  onChange={(e) => handleServerSwitch(e.target.value)}
                  title="选择服务器"
                  aria-label="选择服务器"
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stat bg-[var(--color-bg)] rounded-lg p-3">
                <div className="stat-title text-xs">服务器名称</div>
                <div className="stat-value text-base truncate">{activeServer.name}</div>
              </div>

              <div className="stat bg-[var(--color-bg)] rounded-lg p-3">
                <div className="stat-title text-xs">文件总数</div>
                <div className="stat-value text-base">{rawFiles.length}</div>
              </div>

              <div className="stat bg-[var(--color-bg)] rounded-lg p-3">
                <div className="stat-title text-xs">索引状态</div>
                {indexProgress.isRunning ? (
                  <div className="flex items-center gap-2">
                    <progress
                      className="progress progress-primary progress-xs w-full"
                      value={indexProgress.percentage}
                      max="100"
                    ></progress>
                    <span className="text-xs">{indexProgress.percentage.toFixed(0)}%</span>
                  </div>
                ) : (
                  <div className="stat-value text-base">
                    {indexProgress.indexed} / {indexProgress.total || "—"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
            <p className="text-sm text-[var(--color-neutral)]">未配置服务器</p>
            <p className="text-xs text-[var(--color-neutral-muted)] mt-1">请在设置中添加服务器</p>
          </div>
          )}
        </div>
      )}

      <div className="p-3 border-t border-[var(--color-border)]">
        <a href="#/settings" className={`btn btn-ghost btn-sm gap-2 ${sidebarCollapsed ? "btn-square w-full justify-center" : "w-full justify-start"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!sidebarCollapsed && "设置"}
        </a>
      </div>
    </div>
  );
}
