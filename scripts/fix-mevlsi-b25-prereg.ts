// fix-mevlsi-b25-prereg.ts
// Two fixes for MEVLSI B25 (2025) pre-registration:
//  1. B25 MEVLSI uses EE-311 in semester 3. Ensure its batch mapping is DC/S3
//     and remove the obsolete batch-specific VL-201 mapping. Offering visibility
//     is handled in the API because CourseOffering.branches is not batch-scoped.
//  2. EE-302P (Control Systems Lab) 2026 offering has null slots + null instructor,
//     so the pre-reg filter (`!slots && !instructor`) hides it. Copy slot/instructor
//     from the EE-302 theory offering so the compulsory DC lab shows up.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── Fix 1: B25 MEVLSI uses EE-311, not VL-201 ──
  const [ee311, vl201] = await Promise.all([
    prisma.course.findFirst({ where: { code: "EE-311" } }),
    prisma.course.findFirst({ where: { code: "VL-201" } }),
  ]);
  if (ee311) {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: ee311.id, branch: "MEVLSI", batch: "2025" } },
      create: { courseId: ee311.id, branch: "MEVLSI", batch: "2025", courseCategory: "DC", semester: 3 },
      update: { courseCategory: "DC", semester: 3 },
    });
    console.log(`OK      EE-311 MEVLSI batch="2025" is DC semester 3`);
  }
  if (vl201) {
    const removed = await prisma.courseBranchMapping.deleteMany({
      where: { courseId: vl201.id, branch: "MEVLSI", batch: { in: ["2025", "B25"] } },
    });
    console.log(`REMOVED ${removed.count} obsolete B25 VL-201 mapping(s)`);
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
