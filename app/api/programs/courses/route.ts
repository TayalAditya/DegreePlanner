import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user's primary program
    const userProgram = await prisma.userProgram.findFirst({
      where: { userId: session.user.id, status: "ACTIVE", isPrimary: true },
      select: { programId: true },
    });

    if (!userProgram) {
      return NextResponse.json([]);
    }

    const programCourses = await prisma.programCourse.findMany({
      where: { programId: userProgram.programId },
      select: {
        courseType: true,
        isRequired: true,
        semester: true,
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
            branchMappings: {
              select: { branch: true, batch: true, courseCategory: true, splitCategory: true, splitAmount: true },
            },
            equivalents: {
              select: { equivalent: { select: { code: true } } },
            },
            equivalentFor: {
              select: { course: { select: { code: true } } },
            },
          },
        },
      },
      orderBy: [{ semester: "asc" }, { course: { code: "asc" } }],
    });

    const result = programCourses.map((pc) => {
      const equivCodes = [
        ...pc.course.equivalents.map((e) => e.equivalent.code),
        ...pc.course.equivalentFor.map((e) => e.course.code),
      ];
      const { equivalents, equivalentFor, ...courseRest } = pc.course;
      return {
        ...pc,
        course: {
          ...courseRest,
          equivalentCodes: equivCodes.length > 0 ? equivCodes : undefined,
        },
      };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Error fetching program courses:", error);
    return NextResponse.json({ error: "Failed to fetch program courses" }, { status: 500 });
  }
}
