import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseType, EnrollmentStatus } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await params;
  const { courseCode, semester, year, term, status, grade, courseType } = await request.json();

  if (!courseCode || !semester || !year || !term) {
    return NextResponse.json({ error: "courseCode, semester, year, term are required" }, { status: 400 });
  }

  const course = await prisma.course.findFirst({
    where: { code: { equals: courseCode.trim(), mode: "insensitive" } },
    select: { id: true, code: true, name: true, credits: true },
  });

  if (!course) {
    return NextResponse.json({ error: `Course "${courseCode}" not found` }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      branch: true,
      programs: { where: { isPrimary: true }, select: { programId: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId_semester_year_term: { userId, courseId: course.id, semester: Number(semester), year: Number(year), term } },
  });

  if (existing) {
    return NextResponse.json({ error: "Already enrolled in this course for this semester" }, { status: 409 });
  }

  let finalProgramId = user.programs[0]?.programId ?? null;
  if (!finalProgramId && user.branch) {
    const program = await prisma.program.findUnique({ where: { code: user.branch } });
    if (program) {
      const up = await prisma.userProgram.create({
        data: { userId, programId: program.id, programType: "MAJOR", isPrimary: true, startSemester: 1, status: "ACTIVE" },
      });
      finalProgramId = up.programId;
    }
  }

  const finalCourseType: CourseType =
    courseType && Object.values(CourseType).includes(courseType) ? courseType : CourseType.CORE;

  const finalStatus: EnrollmentStatus =
    status && Object.values(EnrollmentStatus).includes(status)
      ? status
      : grade
        ? EnrollmentStatus.COMPLETED
        : EnrollmentStatus.IN_PROGRESS;

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      userId,
      courseId: course.id,
      semester: Number(semester),
      year: Number(year),
      term,
      courseType: finalCourseType,
      programId: finalProgramId,
      status: finalStatus,
      grade: grade || null,
      isPassFail: false,
      passFailCredits: 0,
      isInternship: false,
    },
    include: { course: true },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
