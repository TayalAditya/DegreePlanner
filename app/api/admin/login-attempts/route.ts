import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const attempts = await prisma.loginAttempt.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(attempts);
}
