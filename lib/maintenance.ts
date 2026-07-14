import prisma from "@/lib/prisma";

export const MAINTENANCE_WINDOW_ID = "global";

export type MaintenanceStatus = {
  active: boolean;
  endsAt: string | null;
  message: string | null;
};

/**
 * Reads the global maintenance window. Expired windows automatically become
 * inactive, so a failed browser refresh cannot leave the planner locked.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const window = await prisma.maintenanceWindow.findUnique({
    where: { id: MAINTENANCE_WINDOW_ID },
  });

  const endsAt = window?.endsAt ?? null;
  const active = Boolean(endsAt && endsAt.getTime() > Date.now());

  return {
    active,
    endsAt: active && endsAt ? endsAt.toISOString() : null,
    message: active ? window?.message ?? null : null,
  };
}
