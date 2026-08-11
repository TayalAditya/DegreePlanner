/**
 * Correct the RWTH AI transfer-credit allocation everywhere it is mapped.
 *
 * 12.45308 is worth 4.67 credits and fulfils CS-305 for 3 DC credits; its
 * remaining 1.67 credits are Free Elective credits. Batch-specific mappings
 * must retain that split because they override generic branch mappings.
 *
 * Run: npx tsx scripts/fix-rwth-ai-credit-split.ts --apply
 */
import { CourseCategoryType } from "@prisma/client";
import prismaImport from "../lib/prisma";

const prisma: any =
  (prismaImport as any).default?.default ??
  (prismaImport as any).default ??
  prismaImport;

const APPLY = process.argv.includes("--apply");
const CODE = "12.45308";
const CREDITS = 4.67;
const DC_CREDITS = 3;
const FE_CREDITS = 1.67;

async function main() {
  const course = await prisma.course.findUnique({
    where: { code: CODE },
    include: { branchMappings: true },
  });

  if (!course) throw new Error(`${CODE} was not found.`);

  console.log(`${APPLY ? "Apply" : "Dry run"}: ${CODE}`);
  console.log(`${CREDITS} credits -> ${DC_CREDITS} DC + ${FE_CREDITS} FE`);
  console.log(`DC mappings to update: ${course.branchMappings.filter((m: any) => m.courseCategory === "DC").length}`);

  if (!APPLY) return;

  await prisma.$transaction([
    prisma.course.update({
      where: { id: course.id },
      data: {
        credits: CREDITS,
        description:
          "Available via Semester Exchange (RWTH Aachen) only. Can be taken in Semester 5, 6 or 7. Replaces CS-305. Credits split: 3 cr count as DC, 1.67 cr counts as FE.",
      },
    }),
    prisma.courseBranchMapping.updateMany({
      where: { courseId: course.id, courseCategory: CourseCategoryType.DC },
      data: { splitCategory: CourseCategoryType.FE, splitAmount: FE_CREDITS },
    }),
  ]);

  console.log("Applied: every DC mapping now allocates 3 DC + 1.67 FE.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
