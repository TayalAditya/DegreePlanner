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
      isPassFail,
      isInternship,
      internshipType,
      internshipDays,
    } = body;

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
        isPassFail: isPassFail || false,
        passFailCredits: isPassFail ? course.credits : 0,
        isInternship: isInternship || false,
        internshipType: isInternship ? internshipType : null,
        internshipDays: isInternship ? internshipDays : null,
      },
      include: {
        course: true,
      },
    });

    // Update user's P/F credits if applicable
    if (isPassFail) {
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
