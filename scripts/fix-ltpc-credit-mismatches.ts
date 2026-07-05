/**
 * Resolve the 6 L-T-P-C vs credits mismatches that the earlier backfill
 * deliberately skipped (it refused to copy an ltpc whose credit component
 * contradicted the offering credits).
 *
 * For each, credits were verified against the official CL / the split-course
 * structure, and a corrected L-T-P-C is set so its last component == credits:
 *
 *   EE-301   offering credits 4 -> 3  (Course row + ltpc both say 3; offering
 *            was the outlier). ltpc 3-0-0-3.
 *   EE-210   credits 3 (theory-half of the EE-210/EE-210P split). Course ltpc
 *            3-0-2-4 was the bundled theory+lab value -> corrected to 3-0-0-3.
 *   CS-515   credits 3 (CL, Advanced CS Practicum). ltpc -> 0-0-6-3.
 *   CS-660   credits 4 (CL, Data Mining). ltpc -> 3-1-0-4.
 *   BE-498P  credits 4 (MTP-1, kept at 4 per app convention). ltpc -> 0-0-8-4.
 *   CE-498P  credits 4 (MTP-1). ltpc -> 0-0-8-4.
 *
 * Sets both the CourseOffering and the linked Course row so catalog + pre-reg
 * agree. Run:
 *   npx tsx scripts/fix-ltpc-credit-mismatches.ts          (dry run)
 *   npx tsx scripts/fix-ltpc-credit-mismatches.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Fix = { code: string; credits: number; ltpc: string; note: string };

const FIXES: Fix[] = [
  { code: "EE-301",  credits: 3, ltpc: "3-0-0-3", note: "offering cr 4->3 (Course row + ltpc agree on 3)" },
  { code: "EE-210",  credits: 3, ltpc: "3-0-0-3", note: "theory-half; drop bundled lab from ltpc" },
  { code: "CS-515",  credits: 3, ltpc: "0-0-6-3", note: "CL=3, practicum" },
  { code: "CS-660",  credits: 4, ltpc: "3-1-0-4", note: "CL=4" },
  { code: "BE-498P", credits: 4, ltpc: "0-0-8-4", note: "MTP-1, credits kept at 4" },
  { code: "CE-498P", credits: 4, ltpc: "0-0-8-4", note: "MTP-1, credits kept at 4" },
];

function C(ltpc: string): number | null {
  const parts = ltpc.split(/[-\s]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x));
  return parts.length ? parts[parts.length - 1] : null;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  for (const f of FIXES) {
    if (C(f.ltpc) !== f.credits) {
      throw new Error(`Bad fix for ${f.code}: ltpc ${f.ltpc} (C=${C(f.ltpc)}) != credits ${f.credits}`);
    }

    const off = await prisma.courseOffering.findFirst({
      where: { courseCode: f.code, offeringSemester: 7, offeringYear: 2026 },
      select: { id: true, credits: true, ltpc: true },
    });
    const course = await prisma.course.findFirst({
      where: { code: f.code },
      select: { id: true, credits: true, ltpc: true },
    });

    console.log(`FIX ${f.code.padEnd(9)} credits->${f.credits}  ltpc->${f.ltpc}   (${f.note})`);
    console.log(`     offering: cr ${off?.credits ?? "—"} / ltpc ${off?.ltpc ?? "—"}   course: cr ${course?.credits ?? "—"} / ltpc ${course?.ltpc ?? "—"}`);

    if (APPLY) {
      if (off) {
        await prisma.courseOffering.update({
          where: { id: off.id },
          data: { credits: f.credits, ltpc: f.ltpc },
        });
      }
      if (course) {
        await prisma.course.update({
          where: { id: course.id },
          data: { credits: f.credits, ltpc: f.ltpc },
        });
      }
    }
  }

  console.log(`\n${APPLY ? "Done — offering + course rows updated." : "Dry run. Re-run with --apply to write."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
