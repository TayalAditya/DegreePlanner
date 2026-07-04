/**
 * Fix pre-reg CourseOffering gaps found by verify-prereg-vs-cl.js against the
 * official IIT Mandi CL (Odd Sem AY 2026-27).
 *
 * Actions (idempotent):
 *   1. Rename placeholder EE-5XX -> EE-598 (real code from CL).
 *   2. Add 5 offerings present in CL but missing from pre-reg:
 *      CS-304, IK-101, HS-304, HS-357, HS-608.
 *
 * Deliberately NOT changed (verified as false positives):
 *   - EE-212/261/302 credits: DB splits theory + lab (EE-212=3 + EE-212P=1 = 4
 *     matches CL's bundled 4). Changing them would double-count the labs.
 *   - BE/CE/MC-498P MTP credits: app curriculum treats MTP as 8cr (MTP-1+MTP-2);
 *     CL's "MTP-1 = 3cr" is a different accounting. Left for manual review.
 *
 * Run with:  npx tsx scripts/fix-prereg-cl-gaps.ts        (dry run, default)
 *            npx tsx scripts/fix-prereg-cl-gaps.ts --apply (writes to DB)
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;

const ALL_BTECH = [
  "EE", "MEVLSI", "BE", "BSCS", "CE", "CSE", "DSAI", "DSE", "EP", "GE", "ME", "MNC", "MSE",
];

// New offerings to insert (values taken directly from the official CL xlsx).
const NEW_OFFERINGS = [
  {
    courseCode: "CS-304",
    courseName: "Formal Languages and Automata Theory",
    credits: 3,
    slots: "B",
    school: "SMSS",
    branches: ["MNC"],
    categoryOverride: CourseCategoryType.DC,
    compulsorySem: 5,
  },
  {
    courseCode: "IK-101",
    courseName: "Sanskrit language-Level 1",
    credits: 3,
    slots: null,
    school: "SHSS",
    branches: ALL_BTECH,
    categoryOverride: CourseCategoryType.IKS,
    compulsorySem: null,
  },
  {
    courseCode: "HS-304",
    courseName: "Organizational Management",
    credits: 3,
    slots: "FS3",
    school: "SHSS",
    branches: ALL_BTECH,
    categoryOverride: CourseCategoryType.DE, // DE-Elective for Minor in Management
    compulsorySem: null,
  },
  {
    courseCode: "HS-357",
    courseName: "Creative Writing",
    credits: 3,
    slots: "A",
    school: "SHSS",
    branches: ALL_BTECH,
    categoryOverride: CourseCategoryType.HSS,
    compulsorySem: null,
  },
  {
    courseCode: "HS-608",
    courseName: "Modern Western Social Thought",
    credits: 3,
    slots: "FS1",
    school: "SHSS",
    branches: ALL_BTECH,
    categoryOverride: CourseCategoryType.HSS,
    compulsorySem: null,
  },
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}\n`);

  // ── 1. Rename EE-5XX -> EE-598 ──────────────────────────────────────────
  const placeholder = await prisma.courseOffering.findFirst({
    where: { courseCode: "EE-5XX", offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
  });
  const alreadyRenamed = await prisma.courseOffering.findFirst({
    where: { courseCode: "EE-598", offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
  });
  if (placeholder && !alreadyRenamed) {
    console.log("RENAME  EE-5XX -> EE-598 (Modelling of Dynamical Systems and Identification)");
    if (APPLY) {
      await prisma.courseOffering.update({
        where: { id: placeholder.id },
        data: { courseCode: "EE-598", categoryOverride: CourseCategoryType.DE },
      });
    }
  } else if (alreadyRenamed) {
    console.log("SKIP    EE-598 already exists");
  } else {
    console.log("SKIP    EE-5XX placeholder not found (already fixed?)");
  }

  // ── 2. Insert missing offerings ─────────────────────────────────────────
  for (const o of NEW_OFFERINGS) {
    const existing = await prisma.courseOffering.findFirst({
      where: { courseCode: o.courseCode, offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
    });
    if (existing) {
      console.log(`SKIP    ${o.courseCode} already offered`);
      continue;
    }
    const course = await prisma.course.findFirst({
      where: { code: o.courseCode },
      select: { id: true },
    });
    console.log(`ADD     ${o.courseCode.padEnd(8)} ${o.courseName}  [${o.categoryOverride}, ${o.credits}cr, slot ${o.slots ?? "—"}]${course ? "" : "  (no catalog Course row — courseId null)"}`);
    if (APPLY) {
      await prisma.courseOffering.create({
        data: {
          courseCode: o.courseCode,
          courseName: o.courseName,
          credits: o.credits,
          slots: o.slots,
          school: o.school,
          branches: o.branches,
          categoryOverride: o.categoryOverride,
          compulsorySem: o.compulsorySem,
          eligibleSems: [3, 5, 7],
          offeringSemester: OFFERING_SEMESTER,
          offeringYear: OFFERING_YEAR,
          isActive: true,
          courseId: course?.id ?? null,
        },
      });
    }
  }

  console.log(`\n${APPLY ? "Done — changes written." : "Dry run complete. Re-run with --apply to write."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
