/**
 * Add the Spring 2026 special IKS offering IK-591_7.
 *
 * It is catalogued separately from the recurring IK-591 course because the
 * title and one-credit special offering need to remain visible on transcripts.
 * Every branch receives an IKS mapping, so it counts in the shared HSS+IKS
 * basket wherever the student records it.
 *
 * Run: npx tsx scripts/add-ik591-jyotisha-special-offering.ts --apply
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const COURSE = {
  code: "IK-591_7",
  name: "Introduction to Jyotisha: Concepts, Philosophy and Tradition",
  description: "Special offering — Spring 2026 (last even semester). Counts in the combined HSS + IKS basket for every branch.",
  credits: 1,
  department: "IK",
  level: 500,
  ltpc: null,
  offeredInFall: false,
  offeredInSpring: true,
  offeredInSummer: false,
  isPassFailEligible: false,
  isActive: true,
} as const;

const ALL_BRANCHES = [
  "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE", "EP", "MSE", "MNC",
  "MEVLSI", "GE", "GE-MECH", "GE-COMM", "GE-ROBO", "BSCS", "COMMON",
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`${COURSE.code} · ${COURSE.credits} cr · Spring 2026 special offering`);

  if (!APPLY) {
    console.log(`Would upsert the catalog entry and ${ALL_BRANCHES.length} IKS mappings.`);
    return;
  }

  const course = await prisma.course.upsert({
    where: { code: COURSE.code },
    update: COURSE,
    create: COURSE,
    select: { id: true, code: true },
  });

  for (const branch of ALL_BRANCHES) {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch, batch: "" } },
      update: { courseCategory: CourseCategoryType.IKS, semester: null, isRequired: false },
      create: {
        courseId: course.id,
        branch,
        batch: "",
        courseCategory: CourseCategoryType.IKS,
        semester: null,
        isRequired: false,
      },
    });
  }

  console.log(`Added ${course.code} with ${ALL_BRANCHES.length} all-branch IKS mappings.`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
