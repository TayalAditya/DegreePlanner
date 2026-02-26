import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Parse the extracted text file to get structured course data
interface ParsedCourse {
  code: string;
  name: string;
  credits: number;
  department: string;
  level: number;
  description?: string;
  offeredInFall: boolean;
  offeredInSpring: boolean;
  offeredInSummer: boolean;
}

function parseCoursesFromFile(filePath: string): ParsedCourse[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const courses: ParsedCourse[] = [];
  const departmentMap: Record<string, string> = {
    AR: "Robotics",
    BE: "BioEngineering",
    BY: "Biology",
    CE: "CivilEngineering",
    CS: "ComputerScience",
    CY: "Chemistry",
    HS: "Humanities",
    DS: "DataScience",
    MA: "Mathematics",
    PH: "Physics",
    ME: "MechanicalEngineering",
    EE: "ElectricalEngineering",
    DP: "Design",
  };

  // Parse course list section headers and details
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Match course code in format: "1.1 AR 501/..." or "1.2 AR 502: ..."
    const courseLineMatch = line.match(
      /^[\d.]+\s+([A-Z]{2})\s+(\d+)(?:[A-Z])?(?:\/[A-Z0-9\s]+)?:\s*(.+?)(?:\s+\.\+)?$/
    );

    if (courseLineMatch) {
      const [, dept, codeNum, courseName] = courseLineMatch;
      const courseCode = `${dept}-${codeNum}`;

      // Look ahead for course details
      let creditStr = "3";
      let level = parseInt(codeNum.substring(0, 1)) * 100;
      let description = "";

      // Search for credit distribution in the next 20 lines
      let foundDetails = false;
      for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
        const detailLine = lines[j].trim();

        // Look for "Credit Distribution : 3-0-0-3" format
        const creditMatch = detailLine.match(/Credit\s+Distribution\s*:\s*(\d+)-(\d+)-(\d+)-(\d+)/);
        if (creditMatch) {
          const [, lecture, , , credits] = creditMatch;
          creditStr = credits;
          foundDetails = true;
        }

        // Look for level info in "Intended for : UG, PG and PhD"
        if (detailLine.match(/Intended for/i)) {
          break;
        }

        // Collect first description lines
        if (
          detailLine.startsWith("•") ||
          detailLine.startsWith("Âˆ") ||
          detailLine.startsWith("-")
        ) {
          description = detailLine.replace(/^[•Âˆ\-]\s*/, "").substring(0, 100);
          break;
        }
      }

      const course: ParsedCourse = {
        code: courseCode,
        name: courseName.trim(),
        credits: parseInt(creditStr) || 3,
        department: departmentMap[dept] || dept,
        level: level,
        description: description || `${dept} course on ${courseName.trim()}`,
        offeredInFall: true,
        offeredInSpring: true,
        offeredInSummer: false,
      };

      courses.push(course);
    }

    i++;
  }

  return courses;
}

async function seedCoursesFromPDF() {
  const pdfPath = path.join(
    process.cwd(),
    "docs",
    "courses_list.txt"
  );

  console.log("📚 Parsing courses from PDF...");
  console.log(`📂 File path: ${pdfPath}`);

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  const courses = parseCoursesFromFile(pdfPath);
  console.log(`✅ Parsed ${courses.length} courses from PDF\n`);

  if (courses.length === 0) {
    console.error("❌ No courses were parsed from the file");
    process.exit(1);
  }

  // Display sample of parsed courses
  console.log("📋 Sample of parsed courses:");
  courses.slice(0, 5).forEach((course) => {
    console.log(
      `  - ${course.code}: ${course.name} (${course.credits} credits, ${course.department})`
    );
  });
  console.log(`  ... and ${courses.length - 5} more\n`);

  try {
    let createdCount = 0;
    let skippedCount = 0;

    console.log("💾 Seeding courses into database...\n");

    for (const course of courses) {
      try {
        const existing = await prisma.course.findUnique({
          where: { code: course.code },
        });

        if (existing) {
          skippedCount++;
        } else {
          const created = await prisma.course.create({
            data: course,
          });
          createdCount++;

          if (createdCount % 50 === 0) {
            console.log(`  ✓ Created ${createdCount} courses...`);
          }
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to create course ${course.code}: ${(error as any).message}`
        );
      }
    }

    console.log(`\n✅ Seeding completed!`);
    console.log(`  ✓ Created: ${createdCount} new courses`);
    console.log(`  ⊘ Skipped: ${skippedCount} existing courses`);
    console.log(`  📊 Total in database: ${await prisma.course.count()}`);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedCoursesFromPDF().catch((e) => {
  console.error(e);
  process.exit(1);
});
