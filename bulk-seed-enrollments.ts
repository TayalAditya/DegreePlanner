#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bulkSeedEnrollments() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'b23243@students.iitmandi.ac.in' },
      select: { id: true }
    });

    if (!user) return;

    // Get program
    const program = await prisma.userProgram.findFirst({
      where: { userId: user.id }
    });

    if (!program) return;

    // Get first 30 courses
    const courses = await prisma.course.findMany({
      take: 30,
      select: { id: true, code: true }
    });

    console.log(`📌 Found ${courses.length} courses`);

    // Create enrollments
    let created = 0;
    for (let i = 0; i < courses.length; i++) {
      const sem = Math.floor(i / 5) + 1; // Spread across semesters
      try {
        await prisma.courseEnrollment.create({
          data: {
            userId: user.id,
            courseId: courses[i].id,
            semester: sem,
            year: 2023 + Math.floor((sem - 1) / 2),
            term: sem % 2 === 1 ? 'FALL' : 'SPRING',
            courseType: 'CORE',
            programId: program.programId,
            status: sem <= 5 ? 'COMPLETED' : 'IN_PROGRESS'
          }
        });
        created++;
      } catch (err: any) {
        if (!err.message.includes('Unique constraint')) {
          console.error(`Failed to create enrollment for ${courses[i].code}:`, err.message);
        }
      }
    }

    console.log(`✅ Created ${created} enrollments`);

    // Verify
    const count = await prisma.courseEnrollment.count({
      where: { userId: user.id }
    });

    console.log(`📊 Total enrollments: ${count}`);

  } catch (error) {
    console.error('❌', error);
  } finally {
    await prisma.$disconnect();
  }
}

bulkSeedEnrollments();
