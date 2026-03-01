import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Get all pending timetable entries (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const pendingEntries = await prisma.timetableEntry.findMany({
      where: {
        isApproved: false,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            enrollmentId: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ entries: pendingEntries });
  } catch (error) {
    console.error("Admin timetable fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending entries" },
      { status: 500 }
    );
  }
}

// Approve or reject a timetable entry (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { entryId, action } = await req.json();

    if (!entryId || !action) {
      return NextResponse.json(
        { error: "Missing entryId or action" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const entry = await prisma.timetableEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (action === "approve") {
      const updated = await prisma.timetableEntry.update({
        where: { id: entryId },
        data: {
          isApproved: true,
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              credits: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, entry: updated });
    } else {
      // Reject = delete the entry
      await prisma.timetableEntry.delete({
        where: { id: entryId },
      });

      return NextResponse.json({ success: true, deleted: true });
    }
  } catch (error) {
    console.error("Admin approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
