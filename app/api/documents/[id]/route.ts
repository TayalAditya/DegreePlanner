import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";

const DOCUMENT_CATEGORIES = new Set([
  "FORMS",
  "PROCEDURES",
  "GUIDES",
  "CERTIFICATES",
  "TRANSCRIPTS",
  "OTHER",
]);

function isAuthorizedToAccess(sessionUserId: string, doc: { userId: string; isPublic: boolean }) {
  return doc.isPublic || doc.userId === sessionUserId;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!isAuthorizedToAccess(session.user.id, doc)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const canEdit = doc.userId === session.user.id || isDocumentsAdmin(session.user);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const data: Record<string, any> = {};

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      data.title = title;
    }

    if (body.description !== undefined) {
      const description = String(body.description ?? "").trim();
      data.description = description ? description : null;
    }

    if (body.category !== undefined) {
      const category = String(body.category ?? "").trim().toUpperCase();
      if (!DOCUMENT_CATEGORIES.has(category)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      data.category = category;
    }

    if (body.fileUrl !== undefined) {
      const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
      data.fileUrl = fileUrl ? fileUrl : null;
    }

    if (body.isPublic !== undefined) {
      data.isPublic = Boolean(body.isPublic);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Document update error:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const canDelete = doc.userId === session.user.id || isDocumentsAdmin(session.user);
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
