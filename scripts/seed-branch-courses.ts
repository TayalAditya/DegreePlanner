import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedBranchCourses() {
  console.log("🌱 Seeding branch-specific courses (DP-010P)...\n");

  // List of all branches that need DP-010P
  const branches = [
    { code: "CSE", dept: "Computer Science" },
    { code: "DSE", dept: "Data Science & Engineering" },
    { code: "MEVLSI", dept: "Microelectronics & VLSI" },
    { code: "EE", dept: "Electrical Engineering" },
    { code: "MNC", dept: "Mathematics & Computing" },
    { code: "CE", dept: "Civil Engineering" },
    { code: "BE", dept: "Bioengineering" },
    { code: "EP", dept: "Engineering Physics" },
    { code: "GE", dept: "General Engineering" },
    { code: "ME", dept: "Mechanical Engineering" },
    { code: "MSE", dept: "Materials Science & Engineering" },
  ];

  for (const branch of branches) {
    const courseCode = `${branch.code.substring(0, 2)}-010P`; // DP -> CS, EE, etc.

    const course = await prisma.course.upsert({
      where: { code: courseCode },
      update: {},
      create: {
        code: courseCode,
        name: `${branch.dept} Project & Seminar`,
        credits: 2,
        department: branch.dept,
        level: 800, // Final year
        description: `Mandatory 2-credit project and seminar for ${branch.dept}. Taken in Semester 8 by all students of this branch.`,

        // Mark as branch-specific
        isBranchSpecific: true,
        requiredBranches: [branch.code],
        requiredSemester: 8,

        // Offering
        offeredInFall: true,
        offeredInSpring: true,
        offeredInSummer: false,

        isActive: true,
      },
    });

    console.log(`✅ ${courseCode}: ${course.name}`);
  }

  console.log(`\n✅ Seeded ${branches.length} branch-specific courses`);
}

seedBranchCourses()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
