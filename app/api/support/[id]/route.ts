import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  adminNote: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.adminNote !== undefined && { adminNote: parsed.data.adminNote }),
      },
      include: {
        user: { select: { name: true, email: true, enrollmentId: true } },
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

