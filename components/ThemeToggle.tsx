"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 bg-background-secondary dark:bg-surface rounded-lg p-1">
      {themes.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`p-2 rounded-md transition-colors ${
              theme === t.value
                ? "bg-primary text-white"
                : "text-foreground-secondary hover:bg-surface dark:hover:bg-background"
            }`}
            title={t.label}
            aria-label={`Switch to ${t.label} theme`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
