import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, ErrorBoundary, ToastContainer } from "@/components";
import { MainLayout, SettingsPage } from "@/pages";
import { useServerStore, useSettingsStore } from "@/stores";

function AppInitializer() {
  useEffect(() => {
    const initializeStores = async () => {
      await useServerStore.getState().initialize();
      await useSettingsStore.getState().initialize();
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
          </Routes>
        </HashRouter>
        <ToastContainer />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
