import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { creditCalculator } from "@/lib/creditCalculator";
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
      select: {
        branch: true,
        batch: true,
        enrollmentId: true,
        doingMTP: true,
        doingMTP2: true,
        doingISTP: true,
      },
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
              equivalents: {
                select: { equivalent: { select: { code: true, name: true } } },
              },
              equivalentFor: {
                select: { course: { select: { code: true, name: true } } },
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

      const equivCodes = [
        ...e.course.equivalents.map((eq) => ({ code: eq.equivalent.code, name: eq.equivalent.name })),
        ...e.course.equivalentFor.map((eq) => ({ code: eq.course.code, name: eq.course.name })),
      ];

      const { equivalents, equivalentFor, ...courseRest } = e.course;
      return {
        ...e,
        course: {
          ...courseRest,
          ...(overrideName ? { name: overrideName } : {}),
          ...(equivCodes.length > 0 ? { equivalentCourses: equivCodes } : {}),
        },
      };
    });

    return NextResponse.json({
      programs,
      enrollments: enrollmentsWithOverrides,
      userSettings: {
        branch: user?.branch,
        batch: user?.batch,
        enrollmentId: user?.enrollmentId,
        doingMTP: user?.doingMTP,
        doingMTP2: user?.doingMTP2,
        doingISTP: user?.doingISTP,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await params;

  try {
    const body = await request.json().catch(() => null);
    const data: { doingMTP?: boolean; doingMTP2?: boolean; doingISTP?: boolean } = {};

    if (body?.doingMTP !== undefined) data.doingMTP = Boolean(body.doingMTP);
    if (body?.doingMTP2 !== undefined) data.doingMTP2 = Boolean(body.doingMTP2);
    if (body?.doingISTP !== undefined) data.doingISTP = Boolean(body.doingISTP);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No project settings provided" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        branch: true,
        batch: true,
        enrollmentId: true,
        doingMTP: true,
        doingMTP2: true,
        doingISTP: true,
      },
    });

    return NextResponse.json({ userSettings: updated });
  } catch (error) {
    console.error("Error updating user project settings for admin:", error);
    return NextResponse.json(
      { error: "Failed to update project settings" },
      { status: 500 }
    );
  }
}
