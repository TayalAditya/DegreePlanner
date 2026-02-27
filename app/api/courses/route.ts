import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/courses - Get all courses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const department = searchParams.get("department");

    const courses = await prisma.course.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(department && { department }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        department: true,
        level: true,
        description: true,
        offeredInFall: true,
        offeredInSpring: true,
        offeredInSummer: true,
        isPassFailEligible: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
    const codePattern = /^[A-Z]{2}-\d{3}$/;
    const allowedNormalized = new Set(["DP301P", "DP498P", "DP499P"]);
    const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const filteredCourses = courses.filter(
      (course) => codePattern.test(course.code) || allowedNormalized.has(normalize(course.code))
    );

    return NextResponse.json(filteredCourses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
