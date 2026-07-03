import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10) || 50));
  const search = (url.searchParams.get("search") || "").trim();
  const outcome = url.searchParams.get("outcome") || "";

  const where: Record<string, unknown> = {};
  if (outcome && outcome !== "ALL") {
    where.outcome = outcome;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { enrollmentId: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [attempts, filteredTotal, total, approved, rejected] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loginAttempt.count({ where }),
    prisma.loginAttempt.count(),
    prisma.loginAttempt.count({ where: { outcome: { in: ["approved", "auto_approved"] } } }),
    prisma.loginAttempt.count({ where: { outcome: "rejected" } }),
  ]);

  return NextResponse.json({
    attempts,
    filteredTotal,
    total,
    approved,
    rejected,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filteredTotal / pageSize)),
  });
}
