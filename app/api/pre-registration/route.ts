import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { EnrollmentStatus, ProgramStatus, ProgramType } from "@prisma/client";
import { creditCalculator } from "@/lib/creditCalculator";
import { isAcadSec } from "@/lib/permissions";
import { getBatchAdjustedCredits } from "@/lib/branches";
import { pickBranchMapping, getHssIksDegreeCap, hssIksCountsAsDe } from "@/lib/courseCategory";
import { MINORS } from "@/lib/minors";
import { isMtp1CourseCode, isMtp2CourseCode } from "@/lib/mtpConfig";
import { yifComponentForCourse } from "@/lib/yif";

const PRE_REG_OPEN = new Date("2026-08-15T00:00:00+05:30");

// Credit limits per semester
const CREDIT_LIMIT: Record<number, number> = { 3: 22, 5: 25, 7: 25 };
const DEFAULT_CREDIT_LIMIT = 25;

// Compute the credit limit for a given semester and batch. B25 got a one-time
// 25-credit cap in semester 3; other batches use the standard limits.
function getCreditLimit(offeringSemester: number, batchYear: number): number {
  if (offeringSemester === 3 && batchYear === 2025) return 25;
  return CREDIT_LIMIT[offeringSemester] ?? DEFAULT_CREDIT_LIMIT;
}

function isHssIksCourse(code: string, batch: number | null | undefined): boolean {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.startsWith("HS") ||
    /^IK\d/.test(normalized) ||
    normalized === "IC181" ||
    (normalized === "IC182" && batch != null && batch >= 2024);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    branch: sessionBranch,
    batch: sessionBatch,
    enrollmentId,
    name: sessionName,
  } = session.user;
  // Branch specializations can be changed from Import Courses. JWT session
  // claims are deliberately long-lived, so use the profile as the source of
  // truth instead of making pre-registration wait for a new sign-in.
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { branch: true, batch: true, name: true, totalPassFailCredits: true, doingYIF: true },
  });
  const branch = currentUser?.branch ?? sessionBranch;
  const batch = currentUser?.batch ?? sessionBatch;
  const name = currentUser?.name ?? sessionName;
  const batchYear = inferBatchYear(batch, enrollmentId);
  const doingYIF = currentUser?.doingYIF ?? false;
  const isB23 = batchYear === 2023;

  // Acad sec users don't have branch/batch — they shouldn't see the student pre-reg view at all.
  // They use the admin plans page instead. Return empty offerings so the page doesn't error.
  if (!batchYear) {
    if (isAcadSec(session.user.email)) {
      return NextResponse.json({
        offeringSemester: 0,
        offeringYear: new Date().getFullYear(),
        term: "FALL",
        creditLimit: 25,
        registrationOpensAt: null,
        offerings: [],
        completedBreakdown: {},
        programRequirements: null,
        incompleteSemesters: [],
        completedCourseCodes: [],
        studentInfo: null,
        savedPlan: { selectedIds: [], registrationTypes: {}, updatedAt: null },
      });
    }
    return NextResponse.json({ error: "Unknown batch" }, { status: 400 });
  }

  const state = inferAcademicState(batchYear);
  const offeringSemester = state.upcomingSemester ?? state.currentSemester;
  const offeringYear = new Date().getFullYear();
  const creditLimit = getCreditLimit(offeringSemester, batchYear);
  const registrationOpensAt = new Date() < PRE_REG_OPEN ? PRE_REG_OPEN.toISOString() : null;

  const normalizedBranch = normalizeBranchCode(branch);

  // Fetch all data in parallel
  const [offerings, completed, userProgram, minorPrograms, savedPlan, equivalencies] = await Promise.all([
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
    // Minors are secondary programs, so they must not be inferred from the
    // primary-program query above. Their local alternative rules still need
    // to affect eligibility in the registration catalogue.
    prisma.userProgram.findMany({
      where: {
        userId: session.user.id,
        programType: ProgramType.MINOR,
        status: ProgramStatus.ACTIVE,
      },
      select: { program: { select: { code: true } } },
    }),
    prisma.preRegistrationPlan.findUnique({
      where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester, offeringYear } },
      select: { selectedIds: true, registrationTypes: true, updatedAt: true },
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

  // Apply course equivalencies in both directions. CourseEquivalent is stored
  // as a directed record, but a completed code must satisfy either side of the
  // pair (for example B23 GE-Mech EE-301 satisfies the EE-302 offering too).
  // Track which course actually satisfied it so the UI can explain why the
  // equivalent is locked.
  const completedViaByCourseId = new Map<string, string>();
  const completedViaByCourseCode = new Map<string, string>();
  const markEquivalentCompleted = (
    sourceId: string,
    sourceCode: string,
    targetId: string,
    targetCode: string
  ) => {
    const sem = completedByCourseId.get(sourceId);
    if (sem === undefined || completedByCourseId.has(targetId)) return;
    completedByCourseId.set(targetId, sem);
    const targetNormCode = targetCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    completedByCourseCode.set(targetNormCode, sem);
    completedViaByCourseId.set(targetId, sourceCode);
    completedViaByCourseCode.set(targetNormCode, sourceCode);
  };
  // Bidirectional courseId → equivalent courseIds map. Used client-side to enforce
  // "register only one of an equivalent set" during live selection (e.g. EE-210 vs EE-212).
  const equivalentIdsByCourseId = new Map<string, Set<string>>();
  const linkEquivalentIds = (aId: string, bId: string) => {
    if (!equivalentIdsByCourseId.has(aId)) equivalentIdsByCourseId.set(aId, new Set());
    equivalentIdsByCourseId.get(aId)!.add(bId);
  };
  for (const eq of equivalencies) {
    markEquivalentCompleted(eq.courseId, eq.course.code, eq.equivalent.id, eq.equivalent.code);
    markEquivalentCompleted(eq.equivalent.id, eq.equivalent.code, eq.courseId, eq.course.code);
    linkEquivalentIds(eq.courseId, eq.equivalent.id);
    linkEquivalentIds(eq.equivalent.id, eq.courseId);
  }

  // Check for completed minor alternative courses: if a student has completed one
  // course from an alternativeCourseCodeSets group, mark all others as completed too.
  // This prevents re-registering alternatives (e.g., HS-504 blocks HS-510 for Management minor).
  for (const minorDef of minorPrograms
    .map((minorProgram) => MINORS.find((minor) => minor.code === minorProgram.program.code))
    .filter((minor): minor is (typeof MINORS)[number] => Boolean(minor))) {
    for (const group of minorDef.groups) {
      if (!group.alternativeCourseCodeSets) continue;
      for (const altSet of group.alternativeCourseCodeSets) {
        // If any course in this alternative set is completed, mark all others as completed
        const completedInSet = altSet.find((code) =>
          completedByCourseCode.has(code.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        );
        if (completedInSet) {
          const normalizedCompleted = completedInSet.toUpperCase().replace(/[^A-Z0-9]/g, "");
          const completedSem = completedByCourseCode.get(normalizedCompleted);
          for (const altCode of altSet) {
            const normalized = altCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (normalized !== normalizedCompleted && !completedByCourseCode.has(normalized)) {
              completedByCourseCode.set(normalized, completedSem!);
              completedViaByCourseCode.set(normalized, completedInSet);
            }
          }
        }
      }
    }
  }

  // IC-181 & IC-182 are IKS basket — only one counts. If either is done, the other is not compulsory.
  const ic181Done = completedByCourseCode.has("IC181");
  const ic182Done = completedByCourseCode.has("IC182");

  // IC Basket: students need 6 cr total. Once fulfilled, further IC_BASKET offerings are optional FE.
  // Use the canonical branch-and-batch resolver. A generic mapping can have a
  // different category from the student's batch-specific curriculum mapping.
  const IC_BASKET_REQ = 6;
  let completedIcBasketCredits = 0;
  for (const e of completed) {
    if (e.grade === "F") continue;
    const mapping = pickBranchMapping(e.course.branchMappings, normalizedBranch, batch);
    if (mapping?.courseCategory === "IC_BASKET") completedIcBasketCredits += e.course.credits;
  }
  const icBasketFulfilled = completedIcBasketCredits >= IC_BASKET_REQ;

  const result = offerings
    .filter((o) => {
      if (!o.slots && !o.instructor) return false;
      const normalizedOfferingCode = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (doingYIF) {
        const isBlockedProject =
          isMtp1CourseCode(normalizedOfferingCode) ||
          isMtp2CourseCode(normalizedOfferingCode) ||
          (normalizedOfferingCode === "DP301P" && !isB23);
        if (isBlockedProject) return false;
      }
      const isB25MevlsiSem3 =
        normalizedBranch === "MEVLSI" && batchYear === 2025 && offeringSemester === 3;
      // For B25 MEVLSI, EE-311 was recoded as VL-201. Exposing both equivalent
      // slot-E rows creates a duplicate compulsory course and a false clash.
      if (isB25MevlsiSem3 && normalizedOfferingCode === "EE311") return false;
      if (isB25MevlsiSem3 && normalizedOfferingCode === "VL201") return true;

      // B24/B25 CE/BE/EP/BSCS: IC202P (Design Practicum) is optional FE — always show
      // regardless of the offering's branch list so students can register if they choose.
      const dpOptionalBranches = new Set(["CE", "BE", "EP", "BSCS"]);
      const isOptionalDpForBranch =
        normalizedOfferingCode === "IC202P" &&
        dpOptionalBranches.has(normalizedBranch) &&
        batch != null && batch >= 2024;
      if (isOptionalDpForBranch) return true;
      // Filter by branch eligibility — also match parent branches.
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
        ? pickBranchMapping(o.course.branchMappings, normalizedBranch, batch)?.courseCategory
        : undefined;
      const baseCat = mappingCategory ?? o.categoryOverride ?? "FE";
      // Once IC basket requirement is fulfilled (6 cr done), further IC_BASKET offerings become optional FE
      let resolvedCategory = icBasketFulfilled && baseCat === "IC_BASKET" ? "FE" : baseCat;

      const normalizedCodeEarly = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (doingYIF && yifComponentForCourse(o.courseCode, batchYear, o.credits)) {
        resolvedCategory = "YIF";
      }

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

      // HSS and IKS share one credit basket, but retain their own catalogue
      // sections: only SHSS courses should appear under HSS, while IKS
      // offerings (including GE-502/GE-523 mappings) appear separately.
      const courseCodeRaw = o.courseCode.toUpperCase();
      const isHssCourse = courseCodeRaw.startsWith("HS-") || courseCodeRaw.startsWith("HS");
      const isIksCourse = /^IK\d/.test(normalizedCodeEarly) ||
        normalizedCodeEarly === "IC181" ||
        (normalizedCodeEarly === "IC182" && batch != null && batch >= 2024);
      if (isHssCourse) {
        resolvedCategory = "HSS";
      } else if (isIksCourse) {
        resolvedCategory = "IKS";
      }

      // Check if already completed — must be declared before isCompulsory
      const normalizedCode = normalizedCodeEarly;
      const completedSem =
        (o.courseId ? completedByCourseId.get(o.courseId) : undefined) ??
        completedByCourseCode.get(normalizedCode) ??
        null;
      const isCompleted = completedSem != null;
      // If completion came from an equivalent course (not the course itself), surface which one.
      const completedVia =
        (o.courseId ? completedViaByCourseId.get(o.courseId) : undefined) ??
        completedViaByCourseCode.get(normalizedCode) ??
        null;

      // Compulsory if:
      //  a) no semester restriction OR same as student's current semester
      //  b) OR different semester but student hasn't completed it yet (backlog DC/IC)
      // Only IC-181 is the required IKS course. IC-182 is a B24+ equivalent
      // elective — it satisfies the requirement via the iksBlocked mechanism
      // but must not itself appear as compulsory (students choose one or the other).
      const isCompulsoryCategory = ["IC", "IC_BASKET", "DC"].includes(resolvedCategory) ||
        (resolvedCategory === "IKS" && normalizedCodeEarly === "IC181");
      // Prefer branch-specific semester from branchMapping over the offering-level compulsorySem
      const branchMappingSem = (
        pickBranchMapping(o.course?.branchMappings, normalizedBranch, batch) as
          | { semester?: number | null }
          | undefined
      )?.semester ?? null;
      const effectiveCompulsorySem = branchMappingSem ?? o.compulsorySem;
      const semesterMatches = effectiveCompulsorySem == null || effectiveCompulsorySem === offeringSemester;

      // IC-181/IC-182 mutual exclusion — done either one → other not compulsory
      const iksBlocked =
        (normalizedCode === "IC181" && (ic182Done || ic181Done)) ||
        (normalizedCode === "IC182" && (ic181Done || ic182Done));

      // Backlog only if due in a PAST semester and not done — future-semester courses are never backlog
      const isBacklog = effectiveCompulsorySem != null && effectiveCompulsorySem < offeringSemester && !isCompleted;
      const isCompulsory = !isCompleted && isCompulsoryCategory && !iksBlocked && (semesterMatches || isBacklog);

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
        completedVia,
        equivalentCourseIds: o.courseId
          ? Array.from(equivalentIdsByCourseId.get(o.courseId) ?? [])
          : [],
      };
    });

  // Preserve the raw combined HSS+IKS usage as well as the basket breakdown.
  // The client needs this to identify the exact course (or portion of a course)
  // that crosses the 20-credit degree cap while planning a new semester.
  const hssIksCreditsCompleted = completed
    .filter((enrollment) =>
      enrollment.grade !== "F" &&
      isHssIksCourse(enrollment.course.code, batch)
    )
    .reduce((sum, enrollment) => sum + enrollment.course.credits, 0);

  let completedBreakdown: Record<string, number> = {};
  let programRequirements: Record<string, number> | null = null;

  if (userProgram?.programId) {
    try {
      const progress = await creditCalculator.calculateProgramProgress(session.user.id, userProgram.programId);
      const req = userProgram.program;
      const adjustedDeCredits = Number(progress?.required?.de ?? req.deCredits);
      const adjustedFeCredits = Number(progress?.required?.freeElective ?? req.feCredits);

      const tally: Record<string, number> = { IC: 0, IC_BASKET: 0, DC: 0, DE: 0, HSS: 0, IKS: 0, FE: 0, MTP: 0, ISTP: 0, YIF: 0, NOT_IN_DEGREE: 0 };
      const add = (cat: string, cr: number) => { tally[cat] = (tally[cat] ?? 0) + cr; };
      // Credits that occupy the HSS+IKS basket but pay out as DE (IK-502 for B23
      // DSE). Tracked apart from tally.HSS so the cap split below can move the
      // portion that fits into DE, while the credits still consume basket room.
      let hssIksAsDeCredits = 0;

      for (const e of completed) {
        if (e.grade === "F") continue;
        const cr = e.course.credits;
        const code = e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mapping = pickBranchMapping(e.course.branchMappings, normalizedBranch, batch);

        // IK-xxx, IC-181, IC-182 → HSS+IKS combined basket
        const isHssIks = isHssIksCourse(code, batch);
        // P/F still consumes the student's P/F allowance. When the course is
        // HSS/IKS, it must also consume the shared HSS+IKS capacity so the
        // client can show the exact degree-counting and excluded portions.
        if (e.isPassFail && !isHssIks) {
          add("FE", cr);
          continue;
        }
        // IK-502 for B23 DSE: consumes HSS+IKS room but pays out as DE. Counted
        // into HSS here so it consumes the basket, and remembered separately so
        // the cap split below can redirect the part that fits. P/F is excluded to
        // match the per-course engines, where a P/F IK-502 keeps the ordinary
        // HSS+IKS treatment rather than becoming a P/F DE.
        if (!e.isPassFail && hssIksCountsAsDe(code, normalizedBranch, batch)) {
          hssIksAsDeCredits += cr;
          add("HSS", cr);
          continue;
        }
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
      const deOverflow = Math.max(0, (tally.DE ?? 0) - adjustedDeCredits);
      tally.DE = Math.min(tally.DE ?? 0, adjustedDeCredits);
      tally.FE = (tally.FE ?? 0) + deOverflow;

      // IC_BASKET overflow → FE (credits beyond 6cr requirement count as FE)
      const icBasketOverflow = Math.max(0, (tally.IC_BASKET ?? 0) - IC_BASKET_REQ);
      tally.IC_BASKET = Math.min(tally.IC_BASKET ?? 0, IC_BASKET_REQ);
      tally.FE = (tally.FE ?? 0) + icBasketOverflow;

      // Merge IKS completed into HSS bucket (combined basket)
      tally.HSS = (tally.HSS ?? 0) + (tally.IKS ?? 0);
      tally.IKS = 0;

      // HSS+IKS combined: BTech = 15, BSCS = 12 (icCredits ≤ 52 → BSCS)
      const HSS_IKS_REQ = (req.icCredits ?? 60) <= 52 ? 12 : 15;

      // HSS overflow → FE (credits beyond HSS requirement count as FE)
      // B23 BOA relaxation: degree cap raised from 20 → 30.
      const HSS_IKS_DEGREE_CAP = getHssIksDegreeCap(batchYear);
      const hssRaw = tally.HSS ?? 0;
      // This surface caps a SUM rather than walking courses in semester order, so
      // the DE-paying credits are given the tail of the basket: everything else
      // fills the basket first, and IK-502 keeps only what is left under the cap.
      // That matches "check whether the course fits" and is deterministic here,
      // where there is no per-course ordering to appeal to. It can differ from the
      // per-course engines by a credit or two, but only for a student who both
      // exceeds the HSS+IKS cap and took IK-502 before their last HS/IK course.
      const hssOther = Math.max(0, hssRaw - hssIksAsDeCredits);
      const hssIksDeCredits = Math.max(0, Math.min(hssIksAsDeCredits, HSS_IKS_DEGREE_CAP - hssOther));
      const hssCoreCredits = Math.min(hssOther, HSS_IKS_REQ);
      const hssFeCredits = Math.max(0, Math.min(hssOther, HSS_IKS_DEGREE_CAP) - hssCoreCredits);
      const hssNotInDegree = Math.max(0, hssRaw - HSS_IKS_DEGREE_CAP);
      tally.HSS = hssCoreCredits;
      tally.FE = (tally.FE ?? 0) + hssFeCredits;
      tally.DE = (tally.DE ?? 0) + hssIksDeCredits;
      tally.NOT_IN_DEGREE = hssNotInDegree;

      // The DE overflow clamp above ran before these DE credits existed, so
      // re-apply it. progressCreditBreakdown clamps DE after its per-course loop
      // for exactly the same reason.
      if (hssIksDeCredits > 0) {
        const lateDeOverflow = Math.max(0, (tally.DE ?? 0) - adjustedDeCredits);
        tally.DE = Math.min(tally.DE ?? 0, adjustedDeCredits);
        tally.FE = (tally.FE ?? 0) + lateDeOverflow;
      }

      completedBreakdown = tally;
      completedBreakdown.YIF = Number(progress.completed.yif ?? 0);
      const batchAdj = getBatchAdjustedCredits(normalizedBranch, batchYear, { dcCredits: req.dcCredits, deCredits: req.deCredits });
      programRequirements = {
        IC:       Math.max(0, req.icCredits - IC_BASKET_REQ - HSS_IKS_REQ),
        IC_BASKET: IC_BASKET_REQ,
        DC:   batchAdj.dcCredits,
        DE:   adjustedDeCredits,
        FE:   adjustedFeCredits,
        MTP:  progress.required.mtp,
        ISTP: progress.required.istp,
        YIF:  progress.required.yif,
        HSS:  HSS_IKS_REQ,
        IKS:  0, // merged into HSS
        NOT_IN_DEGREE: 0,
      };
    } catch (err) {
      console.error("[pre-registration] failed to compute program progress:", err);
      /* keep null — completedBreakdown and programRequirements stay empty */
    }
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
    hssIksCreditsCompleted,
    programRequirements,
    incompleteSemesters,
    completedCourseCodes: completed
      .filter((e) => (e as any).grade !== "F")
      .map((e) => e.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "")),
    studentInfo: {
      name: name ?? null,
      branch: branch ?? null,
      semester: offeringSemester,
      pfCreditsUsed: currentUser?.totalPassFailCredits ?? 0,
      batch: batchYear,
    },
    savedPlan: {
      selectedIds: savedPlan?.selectedIds ?? [],
      registrationTypes: (savedPlan?.registrationTypes as Record<string, string>) ?? {},
      updatedAt: savedPlan?.updatedAt ?? null,
    },
  });
}
