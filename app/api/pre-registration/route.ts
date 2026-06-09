import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { EnrollmentStatus } from "@prisma/client";

const PRE_REG_OPEN = new Date("2026-07-15T00:00:00+05:30");

// Credit limits per semester
const CREDIT_LIMIT: Record<number, number> = { 3: 22, 5: 25, 7: 25 };
const DEFAULT_CREDIT_LIMIT = 25;

function pickCategory(
  branchMappings: Array<{ courseCategory: string; branch: string; batch: string }> | undefined,
  branch: string,
  batch: number | null | undefined
): string | undefined {
  if (!branchMappings || branchMappings.length === 0) return undefined;
  const candidates = getBranchCandidates(branch);
  const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
  const batchStr = batch ? String(batch) : "";

  let best: { courseCategory: string } | undefined;
  let bestScore = Infinity;

  for (const m of branchMappings) {
    const idx = order.get(normalizeBranchCode(m.branch));
    if (idx === undefined) continue;
    // Prefer batch-specific mapping over all-batches
    const batchPenalty = m.batch && m.batch !== "" ? (m.batch === batchStr ? 0 : 1000) : 0.5;
    const score = idx + batchPenalty;
    if (score < bestScore) { best = m; bestScore = score; }
  }
  return best?.courseCategory;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { branch, batch, enrollmentId } = session.user;
  const batchYear = inferBatchYear(batch, enrollmentId);
  if (!batchYear) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  const creditLimit = CREDIT_LIMIT[offeringSemester] ?? DEFAULT_CREDIT_LIMIT;
  const registrationOpensAt = new Date() < PRE_REG_OPEN ? PRE_REG_OPEN.toISOString() : null;

  const normalizedBranch = normalizeBranchCode(branch);

  // Fetch all offerings for this semester
  const offerings = await prisma.courseOffering.findMany({
    where: { offeringYear, isActive: true },
    include: {
      course: {
        include: {
          branchMappings: {
            select: { courseCategory: true, branch: true, batch: true },
          },
        },
      },
    },
    orderBy: { courseCode: "asc" },
  });

  // Fetch user's completed enrollments to show strikethrough
  const completed = await prisma.courseEnrollment.findMany({
    where: { userId: session.user.id, status: EnrollmentStatus.COMPLETED },
    select: { courseId: true, course: { select: { code: true } }, semester: true },
  });
  const completedByCourseId = new Map(completed.map((e) => [e.courseId, e.semester]));
  const completedByCourseCode = new Map(
    completed.map((e) => [e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, ""), e.semester])
  );

  // IC-181 & IC-182 are IKS basket — only one counts. If either is done, the other is not compulsory.
  const ic181Done = completedByCourseCode.has("IC181");
  const ic182Done = completedByCourseCode.has("IC182");


  const result = offerings
    .filter((o) => {
      // Filter by branch eligibility
      const eligible =
        o.branches.includes("ALL") ||
        o.branches.some((b) => normalizeBranchCode(b) === normalizedBranch);
      if (!eligible) return false;
      // Filter by eligible semester
      if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(offeringSemester)) return false;
      return true;
    })
    .map((o) => {
      // Resolve category
      const mappingCategory = o.course
        ? pickCategory(o.course.branchMappings, normalizedBranch, batch)
        : undefined;
      const resolvedCategory =
        mappingCategory ?? o.categoryOverride ?? "FE";

      // Check if already completed — must be declared before isCompulsory
      const normalizedCode = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const completedSem =
        (o.courseId ? completedByCourseId.get(o.courseId) : undefined) ??
        completedByCourseCode.get(normalizedCode) ??
        null;
      const isCompleted = completedSem != null;

      // Compulsory if:
      //  a) no semester restriction OR same as student's current semester
      //  b) OR different semester but student hasn't completed it yet (backlog DC/IC)
      const isCompulsoryCategory = ["IC", "IC_BASKET", "DC", "IKS"].includes(resolvedCategory);
      const semesterMatches = o.compulsorySem == null || o.compulsorySem === offeringSemester;

      // IC-181/IC-182 mutual exclusion — done either one → other not compulsory
      const iksBlocked =
        (normalizedCode === "IC181" && (ic182Done || ic181Done)) ||
        (normalizedCode === "IC182" && (ic181Done || ic182Done));

      const isCompulsory = isCompulsoryCategory && !iksBlocked && (semesterMatches || !isCompleted);

      return {
        id: o.id,
        courseId: o.courseId,
        courseCode: o.courseCode,
        courseName: o.courseName,
        instructor: o.instructor,
        instructorEmail: o.instructorEmail,
        school: o.school,
        slots: o.slots,
        ltpc: o.ltpc,
        credits: o.credits,
        curriculumLink: o.curriculumLink,
        resolvedCategory,
        isCompulsory,
        completedInSemester: completedSem ?? null,
      };
    });

  return NextResponse.json({
    offeringSemester,
    offeringYear,
    term: "FALL",
    creditLimit,
    registrationOpensAt,
    offerings: result,
  });
}
