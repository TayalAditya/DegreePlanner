"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark" | "system";
const PALETTES = ["default", "ocean", "sunset", "forest"] as const;
type ThemePalette = (typeof PALETTES)[number];

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always initialise to defaults – reading localStorage here causes a React
  // hydration mismatch (#418) because the server cannot know the user's
  // persisted preference.  We sync from localStorage in useEffect instead.
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [palette, setPaletteState] = useState<ThemePalette>("default");

  // Hydrate from localStorage after the first client-side render so that the
  // initial server render and the client reconciliation use the same values.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        setThemeState(savedTheme);
      }
      const savedPalette = localStorage.getItem("degreePlanner.palette") as ThemePalette | null;
      if (savedPalette && PALETTES.includes(savedPalette)) {
        setPaletteState(savedPalette);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const prefersDark = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );

  const effectiveTheme: "light" | "dark" =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    const root = window.document.documentElement;

    if (palette === "default") {
      delete root.dataset.palette;
      return;
    }

    root.dataset.palette = palette;
  }, [palette]);

  const setTheme = (newTheme: ThemeMode) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
  };

  const setPalette = (newPalette: ThemePalette) => {
    localStorage.setItem("degreePlanner.palette", newPalette);
    setPaletteState(newPalette);
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
