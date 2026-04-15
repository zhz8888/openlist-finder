import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores";

export function useTheme() {
  const { theme, setTheme, getResolvedTheme } = useSettingsStore();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => getResolvedTheme());

  useEffect(() => {
    const handleThemeChange = () => {
      setResolvedTheme(getResolvedTheme());
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleThemeChange);

    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [getResolvedTheme]);

  useEffect(() => {
    setResolvedTheme(getResolvedTheme());
  }, [theme, getResolvedTheme]);

  return { theme, setTheme, resolvedTheme };
}
