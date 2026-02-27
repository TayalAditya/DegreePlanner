import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";


export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { enrollments } = body;

    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      return NextResponse.json(
        { error: "Invalid enrollments data" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { 
        id: true, 
        batch: true,
        branch: true,
        programs: {
          where: { isPrimary: true },
          select: { programId: true }
        }
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get primary program ID for enrollments
    let primaryProgramId = user.programs[0]?.programId || null;

    // If no primary program, try to auto-enroll based on branch
    if (!primaryProgramId && user.branch) {
      console.log(`Auto-enrolling ${user.email} in ${user.branch} program...`);
      
      const program = await prisma.program.findUnique({
        where: { code: user.branch },
      });

      if (program) {
        const userProgram = await prisma.userProgram.create({
          data: {
            userId: user.id,
            programId: program.id,
            programType: "MAJOR",
            isPrimary: true,
            startSemester: 1,
            status: "ACTIVE",
          },
        });
        primaryProgramId = userProgram.programId;
        console.log(`✅ Auto-enrolled in ${user.branch} program`);
      }
    }

    if (!primaryProgramId) {
      return NextResponse.json(
        { error: "No program found. Please enroll in a program first." },
        { status: 400 }
      );
    }

    // currentSemester from payload tells us which sems are "past" (→ COMPLETED)
    const currentSemester: number = body.currentSemester ?? 99;

    // Map curriculum category codes to CourseType enum values
    const categoryToCourseType: Record<string, "CORE" | "DE" | "PE" | "FREE_ELECTIVE" | "MTP" | "ISTP"> = {
      IC: "CORE",
      ICB: "CORE",
      DC: "CORE",
      HSS: "CORE",
      IKS: "CORE",
      DE: "DE",
      FE: "FREE_ELECTIVE",
      MTP: "MTP",
      ISTP: "ISTP",
      INTERNSHIP: "FREE_ELECTIVE",
    };

    // Process enrollments in batches
    const results = [];
    const errors = [];

    for (const enrollment of enrollments) {
      try {
        const { courseCode, semester, grade } = enrollment;
        // Normalize courseType: map category codes to valid enum values
        const rawType = enrollment.courseType as string;
        const courseType = categoryToCourseType[rawType] ?? "CORE";

        // Find the course by code
        const course = await prisma.course.findUnique({
          where: { code: courseCode },
        });

        if (!course) {
          errors.push({ courseCode, error: "Course not found" });
          continue;
        }

        // Determine correct academic year from batch + semester number
        // Sem 1 = FALL batchYear, Sem 2 = SPRING batchYear+1, Sem 3 = FALL batchYear+1 ...
        const batchYear = user.batch ?? new Date().getFullYear() - 3;
        const semYear = batchYear + Math.floor((semester - 1) / 2);
        const term = semester % 2 === 1 ? "FALL" : "SPRING";

        // Past semesters are COMPLETED; current sem depends on whether grade given
        const isPastSemester = semester < currentSemester;
        const status = grade ? "COMPLETED" : isPastSemester ? "COMPLETED" : "IN_PROGRESS";

        // Check if enrollment already exists
        const existing = await prisma.courseEnrollment.findFirst({
          where: {
            userId: user.id,
            courseId: course.id,
            semester,
          },
        });

        if (existing) {
          // Update existing enrollment
          const updated = await prisma.courseEnrollment.update({
            where: { id: existing.id },
            data: {
              courseType,
              grade,
              status,
              year: semYear,
              term,
              programId: primaryProgramId, // Set programId
            },
          });
          results.push({ courseCode, action: "updated", id: updated.id });
        } else {
          // Create new enrollment
          const created = await prisma.courseEnrollment.create({
            data: {
              userId: user.id,
              courseId: course.id,
              semester,
              year: semYear,
              term,
              courseType: courseType || "CORE",
              grade,
              status,
              programId: primaryProgramId, // Set programId
            },
          });
          results.push({ courseCode, action: "created", id: created.id });
        }
      } catch (error) {
        console.error(`Error processing ${enrollment.courseCode}:`, error);
        errors.push({ courseCode: enrollment.courseCode, error: String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: enrollments.length,
        successful: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error("Bulk enrollment error:", error);
    return NextResponse.json(
      { error: "Failed to create enrollments" },
      { status: 500 }
    );
  }
}
