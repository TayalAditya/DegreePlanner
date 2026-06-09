import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Admin endpoint — returns all saved plans for a given semester+year
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const semester = Number(searchParams.get("semester"));
  const year = Number(searchParams.get("year"));
  if (!semester || !year) return NextResponse.json({ error: "Missing semester or year" }, { status: 400 });

  const plans = await prisma.preRegistrationPlan.findMany({
    where: { offeringSemester: semester, offeringYear: year },
    include: {
      user: { select: { name: true, email: true, enrollmentId: true, branch: true, batch: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch offerings to resolve names
  const offerings = await prisma.courseOffering.findMany({
    where: { offeringSemester: semester, offeringYear: year, isActive: true },
    select: { id: true, courseCode: true, courseName: true, credits: true },
  });
  const offeringMap = new Map(offerings.map((o) => [o.id, o]));

  // Also fetch courses by ID for MTP/internship entries (Course IDs, not Offering IDs)
  const allIds = [...new Set(plans.flatMap((p) => p.selectedIds))];
  const offeringIds = new Set(offerings.map((o) => o.id));
  const courseIds = allIds.filter((id) => !offeringIds.has(id));
  const courseMap = new Map<string, { courseCode: string; courseName: string; credits: number }>();
  if (courseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, code: true, name: true, credits: true },
    });
    for (const c of courses) courseMap.set(c.id, { courseCode: c.code, courseName: c.name, credits: c.credits });
  }

  const result = plans.map((p) => {
    const courses = p.selectedIds.map((id) => {
      const o = offeringMap.get(id);
      if (o) return { code: o.courseCode, name: o.courseName, credits: o.credits };
      const c = courseMap.get(id);
      if (c) return { code: c.courseCode, name: c.courseName, credits: c.credits };
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
