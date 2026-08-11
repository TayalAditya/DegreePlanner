import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export const MAINTENANCE_WINDOW_ID = "global";
export const MAINTENANCE_CACHE_TAG = "maintenance-window";

export type MaintenanceStatus = {
  active: boolean;
  endsAt: string | null;
  message: string | null;
};

// The maintenance window is shared by every dashboard request. Cache the raw
// row briefly; `getMaintenanceStatus` still evaluates expiry against the
// current time and admin updates invalidate this cache immediately.
const getMaintenanceWindow = unstable_cache(
  () =>
    prisma.maintenanceWindow.findUnique({
      where: { id: MAINTENANCE_WINDOW_ID },
    }),
  ["maintenance-window"],
  { revalidate: 60, tags: [MAINTENANCE_CACHE_TAG] }
);

/**
 * Reads the global maintenance window. Expired windows automatically become
 * inactive, so a failed browser refresh cannot leave the planner locked.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const window = await getMaintenanceWindow();

  const endsAt = window?.endsAt ?? null;
  const active = Boolean(endsAt && endsAt.getTime() > Date.now());

  return {
    active,
    endsAt: active && endsAt ? endsAt.toISOString() : null,
    message: active ? window?.message ?? null : null,
  };
}
