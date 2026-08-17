/**
 * Sheet row layout for the `finalCoursePlan` tab.
 *
 * Shared by the submit route and the re-sync script so the two can never write
 * different shapes into the same tab — the sheet is append-only, so a drifted
 * column layout is not something you can quietly fix later.
 */

export type SheetRegType = "REGULAR" | "PASS_FAIL" | "AUDIT";

/** Google Sheet tab these rows belong to. */
export const FINAL_PLAN_SHEET_TAB = "finalCoursePlan";

/**
 * One course per column, so the Acad Sec can scan, sort and filter them instead
 * of parsing one crowded cell.
 *
 * The count is FIXED so "Time of Submission" always lands in the same column no
 * matter how many courses a student took; a dynamic width would stagger it row to
 * row and make the tab unsortable. 12 is well above a real semester load (~5–7,
 * up to ~10 with labs).
 */
export const MAX_COURSE_COLUMNS = 12;

export const FINAL_PLAN_SHEET_HEADER = [
  "Name",
  "Roll No",
  "Branch",
  "Semester",
  ...Array.from({ length: MAX_COURSE_COLUMNS }, (_, i) => `Course ${i + 1}`),
  "Time of Submission",
];

/** Compact type marker used in the cells: `CS-301 (R)`, `HS-102 (P/F)`, `IK-502 (A)`. */
export const REG_TYPE_ABBREV: Record<SheetRegType, string> = {
  REGULAR: "R",
  PASS_FAIL: "P/F",
  AUDIT: "A",
};

export type SheetCourse = {
  code: string;
  registrationType: SheetRegType;
};

const asRegType = (value: unknown): SheetRegType => {
  const raw = String(value ?? "REGULAR").toUpperCase();
  return raw === "PASS_FAIL" || raw === "AUDIT" ? raw : "REGULAR";
};

/** `CS-301 (R)` — course code plus how it is to be registered. */
export const formatCourseCell = (course: SheetCourse) =>
  `${course.code} (${REG_TYPE_ABBREV[asRegType(course.registrationType)]})`;

/**
 * Spread courses across the fixed course columns, padding unused ones so the
 * trailing timestamp always lands in the same column.
 *
 * More courses than columns folds the remainder into the last column rather than
 * dropping it — a submission is a student's academic record, so it must never be
 * silently cut short by a layout constant.
 */
export function courseColumns(courses: SheetCourse[]): string[] {
  const cells = courses.map(formatCourseCell);
  if (cells.length > MAX_COURSE_COLUMNS) {
    const kept = cells.slice(0, MAX_COURSE_COLUMNS - 1);
    kept.push(cells.slice(MAX_COURSE_COLUMNS - 1).join("; "));
    return kept;
  }
  return [...cells, ...Array(MAX_COURSE_COLUMNS - cells.length).fill("")];
}

/** Single-cell fallback, for the legacy payload shape only. */
export const formatCoursesInline = (courses: SheetCourse[]) =>
  courses.map(formatCourseCell).join("; ");

/** Timestamps carry the revision so an append-only tab shows which row is latest. */
export const formatSubmittedAt = (
  submittedAt: Date,
  updatedAt: Date,
  revision: number
) => (revision > 1 ? `${updatedAt.toISOString()} (edit #${revision})` : submittedAt.toISOString());

/** Build the full sheet row for one submission. */
export function buildFinalPlanSheetRow(submission: {
  studentName: string;
  rollNumber: string;
  branch: string;
  offeringSemester: number;
  courses: SheetCourse[];
  submittedAt: Date;
  updatedAt: Date;
  revision: number;
}): Array<string | number> {
  return [
    submission.studentName,
    submission.rollNumber,
    submission.branch,
    submission.offeringSemester,
    ...courseColumns(submission.courses),
    formatSubmittedAt(submission.submittedAt, submission.updatedAt, submission.revision),
  ];
}
