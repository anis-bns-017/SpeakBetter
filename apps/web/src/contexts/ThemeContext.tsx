import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

interface ThemeContextValue {
  /** What the learner chose */
  theme: ThemePreference;
  /** What is on screen now (system turns into light or dark) */
  resolved: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  /** True once the learner picked a theme on this device */
  chosenHere: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme() ?? "system");
  const [chosenHere, setChosenHere] = useState(() => readStoredTheme() !== null);
  const [systemTick, setSystemTick] = useState(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, systemTick]);

  // "Match my device" follows the device when it switches between light and dark
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTick((n) => n + 1);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  // Another tab changed the theme
  useEffect(() => {
    const onStorage = () => {
      const stored = readStoredTheme();
      if (stored) setThemeState(stored);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    storeTheme(next);
    setChosenHere(true);
    setThemeState(next);
  }, []);

  const value = useMemo(
    // systemTick is listed so "system" re-resolves when the device flips
    () => ({ theme, resolved: resolveTheme(theme), setTheme, chosenHere, systemTick }),
    [theme, setTheme, chosenHere, systemTick],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
