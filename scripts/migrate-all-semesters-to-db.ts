import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CourseFromData {
  courseCode: string;
  courseName: string;
  credits: number;
  creditBreakdown: {
    lecture: number;
    tutorial: number;
    practical: number;
    total: number;
  };
  instructor: string;
  semester: number;
  offerings: {
    BE: boolean;
    CE: boolean;
    CS: boolean;
    DSE: boolean;
    EE: boolean;
    EP: boolean;
    ME: boolean;
  };
  category: string;
}

interface ExtractionReport {
  bySemester: {
    [key: number]: CourseFromData[];
  };
}

async function main() {
  const reportPath = path.join(process.cwd(), 'extracted-courses-all-semesters.json');

  if (!fs.existsSync(reportPath)) {
    console.error(`❌ File not found: ${reportPath}`);
    console.log('Run: npx ts-node scripts/extract-all-semesters.ts first');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as ExtractionReport;

  console.log('\n📚 MIGRATING ALL SEMESTER COURSES TO DATABASE\n');
  console.log(`Total course-semester pairs to process: ${Object.keys(report.bySemester).length} semesters`);

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Process each semester
  for (const [semStr, courses] of Object.entries(report.bySemester)) {
    const semester = parseInt(semStr);
    console.log(`\n📖 Processing Semester ${semester} (${courses.length} courses)...`);

    for (const courseData of courses) {
      try {
        // Normalize course code
        const normalizedCode = courseData.courseCode
          .toUpperCase()
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-');

        // Determine which branches offer this course
        const branchesOffered = Object.entries(courseData.offerings)
          .filter(([_, offered]) => offered)
          .map(([branch]) => branch);

        if (branchesOffered.length === 0) {
          branchesOffered.push('COMMON'); // For courses offered across all branches
        }

        // Try to find existing course
        let course = await prisma.course.findUnique({
          where: { code: normalizedCode },
        });

        if (!course) {
          // Create new course
          course = await prisma.course.create({
            data: {
              code: normalizedCode,
              name: courseData.courseName,
              credits: courseData.credits,
              department: 'General', // Will be inferred from code
              level: Math.floor(semester / 2),
              description: `Credits: L${courseData.creditBreakdown.lecture}-T${courseData.creditBreakdown.tutorial}-P${courseData.creditBreakdown.practical}`,
              offeredInFall: semester === 1 || semester === 3 || semester === 5 || semester === 7,
              offeredInSpring: false,
              offeredInSummer: false,
            },
          });
          totalCreated++;
          console.log(`  ✅ Created: ${normalizedCode}`);
        } else {
          totalUpdated++;
        }

        // Create course branch mappings if not exists
        for (const branch of branchesOffered) {
          const categoryMap: { [key: string]: string } = {
            'C': 'IC',
            'E': 'FE',
            'IC': 'IC_BASKET',
            'DC': 'DC',
          };

          const mapping = await prisma.courseBranchMapping.findFirst({
            where: {
              courseId: course.id,
              branch: branch,
            },
          });

          if (!mapping) {
            await prisma.courseBranchMapping.create({
              data: {
                courseId: course.id,
                branch: branch,
                courseCategory: (categoryMap[courseData.category] || 'FE') as any,
              },
            });
          }
        }

        // Store semester information (if you have a semester_course table)
        // This could be extended for tracking when courses are offered
      } catch (error) {
        totalErrors++;
        console.error(`  ❌ Error processing ${courseData.courseCode}:`, (error as any).message);
      }
    }

    console.log(`  Summary: ${courses.length} courses processed for semester ${semester}`);
  }

  console.log('\n\n📊 MIGRATION SUMMARY\n');
  console.log(`✅ Courses Created: ${totalCreated}`);
  console.log(`⏭️  Courses Skipped (already exist): ${totalUpdated}`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log(`✓ Total Processed: ${totalCreated + totalUpdated + totalErrors}`);

  console.log('\n✅ Migration complete!');
  console.log('\n📋 Semesters Coverage:');
  console.log('  Odd Semesters: 1, 3, 5, 7 ✅');
  console.log('  Even Semesters: 2, 4, 6, 8 ⏳ (To be added separately)');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
