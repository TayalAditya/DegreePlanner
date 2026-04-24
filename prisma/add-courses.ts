import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding courses...\n");

  // ─── HS-309: World Cinema ────────────────────────────────────────────────
  // HSS category is auto-inferred from the HS- prefix in the frontend;
  // no CourseBranchMapping entry is needed.
  await prisma.course.upsert({
    where: { code: "HS-309" },
    update: {},
    create: {
      code: "HS-309",
      name: "World Cinema",
      credits: 3,
      department: "School of Humanities & Social Sciences",
      level: 300,
      offeredInFall: true,
      offeredInSpring: true,
      isActive: true,
    },
  });
  console.log("✓ HS-309 World Cinema");

  // ─── TU Munich – Semester Exchange courses ───────────────────────────────
  // Available to CSE students only, via semester exchange.
  // Can be taken in Semester 5, 6, or 7.
  const tumCourses = [
    {
      code: "IN2030",
      name: "Data Mining und Knowledge Discovery",
      credits: 2,
    },
    {
      code: "IN1503",
      name: "Advanced Programming",
      credits: 3.33,
    },
    {
      code: "IN0012",
      name: "Bachelor Practical Course",
      credits: 6.66,
    },
    {
      code: "IN2107",
      name: "Master-Seminar: Advanced Seminar Course",
      credits: 3.33,
    },
  ];

  const semexDescription =
    "Available via Semester Exchange (TU Munich) only. Can be taken in Semester 5, 6, or 7.";

  for (const c of tumCourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "TU Munich (Semester Exchange)",
        level: 300,
        description: semexDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    // Map as DE for CSE branch
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch: { courseId: course.id, branch: "CSE" } },
      update: {},
      create: {
        courseId: course.id,
        branch: "CSE",
        courseCategory: CourseCategoryType.DE,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → CSE:DE`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
