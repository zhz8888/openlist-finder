import { useEffect } from "react";
import { Sidebar, FileList } from "@/components";
import { useFileBrowser } from "@/hooks";
import { useServerStore } from "@/stores";

export function HomePage() {
  const { loadFiles } = useFileBrowser();
  const { activeServerId, servers } = useServerStore();

  useEffect(() => {
    if (activeServerId) {
      loadFiles("/");
    }
  }, [activeServerId, loadFiles]);

  if (!activeServerId || servers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-neutral-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h2 className="text-xl font-semibold text-base-content">欢迎使用 OpenList Finder</h2>
          <p className="text-sm text-neutral">请在设置中添加 OpenList 服务器以开始使用</p>
          <a href="#/settings" className="btn btn-primary btn-sm">前往设置</a>
        </div>
      </div>
    );
  }

  return <FileList />;
}

export function MainLayout() {
  return (
    <div className="flex h-screen bg-base-100">
      <Sidebar />
      <HomePage />
    </div>
  );
}
