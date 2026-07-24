import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

// PATCH — admin review action: approve / reject a paper (toggles public visibility).
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isDocumentsAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { status, reviewNote } = body;

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.previousYearPaper.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const updated = await prisma.previousYearPaper.update({
      where: { id },
      data: {
        status: status as "PENDING" | "APPROVED" | "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
      },
      include: {
        uploadedBy: { select: { name: true, enrollmentId: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PYQ update error:", error);
    return NextResponse.json({ error: "Failed to update paper" }, { status: 500 });
  }
}

// DELETE — admin can delete any paper; uploader can delete their own.
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const paper = await prisma.previousYearPaper.findUnique({ where: { id } });
    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const isAdmin = isDocumentsAdmin(session.user);
    if (!isAdmin && paper.uploadedById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.previousYearPaper.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PYQ delete error:", error);
    return NextResponse.json({ error: "Failed to delete paper" }, { status: 500 });
  }
}
