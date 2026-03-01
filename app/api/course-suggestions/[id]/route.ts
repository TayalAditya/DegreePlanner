import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const updateSuggestionSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ACKNOWLEDGED"]),
  reviewedBy: z.string().trim().max(50).optional(),
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
    const parsed = updateSuggestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reviewedBy =
      parsed.data.reviewedBy || session.user.enrollmentId || session.user.email || "ADMIN";

    const updated = await prisma.courseSuggestion.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewedBy,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { name: true, email: true, enrollmentId: true } },
        course: { select: { code: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating course suggestion:", error);
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
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
    const suggestion = await prisma.courseSuggestion.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = suggestion.userId === session.user.id;

    if (!isAdmin && !isOwner)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!isAdmin && suggestion.status !== "PENDING")
      return NextResponse.json({ error: "Cannot delete a suggestion that has already been reviewed" }, { status: 403 });

    await prisma.courseSuggestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course suggestion:", error);
    return NextResponse.json({ error: "Failed to delete suggestion" }, { status: 500 });
  }
}

