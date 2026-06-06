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
      name: "Bachelor Practical Course Projects in Natural Language Processing",
      credits: 6.67,
    },
    {
      code: "IN2107",
      name: "Foundations and Applications of Graph Neural Networks",
      credits: 3.33,
    },
  ];

  const semexDescription =
    "Available via Semester Exchange (TU Munich) only. Can be taken in Semester 5, 6, or 7.";

  for (const c of tumCourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
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
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
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
      where: { courseId_branch_batch: { courseId: course.id, branch: "DSE", batch: "" } },
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

  // ─── Additional TU Munich courses ──────────────────────────────────────────
  const tumExtra = [
    { code: "IN2375", name: "Computer Vision III: Detection, Segmentation, and Tracking", credits: 4 },
    { code: "IN2106", name: "Master-Praktikum", credits: 6.66 },
    { code: "IN2339", name: "Data Analysis and Visualization in R", credits: 4 },
    { code: "IN2379", name: "Advanced Data Handling and Visualization Techniques", credits: 4 },
  ];

  for (const c of tumExtra) {
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

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
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

  // ─── MGT001348: Innovation Sprint (TU Munich, FE for CSE) ───────────────────
  // MGT prefix → no auto prefix-routing to TUM; set department explicitly.
  const innovationSprint = await prisma.course.upsert({
    where: { code: "MGT001348" },
    update: {},
    create: {
      code: "MGT001348",
      name: "Innovation Sprint",
      credits: 4,
      department: "TU Munich (Semester Exchange)",
      level: 300,
      description: semexDescription,
      offeredInFall: true,
      offeredInSpring: true,
      isActive: true,
    },
  });

  await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId: innovationSprint.id, branch: "CSE", batch: "" } },
    update: {},
    create: {
      courseId: innovationSprint.id,
      branch: "CSE",
      courseCategory: CourseCategoryType.FE,
      isRequired: false,
    },
  });
  console.log("✓ MGT001348 Innovation Sprint (4 cr) → CSE:FE");

  // ─── IN2406: Fundamentals of Artificial Intelligence (split: 3cr DC + 1cr FE) ─
  const in2406 = await prisma.course.upsert({
    where: { code: "IN2406" },
    update: {},
    create: {
      code: "IN2406",
      name: "Fundamentals of Artificial Intelligence",
      credits: 4,
      department: "TU Munich (Semester Exchange)",
      level: 300,
      description: `${semexDescription} Credits split: 3 cr count as DC, 1 cr counts as FE.`,
      offeredInFall: true,
      offeredInSpring: true,
      isActive: true,
    },
  });

  await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId: in2406.id, branch: "CSE", batch: "" } },
    update: { splitCategory: CourseCategoryType.FE, splitAmount: 1 },
    create: {
      courseId: in2406.id,
      branch: "CSE",
      courseCategory: CourseCategoryType.DC,
      isRequired: false,
      splitCategory: CourseCategoryType.FE,
      splitAmount: 1,
    },
  });
  console.log("✓ IN2406 Fundamentals of Artificial Intelligence (4 cr) → CSE: 3cr DC + 1cr FE");

  // ─── TU Darmstadt – MSE Semester Exchange courses ────────────────────────
  const tuDarmstadtMSEDescription =
    "Available via Semester Exchange (TU Darmstadt) only. Can be taken in Semester 5, 6, or 7.";

  const tumMSECourses: {
    code: string;
    name: string;
    credits: number;
    category: CourseCategoryType;
  }[] = [
    { code: "41-12-2182-ku", name: "German Intensive Basic Course III/IV b", credits: 4,    category: CourseCategoryType.HSS },
    { code: "16-08-5120",    name: "High Temperature Materials Behaviour",    credits: 4,    category: CourseCategoryType.FE  },
    { code: "11-01-7562",    name: "Computational Materials Science",         credits: 3.33, category: CourseCategoryType.DC  },
    { code: "11-01-7301",    name: "Electrochemistry for Energy Applications II: Devices and Technology", credits: 2.67, category: CourseCategoryType.DE },
    { code: "11-01-2009",    name: "Concepts in Materials Physics",           credits: 4,    category: CourseCategoryType.DE  },
    { code: "11-01-4105",    name: "Surfaces and Interfaces",                 credits: 3.33, category: CourseCategoryType.DE  },
  ];

  for (const c of tumMSECourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "TU Darmstadt (Semester Exchange)",
        level: 300,
        description: tuDarmstadtMSEDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MSE", batch: "" } },
      update: { courseCategory: c.category, isRequired: false },
      create: {
        courseId: course.id,
        branch: "MSE",
        courseCategory: c.category,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → MSE:${c.category}`);
  }

  // ─── DSAI B25 new courses ─────────────────────────────────────────────────
  // CS305 (Artificial Intelligence) already in DB — only DS417/DS418 are new.
  const dsaiB25Courses = [
    { code: "DS417", name: "Deep Learning",                 credits: 4 },
    { code: "DS418", name: "Introduction to Generative AI", credits: 4 },
  ];

  for (const c of dsaiB25Courses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "School of Computing & Electrical Engineering",
        level: parseInt(c.code.replace(/\D/g, "").slice(0, 3)) || 400,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "DSAI", batch: "" } },
      update: { courseCategory: CourseCategoryType.DC },
      create: {
        courseId: course.id,
        branch: "DSAI",
        batch: "",
        courseCategory: CourseCategoryType.DC,
        isRequired: true,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → DSAI:DC`);
  }

  // ─── TU Darmstadt – EE Semester Exchange courses ─────────────────────────
  const tuDarmstadtEEDescription =
    "Available via Semester Exchange (TU Darmstadt) only. Can be taken in Semester 5, 6, or 7.";

  const tuDarmstadtEECourses: {
    code: string;
    name: string;
    credits: number;
    category: CourseCategoryType;
  }[] = [
    { code: "18-ho-2610", name: "Advanced Digital Integrated Circuit Design", credits: 4,    category: CourseCategoryType.DE },
    { code: "18-zo-2060", name: "Digital Signal Processing",                  credits: 4,    category: CourseCategoryType.DC },
    { code: "18-zh-1010", name: "Hardware Fundamentals for Neural Networks",   credits: 4,    category: CourseCategoryType.DE },
    { code: "18-zo-2030", name: "Digital Signal Processing Lab",               credits: 4,    category: CourseCategoryType.DE },
  ];

  for (const c of tuDarmstadtEECourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "TU Darmstadt (Semester Exchange)",
        level: 300,
        description: tuDarmstadtEEDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "EE", batch: "" } },
      update: { courseCategory: c.category, isRequired: false },
      create: {
        courseId: course.id,
        branch: "EE",
        courseCategory: c.category,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → EE:${c.category}`);
  }

  // ─── Additional TU Munich Semester 5 CSE courses ─────────────────────────
  const tumSem5Courses = [
    { code: "IN4212",      name: "Masterpraktikum - Advanced Platform Engineering for Agentic AI", credits: 6.67 },
    { code: "CIT3230002",  name: "Cloud Information Systems",                                       credits: 3.33 },
    { code: "IN212819",    name: "Practical Course - JavaScript Technology",                        credits: 6.67 },
  ];

  for (const c of tumSem5Courses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
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

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: CourseCategoryType.DE, isRequired: false },
      create: {
        courseId: course.id,
        branch: "CSE",
        courseCategory: CourseCategoryType.DE,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → CSE:DE`);
  }

  // CS305 already exists — just ensure DSAI:DC mapping is present.
  const cs305 = await prisma.course.findUnique({ where: { code: "CS305" } });
  if (cs305) {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: cs305.id, branch: "DSAI", batch: "" } },
      update: { courseCategory: CourseCategoryType.DC },
      create: { courseId: cs305.id, branch: "DSAI", batch: "", courseCategory: CourseCategoryType.DC, isRequired: true },
    });
    console.log("✓ CS305 Artificial Intelligence → DSAI:DC");
  }

  // ─── Add missing XX-010 Department Project courses ───────────────────────
  // 2cr IC, Sem 8 only (Spring), own-branch only.
  // MS-010, VL-010, GE-010, MC-010 were missing from DB.
  const missingDp010 = [
    { code: "MS-010", branch: "MS" },
    { code: "VL-010", branch: "VL" },
    { code: "GE-010", branch: "GE" },
    { code: "MC-010", branch: "MC" },
  ];

  for (const c of missingDp010) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: "Internship",
        credits: 2,
        department: "IIT Mandi",
        level: 0,
        offeredInFall: false,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: c.branch, batch: "" } },
      update: { courseCategory: CourseCategoryType.IC, isRequired: true },
      create: { courseId: course.id, branch: c.branch, batch: "", courseCategory: CourseCategoryType.IC, isRequired: true },
    });

    console.log(`✓ ${c.code} Internship (2 cr) → ${c.branch}:IC`);
  }

  // Fix DS-010: CSE:DE is wrong — CSE students cannot take another branch's XX-010
  const ds010 = await prisma.course.findUnique({ where: { code: "DS-010" } });
  if (ds010) {
    await prisma.courseBranchMapping.updateMany({
      where: { courseId: ds010.id, branch: "CSE" },
      data: { courseCategory: CourseCategoryType.NA },
    });
    console.log("✓ DS-010 CSE:DE → NA (CSE can't take DS-010)");
  }

  // ─── Fix XX-396P and XX-399P: all → FE (P/F internships) ─────────────────
  // BE, CE, CS/CSE, EE, EP, ME were incorrectly mapped as DE.
  // DSE mapping on DS-396P/DS-399P was also DE — fix to FE.
  const internshipMappingFixes: { code: string; branch: string }[] = [
    { code: "BE-396P", branch: "BE"  }, { code: "BE-396P", branch: "BIO" },
    { code: "BE-399P", branch: "BE"  }, { code: "BE-399P", branch: "BIO" },
    { code: "CE-396P", branch: "CE"  }, { code: "CE-399P", branch: "CE"  },
    { code: "CS-396P", branch: "CS"  }, { code: "CS-396P", branch: "CSE" },
    { code: "CS-399P", branch: "CS"  }, { code: "CS-399P", branch: "CSE" },
    { code: "DS-396P", branch: "DSE" }, { code: "DS-399P", branch: "DSE" },
    { code: "EE-396P", branch: "EE"  }, { code: "EE-399P", branch: "EE"  },
    { code: "EP-396P", branch: "EP"  }, { code: "EP-399P", branch: "EP"  },
    { code: "ME-396P", branch: "ME"  }, { code: "ME-399P", branch: "ME"  },
  ];

  for (const { code, branch } of internshipMappingFixes) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) { console.log(`⚠ ${code} not found, skipping`); continue; }
    await prisma.courseBranchMapping.updateMany({
      where: { courseId: course.id, branch },
      data: { courseCategory: CourseCategoryType.FE },
    });
    console.log(`✓ ${code} ${branch}:DE → FE`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
