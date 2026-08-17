/**
 * Backfill: materialize every saved PreRegistrationPlan into CourseEnrollment rows.
 *
 * Saved plans previously lived only in `PreRegistrationPlan.selectedIds`, so the
 * dashboard / progress / courses pages — which all read `CourseEnrollment` — did
 * not know about a student's upcoming semester at all. This walks every plan and
 * brings the enrollment rows in line, using the shared, idempotent
 * `syncPlanToEnrollments` (same code path the plan-save route now runs), so this
 * script and live saves can never drift apart.
 *
 * Dry-run by default. Nothing is written without --apply.
 *
 *   npx tsx scripts/backfill-plan-enrollments.ts                  # preview all
 *   npx tsx scripts/backfill-plan-enrollments.ts --semester=7     # preview one semester
 *   npx tsx scripts/backfill-plan-enrollments.ts --user=B23243    # preview one student
 *   npx tsx scripts/backfill-plan-enrollments.ts --apply          # write
 *
 * This pass is ADDITIVE: it creates missing enrollments and corrects the fields of
 * ones it already owns, but deletes nothing. Deletion requires knowing which
 * courses a plan previously owned, and for a first-ever backfill there is no such
 * history — an audit found 36 rows (including three students DP-498P MTP
 * registrations) that were hand-added or imported, never planned, and a blind
 * "delete anything unplanned" pass would have destroyed them. From here on the
 * plan-save route passes the previous selection, so removing a course from a plan
 * removes its enrollment. Completed, graded, dropped and failed rows are never
 * touched, and no other semester is ever touched.
 */
import prisma from "@/lib/prisma";
import { syncPlanToEnrollments, type PlanSyncResult } from "@/lib/planEnrollmentSync";
import { isAcadSec } from "@/lib/permissions";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");
const semesterArg = args.find((a) => a.startsWith("--semester="))?.split("=")[1];
const userArg = args.find((a) => a.startsWith("--user="))?.split("=")[1];
const SEMESTER = semesterArg ? Number(semesterArg) : null;

async function main() {
  console.log(
    `\nBackfill plan → enrollments  [${APPLY ? "APPLY — writing" : "DRY RUN — no writes"}]` +
      "  (additive — no deletions)"
  );

  const plans = await prisma.preRegistrationPlan.findMany({
    where: SEMESTER ? { offeringSemester: SEMESTER } : undefined,
    select: {
      userId: true,
      offeringSemester: true,
      offeringYear: true,
      selectedIds: true,
      user: {
        select: { email: true, enrollmentId: true, branch: true, batch: true, role: true },
      },
    },
    orderBy: [{ offeringSemester: "asc" }, { updatedAt: "asc" }],
  });

  const targets = plans.filter((p) => {
    if (userArg) {
      const needle = userArg.toUpperCase();
      const roll = String(p.user.enrollmentId ?? "").toUpperCase();
      const email = String(p.user.email ?? "").toUpperCase();
      if (!roll.includes(needle) && !email.includes(needle)) return false;
    }
    // Acad-sec scratch accounts get both tables wiped on every login
    // (lib/acadSecReset.ts) — syncing them would be pointless churn.
    if (isAcadSec(p.user.email)) return false;
    return true;
  });

  console.log(
    `${plans.length} plan(s) found, ${targets.length} in scope` +
      `${userArg ? ` (filtered by "${userArg}")` : ""}${SEMESTER ? ` (semester ${SEMESTER})` : ""}\n`
  );

  const results: Array<{ label: string; result: PlanSyncResult }> = [];
  const totals = { created: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, noop: 0 };
  const skipReasons = new Map<string, number>();

  for (const plan of targets) {
    const label = `${plan.user.enrollmentId ?? plan.user.email} sem${plan.offeringSemester}`;
    try {
      const result = await syncPlanToEnrollments(
        prisma,
        plan.userId,
        plan.offeringSemester,
        plan.offeringYear,
        { apply: APPLY, manageExistingRows: false }
      );

      if (result.reason) {
        skipReasons.set(result.reason, (skipReasons.get(result.reason) ?? 0) + 1);
      }

      totals.created += result.created;
      totals.updated += result.updated;
      totals.deleted += result.deleted;
      totals.skipped += result.skipped;
      if (result.created + result.updated + result.deleted === 0) totals.noop += 1;

      results.push({ label, result });

      const touched = result.created + result.updated + result.deleted;
      if (touched > 0 || VERBOSE) {
        console.log(
          `  ${label.padEnd(22)} ${plan.user.branch ?? "?"} → ` +
            `+${result.created} ~${result.updated} -${result.deleted} skip:${result.skipped}` +
            `${result.reason ? `  (${result.reason})` : ""}`
        );
        for (const c of result.changes) {
          if (c.action === "skipped" && !VERBOSE) continue;
          const sign = c.action === "created" ? "+" : c.action === "deleted" ? "-" : c.action === "updated" ? "~" : "·";
          console.log(`      ${sign} ${c.courseCode.padEnd(12)} ${String(c.credits).padStart(4)}cr  ${c.detail ?? ""}`);
        }
      }
    } catch (error) {
      totals.failed += 1;
      console.error(`  ${label.padEnd(22)} FAILED: ${(error as Error).message}`);
    }
  }

  console.log("\n─── summary ───");
  console.log(`  plans processed : ${targets.length}`);
  console.log(`  enrollments +   : ${totals.created}`);
  console.log(`  enrollments ~   : ${totals.updated}`);
  console.log(`  enrollments -   : ${totals.deleted}`);
  console.log(`  entries skipped : ${totals.skipped}`);
  console.log(`  already in sync : ${totals.noop}`);
  console.log(`  failed          : ${totals.failed}`);
  if (skipReasons.size > 0) {
    console.log("  plans not synced:");
    for (const [reason, n] of skipReasons) console.log(`    ${reason}: ${n}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply to commit.\n");
    return;
  }

  // Verify: a second pass over the same plans must be a complete no-op.
  console.log("\nVerifying idempotency (re-running in dry-run mode)…");
  let residual = 0;
  for (const plan of targets) {
    const check = await syncPlanToEnrollments(
      prisma,
      plan.userId,
      plan.offeringSemester,
      plan.offeringYear,
      { apply: false, manageExistingRows: false }
    );
    const drift = check.created + check.updated + check.deleted;
    if (drift > 0) {
      residual += drift;
      console.error(
        `  DRIFT ${plan.user.enrollmentId ?? plan.user.email} sem${plan.offeringSemester}: ` +
          `+${check.created} ~${check.updated} -${check.deleted}`
      );
    }
  }
  if (residual > 0) {
    throw new Error(`Sync is not idempotent — ${residual} change(s) still pending after apply.`);
  }
  console.log("  clean — a second run would change nothing.\n");
}

main()
  .catch((error) => {
    console.error("\nBackfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
