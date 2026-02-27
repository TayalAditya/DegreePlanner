import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function populateInstructors() {
  try {
    console.log('👨‍🏫 POPULATING INSTRUCTOR DATA\n');
    console.log('═══════════════════════════════════\n');

    // Load fixed courses with instructor information
    const fixedCoursesFile = path.join(__dirname, '..', 'fixed-courses.json');
    const fixedCourses = JSON.parse(fs.readFileSync(fixedCoursesFile, 'utf-8'));

    const instructorSet = new Set<string>();
    const courseInstructorMap = new Map<string, string[]>();

    // Collect all unique instructors
    for (const [_, courses] of Object.entries(fixedCourses.bySemester) as any[]) {
      for (const course of courses) {
        if (course.instructor) {
          const instructorNames = course.instructor
            .split(',')
            .map((name: string) => name.trim())
            .filter((name: string) => name.length > 0);

          for (const name of instructorNames) {
            if (name && name !== 'N/A' && !name.includes('[')) {
              instructorSet.add(name);
            }
          }

          if (instructorNames.length > 0) {
            courseInstructorMap.set(course.courseCode, instructorNames);
          }
        }
      }
    }

    console.log(`Found ${instructorSet.size} unique instructors\n`);
    console.log('Sample instructors:');
    Array.from(instructorSet)
      .slice(0, 10)
      .forEach((name) => {
        console.log(`  • ${name}`);
      });

    if (instructorSet.size > 10) {
      console.log(`  ... and ${instructorSet.size - 10} more\n`);
    }

    console.log('\n═══════════════════════════════════');
    console.log('✅ Analysis complete!\n');

    // Create instructors in database
    console.log('Creating instructors in database...\n');

    let created = 0;
    let skipped = 0;

    for (const instructorName of instructorSet) {
      try {
        const existing = await prisma.instructor.findUnique({
          where: { name: instructorName },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.instructor.create({
          data: {
            name: instructorName,
          },
        });
        created++;
      } catch (error) {
        console.error(`Error creating instructor ${instructorName}:`, error);
      }
    }

    console.log(`✅ Created: ${created} instructors`);
    console.log(`⏭️  Already existed: ${skipped} instructors`);

    // Now create course-instructor mappings
    console.log('\n🔗 Creating course-instructor mappings...\n');

    let mappingsCreated = 0;
    let mappingsSkipped = 0;

    for (const [courseCode, instructorNames] of courseInstructorMap.entries()) {
      // Get the course
      const course = await prisma.course.findUnique({
        where: { code: courseCode },
      });

      if (!course) {
        console.log(`⚠️  Course ${courseCode} not found`);
        continue;
      }

      for (let i = 0; i < instructorNames.length; i++) {
        const instructorName = instructorNames[i];

        // Get or find the instructor
        const instructor = await prisma.instructor.findUnique({
          where: { name: instructorName },
        });

        if (!instructor) {
          console.log(`⚠️  Instructor ${instructorName} not found`);
          continue;
        }

        try {
          const existing = await prisma.courseInstructor.findFirst({
            where: {
              courseId: course.id,
              instructorId: instructor.id,
            },
          });

          if (existing) {
            mappingsSkipped++;
            continue;
          }

          await prisma.courseInstructor.create({
            data: {
              courseId: course.id,
              instructorId: instructor.id,
              isPrimary: i === 0, // First instructor is primary
            },
          });
          mappingsCreated++;
        } catch (error) {
          console.error(
            `Error mapping ${courseCode} to ${instructorName}:`,
            error
          );
        }
      }
    }

    console.log(`✅ Created: ${mappingsCreated} course-instructor mappings`);
    console.log(`⏭️  Already existed: ${mappingsSkipped} mappings`);

    console.log('\n═══════════════════════════════════');
    console.log('✅ INSTRUCTOR POPULATION COMPLETE!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

populateInstructors();
