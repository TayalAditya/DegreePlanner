import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClassType, DayOfWeek, EnrollmentStatus } from "@prisma/client";
import { getCurrentTimetableContext } from "@/lib/timetable";
import { isApproveableSlot } from "@/lib/timetableSlots";

type BulkEntryInput = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slot?: string;
  venue?: string;
  classType?: ClassType;
  instructor?: string;
  notes?: string;
};

const timeRegex = /^\d{2}:\d{2}$/;

function validateEntry(entry: any): { ok: true; value: BulkEntryInput } | { ok: false; error: string } {
  const { dayOfWeek, startTime, endTime, slot, venue, classType, instructor, notes } = entry ?? {};

  if (!dayOfWeek || !startTime || !endTime) {
    return { ok: false, error: "Missing required fields in one or more entries" };
  }
  if (!Object.values(DayOfWeek).includes(dayOfWeek)) {
    return { ok: false, error: "Invalid dayOfWeek in one or more entries" };
  }
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { ok: false, error: "Invalid time format in one or more entries" };
  }
  if (endTime <= startTime) {
    return { ok: false, error: "End time must be after start time in one or more entries" };
  }

  const selectedClassType: ClassType =
    classType && Object.values(ClassType).includes(classType) ? classType : ClassType.LECTURE;

  return {
    ok: true,
    value: {
      dayOfWeek,
      startTime,
      endTime,
      slot: typeof slot === "string" ? slot.trim() || undefined : undefined,
      venue: typeof venue === "string" ? venue.trim() || undefined : undefined,
      classType: selectedClassType,
      instructor: typeof instructor === "string" ? instructor.trim() || undefined : undefined,
      notes: typeof notes === "string" ? notes.trim() || undefined : undefined,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const body = await req.json();

    const courseId: string | undefined = body?.courseId;
    const replaceExisting: boolean = Boolean(body?.replaceExisting);
    const entries: any[] = Array.isArray(body?.entries) ? body.entries : [];

    if (entries.length === 0) {
      return NextResponse.json({ error: "No entries provided" }, { status: 400 });
    }
    if (entries.length > 32) {
      return NextResponse.json({ error: "Too many entries" }, { status: 400 });
    }

    const normalized: BulkEntryInput[] = [];
    for (const e of entries) {
      const res = validateEntry(e);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      normalized.push(res.value);
    }

    const allTaDuty = normalized.every((e) => e.classType === ClassType.TA_DUTY);
    if (!courseId && !allTaDuty) {
      return NextResponse.json({ error: "courseId is required unless all entries are TA_DUTY" }, { status: 400 });
    }

    if (courseId) {
      const isEnrolled = await prisma.courseEnrollment.findFirst({
        where: allTaDuty
          ? {
              userId: session.user.id,
              courseId,
              status: EnrollmentStatus.COMPLETED,
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
            error: allTaDuty
              ? "For TA duties, select a course you have completed"
              : "You can only edit schedules for courses you are enrolled in",
          },
          { status: 403 }
        );
      }
    }

    // Basic dedupe within payload
    const seen = new Set<string>();
    for (const e of normalized) {
      const key = `${e.dayOfWeek}-${e.startTime}-${e.endTime}-${e.classType}`;
      if (seen.has(key)) {
        return NextResponse.json({ error: "Duplicate entries in request" }, { status: 409 });
      }
      seen.add(key);
    }

    const created = await prisma.$transaction(async (tx) => {
      if (replaceExisting && courseId) {
        await tx.timetableEntry.deleteMany({
          where: {
            courseId,
            semester: context.semester,
            year: context.year,
            term: context.term,
          },
        });
      }

      const createdEntries = [];
      for (const e of normalized) {
        const dup = await tx.timetableEntry.findFirst({
          where: {
            courseId,
            semester: context.semester,
            year: context.year,
            term: context.term,
            dayOfWeek: e.dayOfWeek,
            startTime: e.startTime,
            endTime: e.endTime,
            classType: e.classType,
            ...(courseId ? {} : { createdById: session.user.id }),
          },
          select: { id: true },
        });

        if (dup) {
          throw new Error("DUPLICATE_EXISTS");
        }

        const isAdmin = session.user.role === "ADMIN";
        const autoApprove =
          isAdmin ||
          e.classType === ClassType.TA_DUTY ||
          isApproveableSlot(e.slot, e.dayOfWeek, e.startTime);

        const entry = await tx.timetableEntry.create({
          data: {
            courseId: courseId || undefined,
            semester: context.semester,
            year: context.year,
            term: context.term,
            dayOfWeek: e.dayOfWeek,
            startTime: e.startTime,
            endTime: e.endTime,
            slot: e.slot,
            venue: e.venue,
            classType: e.classType ?? ClassType.LECTURE,
            instructor: e.instructor,
            notes: e.notes,
            createdById: session.user.id,
            updatedById: session.user.id,
            isApproved: autoApprove,
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
        createdEntries.push(entry);
      }

      return createdEntries;
    });

    return NextResponse.json({ entries: created }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "DUPLICATE_EXISTS") {
      return NextResponse.json({ error: "One or more classes are already scheduled" }, { status: 409 });
    }
    console.error("Timetable bulk creation error:", error);
    return NextResponse.json(
      { error: "Failed to create timetable entries" },
      { status: 500 }
    );
  }
}

