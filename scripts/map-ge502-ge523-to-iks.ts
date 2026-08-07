/**
 * GE-502 and GE-523 count in the shared HSS+IKS basket for every branch.
 *
 * Keep the mappings and active offerings aligned so course registration,
 * imports and progress all resolve the same IKS classification.
 *
 * Run: npx tsx scripts/map-ge502-ge523-to-iks.ts --apply
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CODES = ["GE-502", "GE-523"] as const;
const ALL_BRANCHES = [
  "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE", "EP", "MSE", "MNC",
  "MEVLSI", "GE", "GE-MECH", "GE-COMM", "GE-ROBO", "BSCS", "COMMON",
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  const courses = await prisma.course.findMany({
    where: { code: { in: [...CODES] } },
    select: { id: true, code: true, name: true, credits: true },
    orderBy: { code: "asc" },
  });
  if (courses.length !== CODES.length) {
    throw new Error(`Expected ${CODES.join(", ")} in the catalog; found ${courses.map((course) => course.code).join(", ") || "none"}.`);
  }

  for (const course of courses) {
    console.log(`${course.code} · ${course.credits} cr · ${course.name}`);
    if (!APPLY) {
      console.log(`  Would set ${ALL_BRANCHES.length} mappings and active offerings to IKS.`);
      continue;
    }

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

    const offerings = await prisma.courseOffering.updateMany({
      where: { courseId: course.id, isActive: true },
      data: { categoryOverride: CourseCategoryType.IKS },
    });
    console.log(`  Updated ${ALL_BRANCHES.length} mappings and ${offerings.count} active offering(s).`);
  }
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
