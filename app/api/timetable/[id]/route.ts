import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClassType, DayOfWeek, EnrollmentStatus } from "@prisma/client";
import { getCurrentTimetableContext } from "@/lib/timetable";
import {
  parseOfficialCorrectionNotes,
  withOfficialCorrectionMarker,
} from "@/lib/officialTimetable";

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
    const isOwnPrivateEntry =
      (entry.classType === ClassType.TA_DUTY || entry.classType === ClassType.PERSONAL) &&
      (isAdmin || entry.createdById === session.user.id);

    // Private entries can be accessed by their creator/admin without an
    // enrollment check. Every other no-course entry is forbidden.
    if (!isAdmin && !isOwnPrivateEntry && !entry.courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isOwnPrivateEntry && entry.courseId) {
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

      const savedPlan = !isEnrolled
        ? await prisma.preRegistrationPlan.findUnique({
            where: {
              userId_offeringSemester_offeringYear: {
                userId: session.user.id,
                offeringSemester: context.semester,
                offeringYear: context.year,
              },
            },
            select: { selectedIds: true },
          })
        : null;
      const isPlanned = savedPlan
        ? Boolean(await prisma.courseOffering.findFirst({
            where: { id: { in: savedPlan.selectedIds }, courseId: entry.courseId },
            select: { id: true },
          }))
        : false;

      if (!isEnrolled && !isPlanned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const correction = parseOfficialCorrectionNotes(entry.notes);
    return NextResponse.json({
      ...entry,
      ...(correction
        ? {
            notes: correction.userNotes || null,
            isOfficialCorrection: true,
            replacesOfficial: correction.replacesOfficial,
          }
        : {}),
    });
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
    const officialCorrection = parseOfficialCorrectionNotes(existing.notes);
    const isOwnPrivateEntry =
      (existing.classType === ClassType.TA_DUTY || existing.classType === ClassType.PERSONAL) &&
      (isAdmin || existing.createdById === session.user.id);

    // Private entries can be edited by their creator/admin without an
    // enrollment check. Every other no-course entry is forbidden.
    if (!isAdmin && !isOwnPrivateEntry && !existing.courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isOwnPrivateEntry && existing.courseId) {
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

      const savedPlan = !isEnrolled
        ? await prisma.preRegistrationPlan.findUnique({
            where: {
              userId_offeringSemester_offeringYear: {
                userId: session.user.id,
                offeringSemester: context.semester,
                offeringYear: context.year,
              },
            },
            select: { selectedIds: true },
          })
        : null;
      const isPlanned = savedPlan
        ? Boolean(await prisma.courseOffering.findFirst({
            where: { id: { in: savedPlan.selectedIds }, courseId: existing.courseId },
            select: { id: true },
          }))
        : false;

      if (!isEnrolled && !isPlanned) {
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
    if (body.notes !== undefined) {
      data.notes = officialCorrection
        ? withOfficialCorrectionMarker(body.notes, officialCorrection.replacesOfficial)
        : body.notes;
    }

    if (body.classType !== undefined) {
      if (!Object.values(ClassType).includes(body.classType)) {
        return NextResponse.json({ error: "Invalid classType" }, { status: 400 });
      }
      if (
        (existing.classType === ClassType.PERSONAL) !==
        (body.classType === ClassType.PERSONAL)
      ) {
        return NextResponse.json({ error: "Personal activities cannot be converted to or from course classes" }, { status: 400 });
      }
      data.classType = body.classType;
    }
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (existing.classType === ClassType.PERSONAL && (!title || title.length > 120)) {
        return NextResponse.json({ error: "Personal activity title must be between 1 and 120 characters" }, { status: 400 });
      }
      data.title = existing.classType === ClassType.PERSONAL ? title : null;
    }

    // If non-admin is editing, reset approval status
    if (!isAdmin) {
      if (isOwnPrivateEntry) {
        data.isApproved = true;
      } else {
        data.isApproved = false;
        data.approvedById = null;
        data.approvedAt = null;
      }
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
    const officialCorrection = parseOfficialCorrectionNotes(entry.notes);
    const isOwnPrivateEntry =
      (entry.classType === ClassType.TA_DUTY || entry.classType === ClassType.PERSONAL) &&
      (isAdmin || entry.createdById === session.user.id);

    if (officialCorrection && !isAdmin) {
      return NextResponse.json(
        { error: "Approved timetable corrections cannot be deleted. Submit another correction instead." },
        { status: 409 },
      );
    }

    // Private entries can be deleted by their creator/admin without an
    // enrollment check. Every other no-course entry is forbidden.
    if (!isAdmin && !isOwnPrivateEntry && !entry.courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isOwnPrivateEntry && entry.courseId) {
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
