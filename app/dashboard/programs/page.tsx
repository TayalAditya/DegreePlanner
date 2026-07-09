import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { loadDashboardEnrollments } from "@/lib/enrollmentsQuery";
import { syncEnrollmentStatusesForUser } from "@/lib/enrollmentStatusSync";
import ProgramsClient from "./ProgramsClient";

export default async function ProgramsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const userId = session.user.id;

  // Prefetch programs + enrollments + settings server-side so the primary
  // program card (the LCP block) paints from SSR HTML instead of after a
  // client-side fetch waterfall + skeleton flash. /api/progress (chart data)
  // still runs client-side because it needs localStorage minor-planner params.
  let initialUserPrograms: any[] = [];
  let initialEnrollments: any[] = [];
  let initialUserSettings: any = null;

  try {
    // Match /api/enrollments behavior: sync statuses before loading enrollments.
    const [, enrollments, userPrograms, userRecord] = await Promise.all([
      syncEnrollmentStatusesForUser(userId, {
        batch: session.user.batch,
        enrollmentId: session.user.enrollmentId,
      }),
      loadDashboardEnrollments(userId),
      prisma.userProgram.findMany({
        where: { userId, status: "ACTIVE" },
        include: { program: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          branch: true,
          batch: true,
          enrollmentId: true,
          doingMTP: true,
          doingMTP2: true,
          doingISTP: true,
          totalPassFailCredits: true,
        },
      }),
    ]);

    initialEnrollments = enrollments;
    initialUserPrograms = userPrograms;
    initialUserSettings = userRecord;
  } catch (error) {
    console.error("Failed to prefetch programs page data:", error);
  }

  return (
    <ProgramsClient
      initialUserPrograms={initialUserPrograms}
      initialEnrollments={initialEnrollments}
      initialUserSettings={initialUserSettings}
    />
  );
}
