import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getMaintenanceStatus, MAINTENANCE_WINDOW_ID } from "@/lib/maintenance";
import { isDocumentsAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const maintenanceSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    durationMinutes: z.number().int().min(1).max(240),
    message: z.string().trim().max(280).optional(),
  }),
  z.object({ action: z.literal("stop") }),
]);

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getMaintenanceStatus();
  return NextResponse.json({
    ...status,
    canManage: isDocumentsAdmin(session.user),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !isDocumentsAdmin(session.user)) {
    return NextResponse.json({ error: "Only B23243 can manage shutdown mode" }, { status: 403 });
  }

  try {
    const parsed = maintenanceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid shutdown settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.action === "start") {
      const endsAt = new Date(Date.now() + parsed.data.durationMinutes * 60_000);
      await prisma.maintenanceWindow.upsert({
        where: { id: MAINTENANCE_WINDOW_ID },
        create: {
          id: MAINTENANCE_WINDOW_ID,
          endsAt,
          message: parsed.data.message || null,
        },
        update: {
          endsAt,
          message: parsed.data.message || null,
          startedAt: new Date(),
        },
      });
    } else {
      await prisma.maintenanceWindow.upsert({
        where: { id: MAINTENANCE_WINDOW_ID },
        create: { id: MAINTENANCE_WINDOW_ID },
        update: { endsAt: null, message: null },
      });
    }

    return NextResponse.json({
      ...(await getMaintenanceStatus()),
      canManage: true,
    });
  } catch (error) {
    console.error("Failed to update shutdown mode:", error);
    return NextResponse.json({ error: "Failed to update shutdown mode" }, { status: 500 });
  }
}
