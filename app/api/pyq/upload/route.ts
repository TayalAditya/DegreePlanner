import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPaper, toPaperForClient } from "@/lib/pyqShared";
import {
  deletePrivatePyqBlob,
  isPrivatePyqBlobConfigured,
  uploadPyqToPrivateBlob,
  validatePyqUploadFile,
} from "@/lib/pyqProtectedStorage";

// POST /api/pyq/upload — multipart upload of an actual paper file.
// Enrollment-gated (students may only upload for a course+semester they are
// enrolled in); admins bypass. Student uploads await review; admin uploads
// are auto-approved (handled in createPaper).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPrivatePyqBlobConfigured()) {
      return NextResponse.json(
        { error: "Protected question-paper storage is not configured. Please contact an administrator." },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const courseCode = formData.get("courseCode") as string | null;
    const examType = formData.get("examType") as string | null;
    const title = (formData.get("title") as string | null) ?? null;
    const semester = formData.get("semester") as string | null;
    const year = formData.get("year") as string | null;
    const term = formData.get("term") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileError = validatePyqUploadFile(file);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    // QPs always go to the dedicated private Blob store. This is deliberately
    // separate from general documents, which may be intentionally public.
    const stored = await uploadPyqToPrivateBlob(file);

    const result = await createPaper(session.user, {
      courseCode: courseCode ?? "",
      examType: examType ?? "",
      title,
      semester: Number(semester),
      year: Number(year),
      term: term ?? "",
      fileUrl: stored.url,
      blobPathname: stored.pathname,
      fileName: stored.fileName,
      fileSize: stored.fileSize,
      mimeType: stored.mimeType,
    });

    if (!result.ok) {
      // Roll back the orphaned blob before returning the validation error.
      await deletePrivatePyqBlob(stored.url);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(toPaperForClient(result.paper), { status: 201 });
  } catch (error) {
    console.error("PYQ upload error:", error);
    return NextResponse.json({ error: "Failed to upload paper" }, { status: 500 });
  }
}
