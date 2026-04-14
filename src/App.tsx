import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components";
import { MainLayout, SettingsPage } from "@/pages";

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
