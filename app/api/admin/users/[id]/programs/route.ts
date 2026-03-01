import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { creditCalculator } from "@/lib/creditCalculator";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userId = params.id;

  try {
    const [programs, enrollments, user] = await Promise.all([
      prisma.userProgram.findMany({
        where: { userId, status: "ACTIVE" },
        include: { program: true },
      }),
      prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              branchMappings: {
                select: { courseCategory: true, branch: true },
              },
            },
          },
        },
        orderBy: [{ semester: "asc" }, { year: "asc" }],
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { branch: true },
      }),
    ]);

    const primaryProgram = programs.find((p) => p.isPrimary);

    let progressData = null;
    if (primaryProgram?.program?.id) {
      try {
        progressData = await creditCalculator.calculateProgramProgress(
          userId,
          primaryProgram.program.id
        );
      } catch {
        // Non-fatal — modal will still show without the chart
      }
    }

    return NextResponse.json({
      programs,
      enrollments,
      userSettings: { branch: user?.branch },
      progressData,
    });
  } catch (error) {
    console.error("Error fetching user programs for admin:", error);
    return NextResponse.json(
      { error: "Failed to fetch user programs" },
      { status: 500 }
    );
  }
}
