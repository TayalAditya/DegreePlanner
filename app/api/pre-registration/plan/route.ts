import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MINORS } from "@/lib/minors";
import { EnrollmentStatus, ProgramStatus, ProgramType } from "@prisma/client";

const normalizeCourseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

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
  const { semester, year, selectedIds, registrationTypes, minorCode } = body as {
    semester: number;
    year: number;
    selectedIds: string[];
    registrationTypes?: Record<string, string>;
    minorCode?: string | null;
  };

  if (!semester || !year || !Array.isArray(selectedIds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let canonicalIds = Array.from(new Set(selectedIds));
  const canonicalTypes = { ...(registrationTypes ?? {}) };

  // B25 MEVLSI Sem-3 registers recoded VL-201, not EE-311. Canonicalize
  // stale tabs/direct requests server-side so a saved plan can never contain
  // both IDs and trigger a false timetable clash.
  if (semester === 3 && year === 2026) {
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { branch: true, batch: true },
    });
    const rawBatch = Number(profile?.batch);
    const batchYear = rawBatch > 0 && rawBatch < 100 ? 2000 + rawBatch : rawBatch;
    const branch = String(profile?.branch ?? "").trim().toUpperCase();
    if (["MEVLSI", "VL", "VLSI"].includes(branch) && batchYear === 2025) {
      const pair = await prisma.courseOffering.findMany({
        where: { offeringYear: 2026, courseCode: { in: ["EE-311", "VL-201"] } },
        select: { id: true, courseCode: true },
      });
      const ee311Id = pair.find((item) => item.courseCode === "EE-311")?.id;
      const vl201Id = pair.find((item) => item.courseCode === "VL-201")?.id;
      if (ee311Id && vl201Id && canonicalIds.includes(ee311Id)) {
        canonicalIds = Array.from(new Set(canonicalIds.map((id) => id === ee311Id ? vl201Id : id)));
        if (canonicalTypes[ee311Id] && !canonicalTypes[vl201Id]) {
          canonicalTypes[vl201Id] = canonicalTypes[ee311Id];
        }
        delete canonicalTypes[ee311Id];
      }
    }
  }

  // A 399P onsite internship is an all-semester commitment. Validate plans on
  // the server too so a stale tab or direct API request cannot bypass the UI.
  const [offeringMatches, courseMatches, activeMinorPrograms, completedCourses] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { id: { in: canonicalIds } },
      select: { id: true, courseCode: true, credits: true },
    }),
    prisma.course.findMany({
      where: { id: { in: canonicalIds } },
      select: { id: true, code: true, credits: true },
    }),
    prisma.userProgram.findMany({
      where: {
        userId: session.user.id,
        programType: ProgramType.MINOR,
        status: ProgramStatus.ACTIVE,
      },
      select: { program: { select: { code: true } } },
    }),
    prisma.courseEnrollment.findMany({
      where: {
        userId: session.user.id,
        status: { in: [EnrollmentStatus.COMPLETED, EnrollmentStatus.IN_PROGRESS] },
        grade: { not: "F" },
      },
      select: { course: { select: { code: true } } },
    }),
  ]);
  const itemsById = new Map<string, { code: string; credits: number }>();
  offeringMatches.forEach((item) => itemsById.set(item.id, { code: item.courseCode, credits: item.credits }));
  courseMatches.forEach((item) => itemsById.set(item.id, { code: item.code, credits: item.credits }));

  // A planner-selected minor is sent with the save request, while declared
  // active minors are always enforced. This prevents a stale tab or direct
  // API request from registering both sides of a minor-only OR pair.
  const activeMinorCodes = new Set(activeMinorPrograms.map((item) => item.program.code));
  const requestedMinorCode = typeof minorCode === "string" ? minorCode.trim() : "";
  if (requestedMinorCode && MINORS.some((minor) => minor.code === requestedMinorCode)) {
    activeMinorCodes.add(requestedMinorCode);
  }
  const completedCodes = new Set(completedCourses.map((item) => normalizeCourseCode(item.course.code)));
  const selectedCodes = new Set(
    canonicalIds
      .map((id) => itemsById.get(id)?.code)
      .filter((code): code is string => Boolean(code))
      .map(normalizeCourseCode)
  );
  for (const minorCodeToValidate of activeMinorCodes) {
    const minor = MINORS.find((item) => item.code === minorCodeToValidate);
    if (!minor) continue;
    for (const group of minor.groups) {
      for (const alternatives of group.alternativeCourseCodeSets ?? []) {
        const completedAlternative = alternatives.find((code) => completedCodes.has(normalizeCourseCode(code)));
        const selectedAlternatives = alternatives.filter((code) => selectedCodes.has(normalizeCourseCode(code)));
        const conflictsWithCompleted = completedAlternative && selectedAlternatives.some(
          (code) => normalizeCourseCode(code) !== normalizeCourseCode(completedAlternative)
        );
        if (conflictsWithCompleted || selectedAlternatives.length > 1) {
          return NextResponse.json(
            {
              error: `${alternatives.join(" and ")} are alternatives in ${minor.name}. Only one can count toward ${group.title}.`,
            },
            { status: 400 }
          );
        }
      }
    }
  }

  const selected399P = canonicalIds.filter((id) => {
    const code = String(itemsById.get(id)?.code ?? "").replace(/[^A-Z0-9]/g, "");
    // Also catch IDs not found in DB — treat unknown IDs as non-399P (they won't
    // pass the credits === 9 check anyway, so no bypass is possible).
    return /399P$/i.test(code);
  });

  if (selected399P.length > 0) {
    const onsite = itemsById.get(selected399P[0]);
    if (canonicalIds.length !== 1) {
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
    create: { userId: session.user.id, offeringSemester: semester, offeringYear: year, selectedIds: canonicalIds, registrationTypes: canonicalTypes },
    update: { selectedIds: canonicalIds, registrationTypes: canonicalTypes },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, updatedAt: plan.updatedAt });
}
