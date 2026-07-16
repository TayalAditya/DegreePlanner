import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { flushSamarthReports } from "@/lib/samarthDigest";

/** Resolve the pre-reg offering semester/year for the signed-in student. */
function offeringContext(batch: number | null | undefined, enrollmentId: string | null | undefined) {
  const batchYear = inferBatchYear(batch, enrollmentId);
  if (!batchYear) return null;
  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  return { batchYear, offeringSemester, offeringYear };
}

type ReportType = "SAMARTH" | "SOOTRANK";

/** Coerce an untrusted value to a valid report type, defaulting to SAMARTH. */
function parseReportType(v: unknown): ReportType {
  return v === "SOOTRANK" ? "SOOTRANK" : "SAMARTH";
}

/** GET → the offering IDs this student currently has flagged for the active semester, per portal. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ samarthReportedIds: [], sootrankReportedIds: [] });

  const reports = await prisma.samarthReport.findMany({
    where: {
      userId: session.user.id,
      offeringSemester: ctx.offeringSemester,
      offeringYear: ctx.offeringYear,
    },
    select: { courseOfferingId: true, reportType: true },
  });

  const samarthReportedIds = reports.filter((r) => r.reportType !== "SOOTRANK").map((r) => r.courseOfferingId);
  const sootrankReportedIds = reports.filter((r) => r.reportType === "SOOTRANK").map((r) => r.courseOfferingId);

  return NextResponse.json({
    samarthReportedIds,
    sootrankReportedIds,
    // Back-compat: older clients read reportedOfferingIds (Samarth only).
    reportedOfferingIds: samarthReportedIds,
  });
}

/** POST { offeringId, reportType? } → flag a course as not visible on Samarth/Sootrank. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { offeringId?: string; reportType?: string };
  const { offeringId } = body;
  const reportType = parseReportType(body.reportType);
  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  // Prefer a real CourseOffering; fall back to a Course row so synthetic cards
  // (internship 399P/396P, MTP) — whose id is a Course.id — can also be reported.
  const offeringRow = await prisma.courseOffering.findUnique({
    where: { id: offeringId },
    select: { id: true, courseCode: true, courseName: true },
  });
  const offering =
    offeringRow ??
    (await prisma.course
      .findUnique({ where: { id: offeringId }, select: { id: true, code: true, name: true } })
      .then((c) => (c ? { id: c.id, courseCode: c.code, courseName: c.name } : null)));
  if (!offering) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const roll = (session.user.enrollmentId || "").toUpperCase();
  const name = session.user.name || "Unknown";
  const branch = session.user.branch || "";

  await prisma.samarthReport.upsert({
    where: {
      userId_courseOfferingId_offeringSemester_offeringYear_reportType: {
        userId: session.user.id,
        courseOfferingId: offering.id,
        offeringSemester: ctx.offeringSemester,
        offeringYear: ctx.offeringYear,
        reportType,
      },
    },
    create: {
      userId: session.user.id,
      rollNumber: roll,
      studentName: name,
      branch,
      batchYear: ctx.batchYear,
      courseOfferingId: offering.id,
      courseCode: offering.courseCode,
      courseName: offering.courseName,
      offeringSemester: ctx.offeringSemester,
      offeringYear: ctx.offeringYear,
      reportType,
    },
    // If it was previously sent then re-flagged, treat as a fresh pending report.
    update: { sentAt: null, rollNumber: roll, studentName: name, branch },
  });

  // Fire the digest if the batch threshold is reached — don't block the response on email.
  flushSamarthReports().catch((e) => console.error("[samarth-digest] flush failed:", e));

  return NextResponse.json({ reported: true });
}

/** DELETE { offeringId, reportType? } → un-flag a course. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { offeringId?: string; reportType?: string };
  const { offeringId } = body;
  const reportType = parseReportType(body.reportType);
  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  await prisma.samarthReport.deleteMany({
    where: {
      userId: session.user.id,
      courseOfferingId: offeringId,
      offeringSemester: ctx.offeringSemester,
      offeringYear: ctx.offeringYear,
      reportType,
    },
  });

  return NextResponse.json({ reported: false });
}
