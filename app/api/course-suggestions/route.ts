import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1";

    if (all && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suggestions = await prisma.courseSuggestion.findMany({
      where: all ? undefined : { userId: session.user.id },
      include: all
        ? {
            user: { select: { name: true, email: true, enrollmentId: true } },
            course: { select: { code: true, name: true } },
          }
        : {
            course: { select: { code: true, name: true } },
          },
      orderBy: { createdAt: "desc" },
      take: all ? 400 : 100,
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Error fetching course suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}

