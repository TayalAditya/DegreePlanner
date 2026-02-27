import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface CorrectedCourse {
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
  offerings: { [key: string]: boolean };
  category: string;
  originalCode: string;
  codeFixed: boolean;
}

interface MigrationReport {
  startTime: string;
  coursesProcessed: number;
  coursesCreated: number;
  coursesUpdated: number;
  coursesFailed: number;
  instructorsExtracted: number;
  instructorsCreated: number;
  instructorsFailed: number;
  errors: Array<{
    courseCode: string;
    error: string;
  }>;
  createdCourses: Array<{ code: string; name: string }>;
  details: string;
}

function extractDepartmentFromCode(code: string): string {
  // Extract 2-letter prefix: IC-102 -> IC, CS-208 -> CS
  const match = code.match(/^([A-Z]{2})/);
  return match ? match[1] : 'UNKNOWN';
}

function extractLevelFromCode(code: string): number {
  // Extract level: CS-208 -> 200, IC-102 -> 100, CS-513 -> 500
  const match = code.match(/(\d)(\d{2})/);
  if (match) {
    const level = parseInt(match[1]) * 100;
    return level || 100; // Default to 100-level if level 0
  }
  return 100;
}

function parseInstructorString(instructorStr: string): string[] {
  // Split by comma and clean up whitespace
  if (!instructorStr) return [];

  return instructorStr
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

async function migrateCoursesFromJson() {
  const report: MigrationReport = {
    startTime: new Date().toISOString(),
    coursesProcessed: 0,
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesFailed: 0,
    instructorsExtracted: 0,
    instructorsCreated: 0,
    instructorsFailed: 0,
    errors: [],
    createdCourses: [],
    details: '',
  };

  try {
    console.log('📊 COURSE DATABASE MIGRATION SCRIPT');
    console.log('=====================================\n');

    // Load fixed courses
    const fixedCoursesFile = path.join(__dirname, '..', 'fixed-courses.json');
    console.log('📖 Loading fixed courses from:', fixedCoursesFile);

    if (!fs.existsSync(fixedCoursesFile)) {
      throw new Error(`File not found: ${fixedCoursesFile}`);
    }

    const fixedCoursesData = JSON.parse(fs.readFileSync(fixedCoursesFile, 'utf-8')) as {
      bySemester: { [key: string]: CorrectedCourse[] };
    };

    console.log('✅ Fixed courses loaded\n');

    // Collect all courses by code to avoid duplicates
    const coursesByCode = new Map<string, CorrectedCourse>();
    const courseCount = Object.values(fixedCoursesData.bySemester).reduce(
      (sum, courses) => sum + courses.length,
      0
    );

    for (const courses of Object.values(fixedCoursesData.bySemester)) {
      for (const course of courses) {
        coursesByCode.set(course.courseCode, course);
      }
    }

    console.log(`📋 Processing ${coursesByCode.size} unique courses (from ${courseCount} total entries)\n`);

    const createdCourseCodes: string[] = [];

    // Process each unique course
    for (const [code, course] of coursesByCode.entries()) {
      report.coursesProcessed++;

      try {
        const department = extractDepartmentFromCode(code);
        const level = extractLevelFromCode(code);

        // Check if course already exists
        const existingCourse = await prisma.course.findUnique({
          where: { code },
        });

        let dbCourse;

        if (existingCourse) {
          // Update existing course
          dbCourse = await prisma.course.update({
            where: { code },
            data: {
              name: course.courseName,
              credits: course.credits,
              department,
              level,
              description: `Extracted from Excel - Category: ${course.category}`,
              isPassFailEligible: false,
            },
          });
          report.coursesUpdated++;
          console.log(`✏️  Updated: ${code} - ${course.courseName}`);
        } else {
          // Create new course
          dbCourse = await prisma.course.create({
            data: {
              code,
              name: course.courseName,
              credits: course.credits,
              department,
              level,
              description: `Extracted from Excel - Category: ${course.category}`,
              isPassFailEligible: false,
              offeredInFall: true, // Assume available unless specified otherwise
              offeredInSpring: true,
            },
          });
          report.coursesCreated++;
          createdCourseCodes.push(code);
          console.log(`✅ Created: ${code} - ${course.courseName}`);
        }

        // Extract and store instructor information
        const instructors = parseInstructorString(course.instructor);
        report.instructorsExtracted += instructors.length;

        // Store instructor information in course description for now
        // In future, use CourseInstructor table
        if (instructors.length > 0) {
          await prisma.course.update({
            where: { code },
            data: {
              description: `Instructors: ${instructors.join(', ')} | Category: ${course.category}`,
            },
          });
          report.instructorsCreated += instructors.length;
        }
      } catch (error) {
        report.coursesFailed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        report.errors.push({
          courseCode: code,
          error: errorMsg,
        });
        console.log(`❌ Error with ${code}: ${errorMsg}`);
      }
    }

    report.createdCourses = createdCourseCodes.map((code) => {
      const course = coursesByCode.get(code);
      return {
        code,
        name: course?.courseName || 'Unknown',
      };
    });

    // Generate summary
    console.log('\n=====================================');
    console.log('✅ MIGRATION COMPLETE\n');
    console.log(`Total processed: ${report.coursesProcessed}`);
    console.log(`Created: ${report.coursesCreated}`);
    console.log(`Updated: ${report.coursesUpdated}`);
    console.log(`Failed: ${report.coursesFailed}`);
    console.log(`\nInstructors extracted: ${report.instructorsExtracted}`);
    console.log(`Instructors stored: ${report.instructorsCreated}`);
    console.log(`Instructor errors: ${report.instructorsFailed}`);

    if (report.errors.length > 0) {
      console.log(`\n⚠️  Errors (${report.errors.length}):`);
      report.errors.slice(0, 5).forEach((e) => {
        console.log(`  - ${e.courseCode}: ${e.error}`);
      });
      if (report.errors.length > 5) {
        console.log(`  ... and ${report.errors.length - 5} more`);
      }
    }

    // Save report
    const reportFile = path.join(__dirname, '..', 'migration-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📁 Report saved to: migration-report.json`);

    return report;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    report.coursesFailed = report.coursesProcessed;
    report.details = error instanceof Error ? error.message : String(error);

    const reportFile = path.join(__dirname, '..', 'migration-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateCoursesFromJson();
