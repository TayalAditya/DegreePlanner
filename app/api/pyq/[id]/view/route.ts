import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";

// GET /api/pyq/[id]/view — auth-checked proxy to the stored file.
// Enforces the review gate on the file itself: only APPROVED papers are
// viewable by everyone; PENDING/REJECTED papers are viewable only by the
// uploader or an admin. Legacy external links are redirected as-is.
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const paper = await prisma.previousYearPaper.findUnique({ where: { id } });
    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const isAdmin = isDocumentsAdmin(session.user);
    const isOwner = paper.uploadedById === session.user.id;
    const canView = paper.status === "APPROVED" || isOwner || isAdmin;
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Legacy external link (no blob) — just redirect.
    if (!paper.blobPathname) {
      return NextResponse.redirect(paper.fileUrl);
    }

    const upstream = await fetch(paper.fileUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "File unavailable" }, { status: 502 });
    }

    const contentType = paper.mimeType || upstream.headers.get("content-type") || "application/octet-stream";
    const filename = (paper.fileName || `${paper.courseCode}-${paper.examType}`).replace(/"/g, "");

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("PYQ view error:", error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
