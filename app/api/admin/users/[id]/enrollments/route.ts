import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";
import { getSpecialDpCourseType } from "@/lib/specialCourseCategories";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { canTakePassFailCourse } from "@/lib/course-validation";
import { CourseType, EnrollmentStatus, Term } from "@prisma/client";

// Odd semesters start in fall, even in spring
function termFromSemester(sem: number): Term {
  return sem % 2 === 1 ? Term.FALL : Term.SPRING;
}

// Academic year from the student's batch + semester, matching the bulk/dashboard
// paths: Fall (odd) opens the academic year, Spring (even) is the next calendar
// year → year = batchYear + floor(semester / 2).
function yearFromSemester(sem: number, batchYear: number): number {
  return batchYear + Math.floor(sem / 2);
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
  const { courseCode, semester, registrationType = "REGULAR" } = await request.json();

  if (!courseCode || !semester) {
    return NextResponse.json({ error: "courseCode and semester are required" }, { status: 400 });
  }
  if (!["REGULAR", "PASS_FAIL", "AUDIT"].includes(registrationType)) {
    return NextResponse.json({ error: "Invalid registration type" }, { status: 400 });
  }

  const semNum = Number(semester);
  const term = termFromSemester(semNum);

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
      batch: true,
      enrollmentId: true,
      programs: { where: { isPrimary: true }, select: { programId: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const batchYear = inferBatchYear(user.batch, user.enrollmentId);
  if (!batchYear) {
    return NextResponse.json(
      { error: "Cannot determine the student's batch year; set their batch or enrollment ID first" },
      { status: 400 }
    );
  }
  const year = yearFromSemester(semNum, batchYear);

  const existing = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId_semester_year_term: { userId, courseId: course.id, semester: semNum, year, term } },
  });

  if (existing) {
    return NextResponse.json({ error: "Already enrolled in this course for this semester" }, { status: 409 });
  }

  let finalProgramId = user.programs[0]?.programId ?? null;
  if (!finalProgramId && user.branch) {
    const program = await prisma.program.findUnique({ where: { code: getProgramLookupBranchCode(user.branch, user.batch) } });
    if (program) {
      const up = await prisma.userProgram.create({
        data: { userId, programId: program.id, programType: "MAJOR", isPrimary: true, startSemester: 1, status: "ACTIVE" },
      });
      finalProgramId = up.programId;
    }
  }

  // Auto-detect courseType from branch mapping
  let finalCourseType: CourseType = CourseType.CORE;
  let detectedCategory = "CORE";
  if (user.branch) {
    const mapping = await prisma.courseBranchMapping.findFirst({
      where: { courseId: course.id, branch: user.branch },
      select: { courseCategory: true },
    });
    if (mapping) {
      const cat = mapping.courseCategory;
      detectedCategory = cat;
      if (cat === "DE") finalCourseType = CourseType["DE"];
      else if (cat === "FE" || cat === "NA" || cat === "INTERNSHIP") {
        finalCourseType = CourseType["FREE_ELECTIVE"];
        detectedCategory = "FE";
      }
      else if (cat === "MTP") finalCourseType = CourseType["MTP"];
      else if (cat === "ISTP") finalCourseType = CourseType["ISTP"];
    }
  }
  const normalizedCode = course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalizedCode.startsWith("HS")) detectedCategory = "HSS";
  if (normalizedCode.startsWith("IK") || normalizedCode === "IC181" || normalizedCode === "IC182") {
    detectedCategory = "IKS";
  }
  const specialDpCourseType = getSpecialDpCourseType(course.code);
  if (specialDpCourseType) finalCourseType = specialDpCourseType as CourseType;

  const state = inferAcademicState(batchYear);
  const currentSem = state.currentSemester;
  const autoStatus = semNum < currentSem ? EnrollmentStatus.COMPLETED : EnrollmentStatus.IN_PROGRESS;
  const isPassFail = registrationType === "PASS_FAIL";
  const isAudit = registrationType === "AUDIT";

  if (isPassFail) {
    if (!["FE", "HSS", "IKS", "DE"].includes(detectedCategory)) {
      return NextResponse.json(
        { error: "Pass/Fail is only available for Free Electives, HSS/IKS, and Discipline Electives" },
        { status: 400 }
      );
    }
    const { allowed, reason } = await canTakePassFailCourse(userId, course.credits, semNum);
    if (!allowed) {
      return NextResponse.json({ error: reason || "Cannot take this course as Pass/Fail" }, { status: 400 });
    }
    // P/F always consumes the Free Elective basket, even when the regular
    // classification would have been HSS/IKS or DE.
    finalCourseType = CourseType.FREE_ELECTIVE;
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const created = await tx.courseEnrollment.create({
      data: {
        userId,
        courseId: course.id,
        semester: semNum,
        year,
        term,
        courseType: finalCourseType,
        programId: finalProgramId,
        status: isAudit ? EnrollmentStatus.AUDIT : autoStatus,
        grade: null,
        isPassFail,
        passFailCredits: isPassFail ? course.credits : 0,
        isInternship: false,
      },
      include: { course: true },
    });

    if (isPassFail) {
      await tx.user.update({
        where: { id: userId },
        data: { totalPassFailCredits: { increment: course.credits } },
      });
    }

    return created;
  });

  return NextResponse.json(enrollment, { status: 201 });
}
