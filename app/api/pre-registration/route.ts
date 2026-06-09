import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { EnrollmentStatus } from "@prisma/client";
import { creditCalculator } from "@/lib/creditCalculator";

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
        select: {
          id: true,
          ltpc: true,
          branchMappings: { select: { courseCategory: true, branch: true, batch: true } },
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
        ltpc: o.ltpc ?? o.course?.ltpc ?? null,
        credits: o.credits,
        curriculumLink: o.curriculumLink,
        resolvedCategory,
        isCompulsory,
        completedInSemester: completedSem ?? null,
      };
    });

  // Use the real credit calculator for accurate completed breakdown
  const userProgram = await prisma.userProgram.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    select: { programId: true, program: { select: { icCredits: true, dcCredits: true, deCredits: true, feCredits: true } } },
  });

  let completedBreakdown: Record<string, number> = {};
  let programRequirements: Record<string, number> | null = null;

  if (userProgram?.programId) {
    try {
      const progress = await creditCalculator.calculateProgramProgress(session.user.id, userProgram.programId);
      const req = userProgram.program;

      // Build per-category breakdown from completed enrollments
      // (creditCalculator groups IC+DC+HSS into "core"; we split them here)
      const completedEnrollments = await prisma.courseEnrollment.findMany({
        where: { userId: session.user.id, status: EnrollmentStatus.COMPLETED },
        include: {
          course: {
            select: {
              code: true, credits: true,
              branchMappings: {
                select: { courseCategory: true, branch: true, batch: true, splitCategory: true, splitAmount: true },
              },
            },
          },
        },
      });

      const tally: Record<string, number> = { IC: 0, IC_BASKET: 0, DC: 0, DE: 0, HSS: 0, IKS: 0, FE: 0, MTP: 0, ISTP: 0 };
      const add = (cat: string, cr: number) => { tally[cat] = (tally[cat] ?? 0) + cr; };

      for (const e of completedEnrollments) {
        if (e.grade === "F") continue;
        const cr = e.course.credits;
        const code = e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mapping = (e.course.branchMappings as Array<{ courseCategory: string; branch: string; batch: string; splitCategory: string | null; splitAmount: number | null }>)
          .find(m => pickCategory([m], normalizedBranch, batch) !== undefined &&
            getBranchCandidates(normalizedBranch).map(b => b.toUpperCase()).includes(m.branch.toUpperCase())) ??
          (() => { const c = pickCategory(e.course.branchMappings as any, normalizedBranch, batch); return c ? { courseCategory: c, splitCategory: null, splitAmount: null } : null; })();

        const cat = mapping?.courseCategory ??
          (code.startsWith("HS") ? "HSS" : code.startsWith("IC") ? "IC" : "FE");

        if (mapping?.splitCategory && mapping.splitAmount) {
          add(cat, cr - mapping.splitAmount);
          add(mapping.splitCategory, mapping.splitAmount);
        } else {
          add(cat, cr);
        }
      }

      // DE overflow → FE (same as creditCalculator)
      const deOverflow = Math.max(0, (tally.DE ?? 0) - req.deCredits);
      tally.DE = Math.min(tally.DE ?? 0, req.deCredits);
      tally.FE = (tally.FE ?? 0) + deOverflow;

      // Keep IC and IC_BASKET separate for sidebar display

      completedBreakdown = tally;
      programRequirements = {
        DC:   req.dcCredits,
        DE:   req.deCredits,
        FE:   req.feCredits,
        MTP:  progress.required.mtp,
        ISTP: progress.required.istp,
        HSS:  12,   // first 12 cr count as core
        IKS:  3,    // IC-181 (IKS basket course)
        // IC and IC_BASKET: show done only (no separate req in program DB)
      };
    } catch { /* keep null */ }
  }

  return NextResponse.json({
    offeringSemester,
    offeringYear,
    term: "FALL",
    creditLimit,
    registrationOpensAt,
    offerings: result,
    completedBreakdown,
    programRequirements,
  });
}
