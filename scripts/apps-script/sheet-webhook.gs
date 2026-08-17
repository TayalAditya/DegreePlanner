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
 * ── AUTH — READ THIS ────────────────────────────────────────────────────────
 * "Who has access: Anyone" is required for the app to reach this endpoint, and
 * it means ANY caller who knows the /exec URL can append rows. The URL is not a
 * secret (it has been committed to a public repo), so the shared secret below is
 * the only thing standing between a stranger and fake student submissions in the
 * Acad Sec's sheet.
 *
 * Set it in the Apps Script editor:
 *   Project Settings (⚙) → Script properties → Add script property
 *   Property: DP_SHEET_WEBHOOK_SECRET
 *   Value:    the same value as the app's DP_SHEET_WEBHOOK_SECRET env var
 * It lives in Script Properties, NOT in this file, so this file stays safe to
 * commit publicly.
 *
 * Until that property is set this script ACCEPTS UNAUTHENTICATED WRITES, so
 * pasting it does not break the currently-deployed app mid-rollout. That also
 * means the hole is still open until you set it. Verify with a browser GET on
 * the /exec URL: `secretEnforced` must be true.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Tabs written today:
 *   NotSubmittedOnSamarth — "my registration isn't submitted on Samarth"
 *   finalCoursePlan       — the student's final course registration declaration
 *
 * PAYLOAD SHAPES
 * --------------
 * Preferred (any tab, any columns — no script change needed for a new tab):
 *   { tab: "finalCoursePlan", secret: "...",
 *     header: ["Name","Roll No","Branch","Semester","Courses","Time of Submission"],
 *     row:    ["Aditya","B23243","DSE",7,"CS-301 (Regular, 4cr, C)","2026-08-18T..."] }
 *
 * Legacy (kept so an older caller keeps working):
 *   { tab, secret, studentName, rollNumber, branch, offeringSemester, offeringYear, reportedAt }
 *
 * header/row WINS when present. The app sends both shapes at once, so this
 * script must prefer header/row or the six legacy columns would be written for
 * finalCoursePlan and the course list would be lost.
 *
 * NOTE: Apps Script always replies HTTP 200, so callers must check the `ok`
 * field in the JSON body — the HTTP status alone says nothing.
 */

var SECRET_PROPERTY = 'DP_SHEET_WEBHOOK_SECRET';
var LEGACY_HEADER = ['Name', 'Roll No', 'Branch', 'Semester', 'Year', 'Reported At'];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'empty request body' });
    }

    var data = JSON.parse(e.postData.contents);

    if (!isAuthorized(data)) {
      // Deliberately vague: don't tell an unknown caller whether the secret is
      // enforced, only that this one was rejected.
      return jsonOut({ ok: false, error: 'unauthorized' });
    }

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
 *
 * Reports which spreadsheet the script is bound to — that answers "are rows
 * landing in the sheet I'm actually looking at?" — and whether the secret is
 * being enforced. It never returns the secret itself.
 */
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return jsonOut({
    ok: true,
    bound: !!ss,
    spreadsheet: ss ? ss.getName() : null,
    tabs: ss ? ss.getSheets().map(function (s) { return s.getName(); }) : [],
    secretEnforced: !!configuredSecret()
  });
}

function configuredSecret() {
  return PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
}

/**
 * Authorized when no secret is configured yet (rollout grace — see the header
 * comment) or the caller's secret matches the configured one.
 */
function isAuthorized(data) {
  var expected = configuredSecret();
  if (!expected) return true;
  return secretsMatch(data && data.secret, expected);
}

/**
 * Length-then-XOR compare so the loop doesn't return early on the first
 * differing character. Length is still observable, which is fine for a
 * fixed-length random secret.
 */
function secretsMatch(got, expected) {
  if (typeof got !== 'string' || typeof expected !== 'string') return false;
  if (got.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < got.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function isNonEmptyArray(v) {
  return Object.prototype.toString.call(v) === '[object Array]' && v.length > 0;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
