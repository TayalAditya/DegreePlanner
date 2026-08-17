/**
 * Rebuild the `finalCoursePlan` sheet tab from the database.
 *
 * WHY
 * ---
 * The first submissions were mirrored while the Apps Script still hardcoded one
 * six-column layout (`Name, Roll No, Branch, Semester, Year, Reported At`). It
 * ignored the per-course columns the app sends, so those rows landed with a
 * `Year` value where the course list should be and no courses at all — and still
 * answered `{"ok":true}`, so it looked fine.
 *
 * Nothing was lost: `FinalCourseSubmission.courses` is the source of truth and
 * holds every course and its type. This re-posts each submission in the correct
 * column layout, using the SAME row builder as the submit route
 * (lib/finalSubmissionSheet.ts) so the repaired rows cannot differ in shape from
 * rows written from here on.
 *
 * BEFORE RUNNING
 * --------------
 *   1. Deploy the updated Apps Script (scripts/apps-script/sheet-webhook.gs) as a
 *      NEW VERSION. Without that it will ignore the columns again and this script
 *      just adds more malformed rows.
 *   2. DELETE the existing `finalCoursePlan` tab. The sheet is append-only, so
 *      this script cannot remove the old rows or fix the wrong header — deleting
 *      the tab lets the script recreate it with the right header.
 *
 *   npx tsx scripts/resync-final-submissions-to-sheet.ts           # preview
 *   npx tsx scripts/resync-final-submissions-to-sheet.ts --apply   # write
 */
import prisma from "@/lib/prisma";
import { postToSheet } from "@/lib/sheetWebhook";
import {
  buildFinalPlanSheetRow,
  FINAL_PLAN_SHEET_HEADER,
  FINAL_PLAN_SHEET_TAB,
  formatCoursesInline,
  formatSubmittedAt,
  type SheetCourse,
} from "@/lib/finalSubmissionSheet";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(
    `\nRe-sync finalCoursePlan from DB  [${APPLY ? "APPLY — writing" : "DRY RUN — no writes"}]\n`
  );

  const submissions = await prisma.finalCourseSubmission.findMany({
    // Oldest first, so the rebuilt tab reads in the order the submissions
    // actually happened.
    orderBy: [{ submittedAt: "asc" }],
  });

  if (submissions.length === 0) {
    console.log("  No submissions in the database — nothing to re-sync.\n");
    return;
  }

  console.log(`  ${submissions.length} submission(s) found\n`);
  console.log(`  Header: ${FINAL_PLAN_SHEET_HEADER.join(" | ")}\n`);

  let sent = 0;
  let failed = 0;

  for (const s of submissions) {
    const courses = (s.courses as SheetCourse[]) ?? [];
    const row = buildFinalPlanSheetRow({
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      branch: s.branch,
      offeringSemester: s.offeringSemester,
      courses,
      submittedAt: s.submittedAt,
      updatedAt: s.updatedAt,
      revision: s.revision,
    });

    console.log(
      `  ${s.rollNumber.padEnd(8)} ${s.studentName.slice(0, 20).padEnd(20)} ` +
        `sem${s.offeringSemester} rev${s.revision}  ${courses.length} course(s)`
    );
    console.log(`      ${formatCoursesInline(courses) || "(none)"}`);

    if (!APPLY) continue;

    const ok = await postToSheet({
      tab: FINAL_PLAN_SHEET_TAB,
      header: FINAL_PLAN_SHEET_HEADER,
      row,
      // Legacy fallback, same as the route: if the script somehow still has not
      // been redeployed, at least the identity and the course list survive
      // instead of a blank row.
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      branch: s.branch,
      offeringSemester: s.offeringSemester,
      offeringYear: s.offeringYear,
      reportedAt: `${formatCoursesInline(courses)} · ${formatSubmittedAt(s.submittedAt, s.updatedAt, s.revision)}`,
    });

    if (ok) {
      sent += 1;
    } else {
      failed += 1;
      console.error(`      FAILED to append — see the [sheet-webhook] log line above`);
    }
  }

  console.log("\n─── summary ───");
  console.log(`  submissions : ${submissions.length}`);
  if (APPLY) {
    console.log(`  appended    : ${sent}`);
    console.log(`  failed      : ${failed}`);
    if (failed > 0) {
      throw new Error(`${failed} row(s) did not reach the sheet.`);
    }
    console.log("\n  Done. Check the finalCoursePlan tab.\n");
  } else {
    console.log("\n  DRY RUN — nothing was written.");
    console.log("  Deploy the updated Apps Script and delete the old finalCoursePlan tab first,");
    console.log("  then re-run with --apply.\n");
  }
}

main()
  .catch((error) => {
    console.error("\nRe-sync failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
