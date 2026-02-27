#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function  seedUserWithEnrollments() {
  try {
    console.log('🔍 Looking for user b23243...');
    const user = await prisma.user.findUnique({
      where: { email: 'b23243@students.iitmandi.ac.in' },
      select: { id: true, email: true, batch: true, enrollmentId: true }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ Found: ${user.email} (Batch ${user.batch})`);

    // Get IC-102P course
    const course = await prisma.course.findFirst({
      where: { code: { in: ['IC-102P', 'IC102P'] } }
    });

    if (!course) {
      console.log('❌ Course not found');
      return;
    }

    console.log(`✅ Course: ${course.code}`);

    // Get program
    const program = await prisma.userProgram.findFirst({
      where: { userId: user.id }
    });

    if (!program) {
      console.log('❌ No program for user');
      return;
    }

    console.log(`✅ Program: ${program.programId}`);

    // Create enrollment
    console.log('\n📝 Creating enrollment...');
    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        semester: 1,
        year: 2023,
        term: 'FALL',
        courseType: 'CORE',
        programId: program.programId,
        status: 'IN_PROGRESS'
      }
    });

    console.log(`✅ Created: ${enrollment.id}`);

    // Verify
    const count = await prisma.courseEnrollment.count({
      where: { userId: user.id }
    });

    console.log(`✅ Total enrollments: ${count}`);

  } catch (error) {
    console.error('❌', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedUserWithEnrollments();
