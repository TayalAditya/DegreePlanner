import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const body = await req.json().catch(() => ({}));
    const data: Record<string, any> = {};

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      data.title = title;
    }

    if (body.content !== undefined) {
      const content = String(body.content ?? "").trim();
      if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });
      data.content = content;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    console.error("Announcement update error:", err);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    await prisma.announcement.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    console.error("Announcement delete error:", err);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
