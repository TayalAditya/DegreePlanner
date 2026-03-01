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

    // Fetch existing ticket to detect what changed
    const existing = await prisma.supportTicket.findUnique({
      where: { id },
      select: { adminNote: true, status: true, userId: true, subject: true },
    });

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

    // Send notification to ticket owner if something meaningful changed
    if (existing?.userId) {
      const newNote = parsed.data.adminNote;
      const noteChanged = newNote && newNote.trim() && newNote !== existing.adminNote;
      const statusChanged = parsed.data.status && parsed.data.status !== existing.status;

      const STATUS_LABEL: Record<string, string> = {
        OPEN: "Open",
        IN_REVIEW: "In Review",
        RESOLVED: "Resolved",
        CLOSED: "Closed",
      };

      if (noteChanged && statusChanged) {
        // Both changed — one notification covering both
        await prisma.notification.create({
          data: {
            userId: existing.userId,
            title: `Ticket ${STATUS_LABEL[parsed.data.status!]}: ${existing.subject}`,
            content: newNote!.trim(),
            ticketId: id,
          },
        });
      } else if (noteChanged) {
        await prisma.notification.create({
          data: {
            userId: existing.userId,
            title: `Admin replied to your ticket: ${existing.subject}`,
            content: newNote!.trim(),
            ticketId: id,
          },
        });
      } else if (statusChanged) {
        await prisma.notification.create({
          data: {
            userId: existing.userId,
            title: `Your ticket status changed to ${STATUS_LABEL[parsed.data.status!]}`,
            content: `Your ticket "${existing.subject}" has been marked as ${STATUS_LABEL[parsed.data.status!]}.`,
            ticketId: id,
          },
        });
      }
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = ticket.userId === session.user.id;

    if (!isAdmin && !isOwner)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Non-admins can only delete their own OPEN tickets
    if (!isAdmin && ticket.status !== "OPEN")
      return NextResponse.json({ error: "Cannot delete a ticket that is already being reviewed" }, { status: 403 });

    await prisma.supportTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting support ticket:", error);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}

