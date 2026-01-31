import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/course-mappings - Get all course-branch mappings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const courseId = searchParams.get("courseId");

    const mappings = await prisma.courseBranchMapping.findMany({
      where: {
        ...(branch && { branch }),
        ...(courseId && { courseId }),
      },
      include: {
        course: true,
      },
      orderBy: [
        { branch: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Error fetching course mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch course mappings" },
      { status: 500 }
    );
  }
}

// POST /api/course-mappings - Create or update course-branch mapping
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courseId, branch, courseCategory, isRequired, semester } = body;

    if (!courseId || !branch || !courseCategory) {
      return NextResponse.json(
        { error: "courseId, branch, and courseCategory are required" },
        { status: 400 }
      );
    }

    // Upsert the mapping
    const mapping = await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch: {
          courseId,
          branch,
        },
      },
      update: {
        courseCategory,
        isRequired,
        semester,
      },
      create: {
        courseId,
        branch,
        courseCategory,
        isRequired: isRequired || false,
        semester,
      },
      include: {
        course: true,
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Error creating/updating course mapping:", error);
    return NextResponse.json(
      { error: "Failed to create/update course mapping" },
      { status: 500 }
    );
  }
}

// PUT /api/course-mappings - Bulk update course mappings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "mappings must be an array" },
        { status: 400 }
      );
    }

    // Bulk upsert
    const results = await Promise.all(
      mappings.map(({ courseId, branch, courseCategory, isRequired, semester }) =>
        prisma.courseBranchMapping.upsert({
          where: {
            courseId_branch: {
              courseId,
              branch,
            },
          },
          update: {
            courseCategory,
            isRequired,
            semester,
          },
          create: {
            courseId,
            branch,
            courseCategory,
            isRequired: isRequired || false,
            semester,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: results.length,
    });
  } catch (error) {
    console.error("Error bulk updating course mappings:", error);
    return NextResponse.json(
      { error: "Failed to bulk update course mappings" },
      { status: 500 }
    );
  }
}
