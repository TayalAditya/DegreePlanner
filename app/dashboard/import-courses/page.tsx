import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { loadDashboardEnrollments } from "@/lib/enrollmentsQuery";
import { courseIdentityKey } from "@/lib/courseIdentity";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBatch24Icb1Course } from "@/lib/batch24";
import { normalizeCourseCode } from "@/lib/parseTranscript";
import ImportCoursesClient from "./ImportCoursesClient";

export default async function ImportCoursesPage() {
  const session = await getSession();

  let initialBranch: string | undefined;
  let initialBatch: number | null = null;
  let initialEnrollmentId: string | null = null;
  let initialDoingMTP = true;
  let initialDoingMTP2 = true;
  let initialManualCourseImportOnly = false;
  let initialBatch24Icb1Course: string | null = null;
  let initialImportedKeys: string[] = [];
  let initialPassFailCredits = 0;
  let initialPassFailCreditsBySemester: Record<number, number> = {};
  let initialCurrentSemester = 6;
  let initialPreRegLockedSemester: number | null = null;

  if (session?.user?.id) {
    try {
      const [userRecord, enrollments] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            branch: true,
            batch: true,
            enrollmentId: true,
            doingMTP: true,
            doingMTP2: true,
            manualCourseImportOnly: true,
            totalPassFailCredits: true,
          },
        }),
        loadDashboardEnrollments(session.user.id),
      ]);

      if (userRecord) {
        initialBranch = userRecord.branch ?? "CSE";
        initialBatch = userRecord.batch ?? null;
        initialEnrollmentId = userRecord.enrollmentId ?? null;
        initialDoingMTP = userRecord.doingMTP ?? true;
        initialDoingMTP2 = userRecord.doingMTP2 ?? true;
        initialManualCourseImportOnly = userRecord.manualCourseImportOnly ?? false;
        initialPassFailCredits = userRecord.totalPassFailCredits ?? 0;

        const batchYear = inferBatchYear(userRecord.batch, userRecord.enrollmentId);
        if (batchYear) {
          const state = inferAcademicState(batchYear);
          if (state.phase === "PRE_REGISTRATION" && state.upcomingSemester) {
            initialPreRegLockedSemester = state.upcomingSemester;
            initialCurrentSemester = state.upcomingSemester - 1;
          } else {
            initialCurrentSemester = state.currentSemester;
          }
        }

        const isBatch24 = userRecord.batch === 2024;
        if (isBatch24 && userRecord.enrollmentId) {
          const icb1 = await getBatch24Icb1Course(userRecord.enrollmentId);
          if (typeof icb1 === "string") {
            initialBatch24Icb1Course = normalizeCourseCode(icb1);
          }
        }
      }

      initialImportedKeys = enrollments
        .filter((e: any) => e.status !== "DROPPED" && e.status !== "FAILED")
        .map((e: any) => courseIdentityKey(e.course?.code))
        .filter(Boolean) as string[];

      initialPassFailCreditsBySemester = enrollments.reduce<Record<number, number>>(
        (totals, enrollment: any) => {
          if (!enrollment.isPassFail) return totals;
          const semester = Number(enrollment.semester || 0);
          if (semester <= 0) return totals;
          totals[semester] = (totals[semester] ?? 0) + Number(enrollment.passFailCredits || enrollment.course?.credits || 0);
          return totals;
        },
        {}
      );
    } catch {
      // Fall back to client-side fetch
    }
  }

  return (
    <ImportCoursesClient
      initialBranch={initialBranch}
      initialBatch={initialBatch}
      initialEnrollmentId={initialEnrollmentId}
      initialDoingMTP={initialDoingMTP}
      initialDoingMTP2={initialDoingMTP2}
      initialManualCourseImportOnly={initialManualCourseImportOnly}
      initialBatch24Icb1Course={initialBatch24Icb1Course}
      initialImportedKeys={initialImportedKeys}
      initialPassFailCredits={initialPassFailCredits}
      initialPassFailCreditsBySemester={initialPassFailCreditsBySemester}
      initialCurrentSemester={initialCurrentSemester}
      initialPreRegLockedSemester={initialPreRegLockedSemester}
    />
  );
}
