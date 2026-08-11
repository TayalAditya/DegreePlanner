import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";
import { VALID_EXAM_TYPES, toPaperForClient } from "@/lib/pyqShared";

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

    return NextResponse.json(papers.map(toPaperForClient));
  } catch (error) {
    console.error("PYQ fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  // Arbitrary URLs cannot be protected: the source owner controls them and a
  // direct redirect would reintroduce downloads. QPs must use /api/pyq/upload.
  return NextResponse.json(
    { error: "Direct links are disabled. Upload a PDF, JPG or PNG through the protected upload endpoint." },
    { status: 405, headers: { Allow: "GET" } }
  );
}
