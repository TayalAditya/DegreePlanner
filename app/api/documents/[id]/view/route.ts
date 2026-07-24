import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/documents/[id]/view — auth-checked proxy to the stored file.
// Public documents are viewable by any signed-in user; private ones only by
// their owner. Legacy external links are redirected as-is.
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const canView = doc.isPublic || doc.userId === session.user.id;
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!doc.fileUrl) {
      return NextResponse.json({ error: "No file attached" }, { status: 404 });
    }

    // Legacy external link (no blob) — just redirect.
    if (!doc.blobPathname) {
      return NextResponse.redirect(doc.fileUrl);
    }

    const upstream = await fetch(doc.fileUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "File unavailable" }, { status: 502 });
    }

    const contentType = doc.mimeType || upstream.headers.get("content-type") || "application/octet-stream";
    const filename = (doc.fileName || doc.title || "document").replace(/"/g, "");

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Document view error:", error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
