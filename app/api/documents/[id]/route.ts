import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const canDelete = session.user.role === "ADMIN" || doc.userId === session.user.id;
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

