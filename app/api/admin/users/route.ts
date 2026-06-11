import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch users + aggregate credit stats in a single query.
  // Avoids loading every enrollment row — just the sums we need.
  const users = await prisma.user.findMany({
    where: { isApproved: true },
    select: {
      id: true,
      name: true,
      email: true,
      enrollmentId: true,
      branch: true,
      batch: true,
      updatedAt: true,
      enrollments: {
        where: { status: { in: ["COMPLETED", "IN_PROGRESS"] } },
        select: {
          status: true,
          grade: true,
          course: { select: { credits: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" }, // most recently active first
  });

  const result = users.map((user) => {
    let completedCredits = 0;
    let inProgressCredits = 0;

    for (const e of user.enrollments) {
      const cr = e.course.credits ?? 0;
      if (e.status === "COMPLETED" && e.grade !== "F") {
        completedCredits += cr;
      } else if (e.status === "IN_PROGRESS") {
        inProgressCredits += cr;
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      enrollmentId: user.enrollmentId,
      branch: user.branch,
      batch: user.batch,
      completedCredits,
      inProgressCredits,
      totalEnrollments: user.enrollments.length,
      lastActiveAt: user.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(result);
}
