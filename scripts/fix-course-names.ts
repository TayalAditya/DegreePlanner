import prisma from "../lib/prisma";

// Group 1: Strip page number artifacts + clean names
const GROUP1_FIXES: Record<string, string> = {
  "AR-501": "Robot Kinematics, Dynamics, and Control",
  "BE-401": "Bioengineering Mini Project, Term Paper and Seminar",
  "CE-510": "Modelling and Simulation in Water Resources Engineering",
  "CE-605": "Engineering Seismology and Seismic Hazard Assessment",
  "CE-610": "Analysis and Design for Earthquake Resistant Structures",
  "CY-344": "Food Chemistry: Processing, Preservation and Storage",
  "CY-403": "Numerical Methods and Data Analysis in Chemistry",
  "CY-404": "Fundamentals of Soft Matter Science and Applications",
  "CY-646": "Advanced NMR Spectroscopy - A Problem Based Approach",
  "CY-702": "Advanced Inorganic Chemistry: Theory and Applications",
  "CY-746": "Self Assembly of Surfactants and Polymers in Solution",
  "EE-312": "Microelectronics Circuits Design Practicum (MCDP)",
  "EE-507": "Transmission Lines and Basic Microwave Engineering",
  "EE-535": "Communication and Signal Processing Systems Design",
  "EE-540": "Wide Band Gap Devices in Power Electronics Applications",
  "EE-553": "Foundations of Intelligent Communication Systems-I",
  "EE-630": "HVDC Transmission and Flexible AC Transmission Systems",
  "GE-522": "Entrepreneurship and Technology Commercialization",
  "GE-523": "Startup Framework: Finance, Valuation, and Structure",
  "HS-263": "Popular Culture in Modern India: A Historical Perspective",
  "HS-503": "German Literature from World War II to Reunification",
  "HS-555": "Infrastructural Development in Highland South Asia",
  "HS-627": "Readings in Eighteenth Century German Literature",
  "IK-503": "Cognitive Psychology and the Indian Thought System",
  "IK-506": "Research Methods and Statistics for Contemplative Science",
  "IK-562": "Research Methodology - Tantra Yukti and Pramāṇa Śāstra",
  "MA-553": "Mathematical Foundations of Financial Engineering",
  "MA-555": "Introduction to Partial Differential Equations for Engineers",
  "MB-519": "Creative Thinking, Problem Solving and Decision Making",
  "MB-532": "Digital Business Strategy, Models and Transformations",
  "MB-581": "Leadership Lessons from Indian Knowledge Systems",
  "ME-304": "Power Plant Engineering / Principles of Energy Conversion",
  "ME-351": "Management of Manufacturing and Logistics Systems",
};

// Group 2: All-caps SEMESTER INTERNSHIP courses to delete
const GROUP2_DELETE = [
  "BE-396", "BE-399",
  "CE-396", "CE-399",
  "CS-396", "CS-399",
  "DS-396", "DS-399",
  "EE-396", "EE-399",
  "EP-396", "EP-399",
  "ME-396", "ME-399",
];

// Group 5: Typo fix
const GROUP5_FIXES: Record<string, string> = {
  "EE-326": "Computer Organization and Processor Architecture Design",
};

async function main() {
  console.log("=== Course Name Fix Script ===\n");

  // ── Group 1: Fix page number artifacts ──────────────────────────────────
  console.log("── Group 1: Fixing page number artifacts ──");
  let g1Fixed = 0;
  for (const [code, cleanName] of Object.entries(GROUP1_FIXES)) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) {
      console.log(`  ⚠️  Not found: ${code}`);
      continue;
    }
    await prisma.course.update({ where: { code }, data: { name: cleanName } });
    console.log(`  ✅ ${code}: "${cleanName}"`);
    g1Fixed++;
  }

  // ── AR-501 special: also upsert ME-452 with same name + credits ─────────
  const ar501 = await prisma.course.findUnique({ where: { code: "AR-501" } });
  if (ar501) {
    const me452Name = "Robot Kinematics, Dynamics, and Control";
    const existing = await prisma.course.findUnique({ where: { code: "ME-452" } });
    if (existing) {
      await prisma.course.update({
        where: { code: "ME-452" },
        data: { name: me452Name, credits: ar501.credits },
      });
      console.log(`  ✅ ME-452 updated: "${me452Name}" (${ar501.credits} credits)`);
    } else {
      await prisma.course.create({
        data: {
          code: "ME-452",
          name: me452Name,
          credits: ar501.credits,
          department: ar501.department,
          level: ar501.level,
          isActive: ar501.isActive,
          isPassFailEligible: ar501.isPassFailEligible,
          isBranchSpecific: ar501.isBranchSpecific,
          offeredInFall: ar501.offeredInFall,
          offeredInSpring: ar501.offeredInSpring,
          offeredInSummer: ar501.offeredInSummer,
        },
      });
      console.log(`  ✅ ME-452 created: "${me452Name}" (${ar501.credits} credits)`);
    }
  }

  // ── Group 2: Delete all-caps SEMESTER INTERNSHIP courses ────────────────
  console.log("\n── Group 2: Deleting all-caps SEMESTER INTERNSHIP courses ──");
  let g2Deleted = 0, g2Skipped = 0;
  for (const code of GROUP2_DELETE) {
    const course = await prisma.course.findUnique({
      where: { code },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!course) {
      console.log(`  ⚠️  Not found: ${code}`);
      continue;
    }
    if (course._count.enrollments > 0) {
      console.log(`  ⏭️  Skipped ${code}: has ${course._count.enrollments} enrollment(s) — delete manually`);
      g2Skipped++;
      continue;
    }
    // Delete related mappings first
    await prisma.courseBranchMapping.deleteMany({ where: { courseId: course.id } });
    await prisma.programCourse.deleteMany({ where: { courseId: course.id } });
    await prisma.coursePrerequisite.deleteMany({
      where: { OR: [{ courseId: course.id }, { prerequisiteId: course.id }] },
    });
    await prisma.course.delete({ where: { code } });
    console.log(`  🗑️  Deleted: ${code} ("${course.name}")`);
    g2Deleted++;
  }

  // ── Group 5: Fix typo ────────────────────────────────────────────────────
  console.log("\n── Group 5: Fixing typos ──");
  let g5Fixed = 0;
  for (const [code, cleanName] of Object.entries(GROUP5_FIXES)) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) {
      console.log(`  ⚠️  Not found: ${code}`);
      continue;
    }
    await prisma.course.update({ where: { code }, data: { name: cleanName } });
    console.log(`  ✅ ${code}: "${cleanName}"`);
    g5Fixed++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n=== Done ===");
  console.log(`Group 1: ${g1Fixed} names fixed`);
  console.log(`Group 2: ${g2Deleted} deleted, ${g2Skipped} skipped (had enrollments)`);
  console.log(`Group 5: ${g5Fixed} typos fixed`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
