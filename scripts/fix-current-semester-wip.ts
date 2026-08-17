/**
 * Enforce the invariant: a course in a student's CURRENT or FUTURE semester is
 * work in progress, never completed.
 *
 * A COMPLETED row (or a grade) in a term that has not finished yet inflates
 * earned credits and can unlock downstream requirements early — the student
 * appears to have passed a course they are still taking. The three enrollment
 * write paths already guard this (`isCurrentOrFutureSemesterForUser` in
 * app/api/enrollments/route.ts, and the equivalents in enrollments/bulk and
 * admin/users/[id]/enrollments), so this repairs historical rows that predate
 * those guards and acts as a standing audit.
 *
 * "Current" is per-batch, from `inferAcademicState` — Fall 2026 means sem 7 for
 * B23, sem 5 for B24, sem 3 for B25, sem 1 for B26.
 *
 * Deliberately NOT touched:
 *   - AUDIT rows — a valid, distinct registration type, not a completion.
 *   - DROPPED / FAILED rows — real outcomes a student chose or received.
 *   - Graduated batches (isPastProgram) — their Sem 8 is genuinely finished.
 *
 * Dry-run by default.
 *   npx tsx scripts/fix-current-semester-wip.ts             # preview
 *   npx tsx scripts/fix-current-semester-wip.ts --apply     # write
 */
import prisma from "@/lib/prisma";
import { EnrollmentStatus } from "@prisma/client";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

type Offender = {
  who: string;
  batch: number;
  currentSem: number;
  semester: number;
  code: string;
  status: string;
  grade: string | null;
  enrollmentId: string;
};

async function collect(): Promise<Offender[]> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, enrollmentId: true, batch: true },
  });

  const offenders: Offender[] = [];

  for (const u of users) {
    const batchYear = inferBatchYear(u.batch, u.enrollmentId);
    if (batchYear == null) continue;
    const state = inferAcademicState(batchYear);
    // A graduated batch has no unfinished term — its Sem 8 really is complete.
    if (state.isPastProgram) continue;
    const currentSem = state.currentSemester;

    const rows = await prisma.courseEnrollment.findMany({
      where: {
        userId: u.id,
        semester: { gte: currentSem },
        // Only COMPLETED is wrong here. AUDIT is a legitimate registration type
        // and DROPPED/FAILED are real outcomes.
        status: EnrollmentStatus.COMPLETED,
      },
      select: {
        id: true,
        semester: true,
        status: true,
        grade: true,
        course: { select: { code: true } },
      },
    });

    for (const r of rows) {
      offenders.push({
        who: u.enrollmentId ?? u.email,
        batch: batchYear,
        currentSem,
        semester: r.semester,
        code: r.course.code,
        status: r.status,
        grade: r.grade,
        enrollmentId: r.id,
      });
    }
  }

  return offenders;
}

async function main() {
  console.log(`\nCurrent/future-semester WIP invariant  [${APPLY ? "APPLY — writing" : "DRY RUN"}]\n`);

  const offenders = await collect();

  if (offenders.length === 0) {
    console.log("  No COMPLETED rows in any student's current or future semester.");
    console.log("  Invariant already holds — nothing to do.\n");
    return;
  }

  const byBatch = new Map<number, Offender[]>();
  for (const o of offenders) {
    if (!byBatch.has(o.batch)) byBatch.set(o.batch, []);
    byBatch.get(o.batch)!.push(o);
  }

  console.log(`  ${offenders.length} row(s) violate the invariant:\n`);
  for (const [batch, rows] of [...byBatch.entries()].sort()) {
    console.log(`  batch ${batch} (current sem ${rows[0].currentSem}): ${rows.length} row(s)`);
    const shown = VERBOSE ? rows : rows.slice(0, 12);
    for (const r of shown) {
      console.log(
        `      ${r.who.padEnd(10)} sem${String(r.semester).padStart(2)} ${r.code.padEnd(12)} ${r.status} grade=${r.grade ?? "(none)"}`
      );
    }
    if (!VERBOSE && rows.length > shown.length) {
      console.log(`      … and ${rows.length - shown.length} more (--verbose to list)`);
    }
  }

  if (!APPLY) {
    console.log("\n  DRY RUN — nothing written. Re-run with --apply to fix.\n");
    return;
  }

  // Clear the grade alongside the status: a grade is what made the row look
  // settled, and leaving it behind would let the next sweep re-complete it.
  const result = await prisma.courseEnrollment.updateMany({
    where: { id: { in: offenders.map((o) => o.enrollmentId) } },
    data: { status: EnrollmentStatus.IN_PROGRESS, grade: null },
  });
  console.log(`\n  Updated ${result.count} row(s) → IN_PROGRESS, grade cleared.`);

  const residual = await collect();
  if (residual.length > 0) {
    throw new Error(`${residual.length} row(s) still violate the invariant after apply.`);
  }
  console.log("  Verified — invariant now holds.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
