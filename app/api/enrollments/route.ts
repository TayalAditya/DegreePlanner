import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EnrollmentStatus, CourseType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const semester = searchParams.get("semester");

    const where: any = {
      userId: session.user.id,
    };

    if (semester) {
      where.semester = parseInt(semester);
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where,
      include: {
        course: true,
      },
      orderBy: [
        { semester: "asc" },
        { course: { code: "asc" } },
      ],
    });

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      courseId,
      semester,
      year,
      term,
      courseType,
      programId,
    } = body;

    // Check if enrollment already exists
    const existing = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId_semester_year_term: {
          userId: session.user.id,
          courseId,
          semester,
          year,
          term,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already enrolled in this course for this semester" },
        { status: 400 }
      );
    }

    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId: session.user.id,
        courseId,
        semester,
        year,
        term,
        courseType: courseType || CourseType.FREE_ELECTIVE,
        programId,
        status: EnrollmentStatus.IN_PROGRESS,
      },
      include: {
        course: true,
      },
    });

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    console.error("Error creating enrollment:", error);
    return NextResponse.json(
      { error: "Failed to create enrollment" },
      { status: 500 }
    );
  }
}
