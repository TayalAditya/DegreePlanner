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
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Process enrollments in batches
    const results = [];
    const errors = [];

    for (const enrollment of enrollments) {
      try {
        const { courseCode, semester, courseType, grade } = enrollment;

        // Find the course by code
        const course = await prisma.course.findUnique({
          where: { code: courseCode },
        });

        if (!course) {
          errors.push({ courseCode, error: "Course not found" });
          continue;
        }

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
              status: grade ? "COMPLETED" : "IN_PROGRESS",
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
              year: new Date().getFullYear(),
              term: semester % 2 === 0 ? "SPRING" : "FALL",
              courseType: courseType || "FE",
              grade,
              status: grade ? "COMPLETED" : "IN_PROGRESS",
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
