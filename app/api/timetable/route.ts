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

    const courses = currentEnrollments.map((e) => e.course);
    const courseIds = currentEnrollments.map((e) => e.courseId);

    const entries =
      courseIds.length === 0
        ? []
        : await prisma.timetableEntry.findMany({
            where: {
              semester: context.semester,
              year: context.year,
              term: context.term,
              courseId: { in: courseIds },
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
    if (!courseId || !dayOfWeek || !startTime || !endTime) {
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

    const isEnrolled = await prisma.courseEnrollment.findFirst({
      where: {
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
        { error: "You can only edit schedules for courses you are enrolled in" },
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

    const entry = await prisma.timetableEntry.create({
      data: {
        courseId,
        semester: context.semester,
        year: context.year,
        term: context.term,
        dayOfWeek,
        startTime,
        endTime,
        slot: typeof slot === "string" ? slot.trim() || undefined : undefined,
        venue,
        roomNumber,
        building,
        classType: selectedClassType,
        instructor,
        notes,
        createdById: session.user.id,
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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Timetable creation error:", error);
    return NextResponse.json(
      { error: "Failed to create timetable entry" },
      { status: 500 }
    );
  }
}
