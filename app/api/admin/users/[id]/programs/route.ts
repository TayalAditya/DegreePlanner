import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { creditCalculator } from "@/lib/creditCalculator";
import { syncEnrollmentStatusesForUser } from "@/lib/enrollmentStatusSync";
import { courseIdentityKey } from "@/lib/courseIdentity";

const COURSE_NAME_OVERRIDES: Record<string, string> = {
  IK593: "Kulhad Economy",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branch: true, batch: true, enrollmentId: true },
    });

    // Auto-enroll in the correct program if the student has none yet
    // (handles students who were approved but haven't logged in).
    if (user?.branch) {
      const existingPrimary = await prisma.userProgram.findFirst({
        where: { userId, isPrimary: true, programType: "MAJOR" },
      });
      if (!existingPrimary) {
        const { getProgramLookupBranchCode } = await import("@/lib/branchInfo");
        const code = getProgramLookupBranchCode(user.branch, user.batch);
        const prog = await prisma.program.findUnique({ where: { code } })
          ?? await prisma.program.findUnique({ where: { code: user.branch } });
        if (prog) {
          await prisma.userProgram.create({
            data: { userId, programId: prog.id, programType: "MAJOR", isPrimary: true, startSemester: 1, status: "ACTIVE" },
          });
        }
      }
    }

    const [programs, enrollments] = await Promise.all([
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
                select: { courseCategory: true, branch: true, batch: true, splitCategory: true, splitAmount: true },
              },
            },
          },
        },
        orderBy: [{ semester: "asc" }, { year: "asc" }],
      }),
    ]);

    const primaryProgram = programs.find((p) => p.isPrimary) ?? programs[0];

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

    const enrollmentsWithOverrides = enrollments.map((e) => {
      const key = courseIdentityKey(e.course?.code);
      const overrideName = COURSE_NAME_OVERRIDES[key];
      if (!overrideName) return e;
      return {
        ...e,
        course: {
          ...e.course,
          name: overrideName,
        },
      };
    });

    return NextResponse.json({
      programs,
      enrollments: enrollmentsWithOverrides,
      userSettings: { branch: user?.branch, batch: user?.batch, enrollmentId: user?.enrollmentId },
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
