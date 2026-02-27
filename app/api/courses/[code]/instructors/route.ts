import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const courseCode = params.code.toUpperCase();

    // Find the course
    const course = await prisma.course.findUnique({
      where: { code: courseCode },
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Get all instructors for this course
    const courseInstructors = await prisma.courseInstructor.findMany({
      where: { courseId: course.id },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
            phone: true,
            office: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { instructor: { name: 'asc' } }],
    });

    return NextResponse.json({
      courseCode,
      courseName: course.name,
      instructors: courseInstructors.map((ci) => ({
        id: ci.instructor.id,
        name: ci.instructor.name,
        email: ci.instructor.email,
        department: ci.instructor.department,
        designation: ci.instructor.designation,
        phone: ci.instructor.phone,
        office: ci.instructor.office,
        isPrimary: ci.isPrimary,
        responsibilities: ci.responsibilities,
        semester: ci.semester,
        year: ci.year,
        term: ci.term,
      })),
      totalInstructors: courseInstructors.length,
    });
  } catch (error) {
    console.error('Error fetching course instructors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instructors' },
      { status: 500 }
    );
  }
}
