import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const B23_GE_MECH_DC = [
  { code: "EE-261", semester: 3 },
  { code: "EE-203", semester: 3 },
  { code: "EE-201", semester: 4 },
  { code: "EE-211", semester: 4 },
  { code: "ME-100", semester: 4 },
  { code: "EE-260", semester: 5 },
  { code: "ME-206", semester: 5 },
  { code: "AR-520", semester: 5 },
  { code: "AR-503", semester: 5 }, // Equivalent to AR-520 for B23 records.
  { code: "EE-301", semester: 5 },
  { code: "EE-302", semester: 5 }, // Equivalent to EE-301 for B23 records.
  { code: "ME-305", semester: 7 },
  { code: "ME-309", semester: 7 },
  { code: "EE-231", semester: 7 },
] as const;

const EQUIVALENT_PAIRS = [
  ["AR-503", "AR-520"],
  ["EE-302", "EE-301"],
] as const;

async function getCourse(code: string) {
  const course = await prisma.course.findFirst({ where: { code } });
  if (!course) throw new Error(`Course ${code} was not found in the catalog`);
  return course;
}

async function main() {
  const courseIds = new Map<string, string>();

  for (const { code, semester } of B23_GE_MECH_DC) {
    const course = await getCourse(code);
    courseIds.set(code, course.id);
    await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch_batch: {
          courseId: course.id,
          branch: "GE-MECH",
          batch: "2023",
        },
      },
      create: {
        courseId: course.id,
        branch: "GE-MECH",
        batch: "2023",
        courseCategory: CourseCategoryType.DC,
        isRequired: true,
        semester,
      },
      update: {
        courseCategory: CourseCategoryType.DC,
        isRequired: true,
        semester,
      },
    });
  }

  for (const [fromCode, toCode] of EQUIVALENT_PAIRS) {
    const courseId = courseIds.get(fromCode) ?? (await getCourse(fromCode)).id;
    const equivalentId = courseIds.get(toCode) ?? (await getCourse(toCode)).id;
    await prisma.courseEquivalent.upsert({
      where: { courseId_equivalentId: { courseId, equivalentId } },
      create: { courseId, equivalentId },
      update: {},
    });
  }

  console.log(`Aligned ${B23_GE_MECH_DC.length} B23 GE-Mech DC mappings and ${EQUIVALENT_PAIRS.length} equivalence pairs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
