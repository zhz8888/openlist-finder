import { useEffect } from "react";
import { useSettingsStore } from "@/stores";

export function useTheme() {
  const { theme, setTheme, getResolvedTheme } = useSettingsStore();

  useEffect(() => {
    const resolved = getResolvedTheme();
    const dataTheme = resolved === "dark" ? "github-dark" : "github-light";
    document.documentElement.setAttribute("data-theme", dataTheme);

    if (theme.mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const newTheme = mediaQuery.matches ? "github-dark" : "github-light";
        document.documentElement.setAttribute("data-theme", newTheme);
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, getResolvedTheme]);

  return { theme, setTheme, resolvedTheme: getResolvedTheme() };
}
