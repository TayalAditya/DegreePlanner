import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";

export const VALID_EXAM_TYPES = new Set(["QUIZ", "MIDSEM", "ENDSEM", "OTHER"]);
export const VALID_TERMS = new Set(["FALL", "SPRING", "SUMMER"]);

export type PaperFields = {
  courseCode: string;
  examType: string;
  title?: string | null;
  semester: number;
  year: number;
  term: string;
  fileUrl: string;
  blobPathname?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

export type CreatePaperResult =
  | { ok: true; paper: unknown }
  | { ok: false; status: number; error: string };

/**
 * Shared create path for PYQ papers used by both the JSON (link) route and the
 * multipart upload route: validates fields, enforces the enrollment gate
 * (admins bypass), and creates the record with the correct review status.
 */
export async function createPaper(
  sessionUser: { id: string; email?: string | null; role?: string; enrollmentId?: string | null },
  fields: PaperFields
): Promise<CreatePaperResult> {
  const { courseCode, examType, title, semester, year, term, fileUrl } = fields;

  if (!courseCode || !examType || !fileUrl || !semester || !year || !term) {
    return {
      ok: false,
      status: 400,
      error: "Missing required fields: courseCode, examType, file, semester, year, term",
    };
  }
  if (!VALID_EXAM_TYPES.has(examType)) {
    return { ok: false, status: 400, error: "Invalid exam type" };
  }
  if (!VALID_TERMS.has(term)) {
    return { ok: false, status: 400, error: "Invalid term" };
  }

  const course = await prisma.course.findFirst({ where: { code: courseCode } });
  if (!course) {
    return { ok: false, status: 404, error: "Course not found" };
  }

  const isAdmin = isDocumentsAdmin(sessionUser);
  if (!isAdmin) {
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        userId: sessionUser.id,
        courseId: course.id,
        semester: Number(semester),
      },
    });
    if (!enrollment) {
      return {
        ok: false,
        status: 403,
        error: "You can only upload papers for courses you are enrolled in for that semester",
      };
    }
  }

  const paper = await prisma.previousYearPaper.create({
    data: {
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      semester: Number(semester),
      year: Number(year),
      term: term as "FALL" | "SPRING" | "SUMMER",
      examType: examType as "QUIZ" | "MIDSEM" | "ENDSEM" | "OTHER",
      title: title || `${course.code} ${examType} ${term} ${year}`,
      fileUrl,
      blobPathname: fields.blobPathname ?? null,
      fileName: fields.fileName ?? null,
      fileSize: fields.fileSize ?? null,
      mimeType: fields.mimeType ?? null,
      uploadedById: sessionUser.id,
      // Admin uploads are auto-approved; student uploads await review.
      status: isAdmin ? "APPROVED" : "PENDING",
      ...(isAdmin ? { reviewedById: sessionUser.id, reviewedAt: new Date() } : {}),
    },
    include: {
      uploadedBy: { select: { name: true, enrollmentId: true } },
    },
  });

  return { ok: true, paper };
}
