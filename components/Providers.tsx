"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider, useToast } from "./ToastProvider";
import { ConfirmDialogProvider } from "./ConfirmDialog";
import { ErrorBoundary } from "./ErrorBoundary";

function ServiceWorkerPopups() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "PUSH_MESSAGE") {
        const title = typeof data.title === "string" ? data.title : "Degree Planner";
        const body = typeof data.body === "string" ? data.body : "";
        showToast("info", body ? `${title}: ${body}` : title);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [showToast]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmDialogProvider>
                <ServiceWorkerPopups />
                {!isOnline && (
                  <div className="fixed top-0 left-0 right-0 bg-red-500 dark:bg-red-600 text-white text-center py-2 z-[9999] text-sm">
                    You are currently offline. Changes will be saved when connection is restored.
                  </div>
                )}
                {children}
              </ConfirmDialogProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
