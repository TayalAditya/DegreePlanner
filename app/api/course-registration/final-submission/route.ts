import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { postToSheet } from "@/lib/sheetWebhook";

/**
 * The student's own FINAL course registration declaration.
 *
 * Samarth and Sootrank sometimes disagree with each other, or with what the
 * student actually wants. This endpoint records what the student says should be
 * registered and in what form, so the Academic Secretary has one authoritative
 * list to reconcile the portals against.
 *
 * DB is the source of truth; the `finalCoursePlan` tab of the Acad Sec's Google
 * Sheet is an append-only mirror (one row per submission, so edits read as an
 * audit trail).
 */

/** Google Sheet tab this endpoint appends to. */
const SHEET_TAB = "finalCoursePlan";

/**
 * One course per column so the Acad Sec can scan/sort/filter them, rather than
 * one crowded cell. The count is FIXED so that "Time of Submission" always lands
 * in the same column no matter how many courses a student took — a dynamic width
 * would stagger it row to row and make the tab unsortable.
 *
 * 12 is well above a real semester load (~5–7, up to ~10 with labs). A student
 * who somehow exceeds it does not lose data: the overflow is folded into the last
 * course column rather than truncated.
 */
const MAX_COURSE_COLUMNS = 12;

const SHEET_HEADER = [
  "Name",
  "Roll No",
  "Branch",
  "Semester",
  ...Array.from({ length: MAX_COURSE_COLUMNS }, (_, i) => `Course ${i + 1}`),
  "Time of Submission",
];

type RegType = "REGULAR" | "PASS_FAIL" | "AUDIT";

/** One declared course, as stored in `FinalCourseSubmission.courses`. */
type SubmittedCourse = {
  code: string;
  name: string;
  credits: number;
  slots: string;
  registrationType: RegType;
};

const REG_TYPE_LABEL: Record<RegType, string> = {
  REGULAR: "Regular",
  PASS_FAIL: "Pass-Fail",
  AUDIT: "Audit",
};

/** Compact form for the sheet cells: `CS-301 (R)`, `HS-102 (P/F)`, `IK-502 (A)`. */
const REG_TYPE_ABBREV: Record<RegType, string> = {
  REGULAR: "R",
  PASS_FAIL: "P/F",
  AUDIT: "A",
};

/**
 * Resolve the registration semester/year for the signed-in student. Same shape
 * as the not-submitted route's helper so both endpoints agree on which term a
 * student is acting on.
 */
function registrationContext(batch: number | null | undefined, enrollmentId: string | null | undefined) {
  const batchYear = inferBatchYear(batch, enrollmentId);
  if (!batchYear) return null;
  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  return { batchYear, offeringSemester, offeringYear };
}

const asRegType = (value: unknown): RegType => {
  const raw = String(value ?? "REGULAR").toUpperCase();
  return raw === "PASS_FAIL" || raw === "AUDIT" ? raw : "REGULAR";
};

/**
 * Accept only the fields this record is allowed to hold, and coerce each one.
 * The client sends a list built from its own UI state, so nothing here is
 * trusted: a bad `credits` would otherwise corrupt the stored total, and an
 * unbounded `name` would corrupt the sheet row.
 */
function parseCourses(raw: unknown): SubmittedCourse[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const courses: SubmittedCourse[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const code = String(item.code ?? "").trim().slice(0, 32).toUpperCase();
    if (!code) continue;
    // A course listed twice would double-count credits in the stored total.
    if (seen.has(code)) continue;
    seen.add(code);

    const credits = Number(item.credits);
    courses.push({
      code,
      name: String(item.name ?? "").trim().slice(0, 200),
      credits: Number.isFinite(credits) && credits >= 0 ? credits : 0,
      slots: String(item.slots ?? "").trim().slice(0, 64),
      registrationType: asRegType(item.registrationType),
    });
  }

  return courses;
}

/** `CS-301 (R)` — course code plus how it is to be registered. */
const formatCourseCell = (course: SubmittedCourse) =>
  `${course.code} (${REG_TYPE_ABBREV[course.registrationType]})`;

/**
 * Spread courses across the fixed course columns, padding unused ones so the
 * trailing timestamp always lands in the same column.
 *
 * If there are more courses than columns, the last column carries the remainder
 * joined together — a submission is a student's academic record, so it must never
 * be silently cut short by a layout constant.
 */
function courseColumns(courses: SubmittedCourse[]): string[] {
  const cells = courses.map(formatCourseCell);
  if (cells.length > MAX_COURSE_COLUMNS) {
    const kept = cells.slice(0, MAX_COURSE_COLUMNS - 1);
    kept.push(cells.slice(MAX_COURSE_COLUMNS - 1).join("; "));
    return kept;
  }
  return [...cells, ...Array(MAX_COURSE_COLUMNS - cells.length).fill("")];
}

/**
 * Single-cell summary, used only for the legacy payload shape (an Apps Script
 * that has not been redeployed yet has no per-course columns to write into).
 */
const formatCoursesForSheet = (courses: SubmittedCourse[]) =>
  courses.map(formatCourseCell).join("; ");

const roundCredits = (value: number) => Math.round(value * 100) / 100;

/** GET → this student's declaration for the active term, if any. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = registrationContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ submitted: false });

  const row = await prisma.finalCourseSubmission.findUnique({
    where: {
      userId_offeringSemester_offeringYear: {
        userId: session.user.id,
        offeringSemester: ctx.offeringSemester,
        offeringYear: ctx.offeringYear,
      },
    },
    select: {
      courses: true,
      totalCredits: true,
      revision: true,
      submittedAt: true,
      updatedAt: true,
    },
  });

  if (!row) return NextResponse.json({ submitted: false });

  return NextResponse.json({
    submitted: true,
    courses: row.courses as SubmittedCourse[],
    totalCredits: row.totalCredits,
    revision: row.revision,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/**
 * POST { courses: [...] } → record (or re-record) the declaration.
 *
 * Identity and term come from the session, never the body — a student may only
 * ever declare for themselves, for the term they are actually in.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = registrationContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const courses = parseCourses((body as { courses?: unknown } | null)?.courses);
  if (courses.length === 0) {
    return NextResponse.json(
      { error: "Select at least one course before submitting." },
      { status: 400 }
    );
  }

  const totalCredits = roundCredits(courses.reduce((sum, c) => sum + c.credits, 0));
  const roll = (session.user.enrollmentId || "").toUpperCase();
  const name = session.user.name || "Unknown";
  const branch = session.user.branch || "";

  const row = await prisma.finalCourseSubmission.upsert({
    where: {
      userId_offeringSemester_offeringYear: {
        userId: session.user.id,
        offeringSemester: ctx.offeringSemester,
        offeringYear: ctx.offeringYear,
      },
    },
    create: {
      userId: session.user.id,
      rollNumber: roll,
      studentName: name,
      branch,
      batchYear: ctx.batchYear,
      offeringSemester: ctx.offeringSemester,
      offeringYear: ctx.offeringYear,
      courses,
      totalCredits,
    },
    // Re-submitting is an edit, not a new record: bump the revision so the
    // append-only sheet shows which row is the latest declaration.
    update: {
      courses,
      totalCredits,
      revision: { increment: 1 },
      rollNumber: roll,
      studentName: name,
      branch,
    },
    select: { revision: true, submittedAt: true, updatedAt: true },
  });

  // Mirror to the sheet. Must be awaited: on Vercel the function freezes as soon
  // as the response is returned, so a fire-and-forget fetch never completes in
  // production. postToSheet swallows its own errors and has an 8s timeout, so a
  // webhook outage can't fail the submission — the DB write above already holds.
  //
  // Two payload shapes are sent on purpose. `header`/`row` is what an updated
  // Apps Script reads. The flat fields below are the legacy shape: an Apps Script
  // that has NOT been redeployed yet ignores header/row and falls back to those,
  // so it still records who submitted and when instead of appending a blank row.
  // Once the script is updated the legacy fields are simply unused.
  const submittedAtLabel =
    row.revision > 1
      ? `${row.updatedAt.toISOString()} (edit #${row.revision})`
      : row.submittedAt.toISOString();

  const sheetSynced = await postToSheet({
    tab: SHEET_TAB,
    header: SHEET_HEADER,
    row: [
      name,
      roll,
      branch,
      ctx.offeringSemester,
      ...courseColumns(courses),
      submittedAtLabel,
    ],
    // Legacy fallback — see above.
    studentName: name,
    rollNumber: roll,
    branch,
    offeringSemester: ctx.offeringSemester,
    offeringYear: ctx.offeringYear,
    reportedAt: `${formatCoursesForSheet(courses)} · ${submittedAtLabel}`,
  });

  return NextResponse.json({
    submitted: true,
    courses,
    totalCredits,
    revision: row.revision,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Surfaced so the UI can say the sheet sync lagged instead of claiming a
    // clean end-to-end success.
    sheetSynced,
  });
}
