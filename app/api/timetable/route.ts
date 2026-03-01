import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClassType, DayOfWeek, EnrollmentStatus } from "@prisma/client";
import { getCurrentTimetableContext } from "@/lib/timetable";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);

    const currentEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId: session.user.id,
        semester: context.semester,
        year: context.year,
        term: context.term,
        status: EnrollmentStatus.IN_PROGRESS,
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
      orderBy: [{ course: { code: "asc" } }],
    });

    const availableCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId: session.user.id,
        status: { in: [EnrollmentStatus.IN_PROGRESS, EnrollmentStatus.COMPLETED] },
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
      orderBy: [{ updatedAt: "desc" }],
      distinct: ["courseId"],
    });

    const courses = availableCourseEnrollments
      .map((e) => e.course)
      .sort((a, b) => a.code.localeCompare(b.code));
    const courseIds = currentEnrollments.map((e) => e.courseId);

    // Check if user is admin
    const isAdmin = session.user.role === "ADMIN";

    const visibilityClauses: Array<Record<string, unknown>> = [
      { classType: ClassType.TA_DUTY, createdById: session.user.id },
    ];
    if (courseIds.length > 0) {
      visibilityClauses.push({ courseId: { in: courseIds } });
    }

    const entries = await prisma.timetableEntry.findMany({
      where: {
        semester: context.semester,
        year: context.year,
        term: context.term,
        OR: visibilityClauses,
        // Non-admin users only see approved entries
        ...(isAdmin ? {} : { isApproved: true }),
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
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ context, courses, entries });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timetable" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const body = await req.json();
    const {
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      slot,
      venue,
      roomNumber,
      building,
      classType,
      instructor,
      notes,
    } = body;

    // Validate required fields
    // courseId is optional for TA duties
    if (!dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Object.values(DayOfWeek).includes(dayOfWeek)) {
      return NextResponse.json({ error: "Invalid dayOfWeek" }, { status: 400 });
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
    }
    if (endTime <= startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const selectedClassType: ClassType =
      classType && Object.values(ClassType).includes(classType) ? classType : ClassType.LECTURE;

    if (!courseId && selectedClassType !== ClassType.TA_DUTY) {
      return NextResponse.json(
        { error: "courseId is required unless classType is TA_DUTY" },
        { status: 400 }
      );
    }

    // Check enrollment permissions when courseId is provided
    if (courseId) {
      const taDutyCourseCheck = selectedClassType === ClassType.TA_DUTY;

      const isEnrolled = await prisma.courseEnrollment.findFirst({
        where: taDutyCourseCheck
          ? {
              userId: session.user.id,
              courseId,
              status: { in: [EnrollmentStatus.IN_PROGRESS, EnrollmentStatus.COMPLETED] },
            }
          : {
              userId: session.user.id,
              courseId,
              semester: context.semester,
              year: context.year,
              term: context.term,
              status: EnrollmentStatus.IN_PROGRESS,
            },
        select: { id: true },
      });

      if (!isEnrolled) {
        return NextResponse.json(
          {
            error: taDutyCourseCheck
              ? "For TA duties, select a course you are currently taking or have completed"
              : "You can only edit schedules for courses you are enrolled in",
          },
          { status: 403 }
        );
      }

      const duplicate = await prisma.timetableEntry.findFirst({
        where: {
          courseId,
          semester: context.semester,
          year: context.year,
          term: context.term,
          dayOfWeek,
          startTime,
          endTime,
          classType: selectedClassType,
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json({ error: "This class is already scheduled" }, { status: 409 });
      }
    }

    // Admins always approved; TA duties are personal (no approval needed); slot-based entries match official schedule (auto-approve)
    const isAdmin = session.user.role === "ADMIN";
    const slotValue = typeof slot === "string" ? slot.trim() || undefined : undefined;
    const autoApprove = isAdmin || selectedClassType === ClassType.TA_DUTY || Boolean(slotValue);

    const entry = await prisma.timetableEntry.create({
      data: {
        courseId,
        semester: context.semester,
        year: context.year,
        term: context.term,
        dayOfWeek,
        startTime,
        endTime,
        slot: slotValue,
        venue,
        roomNumber,
        building,
        classType: selectedClassType,
        instructor,
        notes,
        createdById: session.user.id,
        updatedById: session.user.id,
        isApproved: autoApprove,
        ...(autoApprove && { approvedById: session.user.id, approvedAt: new Date() }),
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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Timetable creation error:", error);
    return NextResponse.json(
      { error: "Failed to create timetable entry" },
      { status: 500 }
    );
  }
}
