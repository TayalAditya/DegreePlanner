import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function importAllCourses() {
  const filePath = path.join(process.cwd(), "docs", "courses_list.txt");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let currentDept = "";
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    // Department headers like "3 Civil Engineering Courses"
    if (line.match(/^\d+\s+(.+)\s+Courses$/i)) {
      const match = line.match(/^\d+\s+(.+)\s+Courses$/i);
      if (match) {
        currentDept = match[1].trim();
        console.log(`\n📂 ${currentDept}`);
      }
      continue;
    }

    // Course lines like "BE - 201 Cell Biology (3)"
    const courseMatch = line.match(/^([A-Z]{2,4})\s*[-\s]\s*(\d{3}[A-Z]?)\s+(.+?)\s*\((\d+)\)/);
    if (!courseMatch) continue;

    const [, deptCode, courseNum, courseName, creditsStr] = courseMatch;
    const code = `${deptCode}-${courseNum}`;
    const name = courseName.trim();
    const credits = parseInt(creditsStr);

    // Determine department code from course prefix
    const deptMapping: Record<string, string> = {
      BE: "BE",
      CE: "CE",
      CH: "CHEM",
      CS: "CSE",
      DS: "CSE",
      EE: "EE",
      EN: "EN",
      ET: "ET",
      GE: "GE",
      HS: "HSS",
      IC: "IC",
      IK: "IKS",
      MA: "MATH",
      MB: "MBA",
      ME: "ME",
      PH: "PHYS",
      QC: "QC",
      RM: "RM",
      DP: "IC",
      SA: "HSS",
    };

    const department = deptMapping[deptCode] || deptCode;

    // Determine level from course number
    const level = parseInt(courseNum[0]) * 100;

    try {
      const existing = await prisma.course.findUnique({
        where: { code },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.course.create({
        data: {
          code,
          name,
          credits,
          department,
          level,
          offeredInFall: true,
          offeredInSpring: true,
          offeredInSummer: false,
          isActive: true,
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(`  ✅ ${imported} courses imported...`);
      }
    } catch (error) {
      console.error(`❌ Error importing ${code}:`, (error as Error).message);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped (already exist): ${skipped}`);
  console.log(`📊 Total in DB: ${imported + skipped}`);
}

importAllCourses()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
