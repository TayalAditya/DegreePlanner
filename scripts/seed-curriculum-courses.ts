import { PrismaClient } from "@prisma/client";
import { DEFAULT_CURRICULUM } from "../lib/defaultCurriculum";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding IIT Mandi curriculum courses...\n");

  // Collect all unique courses across all branches/semesters
  const courseMap = new Map<string, { code: string; name: string; credits: number; category: string }>();

  for (const [key, courses] of Object.entries(DEFAULT_CURRICULUM)) {
    for (const course of courses) {
      if (!courseMap.has(course.code)) {
        courseMap.set(course.code, {
          code: course.code,
          name: course.name,
          credits: course.credits,
          category: course.category,
        });
      }
    }
  }

  console.log(`Found ${courseMap.size} unique courses across all branches\n`);

  let created = 0;
  let skipped = 0;

  for (const [code, course] of courseMap) {
    // Determine department from course code prefix
    const prefix = code.replace(/\d.*/, "");
    const departmentMap: Record<string, string> = {
      IC: "Institute Core",
      CS: "Computer Science",
      EE: "Electrical Engineering",
      ME: "Mechanical Engineering",
      CE: "Civil Engineering",
      BE: "Bioengineering",
      EP: "Engineering Physics",
      MA: "Mathematics",
      MNC: "Mathematics & Computing",
      MT: "Materials Science",
      DS: "Data Science",
      CY: "Chemical Sciences",
      PH: "Physics",
      IC2: "Institute Core",
    };
    const department = departmentMap[prefix] || "General";

    // Determine level from course code number
    const numMatch = code.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0]) : 100;
    const level = num >= 400 ? 400 : num >= 300 ? 300 : num >= 200 ? 200 : 100;

    try {
      await prisma.course.upsert({
        where: { code },
        update: { name: course.name, credits: course.credits },
        create: {
          code,
          name: course.name,
          credits: course.credits,
          department,
          level,
          isActive: true,
          offeredInFall: true,
          offeredInSpring: true,
        },
      });
      created++;
    } catch (err) {
      console.error(`Failed to create ${code}:`, err);
      skipped++;
    }
  }

  console.log(`✅ Created/updated ${created} courses, ${skipped} skipped`);

  // Also fix sae@iitmandi.ac.in approval
  const saeUser = await prisma.user.findUnique({ where: { email: "sae@iitmandi.ac.in" } });
  if (saeUser && !saeUser.isApproved) {
    await prisma.user.update({
      where: { email: "sae@iitmandi.ac.in" },
      data: { isApproved: true, role: "ADMIN" },
    });
    console.log("✅ Fixed sae@iitmandi.ac.in approval status");
  }

  // Auto-enroll each user into their branch program if not already enrolled
  const users = await prisma.user.findMany({
    where: { isApproved: true, branch: { not: null } },
    select: { id: true, email: true, branch: true },
  });

  for (const user of users) {
    if (!user.branch) continue;
    const program = await prisma.program.findUnique({ where: { code: user.branch } });
    if (!program) {
      console.log(`⚠️  No program found for branch ${user.branch}`);
      continue;
    }
    const existing = await prisma.userProgram.findFirst({
      where: { userId: user.id, programId: program.id },
    });
    if (!existing) {
      await prisma.userProgram.create({
        data: {
          userId: user.id,
          programId: program.id,
          programType: "MAJOR",
          isPrimary: true,
          startSemester: 1,
          status: "ACTIVE",
        },
      });
      console.log(`✅ Enrolled ${user.email} in ${user.branch} program`);
    }
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
