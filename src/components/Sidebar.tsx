import { useState } from "react";
import { useServerStore, useSearchStore, useFileBrowserStore } from "@/stores";
import { useFileBrowser } from "@/hooks";

export function Sidebar() {
  const { servers, activeServerId, setActiveServer } = useServerStore();
  const { indexProgress } = useSearchStore();
  const { loadFiles } = useFileBrowser();
  const rawFiles = useFileBrowserStore((s) => s.files);
  const [collapsed, setCollapsed] = useState(false);
  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleServerSwitch = (id: string) => {
    setActiveServer(id);
    loadFiles("/");
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-1 bg-base-200 border-r border-base-300 w-14">
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <div className="divider my-1"></div>
        {servers.map((s) => (
          <button
            key={s.id}
            className={`btn btn-ghost btn-xs btn-square mb-1 ${s.id === activeServerId ? "btn-active" : ""}`}
            onClick={() => handleServerSwitch(s.id)}
            title={s.name}
          >
            {s.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-base-200 border-r border-base-300 w-64 min-w-[16rem]">
      <div className="flex items-center justify-between p-3 border-b border-base-300">
        <h2 className="font-bold text-sm truncate">OpenList Finder</h2>
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        {activeServer ? (
          <div className="space-y-3">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs opacity-70">Server</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={activeServerId || ""}
                onChange={(e) => handleServerSwitch(e.target.value)}
                title="Select server"
                aria-label="Select server"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="stat bg-base-100 rounded-box p-3">
              <div className="stat-title text-xs">Server Name</div>
              <div className="stat-value text-base truncate">{activeServer.name}</div>
            </div>

            <div className="stat bg-base-100 rounded-box p-3">
              <div className="stat-title text-xs">Total Files</div>
              <div className="stat-value text-base">{rawFiles.length}</div>
            </div>

            <div className="stat bg-base-100 rounded-box p-3">
              <div className="stat-title text-xs">Index Status</div>
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
            <p className="text-sm opacity-60">No server configured</p>
            <p className="text-xs opacity-40 mt-1">Add a server in Settings</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-base-300">
        <a href="#/settings" className="btn btn-ghost btn-sm w-full justify-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </a>
      </div>
    </div>
  );
}
