import { useEffect, useCallback, type ReactNode } from "react";
import { useSettingsStore } from "@/stores";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(mode: "light" | "dark" | "system") {
  let resolvedTheme: "light" | "dark";
  if (mode === "system") {
    resolvedTheme = getSystemTheme();
  } else {
    resolvedTheme = mode;
  }
  const dataTheme = resolvedTheme === "dark" ? "github-dark" : "github-light";
  document.documentElement.setAttribute("data-theme", dataTheme);
  localStorage.setItem("openlist-theme", mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useSettingsStore((s) => s.theme.mode);
  const setThemeMode = useSettingsStore((s) => s.setTheme);

  const updateTheme = useCallback((mode: "light" | "dark" | "system") => {
    applyTheme(mode);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("openlist-theme") as "light" | "dark" | "system" | null;
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      setThemeMode({ mode: savedTheme as "light" | "dark" | "system" });
    } else {
      applyTheme(themeMode);
    }
  }, []);

  useEffect(() => {
    updateTheme(themeMode);
  }, [themeMode, updateTheme]);

  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeMode]);

  return <>{children}</>;
}
