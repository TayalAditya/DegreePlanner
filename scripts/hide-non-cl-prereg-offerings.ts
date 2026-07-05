/**
 * Hide (deactivate) pre-reg CourseOfferings that are NOT in the official CL and
 * are branch-specific DC/DE / remedial / PG courses — they confuse students in
 * the pre-reg picker. Sets isActive=false (reversible); does NOT delete the row
 * and does NOT touch any existing enrollments (those link to Course, not the
 * offering, and credit calc reads Course.credits).
 *
 * Explicitly KEPT active (legit, even though not a literal CL code):
 *   - split lab/theory halves EE-210(P), EE-212P, EE-261P, EE-301, EE-302P
 *     (CL lists them merged as EE-212 / EE-302 / EE-261)
 *   - section-split base codes already matched to CL (_1/_2 variants)
 *
 * Run:  npx tsx scripts/hide-non-cl-prereg-offerings.ts          (dry run)
 *       npx tsx scripts/hide-non-cl-prereg-offerings.ts --apply
 *       npx tsx scripts/hide-non-cl-prereg-offerings.ts --apply --restore  (re-activate)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const RESTORE = process.argv.includes("--restore");

// Branch-specific DC/DE + remedial/PG offerings that are not in the CL and
// should not appear in the pre-reg picker.
const HIDE_CODES = [
  "BE-203",  // Enzymology and Bioprocessing (BE elective)
  "BE-301",  // Biomechanics (BE elective)
  "DS-201",  // Data Handling and Visualisation
  "DS-301",  // Mathematical Foundations of Data Science
  "MA-322",  // Applied Graph Theory
  "AR-520",  // Design Practicum of Mechatronic Systems
  "RM-600",  // Research Methodology (PG)
  "HS-001",  // Preparatory English (remedial)
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}${RESTORE ? " (RESTORE)" : ""}\n`);
  const target = RESTORE ? true : false;

  const offs = await prisma.courseOffering.findMany({
    where: { courseCode: { in: HIDE_CODES }, offeringSemester: 7, offeringYear: 2026 },
    select: { id: true, courseCode: true, courseName: true, isActive: true },
  });

  for (const o of offs) {
    const enroll = await prisma.courseEnrollment.count({ where: { course: { code: o.courseCode } } });
    console.log(
      `${RESTORE ? "SHOW" : "HIDE"} ${o.courseCode.padEnd(9)} isActive ${o.isActive} -> ${target}   ` +
      `(${(o.courseName || "").slice(0, 34)}) [${enroll} existing enrollments untouched]`
    );
    if (APPLY) {
      await prisma.courseOffering.update({ where: { id: o.id }, data: { isActive: target } });
    }
  }

  const missing = HIDE_CODES.filter((c) => !offs.some((o) => o.courseCode === c));
  if (missing.length) console.log(`\nNot found as sem-7/2026 offerings: ${missing.join(", ")}`);

  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
