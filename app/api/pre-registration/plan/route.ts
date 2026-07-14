import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EnrollmentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const semester = Number(searchParams.get("semester"));
  const year = Number(searchParams.get("year"));
  if (!semester || !year) return NextResponse.json({ error: "Missing semester or year" }, { status: 400 });

  const plan = await prisma.preRegistrationPlan.findUnique({
    where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester: semester, offeringYear: year } },
    select: { selectedIds: true, registrationTypes: true, updatedAt: true },
  });

  return NextResponse.json({
    selectedIds: plan?.selectedIds ?? [],
    registrationTypes: (plan?.registrationTypes as Record<string, string>) ?? {},
    updatedAt: plan?.updatedAt ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { semester, year, selectedIds, registrationTypes } = body as {
    semester: number;
    year: number;
    selectedIds: string[];
    registrationTypes?: Record<string, string>;
  };

  if (!semester || !year || !Array.isArray(selectedIds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const types = registrationTypes ?? {};

  // A 399P onsite internship is an all-semester commitment. Validate plans on
  // the server too so a stale tab or direct API request cannot bypass the UI.
  const uniqueIds = Array.from(new Set(selectedIds));
  const [offeringMatches, courseMatches] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, courseCode: true, credits: true },
    }),
    prisma.course.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, code: true, credits: true },
    }),
  ]);
  const itemsById = new Map<string, { code: string; credits: number }>();
  offeringMatches.forEach((item) => itemsById.set(item.id, { code: item.courseCode, credits: item.credits }));
  courseMatches.forEach((item) => itemsById.set(item.id, { code: item.code, credits: item.credits }));
  const selected399P = uniqueIds.filter((id) =>
    /399P$/i.test(String(itemsById.get(id)?.code ?? "").replace(/[^A-Z0-9]/g, ""))
  );

  if (selected399P.length > 0) {
    const onsite = itemsById.get(selected399P[0]);
    if (uniqueIds.length !== 1) {
      return NextResponse.json(
        { error: "399P is a full-semester onsite internship and cannot be planned with any other course." },
        { status: 400 }
      );
    }
    if (!onsite || Number(onsite.credits) !== 9) {
      return NextResponse.json(
        { error: "399P must be configured as a 9-credit onsite internship." },
        { status: 400 }
      );
    }
    const existingPassFailCount = await prisma.courseEnrollment.count({
      where: {
        userId: session.user.id,
        isPassFail: true,
        status: { notIn: [EnrollmentStatus.DROPPED, EnrollmentStatus.FAILED] },
      },
    });
    if (existingPassFailCount > 0) {
      return NextResponse.json(
        { error: "399P uses all 9 P/F credits. Remove existing P/F courses before planning it." },
        { status: 400 }
      );
    }
  }

  const plan = await prisma.preRegistrationPlan.upsert({
    where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester: semester, offeringYear: year } },
    create: { userId: session.user.id, offeringSemester: semester, offeringYear: year, selectedIds, registrationTypes: types },
    update: { selectedIds, registrationTypes: types },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, updatedAt: plan.updatedAt });
}
