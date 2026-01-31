import { PrismaClient, ProgramType, CourseType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create sample programs
  console.log("Creating programs...");
  
  const csMajor = await prisma.program.upsert({
    where: { code: "CS-MAJOR" },
    update: {},
    create: {
      name: "Computer Science",
      code: "CS-MAJOR",
      type: ProgramType.MAJOR,
      department: "Computer Science",
      totalCreditsRequired: 120,
      coreCredits: 60,
      deCredits: 24,
      peCredits: 18,
      freeElectiveCredits: 12,
      mtpRequired: true,
      mtpCredits: 6,
      istpAllowed: true,
      istpCredits: 6,
      minCreditsForMtp: 90,
      minSemesterForMtp: 7,
      description: "Bachelor of Science in Computer Science",
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
      coreCredits: 12,
      deCredits: 12,
      peCredits: 0,
      freeElectiveCredits: 0,
      mtpRequired: false,
      mtpCredits: 0,
      istpAllowed: false,
      istpCredits: 0,
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
