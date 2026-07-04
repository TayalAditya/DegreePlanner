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

  const { branch, batch, enrollmentId, name } = session.user;
  const batchYear = inferBatchYear(batch, enrollmentId);
  if (!batchYear) return NextResponse.json({ error: "Unknown batch" }, { status: 400 });

  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  const creditLimit = CREDIT_LIMIT[offeringSemester] ?? DEFAULT_CREDIT_LIMIT;
  const registrationOpensAt = new Date() < PRE_REG_OPEN ? PRE_REG_OPEN.toISOString() : null;

  const normalizedBranch = normalizeBranchCode(branch);

  // Fetch all data in parallel
  const [offerings, completed, userProgram, savedPlan, userRecord, equivalencies] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { offeringYear, isActive: true },
      include: {
        course: {
          select: {
            id: true,
            ltpc: true,
            branchMappings: { select: { courseCategory: true, branch: true, batch: true, semester: true } },
          },
        },
      },
      orderBy: { courseCode: "asc" },
    }),
    prisma.courseEnrollment.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { status: EnrollmentStatus.COMPLETED },
          // During pre-reg break, sync doesn't run — treat past-semester IN_PROGRESS as done
          { status: EnrollmentStatus.IN_PROGRESS, semester: { lt: offeringSemester } },
        ],
      },
      include: {
        course: {
          select: {
            code: true,
            credits: true,
            branchMappings: {
              select: { courseCategory: true, branch: true, batch: true, splitCategory: true, splitAmount: true },
            },
          },
        },
      },
    }),
    prisma.userProgram.findFirst({
      where: { userId: session.user.id, isPrimary: true },
      select: { programId: true, program: { select: { icCredits: true, dcCredits: true, deCredits: true, feCredits: true, mtpIstpCredits: true } } },
    }),
    prisma.preRegistrationPlan.findUnique({
      where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester, offeringYear } },
      select: { selectedIds: true, updatedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totalPassFailCredits: true },
    }),
    prisma.courseEquivalent.findMany({
      select: { courseId: true, equivalentId: true,
        course: { select: { code: true } },
        equivalent: { select: { id: true, code: true } },
      },
    }),
  ]);

  const completedByCourseId = new Map(completed.map((e) => [e.courseId, e.semester]));
  const completedByCourseCode = new Map(
    completed.map((e) => [e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, ""), e.semester])
  );

  // Apply course equivalencies from DB: if student completed an exchange course, treat the IIT Mandi equivalent as done
  for (const eq of equivalencies) {
    const sem = completedByCourseId.get(eq.courseId);
    if (sem !== undefined) {
      completedByCourseId.set(eq.equivalent.id, sem);
      completedByCourseCode.set(eq.equivalent.code.toUpperCase().replace(/[^A-Z0-9]/g, ""), sem);
    }
  }

  // IC-181 & IC-182 are IKS basket — only one counts. If either is done, the other is not compulsory.
  const ic181Done = completedByCourseCode.has("IC181");
  const ic182Done = completedByCourseCode.has("IC182");

  // IC Basket: students need 6 cr total. Once fulfilled, further IC_BASKET offerings are optional FE.
  // Use the same per-mapping .find() logic as the tally to avoid score-order issues.
  const IC_BASKET_REQ = 6;
  let completedIcBasketCredits = 0;
  for (const e of completed) {
    if (e.grade === "F") continue;
    const bm = e.course.branchMappings as Array<{ courseCategory: string; branch: string; batch: string }>;
    const mapping =
      bm.find(
        (m) =>
          pickCategory([m], normalizedBranch, batch) !== undefined &&
          getBranchCandidates(normalizedBranch)
            .map((b) => b.toUpperCase())
            .includes(m.branch.toUpperCase())
      ) ??
      (() => {
        const c = pickCategory(bm, normalizedBranch, batch);
        return c ? { courseCategory: c } : null;
      })();
    if (mapping?.courseCategory === "IC_BASKET") completedIcBasketCredits += e.course.credits;
  }
  const icBasketFulfilled = completedIcBasketCredits >= IC_BASKET_REQ;

  const isAdmin = session.user.role === "ADMIN";

  const result = offerings
    .filter((o) => {
      // Admins see all offerings regardless of branch or semester restrictions
      if (isAdmin) return true;
      if (!o.slots && !o.instructor) return false;
      // B24/B25 CE/BE/EP/BSCS: IC202P (Design Practicum) is optional FE — always show
      // regardless of the offering's branch list so students can register if they choose.
      const dpOptionalBranches = new Set(["CE", "BE", "EP", "BSCS"]);
      const isOptionalDpForBranch =
        o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "") === "IC202P" &&
        dpOptionalBranches.has(normalizedBranch) &&
        batch != null && batch >= 2024;
      if (isOptionalDpForBranch) return true;
      // Filter by branch eligibility — also match parent branches
      // (e.g. GE-ROBO student matches offerings listed for "GE")
      const branchCandidates = getBranchCandidates(normalizedBranch);
      const eligible =
        o.branches.includes("ALL") ||
        o.branches.some((b) => branchCandidates.includes(normalizeBranchCode(b)));
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
      const baseCat = mappingCategory ?? o.categoryOverride ?? "FE";
      // Once IC basket requirement is fulfilled (6 cr done), further IC_BASKET offerings become optional FE
      let resolvedCategory = icBasketFulfilled && baseCat === "IC_BASKET" ? "FE" : baseCat;

      const normalizedCodeEarly = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

      // B24/B25 CE/BE/EP/BSCS: IC202P (Design Practicum) is optional — reclassify to FE.
      const dpOptionalBranches = new Set(["CE", "BE", "EP", "BSCS"]);
      if (
        normalizedCodeEarly === "IC202P" &&
        dpOptionalBranches.has(normalizedBranch) &&
        batch != null && batch >= 2024
      ) {
        resolvedCategory = "FE";
      }

      // BSCS: IC272 (Machine Learning) is a BTech IC course — not compulsory for BSCS.
      if (normalizedCodeEarly === "IC272" && normalizedBranch === "BSCS") {
        resolvedCategory = "FE";
      }

      // HS-xxx, IK-xxx, IC-181/IC-182 always go to HSS+IKS basket regardless of branchMappings.
      const courseCodeRaw = o.courseCode.toUpperCase();
      if (courseCodeRaw.startsWith("HS-") || courseCodeRaw.startsWith("HS") ||
          /^IK\d/.test(normalizedCodeEarly) ||
          normalizedCodeEarly === "IC181" ||
          (normalizedCodeEarly === "IC182" && batch != null && batch >= 2024)) {
        resolvedCategory = "HSS";
      }

      // Check if already completed — must be declared before isCompulsory
      const normalizedCode = normalizedCodeEarly;
      const completedSem =
        (o.courseId ? completedByCourseId.get(o.courseId) : undefined) ??
        completedByCourseCode.get(normalizedCode) ??
        null;
      const isCompleted = completedSem != null;

      // Compulsory if:
      //  a) no semester restriction OR same as student's current semester
      //  b) OR different semester but student hasn't completed it yet (backlog DC/IC)
      const isCompulsoryCategory = ["IC", "IC_BASKET", "DC", "IKS"].includes(resolvedCategory);
      // Prefer branch-specific semester from branchMapping over the offering-level compulsorySem
      const branchMappingSem = o.course?.branchMappings
        ? (() => {
            const candidates = getBranchCandidates(normalizedBranch);
            const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
            const batchStr = batch ? String(batch) : "";
            let best: { semester: number | null } | undefined;
            let bestScore = Infinity;
            for (const m of o.course!.branchMappings as Array<{ branch: string; batch: string; semester: number | null }>) {
              const idx = order.get(normalizeBranchCode(m.branch));
              if (idx === undefined) continue;
              const batchPenalty = m.batch && m.batch !== "" ? (m.batch === batchStr ? 0 : 1000) : 0.5;
              const score = idx + batchPenalty;
              if (score < bestScore) { best = m; bestScore = score; }
            }
            return best?.semester ?? null;
          })()
        : null;
      const effectiveCompulsorySem = branchMappingSem ?? o.compulsorySem;
      const semesterMatches = effectiveCompulsorySem == null || effectiveCompulsorySem === offeringSemester;

      // IC-181/IC-182 mutual exclusion — done either one → other not compulsory
      const iksBlocked =
        (normalizedCode === "IC181" && (ic182Done || ic181Done)) ||
        (normalizedCode === "IC182" && (ic181Done || ic182Done));

      // Backlog only if due in a PAST semester and not done — future-semester courses are never backlog
      const isBacklog = effectiveCompulsorySem != null && effectiveCompulsorySem < offeringSemester && !isCompleted;
      const isCompulsory = isCompulsoryCategory && !iksBlocked && (semesterMatches || isBacklog);

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

  let completedBreakdown: Record<string, number> = {};
  let programRequirements: Record<string, number> | null = null;

  if (userProgram?.programId) {
    try {
      const progress = await creditCalculator.calculateProgramProgress(session.user.id, userProgram.programId);
      const req = userProgram.program;

      const tally: Record<string, number> = { IC: 0, IC_BASKET: 0, DC: 0, DE: 0, HSS: 0, IKS: 0, FE: 0, MTP: 0, ISTP: 0 };
      const add = (cat: string, cr: number) => { tally[cat] = (tally[cat] ?? 0) + cr; };

      for (const e of completed) {
        if (e.grade === "F") continue;
        const cr = e.course.credits;
        const code = e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mapping = (e.course.branchMappings as Array<{ courseCategory: string; branch: string; batch: string; splitCategory: string | null; splitAmount: number | null }>)
          .find(m => pickCategory([m], normalizedBranch, batch) !== undefined &&
            getBranchCandidates(normalizedBranch).map(b => b.toUpperCase()).includes(m.branch.toUpperCase())) ??
          (() => { const c = pickCategory(e.course.branchMappings as any, normalizedBranch, batch); return c ? { courseCategory: c, splitCategory: null, splitAmount: null } : null; })();

        // IK-xxx, IC-181, IC-182 → HSS+IKS combined basket
        const isHssIks = /^IK\d/.test(code) || code === "IC181" ||
          (code === "IC182" && batch != null && batch >= 2024);
        let cat = isHssIks ? "HSS" :
          (mapping?.courseCategory ??
            (code.startsWith("HS") ? "HSS" : code.startsWith("IC") ? "IC" : "FE"));

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

      // IC_BASKET overflow → FE (credits beyond 6cr requirement count as FE)
      const icBasketOverflow = Math.max(0, (tally.IC_BASKET ?? 0) - IC_BASKET_REQ);
      tally.IC_BASKET = Math.min(tally.IC_BASKET ?? 0, IC_BASKET_REQ);
      tally.FE = (tally.FE ?? 0) + icBasketOverflow;

      // Merge IKS completed into HSS bucket (combined basket)
      tally.HSS = (tally.HSS ?? 0) + (tally.IKS ?? 0);
      tally.IKS = 0;
      completedBreakdown = tally;

      // HSS+IKS combined: BTech = 15, BSCS = 12 (icCredits ≤ 52 → BSCS)
      const HSS_IKS_REQ = (req.icCredits ?? 60) <= 52 ? 12 : 15;
      programRequirements = {
        IC:       Math.max(0, req.icCredits - IC_BASKET_REQ - HSS_IKS_REQ),
        IC_BASKET: IC_BASKET_REQ,
        DC:   req.dcCredits,
        DE:   req.deCredits,
        FE:   req.feCredits,
        MTP:  progress.required.mtp,
        ISTP: progress.required.istp,
        HSS:  HSS_IKS_REQ,
        IKS:  0, // merged into HSS
      };
    } catch { /* keep null */ }
  }

  // Detect previous semesters with suspiciously few credits (likely not fully imported).
  // Exception: semesters where the only courses are semester-long internships (399P / 396P).
  const semesterMap = new Map<number, { credits: number; codes: string[] }>();
  for (const e of completed) {
    if (!e.semester || e.semester >= offeringSemester) continue;
    const entry = semesterMap.get(e.semester) ?? { credits: 0, codes: [] };
    const code = e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    entry.credits += e.course.credits;
    entry.codes.push(code);
    semesterMap.set(e.semester, entry);
  }
  const incompleteSemesters: number[] = [];
  // Check semesters that have SOME data but < 12 credits
  for (const [sem, { credits, codes }] of semesterMap) {
    if (credits >= 12) continue;
    const onlyInternship = codes.every((c) => c.endsWith("399P") || c.endsWith("396P"));
    if (onlyInternship) continue;
    incompleteSemesters.push(sem);
  }
  // Also flag semesters that have NO data at all (completely missing imports)
  for (let sem = 1; sem < offeringSemester; sem++) {
    if (!semesterMap.has(sem) && !incompleteSemesters.includes(sem)) {
      incompleteSemesters.push(sem);
    }
  }
  incompleteSemesters.sort((a, b) => a - b);

  return NextResponse.json({
    offeringSemester,
    offeringYear,
    term: "FALL",
    creditLimit,
    registrationOpensAt,
    offerings: result,
    completedBreakdown,
    programRequirements,
    incompleteSemesters,
    completedCourseCodes: completed
      .filter((e) => (e as any).grade !== "F")
      .map((e) => e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "")),
    studentInfo: {
      name: name ?? null,
      branch: branch ?? null,
      semester: offeringSemester,
      pfCreditsUsed: userRecord?.totalPassFailCredits ?? 0,
    },
    savedPlan: {
      selectedIds: savedPlan?.selectedIds ?? [],
      updatedAt: savedPlan?.updatedAt ?? null,
    },
  });
}
