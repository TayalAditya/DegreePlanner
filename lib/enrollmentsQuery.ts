import prisma from "@/lib/prisma";
import { courseIdentityKey } from "@/lib/courseIdentity";

/**
 * Display-name overrides applied to enrollment course names.
 * Shared between the /api/enrollments GET route and server-side
 * dashboard prefetch so both return an identical shape.
 */
export const COURSE_NAME_OVERRIDES: Record<string, string> = {
  IK593: "Kulhad Economy",
};

type LoadEnrollmentsOptions = {
  /** Optional semester filter (matches the ?semester= query param). */
  semester?: number;
};

/**
 * Loads a user's enrollments with the same include/order/overrides that the
 * `/api/enrollments` GET endpoint returns. Used server-side so the dashboard
 * can hydrate React Query with `initialData` and skip the client fetch.
 *
 * Note: this does NOT run status sync — callers that need it (the API route,
 * the dashboard page) already trigger `syncEnrollmentStatusesForUser`.
 */
export async function loadDashboardEnrollments(
  userId: string,
  options: LoadEnrollmentsOptions = {}
) {
  const where: { userId: string; semester?: number } = { userId };
  if (typeof options.semester === "number" && !Number.isNaN(options.semester)) {
    where.semester = options.semester;
  }

  const enrollments = await prisma.courseEnrollment.findMany({
    where,
    include: {
      course: {
        include: {
          branchMappings: {
            select: {
              courseCategory: true,
              branch: true,
              batch: true,
              splitCategory: true,
              splitAmount: true,
            },
          },
        },
      },
    },
    orderBy: [{ semester: "asc" }, { course: { code: "asc" } }],
  });

  return enrollments.map((e) => {
    const key = courseIdentityKey(e.course?.code);
    const overrideName = COURSE_NAME_OVERRIDES[key];
    if (!overrideName) return e;
    return {
      ...e,
      course: {
        ...e.course,
        name: overrideName,
      },
    };
  });
}
