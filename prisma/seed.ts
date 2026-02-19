import { PrismaClient, ProgramType, CourseType } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPrograms() {
  console.log("🌱 Seeding all IIT Mandi programs...\n");

  // Delete existing user enrollments first
  await prisma.userProgram.deleteMany({});
  // Then delete programs
  await prisma.program.deleteMany({});

  // IC credits for all B.Tech: 39 (IC Compulsory) + 6 (IC Basket) + 12 (HSS) + 3 (IKS) = 60
  // MTP/ISTP: 12 credits
  // Total: 160 for B.Tech, 163 for BS-CS

  const programs = [
    // B.Tech: IC(60) + DC(branch-specific) + DE(branch-specific) + FE(22) + MTP/ISTP(12) = 160
    // BS-CS: IC(52) + DC(59) + DE(23) + FE(15) + Research(14) = 163

    // School of Computing & Electrical Engineering
    {
      code: "CSE",
      name: "B.Tech in Computer Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 38,
      deCredits: 28,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "DSE",
      name: "B.Tech in Data Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 33,
      deCredits: 33,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "MEVLSI",
      name: "B.Tech in Microelectronics & VLSI",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 54,
      deCredits: 12,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "EE",
      name: "B.Tech in Electrical Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 161, // EE is special: DC+DE=72, FE=17
      icCredits: 60,
      dcCredits: 52,
      deCredits: 20,
      feCredits: 17,
      mtpIstpCredits: 12,
    },
    // School of Mathematics & Statistical Science
    {
      code: "MNC",
      name: "B.Tech in Mathematics & Computing",
      department: "School of Mathematics & Statistical Science",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 51,
      deCredits: 15,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Environmental and Natural Sciences
    {
      code: "CE",
      name: "B.Tech in Civil Engineering",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 49,
      deCredits: 17,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Bioengineering
    {
      code: "BE",
      name: "B.Tech in Bioengineering",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 42,
      deCredits: 24,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Physical Sciences
    {
      code: "EP",
      name: "B.Tech in Engineering Physics",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 37,
      deCredits: 29,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Mechanical and Materials Engineering
    {
      code: "GE",
      name: "B.Tech in General Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 36,
      deCredits: 30,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "ME",
      name: "B.Tech in Mechanical Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 50,
      deCredits: 16,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "MSE",
      name: "B.Tech in Materials Science & Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 45,
      deCredits: 21,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Chemical Sciences
    {
      code: "BSCS",
      name: "B.S. in Chemical Sciences",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 163,
      icCredits: 52,
      dcCredits: 59,  // DC only (not DC+DE combined)
      deCredits: 23,  // DE only
      feCredits: 15,
      mtpIstpCredits: 14,
    },
  ];

  const created = [];
  for (const prog of programs) {
    // BS program has different MTP requirements
    const isBSTech = prog.code === "BSCS";

    const program = await prisma.program.create({
      data: {
        ...prog,
        type: "MAJOR",
        minCreditsForMtp: isBSTech ? 0 : 90,
        minSemesterForMtp: isBSTech ? 0 : 7,
      },
    });
    created.push(program);
    console.log(`✅ ${program.code}: ${program.name}`);
  }

  console.log(`\n✅ Created ${created.length} programs`);
  return created;
}

async function main() {
  console.log("🌱 Starting database seeding...\n");

  // Seed programs first
  await seedPrograms();

  // Create sample programs for testing
  console.log("\nCreating sample test programs...");

  const csMajor = await prisma.program.upsert({
    where: { code: "CS-SAMPLE" },
    update: {},
    create: {
      name: "Computer Science Sample",
      code: "CS-SAMPLE",
      type: ProgramType.MAJOR,
      department: "Computer Science",
      totalCreditsRequired: 120,
      icCredits: 60,
      dcCredits: 30,
      deCredits: 18,
      feCredits: 12,
      mtpIstpCredits: 0,
      minCreditsForMtp: 90,
      minSemesterForMtp: 7,
      description: "Bachelor of Science in Computer Science (Sample)",
    },
  });

  const mathMinor = await prisma.program.upsert({
    where: { code: "MATH-MINOR" },
    update: {},
    create: {
      name: "Mathematics Minor",
      code: "MATH-MINOR",
      type: ProgramType.MINOR,
      department: "Mathematics",
      totalCreditsRequired: 24,
      icCredits: 12,
      dcCredits: 12,
      deCredits: 0,
      feCredits: 0,
      mtpIstpCredits: 0,
      description: "Minor in Mathematics",
    },
  });

  // Create sample courses
  console.log("Creating courses...");

  const courses = [
    {
      code: "CS101",
      name: "Introduction to Programming",
      credits: 4,
      department: "Computer Science",
      level: 100,
      description: "Fundamental concepts of programming",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "CS102",
      name: "Data Structures",
      credits: 4,
      department: "Computer Science",
      level: 100,
      description: "Arrays, linked lists, trees, graphs",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "CS201",
      name: "Algorithms",
      credits: 4,
      department: "Computer Science",
      level: 200,
      description: "Algorithm design and analysis",
      offeredInFall: true,
      offeredInSpring: false,
    },
    {
      code: "CS301",
      name: "Database Systems",
      credits: 4,
      department: "Computer Science",
      level: 300,
      description: "Database design and SQL",
      offeredInFall: false,
      offeredInSpring: true,
    },
    {
      code: "CS302",
      name: "Operating Systems",
      credits: 4,
      department: "Computer Science",
      level: 300,
      description: "Process management, memory, file systems",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "CS401",
      name: "Machine Learning",
      credits: 4,
      department: "Computer Science",
      level: 400,
      description: "Supervised and unsupervised learning",
      offeredInFall: true,
      offeredInSpring: false,
    },
    {
      code: "CS402",
      name: "Web Development",
      credits: 3,
      department: "Computer Science",
      level: 400,
      description: "Full-stack web development",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "MATH201",
      name: "Calculus I",
      credits: 4,
      department: "Mathematics",
      level: 200,
      description: "Differential calculus",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "MATH202",
      name: "Calculus II",
      credits: 4,
      department: "Mathematics",
      level: 200,
      description: "Integral calculus",
      offeredInFall: true,
      offeredInSpring: true,
    },
    {
      code: "MATH301",
      name: "Linear Algebra",
      credits: 4,
      department: "Mathematics",
      level: 300,
      description: "Matrices, vector spaces, eigenvalues",
      offeredInFall: true,
      offeredInSpring: false,
    },
  ];

  for (const courseData of courses) {
    await prisma.course.upsert({
      where: { code: courseData.code },
      update: {},
      create: courseData,
    });
  }

  // Link courses to programs
  console.log("Linking courses to programs...");

  const cs101 = await prisma.course.findUnique({ where: { code: "CS101" } });
  const cs102 = await prisma.course.findUnique({ where: { code: "CS102" } });
  const cs201 = await prisma.course.findUnique({ where: { code: "CS201" } });
  const cs301 = await prisma.course.findUnique({ where: { code: "CS301" } });
  const cs302 = await prisma.course.findUnique({ where: { code: "CS302" } });
  const cs401 = await prisma.course.findUnique({ where: { code: "CS401" } });
  const cs402 = await prisma.course.findUnique({ where: { code: "CS402" } });

  // CS Major core courses
  if (cs101) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs101.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs101.id,
        courseType: CourseType.CORE,
        isRequired: true,
        semester: 1,
      },
    });
  }

  if (cs102) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs102.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs102.id,
        courseType: CourseType.CORE,
        isRequired: true,
        semester: 2,
      },
    });

    // CS102 requires CS101
    if (cs101) {
      await prisma.coursePrerequisite.upsert({
        where: {
          courseId_prerequisiteId: {
            courseId: cs102.id,
            prerequisiteId: cs101.id,
          },
        },
        update: {},
        create: {
          courseId: cs102.id,
          prerequisiteId: cs101.id,
        },
      });
    }
  }

  if (cs201) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs201.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs201.id,
        courseType: CourseType.CORE,
        isRequired: true,
        semester: 3,
      },
    });

    // CS201 requires CS102
    if (cs102) {
      await prisma.coursePrerequisite.upsert({
        where: {
          courseId_prerequisiteId: {
            courseId: cs201.id,
            prerequisiteId: cs102.id,
          },
        },
        update: {},
        create: {
          courseId: cs201.id,
          prerequisiteId: cs102.id,
        },
      });
    }
  }

  // DE courses
  if (cs301) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs301.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs301.id,
        courseType: CourseType.DE,
        isRequired: false,
        semester: 5,
      },
    });
  }

  if (cs302) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs302.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs302.id,
        courseType: CourseType.DE,
        isRequired: false,
        semester: 5,
      },
    });
  }

  if (cs401) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs401.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs401.id,
        courseType: CourseType.DE,
        isRequired: false,
        semester: 7,
      },
    });
  }

  if (cs402) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: csMajor.id,
          courseId: cs402.id,
        },
      },
      update: {},
      create: {
        programId: csMajor.id,
        courseId: cs402.id,
        courseType: CourseType.PE,
        isRequired: false,
        semester: 6,
      },
    });
  }

  // Math minor courses
  const math201 = await prisma.course.findUnique({ where: { code: "MATH201" } });
  const math202 = await prisma.course.findUnique({ where: { code: "MATH202" } });
  const math301 = await prisma.course.findUnique({ where: { code: "MATH301" } });

  if (math201) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: mathMinor.id,
          courseId: math201.id,
        },
      },
      update: {},
      create: {
        programId: mathMinor.id,
        courseId: math201.id,
        courseType: CourseType.CORE,
        isRequired: true,
        semester: 1,
      },
    });
  }

  if (math202) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: mathMinor.id,
          courseId: math202.id,
        },
      },
      update: {},
      create: {
        programId: mathMinor.id,
        courseId: math202.id,
        courseType: CourseType.CORE,
        isRequired: true,
        semester: 2,
      },
    });

    // MATH202 requires MATH201
    if (math201) {
      await prisma.coursePrerequisite.upsert({
        where: {
          courseId_prerequisiteId: {
            courseId: math202.id,
            prerequisiteId: math201.id,
          },
        },
        update: {},
        create: {
          courseId: math202.id,
          prerequisiteId: math201.id,
        },
      });
    }
  }

  if (math301) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: mathMinor.id,
          courseId: math301.id,
        },
      },
      update: {},
      create: {
        programId: mathMinor.id,
        courseId: math301.id,
        courseType: CourseType.DE,
        isRequired: false,
        semester: 3,
      },
    });
  }

  console.log("✅ Database seeded successfully!");
  console.log(`
Created:
  - ${courses.length} courses
  - 2 programs (CS Major, Math Minor)
  - Course prerequisites
  - Program-course relationships
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
