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

  const result = plans.map((p) => {
    const courses = p.selectedIds
      .map((id) => offeringMap.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null);
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
      courses: courses.map((c) => ({ code: c.courseCode, name: c.courseName, credits: c.credits })),
    };
  });

  return NextResponse.json({ plans: result, total: result.length });
}
