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

  // TU Darmstadt semester exchange courses.
  // These count as DE for DSE/DSAI students. For other branches, the app treats
  // courses with non-matching branch mappings as Free Electives.
  const tuDarmstadtCourses = [
    {
      code: "20-00-0157-iv",
      name: "Computer Vision I",
      credits: 4,
    },
    {
      code: "20-00-0040-iv",
      name: "Computer Graphics I",
      credits: 4,
    },
    {
      code: "20-00-1233-iv",
      name: "Introduction to Large Language Models",
      credits: 4,
    },
    {
      code: "20-00-0449-iv",
      name: "Probabilistic Graphical Models",
      credits: 4,
    },
    {
      code: "18-sc-2050",
      name: "Introduction to Scientific Computing in C++",
      credits: 3,
    },
  ];

  const tuDarmstadtDescription =
    "Available via Semester Exchange (TU Darmstadt) only. Counts as DE for DSE/DSAI students.";

  for (const c of tuDarmstadtCourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        credits: c.credits,
        department: "TU Darmstadt (Semester Exchange)",
        level: 300,
        description: tuDarmstadtDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "TU Darmstadt (Semester Exchange)",
        level: 300,
        description: tuDarmstadtDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch: { courseId: course.id, branch: "DSE" } },
      update: { courseCategory: CourseCategoryType.DE, isRequired: false },
      create: {
        courseId: course.id,
        branch: "DSE",
        courseCategory: CourseCategoryType.DE,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) -> DSE:DE`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
