"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider, useToast } from "./ToastProvider";
import { ConfirmDialogProvider } from "./ConfirmDialog";
import { ErrorBoundary } from "./ErrorBoundary";
import { MaintenanceGate } from "./MaintenanceGate";

function ServiceWorkerPopups() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // The worker is an optional offline enhancement. Let the browser perform
    // its normal update check instead of issuing a second, cache-bypassing
    // request on every page load.
    void navigator.serviceWorker
      .register("/sw.js")
      .catch(() => undefined);

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
            staleTime: 60_000, // 1 minute
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

  // Always start true – reading navigator.onLine in the initialiser causes a
  // server/client mismatch because navigator is undefined on the server.
  const [isOnline, setIsOnline] = useState(true);

  const handleOnline = useCallback(() => setIsOnline(true), []);
  const handleOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOffline, handleOnline]);

  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmDialogProvider>
                <ServiceWorkerPopups />
                <MaintenanceGate />
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
