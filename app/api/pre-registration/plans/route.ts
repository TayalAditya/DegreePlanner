import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAcadSec } from "@/lib/permissions";
import { EnrollmentStatus } from "@prisma/client";

// Admin / Acad Sec endpoint — returns all saved plans for a given semester+year
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && !isAcadSec(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const semester = Number(searchParams.get("semester"));
  const year = Number(searchParams.get("year"));
  if (!semester || !year) return NextResponse.json({ error: "Missing semester or year" }, { status: 400 });

  const plans = await prisma.preRegistrationPlan.findMany({
    where: { offeringSemester: semester, offeringYear: year },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          enrollmentId: true,
          branch: true,
          batch: true,
          enrollments: {
            where: { status: EnrollmentStatus.COMPLETED },
            select: { courseId: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Collect all IDs referenced across plans
  const allIds = [...new Set(plans.flatMap((p) => p.selectedIds))];

  // Look up offerings directly by ID — no year/semester filter so plans
  // saved in a previous cycle (or before offerings are recreated) still resolve.
  const [offerings, equivalencies] = await Promise.all([
    allIds.length > 0
      ? prisma.courseOffering.findMany({
        // A withdrawn offering can remain in an older saved plan, but it is
        // not part of the student's effective registration plan.
        where: { id: { in: allIds }, isActive: true },
        select: { id: true, courseId: true, courseCode: true, courseName: true, credits: true },
      })
      : Promise.resolve([]),
    prisma.courseEquivalent.findMany({
      select: { courseId: true, equivalentId: true },
    }),
  ]);
  const offeringMap = new Map(offerings.map((o) => [o.id, o]));

  // Any IDs not found as offerings are Course-table IDs (MTP/internship entries)
  const courseIds = allIds.filter((id) => !offeringMap.has(id));
  const courseMap = new Map<string, { courseCode: string; courseName: string; credits: number }>();
  if (courseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds }, isActive: true },
      select: { id: true, code: true, name: true, credits: true },
    });
    for (const c of courses) courseMap.set(c.id, { courseCode: c.code, courseName: c.name, credits: c.credits });
  }

  // Treat course equivalents as one completion component. This mirrors the
  // student timetable: a saved plan must not be reported with a course that
  // the student has already completed under an equivalent code.
  const equivalentIdsByCourseId = new Map<string, Set<string>>();
  const linkEquivalentIds = (left: string, right: string) => {
    if (!equivalentIdsByCourseId.has(left)) equivalentIdsByCourseId.set(left, new Set());
    equivalentIdsByCourseId.get(left)!.add(right);
  };
  for (const equivalency of equivalencies) {
    linkEquivalentIds(equivalency.courseId, equivalency.equivalentId);
    linkEquivalentIds(equivalency.equivalentId, equivalency.courseId);
  }

  const result = plans.map((p) => {
    const fulfilledCourseIds = new Set(p.user.enrollments.map((enrollment) => enrollment.courseId));
    const equivalenceQueue = Array.from(fulfilledCourseIds);
    for (let index = 0; index < equivalenceQueue.length; index++) {
      for (const equivalentId of equivalentIdsByCourseId.get(equivalenceQueue[index]) ?? []) {
        if (fulfilledCourseIds.has(equivalentId)) continue;
        fulfilledCourseIds.add(equivalentId);
        equivalenceQueue.push(equivalentId);
      }
    }
    const courses = p.selectedIds.map((id) => {
      const o = offeringMap.get(id);
      if (o && (o.courseId == null || !fulfilledCourseIds.has(o.courseId))) {
        return { code: o.courseCode, name: o.courseName, credits: o.credits };
      }
      const c = courseMap.get(id);
      if (c && !fulfilledCourseIds.has(id)) return { code: c.courseCode, name: c.courseName, credits: c.credits };
      return null;
    }).filter((c): c is NonNullable<typeof c> => c != null);
    const totalCredits = courses.reduce((s, c) => s + c.credits, 0);
    return {
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      enrollmentId: p.user.enrollmentId,
      branch: p.user.branch,
      batch: p.user.batch,
      updatedAt: p.updatedAt,
      totalCredits,
      courses,
    };
  });

  return NextResponse.json({ plans: result, total: result.length });
}
