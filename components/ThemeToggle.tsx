"use client";

import { useTheme } from "./ThemeProvider";
import { useId } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

type ThemeToggleVariant = "full" | "mode" | "palette";

export function ThemeToggle({
  variant = "full",
  className = "",
}: {
  variant?: ThemeToggleVariant;
  className?: string;
}) {
  const { theme, setTheme, palette, setPalette } = useTheme();
  const reducedMotion = useReducedMotion();
  const instanceId = useId();

  const themes = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  const paletteOptions = [
    { value: "default" as const, label: "Default", swatches: ["#4f46e5", "#7c3aed", "#14b8a6"] },
    { value: "ocean" as const, label: "Ocean", swatches: ["#0284c7", "#06b6d4", "#14b8a6"] },
    { value: "sunset" as const, label: "Sunset", swatches: ["#f97316", "#db2777", "#8b5cf6"] },
    { value: "forest" as const, label: "Forest", swatches: ["#16a34a", "#84cc16", "#14b8a6"] },
  ];

  const showThemeButtons = variant !== "palette";
  const showPalette = variant !== "mode";

  if (variant === "mode") {
    return (
      <div
        className={`inline-flex items-center gap-1 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-1 shadow-sm ${className}`}
      >
        <LayoutGroup id={`${instanceId}-theme-mode`}>
          {themes.map((t) => {
            const Icon = t.icon;
            const selected = theme === t.value;

            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors transition-transform hover:bg-surface-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                title={t.label}
                aria-label={`Switch to ${t.label} theme`}
                aria-pressed={selected}
                type="button"
              >
                {selected && (
                  <motion.span
                    layoutId={`${instanceId}-theme-toggle-indicator`}
                    className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border"
                    transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
                    aria-hidden="true"
                  />
                )}
                <span className={`relative z-10 ${selected ? "text-foreground" : "text-foreground-secondary"}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </LayoutGroup>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border border-border bg-background-secondary/60 dark:bg-background/20 p-2 shadow-sm ${className}`}
    >
      {showThemeButtons && (
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface/70 dark:bg-surface/50 p-1">
          <LayoutGroup id={`${instanceId}-theme-panel`}>
            {themes.map((t) => {
              const Icon = t.icon;
              const selected = theme === t.value;

              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className="relative flex-1 min-h-[40px] inline-flex items-center justify-center rounded-lg transition-colors transition-transform hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  title={t.label}
                  aria-label={`Switch to ${t.label} theme`}
                  aria-pressed={selected}
                  type="button"
                >
                  {selected && (
                    <motion.span
                      layoutId={`${instanceId}-theme-toggle-indicator`}
                      className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border"
                      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className={`relative z-10 ${selected ? "text-foreground" : "text-foreground-secondary"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                </button>
              );
            })}
          </LayoutGroup>
        </div>
      )}

      {showPalette && (
        <div className={`${showThemeButtons ? "mt-2" : ""} grid grid-cols-4 gap-1`}>
          {paletteOptions.map((opt) => {
            const selected = palette === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPalette(opt.value)}
                aria-pressed={selected}
                className={`relative min-h-[40px] rounded-xl border bg-surface/70 dark:bg-surface/50 px-2 transition-colors transition-transform hover:bg-surface-hover hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                  selected ? "border-primary/40" : "border-border/60"
                }`}
                title={opt.label}
                aria-label={`Use ${opt.label} palette`}
              >
                <span className="flex items-center justify-center gap-1" aria-hidden="true">
                  {opt.swatches.map((c) => (
                    <span
                      key={c}
                      className="h-2.5 w-2.5 rounded-full border border-border/60"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                {selected && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-white shadow-sm flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
