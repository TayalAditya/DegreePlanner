"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { MaintenanceScreen } from "@/components/MaintenanceScreen";

type MaintenanceResponse = {
  active: boolean;
  endsAt: string | null;
  message: string | null;
  canManage: boolean;
};

const POLL_INTERVAL_MS = 5_000;

/**
 * Protects already-open dashboard tabs too. The server layout covers fresh
 * navigations, while this short poll makes an active shutdown visible without
 * requiring students to manually reload.
 */
export function MaintenanceGate() {
  const { status } = useSession();
  const [maintenance, setMaintenance] = useState<MaintenanceResponse | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/maintenance", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as MaintenanceResponse;
        if (!cancelled) setMaintenance(next);
      } catch {
        // A temporary network error should never block access by itself.
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status]);

  if (status !== "authenticated" || !maintenance?.active || maintenance.canManage || !maintenance.endsAt) return null;

  return <MaintenanceScreen endsAt={maintenance.endsAt} message={maintenance.message} />;
}
