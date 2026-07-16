import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { postToSheet } from "@/lib/sheetWebhook";

/** Resolve the pre-reg offering semester/year for the signed-in student. */
function offeringContext(batch: number | null | undefined, enrollmentId: string | null | undefined) {
  const batchYear = inferBatchYear(batch, enrollmentId);
  if (!batchYear) return null;
  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  return { batchYear, offeringSemester, offeringYear };
}

/**
 * Global "my pre-registration wasn't submitted on Samarth" flag.
 * Course-agnostic — one row per student per semester. DB is the source of truth;
 * a Google Sheet (NotSubmittedOnSamarth tab) is mirrored on POST via webhook.
 */

/** GET → whether this student has flagged the active semester as not submitted. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ reported: false });

  const row = await prisma.preRegNotSubmitted.findUnique({
    where: {
      userId_offeringSemester_offeringYear: {
        userId: session.user.id,
        offeringSemester: ctx.offeringSemester,
        offeringYear: ctx.offeringYear,
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ reported: !!row });
}

/** POST → flag the active semester as not submitted (DB row + Google Sheet mirror). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  const roll = (session.user.enrollmentId || "").toUpperCase();
  const name = session.user.name || "Unknown";
  const branch = session.user.branch || "";

  const row = await prisma.preRegNotSubmitted.upsert({
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
    },
    update: { rollNumber: roll, studentName: name, branch },
  });

  // Mirror to the Google Sheet — append-only log. Must be awaited: on Vercel the
  // function freezes as soon as the response is returned, so a fire-and-forget
  // fetch never completes in production. postToSheet never throws (errors are
  // logged and swallowed) and has an 8s timeout, so this can't 500 the request.
  await postToSheet({
    tab: "NotSubmittedOnSamarth",
    studentName: name,
    rollNumber: roll,
    branch,
    offeringSemester: ctx.offeringSemester,
    offeringYear: ctx.offeringYear,
    reportedAt: row.createdAt.toISOString(),
  });

  return NextResponse.json({ reported: true });
}

/** DELETE → un-flag the active semester (DB only; the sheet stays an append-only log). */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = offeringContext(session.user.batch, session.user.enrollmentId);
  if (!ctx) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  await prisma.preRegNotSubmitted.deleteMany({
    where: {
      userId: session.user.id,
      offeringSemester: ctx.offeringSemester,
      offeringYear: ctx.offeringYear,
    },
  });

  return NextResponse.json({ reported: false });
}
