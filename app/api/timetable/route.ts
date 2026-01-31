import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");

    const timetable = await prisma.timetableEntry.findMany({
      where: {
        userId: session.user.id,
        ...(semester && { semester: parseInt(semester) }),
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
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json(timetable);
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

    const body = await req.json();
    const {
      courseId,
      dayOfWeek,
      startTime,
      endTime,
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

    // Check for time conflicts
    const conflicts = await prisma.timetableEntry.findMany({
      where: {
        userId: session.user.id,
        dayOfWeek,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: "Time conflict detected" },
        { status: 409 }
      );
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        userId: session.user.id,
        courseId,
        semester: body.semester || 1,
        year: body.year || new Date().getFullYear(),
        term: body.term || 'FALL',
        dayOfWeek,
        startTime,
        endTime,
        venue,
        roomNumber,
        building,
        classType,
        instructor,
        notes,
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
