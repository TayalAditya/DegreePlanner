import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Map to CSS variables for easy theming
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        'background-secondary': "rgb(var(--background-secondary-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        'surface-elevated': "rgb(var(--surface-elevated-rgb) / <alpha-value>)",
        'surface-hover': "rgb(var(--surface-hover-rgb) / <alpha-value>)",

        // shadcn-style aliases (used by some pages)
        card: "rgb(var(--surface-rgb) / <alpha-value>)",
        muted: "rgb(var(--background-secondary-rgb) / <alpha-value>)",
        'muted-foreground': "rgb(var(--foreground-secondary-rgb) / <alpha-value>)",
        
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        'foreground-secondary': "rgb(var(--foreground-secondary-rgb) / <alpha-value>)",
        'foreground-muted': "rgb(var(--foreground-muted-rgb) / <alpha-value>)",
        
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        'border-strong': "rgb(var(--border-strong-rgb) / <alpha-value>)",
        
        // Brand colors with extended palette
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--primary-hover-rgb) / <alpha-value>)",
          light: "rgb(var(--primary-light-rgb) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary-rgb) / <alpha-value>)",
          hover: "rgb(var(--secondary-hover-rgb) / <alpha-value>)",
          light: "rgb(var(--secondary-light-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--accent-hover-rgb) / <alpha-value>)",
          light: "rgb(var(--accent-light-rgb) / <alpha-value>)",
        },
        
        // Semantic colors with light variants
        success: {
          DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)",
          light: "rgb(var(--success-light-rgb) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)",
          light: "rgb(var(--warning-light-rgb) / <alpha-value>)",
        },
        error: {
          DEFAULT: "rgb(var(--error-rgb) / <alpha-value>)",
          light: "rgb(var(--error-light-rgb) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--info-rgb) / <alpha-value>)",
          light: "rgb(var(--info-light-rgb) / <alpha-value>)",
        },
        
        hover: "rgb(var(--hover-rgb) / <alpha-value>)",
        active: "rgb(var(--active-rgb) / <alpha-value>)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        'print': {'raw': 'print'},
        'touch': {'raw': '(hover: none) and (pointer: coarse)'},
        'no-touch': {'raw': '(hover: hover) and (pointer: fine)'},
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
};
export default config;
