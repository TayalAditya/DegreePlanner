import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/announcements - admin-only announcement management list
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json(announcements);
}

