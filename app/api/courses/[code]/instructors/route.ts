import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const courseCode = code.toUpperCase();

    // Find the course
    const course = await prisma.course.findUnique({
      where: { code: courseCode },
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        department: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Return course information
    // Instructor data is not available in current schema
    return NextResponse.json({
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      department: course.department,
      instructors: [],
      totalInstructors: 0,
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course information' },
      { status: 500 }
    );
  }
}
