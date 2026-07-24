import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";

const VALID_EXAM_TYPES = new Set(["QUIZ", "MIDSEM", "ENDSEM", "OTHER"]);
const VALID_TERMS = new Set(["FALL", "SPRING", "SUMMER"]);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseCode = searchParams.get("courseCode");
    const examType = searchParams.get("examType");
    const semester = searchParams.get("semester");

    const isAdmin = isDocumentsAdmin(session.user);

    // Non-admins see APPROVED papers plus their own uploads (any status).
    // Admins see everything (so they can review PENDING papers).
    const where: Record<string, unknown> = isAdmin
      ? {}
      : {
          OR: [
            { status: "APPROVED" },
            { uploadedById: session.user.id },
          ],
        };

    if (courseCode) where.courseCode = courseCode;
    if (examType && VALID_EXAM_TYPES.has(examType)) where.examType = examType;
    if (semester) where.semester = parseInt(semester, 10);

    const papers = await prisma.previousYearPaper.findMany({
      where,
      include: {
        uploadedBy: {
          select: { name: true, enrollmentId: true },
        },
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(papers);
  } catch (error) {
    console.error("PYQ fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courseCode, examType, fileUrl, title, semester, year, term } = body;

    // Validate required fields
    if (!courseCode || !examType || !fileUrl || !semester || !year || !term) {
      return NextResponse.json(
        { error: "Missing required fields: courseCode, examType, fileUrl, semester, year, term" },
        { status: 400 }
      );
    }

    if (!VALID_EXAM_TYPES.has(examType)) {
      return NextResponse.json({ error: "Invalid exam type" }, { status: 400 });
    }
    if (!VALID_TERMS.has(term)) {
      return NextResponse.json({ error: "Invalid term" }, { status: 400 });
    }

    // Find the course in DB
    const course = await prisma.course.findFirst({ where: { code: courseCode } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify the user is enrolled in this course for that semester (admin bypass).
    const isAdmin = isDocumentsAdmin(session.user);
    if (!isAdmin) {
      const enrollment = await prisma.courseEnrollment.findFirst({
        where: {
          userId: session.user.id,
          courseId: course.id,
          semester: parseInt(semester, 10),
        },
      });

      if (!enrollment) {
        return NextResponse.json(
          { error: "You can only upload papers for courses you are enrolled in for that semester" },
          { status: 403 }
        );
      }
    }

    const paper = await prisma.previousYearPaper.create({
      data: {
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        semester: parseInt(semester, 10),
        year: parseInt(year, 10),
        term: term as "FALL" | "SPRING" | "SUMMER",
        examType: examType as "QUIZ" | "MIDSEM" | "ENDSEM" | "OTHER",
        title: title || `${course.code} ${examType} ${term} ${year}`,
        fileUrl,
        uploadedById: session.user.id,
        // Admin uploads are auto-approved; student uploads await review.
        status: isAdmin ? "APPROVED" : "PENDING",
        ...(isAdmin
          ? { reviewedById: session.user.id, reviewedAt: new Date() }
          : {}),
      },
      include: {
        uploadedBy: {
          select: { name: true, enrollmentId: true },
        },
      },
    });

    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    console.error("PYQ create error:", error);
    return NextResponse.json({ error: "Failed to upload paper" }, { status: 500 });
  }
}
