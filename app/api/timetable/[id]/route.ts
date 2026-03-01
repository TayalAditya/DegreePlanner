import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClassType, DayOfWeek, EnrollmentStatus } from "@prisma/client";
import { getCurrentTimetableContext } from "@/lib/timetable";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const { id } = await params;
    const entry = await prisma.timetableEntry.findUnique({
      where: { id },
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

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.semester !== context.semester || entry.year !== context.year || entry.term !== context.term) {
      return NextResponse.json({ error: "This entry is not in your current semester" }, { status: 409 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwnTaDuty =
      entry.classType === ClassType.TA_DUTY &&
      (isAdmin || entry.createdById === session.user.id);

    // TA duties can be accessed by creator/admin without current enrollment check
    if (!isOwnTaDuty && entry.courseId) {
      const isEnrolled = await prisma.courseEnrollment.findFirst({
        where: {
          userId: session.user.id,
          courseId: entry.courseId,
          semester: context.semester,
          year: context.year,
          term: context.term,
          status: EnrollmentStatus.IN_PROGRESS,
        },
        select: { id: true },
      });

      if (!isEnrolled) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch entry" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.timetableEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existing.semester !== context.semester || existing.year !== context.year || existing.term !== context.term) {
      return NextResponse.json({ error: "This entry is not in your current semester" }, { status: 409 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwnTaDuty =
      existing.classType === ClassType.TA_DUTY &&
      (isAdmin || existing.createdById === session.user.id);

    // TA duties can be edited by creator/admin without current enrollment check
    if (!isOwnTaDuty && existing.courseId) {
      const isEnrolled = await prisma.courseEnrollment.findFirst({
        where: {
          userId: session.user.id,
          courseId: existing.courseId,
          semester: context.semester,
          year: context.year,
          term: context.term,
          status: EnrollmentStatus.IN_PROGRESS,
        },
        select: { id: true },
      });

      if (!isEnrolled) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const data: Record<string, any> = {};

    if (body.dayOfWeek !== undefined) {
      if (!Object.values(DayOfWeek).includes(body.dayOfWeek)) {
        return NextResponse.json({ error: "Invalid dayOfWeek" }, { status: 400 });
      }
      data.dayOfWeek = body.dayOfWeek;
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    const nextStartTime = body.startTime !== undefined ? body.startTime : existing.startTime;
    const nextEndTime = body.endTime !== undefined ? body.endTime : existing.endTime;

    if (body.startTime !== undefined) {
      if (!timeRegex.test(body.startTime)) {
        return NextResponse.json({ error: "Invalid startTime format" }, { status: 400 });
      }
      data.startTime = body.startTime;
    }

    if (body.endTime !== undefined) {
      if (!timeRegex.test(body.endTime)) {
        return NextResponse.json({ error: "Invalid endTime format" }, { status: 400 });
      }
      data.endTime = body.endTime;
    }

    if ((body.startTime !== undefined || body.endTime !== undefined) && nextEndTime <= nextStartTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    if (body.slot !== undefined) {
      data.slot = typeof body.slot === "string" ? body.slot.trim() || null : null;
    }
    if (body.venue !== undefined) data.venue = body.venue;
    if (body.roomNumber !== undefined) data.roomNumber = body.roomNumber;
    if (body.building !== undefined) data.building = body.building;
    if (body.instructor !== undefined) data.instructor = body.instructor;
    if (body.notes !== undefined) data.notes = body.notes;

    if (body.classType !== undefined) {
      if (!Object.values(ClassType).includes(body.classType)) {
        return NextResponse.json({ error: "Invalid classType" }, { status: 400 });
      }
      data.classType = body.classType;
    }

    // If non-admin is editing, reset approval status
    if (!isAdmin) {
      data.isApproved = false;
      data.approvedById = null;
      data.approvedAt = null;
    }

    const updated = await prisma.timetableEntry.update({
      where: { id },
      data: {
        ...data,
        updatedById: session.user.id,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Timetable update error:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const { id } = await params;
    const entry = await prisma.timetableEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.semester !== context.semester || entry.year !== context.year || entry.term !== context.term) {
      return NextResponse.json({ error: "This entry is not in your current semester" }, { status: 409 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwnTaDuty =
      entry.classType === ClassType.TA_DUTY &&
      (isAdmin || entry.createdById === session.user.id);

    // TA duties can be deleted by creator/admin without current enrollment check
    if (!isOwnTaDuty && entry.courseId) {
      const isEnrolled = await prisma.courseEnrollment.findFirst({
        where: {
          userId: session.user.id,
          courseId: entry.courseId,
          semester: context.semester,
          year: context.year,
          term: context.term,
          status: EnrollmentStatus.IN_PROGRESS,
        },
        select: { id: true },
      });

      if (!isEnrolled) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await prisma.timetableEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Timetable delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}
