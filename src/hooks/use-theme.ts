import { useState, useEffect } from "react";

type ThemeMode = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "dbus-theme";

/**
 * localStorage is unavailable in some contexts (privacy mode, sandboxed
 * iframes, test environments). A throw here used to take the whole theme
 * switcher out of the topbar, so both access paths are guarded.
 */
function readStoredMode(): ThemeMode | null {
  try {
    return (globalThis.localStorage?.getItem(STORAGE_KEY) as ThemeMode | null) ?? null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: ThemeMode): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    /* persistence is best-effort */
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode() || "dark");

  const resolved = resolveTheme(mode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolved);
    writeStoredMode(mode);
  }, [mode, resolved]);

  const setTheme = (next: ThemeMode) => setMode(next);
  const toggleTheme = () => {
    setMode((m) => (m === "dark" ? "light" : m === "light" ? "system" : "dark"));
  };

  return { theme: mode, resolved, setTheme, toggleTheme };
}
