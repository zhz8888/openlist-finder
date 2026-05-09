import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, ErrorBoundary, ToastContainer } from "@/components";
import { MainLayout, SettingsPage } from "@/pages";
import { LogViewerPage } from "@/pages/LogViewerPage";
import { useServerStore, useSettingsStore, useToastStore } from "@/stores";

function AppInitializer() {
  useEffect(() => {
    const initializeStores = async () => {
      try {
        await useServerStore.getState().initialize();
      } catch (error) {
        console.error("Failed to initialize server store:", error);
        useToastStore.getState().addToast("error", "初始化服务器配置失败");
      }
      try {
        await useSettingsStore.getState().initialize();
      } catch (error) {
        console.error("Failed to initialize settings store:", error);
        useToastStore.getState().addToast("error", "初始化设置失败");
      }
    };
    initializeStores();
  }, []);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppInitializer />
        <HashRouter>
          <Routes>
            <Route path="/" element={<MainLayout />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/logs" element={<LogViewerPage />} />
          </Routes>
        </HashRouter>
        <ToastContainer />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
