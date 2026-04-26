// Optimistic update utilities for better UX

import { QueryClient } from "@tanstack/react-query";

type MutationContext<T> = {
  previousData?: T;
};

export function createOptimisticUpdate<T>(queryKey: string[]) {
  return {
    // Optimistic update on mutation start
    onMutate: async (newData: Partial<T>) => {
      const queryClient = new QueryClient();
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T>(queryKey);

      // Optimistically update to new value
      queryClient.setQueryData<T>(queryKey, (old: any) => {
        if (Array.isArray(old)) {
          return [...old, newData];
        }
        return { ...old, ...newData };
      });

      return { previousData };
    },

    // Rollback on error
    onError: (err: Error, newData: T, context?: MutationContext<T>) => {
      const queryClient = new QueryClient();
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    // Refetch on success or error
    onSettled: () => {
      const queryClient = new QueryClient();
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

// Debounce utility for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle utility for scroll/resize events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Local storage with JSON parsing
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    if (typeof window === "undefined") return defaultValue || null;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  },

  remove(key: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },

  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.clear();
  },
};

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

const CREDIT_SCALE = 300;

export type CreditValue = number | string | null | undefined;

export function toCreditUnits(value: CreditValue): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;

  const sign = numeric < 0 ? -1 : 1;
  const absolute = Math.abs(numeric);
  const whole = Math.trunc(absolute);
  const cents = Math.round((absolute - whole) * 100);

  if (cents === 33 || cents === 34) {
    return sign * (whole * CREDIT_SCALE + CREDIT_SCALE / 3);
  }

  if (cents === 66 || cents === 67) {
    return sign * (whole * CREDIT_SCALE + (2 * CREDIT_SCALE) / 3);
  }

  return Math.round((numeric + Number.EPSILON) * CREDIT_SCALE);
}

export function fromCreditUnits(units: number): number {
  const numeric = Number(units || 0);
  if (!Number.isFinite(numeric)) return 0;

  return numeric / CREDIT_SCALE;
}

export function normalizeCredits(value: CreditValue): number {
  return fromCreditUnits(toCreditUnits(value));
}

export function sumCredits(values: CreditValue[]): number {
  return fromCreditUnits(values.reduce<number>((sum, value) => sum + toCreditUnits(value), 0));
}

export function addCredits(...values: CreditValue[]): number {
  return sumCredits(values);
}

export function subtractCredits(value: CreditValue, ...subtract: CreditValue[]): number {
  const units = toCreditUnits(value) - subtract.reduce<number>((sum, item) => sum + toCreditUnits(item), 0);
  return fromCreditUnits(units);
}

export function minCredits(...values: CreditValue[]): number {
  if (values.length === 0) return 0;
  return fromCreditUnits(Math.min(...values.map(toCreditUnits)));
}

export function maxCredits(...values: CreditValue[]): number {
  if (values.length === 0) return 0;
  return fromCreditUnits(Math.max(...values.map(toCreditUnits)));
}

// Format credit totals without exposing floating-point precision artifacts.
export function formatCredits(value: number | string | null | undefined, maximumFractionDigits = 2): string {
  const numeric = normalizeCredits(value);
  if (!Number.isFinite(numeric)) return "0";

  const digits = Math.max(0, maximumFractionDigits);
  const factor = 10 ** digits;
  const rounded = Math.round((numeric + Number.EPSILON) * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;

  const fixed = normalized.toFixed(digits);
  if (digits === 0) return fixed;

  return fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

// Format date for display
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

// Format time for display
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Calculate relative time (e.g., "2 hours ago")
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return "just now";
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

// Download file utility
export function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Check if mobile device
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if online
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

// Sleep utility for async operations
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Format course code consistently (e.g., IC123 or IC-123 → IC-123)
export function formatCourseCode(code: string): string {
  if (!code) return "";
  
  // Normalise common practicum/lab suffix: "XY123(P)" -> "XY123P"
  const cleaned = code
    .toUpperCase()
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/gi, "$1P");

  // Remove any existing hyphens and spaces
  const normalized = cleaned.replace(/[\s-]/g, "");
  
  // Find where the letters end and numbers begin
  let i = 0;
  while (i < normalized.length && /[A-Z]/.test(normalized[i])) {
    i++;
  }
  
  // If we have both letters and numbers, format as ABC-123
  if (i > 0 && i < normalized.length) {
    return normalized.slice(0, i) + "-" + normalized.slice(i);
  }
  
  return normalized;
}
