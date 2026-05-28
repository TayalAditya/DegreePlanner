import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";
import { CourseType, EnrollmentStatus, Term } from "@prisma/client";

// Odd semesters start in fall, even in spring
function termFromSemester(sem: number): Term {
  return sem % 2 === 1 ? Term.FALL : Term.SPRING;
}

// Infer academic year from semester and current date
function yearFromSemester(sem: number): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Fall term starts ~Aug; spring term starts ~Jan
  if (sem % 2 === 1) {
    // Fall: if we're past July, it's this year; otherwise last year
    return month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  } else {
    // Spring: always current year
    return now.getFullYear();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await params;
  const { courseCode, semester } = await request.json();

  if (!courseCode || !semester) {
    return NextResponse.json({ error: "courseCode and semester are required" }, { status: 400 });
  }

  const semNum = Number(semester);
  const term = termFromSemester(semNum);
  const year = yearFromSemester(semNum);

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
    where: { userId_courseId_semester_year_term: { userId, courseId: course.id, semester: semNum, year, term } },
  });

  if (existing) {
    return NextResponse.json({ error: "Already enrolled in this course for this semester" }, { status: 409 });
  }

  let finalProgramId = user.programs[0]?.programId ?? null;
  if (!finalProgramId && user.branch) {
    const program = await prisma.program.findUnique({ where: { code: getProgramLookupBranchCode(user.branch) } });
    if (program) {
      const up = await prisma.userProgram.create({
        data: { userId, programId: program.id, programType: "MAJOR", isPrimary: true, startSemester: 1, status: "ACTIVE" },
      });
      finalProgramId = up.programId;
    }
  }

  // Auto-detect courseType from branch mapping
  let finalCourseType: CourseType = CourseType.CORE;
  if (user.branch) {
    const mapping = await prisma.courseBranchMapping.findFirst({
      where: { courseId: course.id, branch: user.branch },
      select: { courseCategory: true },
    });
    if (mapping) {
      const cat = mapping.courseCategory;
      if (cat === "DE") finalCourseType = CourseType["DE"];
      else if (cat === "FE" || cat === "NA" || cat === "INTERNSHIP") finalCourseType = CourseType["FREE_ELECTIVE"];
      else if (cat === "MTP") finalCourseType = CourseType["MTP"];
      else if (cat === "ISTP") finalCourseType = CourseType["ISTP"];
    }
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      userId,
      courseId: course.id,
      semester: semNum,
      year,
      term,
      courseType: finalCourseType,
      programId: finalProgramId,
      status: EnrollmentStatus.IN_PROGRESS,
      grade: null,
      isPassFail: false,
      passFailCredits: 0,
      isInternship: false,
    },
    include: { course: true },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
