/**
 * Google Apps Script webhook — Degree Planner → Acad Sec spreadsheet.
 *
 * Deploy: Extensions → Apps Script from the target spreadsheet (it must be
 * CONTAINER-BOUND — `getActiveSpreadsheet()` below resolves to the sheet this
 * script is attached to, so a standalone script writes nowhere useful).
 * Then Deploy → Manage deployments → edit → New version.
 * Execute as: Me. Who has access: Anyone.
 * Re-deploying a NEW VERSION is what makes edits live; saving alone does not —
 * the /exec URL keeps serving the last deployed version.
 *
 * Tabs written today:
 *   NotSubmittedOnSamarth — "my registration isn't submitted on Samarth"
 *   finalCoursePlan       — the student's final course registration declaration
 *
 * PAYLOAD SHAPES
 * --------------
 * Preferred (any tab, any columns — no script change needed for a new tab):
 *   { tab: "finalCoursePlan",
 *     header: ["Name","Roll No","Branch","Semester","Courses","Time of Submission"],
 *     row:    ["Aditya","B23243","DSE",7,"CS-301 (Regular, 4cr, C)","2026-08-18T..."] }
 *
 * Legacy (kept so an older caller keeps working):
 *   { tab, studentName, rollNumber, branch, offeringSemester, offeringYear, reportedAt }
 *
 * header/row WINS when present. The app sends both shapes at once, so this
 * script must prefer header/row or the six legacy columns would be written for
 * finalCoursePlan and the course list would be lost.
 */

var LEGACY_HEADER = ['Name', 'Roll No', 'Branch', 'Semester', 'Year', 'Reported At'];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'empty request body' });
    }

    var data = JSON.parse(e.postData.contents);
    var tabName = data.tab || 'NotSubmittedOnSamarth';

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      // Standalone script — not attached to any spreadsheet. Fail loudly rather
      // than silently discarding a student's submission.
      return jsonOut({ ok: false, error: 'no active spreadsheet — script must be container-bound' });
    }

    var sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);

    var header = data.header;
    var row = data.row;

    // Fall back to the legacy field mapping only when the caller did not supply
    // its own columns.
    if (!isNonEmptyArray(header) || !isNonEmptyArray(row)) {
      header = LEGACY_HEADER;
      row = [
        data.studentName || '',
        data.rollNumber || '',
        data.branch || '',
        data.offeringSemester || '',
        data.offeringYear || '',
        data.reportedAt || new Date().toISOString()
      ];
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(header);
      sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow(row);

    return jsonOut({ ok: true, tab: tabName, columns: row.length });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/**
 * Health check, so the deployment can be verified in a browser. Without this a
 * GET returns "Script function not found: doGet", which is easy to misread as a
 * broken deployment.
 */
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return jsonOut({
    ok: true,
    bound: !!ss,
    spreadsheet: ss ? ss.getName() : null,
    tabs: ss ? ss.getSheets().map(function (s) { return s.getName(); }) : []
  });
}

function isNonEmptyArray(v) {
  return Object.prototype.toString.call(v) === '[object Array]' && v.length > 0;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
