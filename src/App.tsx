import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, ErrorBoundary, ToastContainer } from "@/components";
import { MainLayout, SettingsPage } from "@/pages";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
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
