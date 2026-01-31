// Theme configuration with dark and light modes
export const colors = {
  light: {
    primary: '#4f46e5', // Indigo
    primaryHover: '#4338ca',
    secondary: '#06b6d4', // Cyan
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    surface: '#ffffff',
    surfaceHover: '#f3f4f6',
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
    },
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  dark: {
    primary: '#6366f1', // Lighter indigo for dark mode
    primaryHover: '#818cf8',
    secondary: '#22d3ee', // Lighter cyan
    background: '#0f172a', // Slate 900
    backgroundSecondary: '#1e293b', // Slate 800
    surface: '#1e293b',
    surfaceHover: '#334155',
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
    },
    border: '#334155',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';
