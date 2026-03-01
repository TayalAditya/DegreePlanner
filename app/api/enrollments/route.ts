import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EnrollmentStatus, CourseType } from "@prisma/client";
import {
  canTakePassFailCourse,
  validateBranchSpecificCourse,
  getInternshipCredits,
} from "@/lib/course-validation";

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
        course: {
          include: {
            branchMappings: {
              select: {
                courseCategory: true,
                branch: true,
              },
            },
          },
        },
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

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { count } = await prisma.courseEnrollment.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error("Error deleting enrollments:", error);
    return NextResponse.json(
      { error: "Failed to delete enrollments" },
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
      grade,
      status,
      programId,
      isPassFail,
      isInternship,
      internshipType,
      internshipDays,
    } = body;

    console.log("Creating enrollment with semester:", semester, "type:", typeof semester);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        branch: true,
        enrollmentId: true,
        programs: {
          where: { isPrimary: true },
          select: { programId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If no programId provided, use user's primary program (or auto-enroll based on branch)
    let finalProgramId = programId || user.programs[0]?.programId || null;

    if (!finalProgramId && user.branch) {
      const program = await prisma.program.findUnique({
        where: { code: user.branch },
      });

      if (program) {
        const userProgram = await prisma.userProgram.create({
          data: {
            userId: session.user.id,
            programId: program.id,
            programType: "MAJOR",
            isPrimary: true,
            startSemester: 1,
            status: "ACTIVE",
          },
        });
        finalProgramId = userProgram.programId;
      }
    }

    // Get the course to validate
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        credits: true,
        isBranchSpecific: true,
        isPassFailEligible: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

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

    // Validate P/F course enrollment
    if (isPassFail) {
      if (!course.isPassFailEligible) {
        return NextResponse.json(
          { error: "This course cannot be taken as Pass/Fail" },
          { status: 400 }
        );
      }

      const { allowed, reason } = await canTakePassFailCourse(
        session.user.id,
        course.credits,
        semester
      );

      if (!allowed) {
        return NextResponse.json(
          { error: reason || "Cannot take P/F course" },
          { status: 400 }
        );
      }
    }

    // Validate branch-specific course
    if (course.isBranchSpecific) {
      const { valid, reason } = await validateBranchSpecificCourse(
        session.user.id,
        course.code,
        semester
      );

      if (!valid) {
        return NextResponse.json(
          { error: reason || "Cannot enroll in this branch-specific course" },
          { status: 400 }
        );
      }
    }

    // Validate internship
    let internshipCredits = 0;
    if (isInternship) {
      if (!internshipType || !["REMOTE", "ONSITE"].includes(internshipType)) {
        return NextResponse.json(
          { error: "Invalid internship type. Must be REMOTE or ONSITE" },
          { status: 400 }
        );
      }

      internshipCredits = await getInternshipCredits(
        session.user.id,
        internshipType as "REMOTE" | "ONSITE",
        internshipDays
      );
    }

    // Create enrollment
    const finalStatus: EnrollmentStatus =
      status && Object.values(EnrollmentStatus).includes(status)
        ? status
        : grade
          ? EnrollmentStatus.COMPLETED
          : EnrollmentStatus.IN_PROGRESS;

    const normalizedCourseCode = course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isDpIstp = normalizedCourseCode === "DP301P";
    const isDpMtp = normalizedCourseCode === "DP498P" || normalizedCourseCode === "DP499P";

    let finalCourseType: CourseType =
      courseType && Object.values(CourseType).includes(courseType as CourseType)
        ? (courseType as CourseType)
        : CourseType.FREE_ELECTIVE;

    // Special DP codes (always treated as ISTP/MTP)
    if (isDpIstp) finalCourseType = CourseType.ISTP;
    if (isDpMtp) finalCourseType = CourseType.MTP;

    const finalIsPassFail =
      finalCourseType === CourseType.FREE_ELECTIVE ? Boolean(isPassFail) : false;

    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId: session.user.id,
        courseId,
        semester,
        year,
        term,
        courseType: finalCourseType,
        programId: finalProgramId,
        status: finalStatus,
        grade: grade || null,
        isPassFail: finalIsPassFail,
        passFailCredits: finalIsPassFail ? course.credits : 0,
        isInternship: isInternship || false,
        internshipType: isInternship ? internshipType : null,
        internshipDays: isInternship ? internshipDays : null,
      },
      include: {
        course: true,
      },
    });

    // If student overrides the inferred course type, log it for admin review.
    // NOTE: This is not blocking logic, it's only an audit trail.
    if (user.branch && !isDpIstp && !isDpMtp) {
      const candidates: string[] = [user.branch];
      if (user.branch === "CSE") candidates.push("CS");
      if (user.branch === "CS") candidates.push("CSE");
      if (user.branch === "DSE") candidates.push("DS");
      if (user.branch === "DS") candidates.push("DSE");
      if (user.branch === "MSE") candidates.push("MS");
      if (user.branch === "MS") candidates.push("MSE");
      if (user.branch === "MEVLSI") candidates.push("VL", "VLSI");
      if (user.branch === "VL") candidates.push("MEVLSI", "VLSI");
      if (user.branch === "BSCS") candidates.push("BS", "CH");
      if (user.branch === "BS") candidates.push("BSCS", "CH");
      if (user.branch === "BE") candidates.push("BIO");
      if (user.branch === "BIO") candidates.push("BE");
      if (user.branch === "GE-MECH") candidates.push("GE");
      if (user.branch === "GE-COMM") candidates.push("GE");
      if (user.branch === "GE-ROBO") candidates.push("GE");
      candidates.push("COMMON");

      const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
      const mappings = await prisma.courseBranchMapping.findMany({
        where: {
          courseId,
          branch: { in: uniqueCandidates },
        },
        select: {
          branch: true,
          courseCategory: true,
        },
      });

      const pickMapping = () => {
        for (const b of uniqueCandidates) {
          const m = mappings.find((x) => x.branch === b);
          if (m) return m;
        }
        return null;
      };

      const mapping = pickMapping();
      if (mapping?.courseCategory) {
        const expectedType = (() => {
          switch (mapping.courseCategory) {
            case "DE":
              return CourseType.DE;
            case "FE":
            case "NA":
            case "INTERNSHIP":
              return CourseType.FREE_ELECTIVE;
            case "MTP":
              return CourseType.MTP;
            case "ISTP":
              return CourseType.ISTP;
            default:
              return CourseType.CORE;
          }
        })();

        if (expectedType !== finalCourseType) {
          await prisma.courseSuggestion.create({
            data: {
              userId: session.user.id,
              courseId,
              suggestedCategory: finalCourseType,
              currentCategory: expectedType,
              status: "PENDING",
              enrollmentId: enrollment.id,
              semester,
              year,
              term,
            },
          });
        }
      }
    }

    // Update user's P/F credits if applicable
    if (finalIsPassFail) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          totalPassFailCredits: {
            increment: course.credits,
          },
        },
      });
    }

    return NextResponse.json(
      {
        ...enrollment,
        internshipCredits,
        message: isInternship
          ? `Internship enrolled. Credits to be awarded: ${internshipCredits}`
          : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating enrollment:", error);
    return NextResponse.json(
      { error: "Failed to create enrollment" },
      { status: 500 }
    );
  }
}
