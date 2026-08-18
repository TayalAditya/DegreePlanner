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
 *   npx tsx scripts/resync-final-submissions-to-sheet.ts --csv     # write a CSV to paste/import
 *   npx tsx scripts/resync-final-submissions-to-sheet.ts --apply   # write via the webhook
 *
 * --csv needs NONE of the above: it writes tmp/finalCoursePlan-export.csv straight
 * from the database, so the correct per-course columns can be pasted into the
 * sheet before the Apps Script is redeployed.
 */
import fs from "node:fs";
import path from "node:path";
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
const CSV = process.argv.includes("--csv");

/** tmp/ is gitignored — these rows are real student records and must not be committed. */
const CSV_PATH = path.join("tmp", "finalCoursePlan-export.csv");

/** RFC4180: quote when the value contains a comma, quote or newline; double inner quotes. */
const csvCell = (value: string | number) => {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  console.log(
    `\nRe-sync finalCoursePlan from DB  [${
      APPLY ? "APPLY — writing via webhook" : CSV ? "CSV — writing a file" : "DRY RUN — no writes"
    }]\n`
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
  const csvRows: string[] = [FINAL_PLAN_SHEET_HEADER.map(csvCell).join(",")];

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

    csvRows.push(row.map(csvCell).join(","));

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

  if (CSV) {
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, `${csvRows.join("\n")}\n`, "utf8");
    console.log(`  written     : ${CSV_PATH}`);
    console.log("\n  Import it into the sheet: File -> Import -> Upload, and choose");
    console.log("  \"Insert new sheet\" (or replace the finalCoursePlan tab).");
    console.log("  This path needs no Apps Script redeploy.\n");
    return;
  }

  if (APPLY) {
    console.log(`  appended    : ${sent}`);
    console.log(`  failed      : ${failed}`);
    if (failed > 0) {
      throw new Error(`${failed} row(s) did not reach the sheet.`);
    }
    console.log("\n  Done. Check the finalCoursePlan tab.\n");
  } else {
    console.log("\n  DRY RUN — nothing was written.");
    console.log("  --csv    write a CSV to import into the sheet (no redeploy needed)");
    console.log("  --apply  post via the webhook (needs the updated Apps Script deployed");
    console.log("           and the old finalCoursePlan tab deleted first)\n");
  }
}

main()
  .catch((error) => {
    console.error("\nRe-sync failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
