"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  const themes = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 bg-background-secondary dark:bg-surface rounded-lg p-1">
      <LayoutGroup id="theme-toggle">
        {themes.map((t) => {
          const Icon = t.icon;
          const selected = theme === t.value;

          return (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="relative p-2 rounded-md transition-colors hover:bg-surface dark:hover:bg-background focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              title={t.label}
              aria-label={`Switch to ${t.label} theme`}
              aria-pressed={selected}
              type="button"
            >
              {selected && (
                <motion.span
                  layoutId="theme-toggle-indicator"
                  className="absolute inset-0 rounded-md bg-primary shadow-sm"
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={`relative z-10 ${selected ? "text-white" : "text-foreground-secondary"}`}>
                <Icon className="w-4 h-4" />
              </span>
            </button>
          );
        })}
      </LayoutGroup>
    </div>
  );
}
