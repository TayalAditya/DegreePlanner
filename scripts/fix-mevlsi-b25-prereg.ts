// fix-mevlsi-b25-prereg.ts
// Two fixes for MEVLSI B25 (2025) pre-registration:
//  1. EE-311 renamed to VL-201 from B25 onwards → remove MEVLSI from EE-311's 2026
//     offering so B25 MEVLSI students don't see it at all (VL-201 takes its place).
//     Also drop the stray EE-311 MEVLSI batch="2025" FE mapping.
//  2. EE-302P (Control Systems Lab) 2026 offering has null slots + null instructor,
//     so the pre-reg filter (`!slots && !instructor`) hides it. Copy slot/instructor
//     from the EE-302 theory offering so the compulsory DC lab shows up.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── Fix 1: hide EE-311 for MEVLSI (renamed to VL-201 B25 onwards) ──
  const ee311Off = await prisma.courseOffering.findFirst({
    where: { offeringYear: 2026, courseCode: "EE-311" },
    select: { id: true, branches: true },
  });
  if (ee311Off) {
    if (ee311Off.branches.includes("MEVLSI")) {
      const newBranches = ee311Off.branches.filter((b) => b !== "MEVLSI");
      await prisma.courseOffering.update({
        where: { id: ee311Off.id },
        data: { branches: newBranches },
      });
      console.log(`UPDATED EE-311 offering: removed MEVLSI from branches`);
    } else {
      console.log(`OK      EE-311 offering already excludes MEVLSI`);
    }
  } else {
    console.log(`SKIP    no EE-311 2026 offering`);
  }

  // Drop stray EE-311 MEVLSI batch="2025" FE mapping (from earlier attempt)
  const ee311 = await prisma.course.findFirst({ where: { code: "EE-311" } });
  if (ee311) {
    const where = { courseId_branch_batch: { courseId: ee311.id, branch: "MEVLSI", batch: "2025" } };
    const stray = await prisma.courseBranchMapping.findUnique({ where });
    if (stray) {
      await prisma.courseBranchMapping.delete({ where });
      console.log(`DELETED stray EE-311 MEVLSI batch="2025" (${stray.courseCategory}) mapping`);
    } else {
      console.log(`OK      no stray EE-311 MEVLSI batch="2025" mapping`);
    }
  }

  // ── Fix 2: give EE-302P a slot + instructor so pre-reg shows it ──
  const ee302Off = await prisma.courseOffering.findFirst({
    where: { offeringYear: 2026, courseCode: "EE-302" },
    select: { slots: true, instructor: true, instructorEmail: true },
  });
  const ee302pOff = await prisma.courseOffering.findFirst({
    where: { offeringYear: 2026, courseCode: "EE-302P" },
    select: { id: true, slots: true, instructor: true },
  });
  if (ee302pOff && ee302Off) {
    if (!ee302pOff.slots && !ee302pOff.instructor) {
      await prisma.courseOffering.update({
        where: { id: ee302pOff.id },
        data: {
          slots: ee302Off.slots,
          instructor: ee302Off.instructor,
          instructorEmail: ee302Off.instructorEmail,
        },
      });
      console.log(`UPDATED EE-302P offering: slots="${ee302Off.slots}", instructor="${ee302Off.instructor}"`);
    } else {
      console.log(`OK      EE-302P offering already has slot/instructor`);
    }
  } else {
    console.log(`SKIP    EE-302P or EE-302 offering missing`);
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
