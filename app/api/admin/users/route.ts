import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { isApproved: true },
    select: {
      id: true,
      name: true,
      email: true,
      enrollmentId: true,
      branch: true,
      batch: true,
      enrollments: {
        select: {
          semester: true,
          status: true,
          grade: true,
          course: { select: { credits: true } },
        },
      },
    },
    orderBy: { enrollmentId: "asc" },
  });

  const result = users.map((user) => {
    const semMap: Record<number, { courses: number; credits: number }> = {};
    let completedCredits = 0;
    let inProgressCredits = 0;

    user.enrollments.forEach((e) => {
      const sem = e.semester || 0;
      if (!semMap[sem]) semMap[sem] = { courses: 0, credits: 0 };
      semMap[sem].courses++;
      semMap[sem].credits += e.course.credits;

      if (e.status === "COMPLETED" && e.grade !== "F") {
        completedCredits += e.course.credits;
      } else if (e.status === "IN_PROGRESS") {
        inProgressCredits += e.course.credits;
      }
    });

    const semesterBreakdown = Object.entries(semMap)
      .map(([sem, data]) => ({ semester: Number(sem), ...data }))
      .sort((a, b) => a.semester - b.semester);

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
      semesterBreakdown,
    };
  });

  return NextResponse.json(result);
}
