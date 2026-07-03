import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { loadDashboardEnrollments } from "@/lib/enrollmentsQuery";
import CoursesClient from "./CoursesClient";

// Server wrapper: pre-load enrollments + user settings so the courses route
// paints with real data on first request instead of blocking on a client-side
// fetch waterfall. Mirrors the app/dashboard/page.tsx → DashboardOverview pattern.
export default async function CoursesPage() {
  const session = await getSession();

  let initialEnrollments: any[] = [];
  let initialUser: {
    branch?: string;
    totalPassFailCredits?: number;
    batch?: number | null;
    enrollmentId?: string | null;
  } | null = null;

  if (session?.user?.id) {
    try {
      const [enrollments, userRecord] = await Promise.all([
        loadDashboardEnrollments(session.user.id),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            branch: true,
            batch: true,
            enrollmentId: true,
            totalPassFailCredits: true,
          },
        }),
      ]);

      initialEnrollments = enrollments;
      if (userRecord) {
        initialUser = {
          branch: userRecord.branch ?? undefined,
          batch: userRecord.batch ?? null,
          enrollmentId: userRecord.enrollmentId ?? null,
          totalPassFailCredits: userRecord.totalPassFailCredits ?? 0,
        };
      }
    } catch {
      // Fall back to client-side fetch if the server prefetch fails.
      initialEnrollments = [];
      initialUser = null;
    }
  }

  return (
    <CoursesClient
      initialEnrollments={initialEnrollments as any}
      initialUser={initialUser}
    />
  );
}
