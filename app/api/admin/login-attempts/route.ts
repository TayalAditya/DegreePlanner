import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Accurate aggregate counts across ALL rows (not just the returned page),
  // plus the most-recent slice for the table (client paginates + searches it).
  const [attempts, total, approved, rejected] = await Promise.all([
    prisma.loginAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.loginAttempt.count(),
    prisma.loginAttempt.count({ where: { outcome: { in: ["approved", "auto_approved"] } } }),
    prisma.loginAttempt.count({ where: { outcome: "rejected" } }),
  ]);

  return NextResponse.json({ attempts, total, approved, rejected });
}
