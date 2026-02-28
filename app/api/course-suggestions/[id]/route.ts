import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const suggestion = await prisma.courseSuggestion.update({
      where: { id: params.id },
      data: {
        status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
      include: {
        course: {
          select: { code: true, name: true },
        },
        user: {
          select: { name: true, enrollmentId: true },
        },
      },
    });

    // If approved, optionally update branch mapping here in future
    // For now, just record the suggestion

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("Failed to update suggestion:", error);
    return NextResponse.json(
      { error: "Failed to update suggestion" },
      { status: 500 }
    );
  }
}
