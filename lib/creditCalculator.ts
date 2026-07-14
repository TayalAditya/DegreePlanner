import { CourseType, EnrollmentStatus, ProgramType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildNonMgmtMinorCountedCourseCodeSet } from "@/lib/minorPlanner";
import { normalizeBranchForIcBasket } from "@/lib/icBasketConfig";
import { getBranchCandidates, isDataScienceBranch, normalizeBranchCode } from "@/lib/branchInfo";
import { getBatchAdjustedCredits } from "@/lib/branches";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import { pickBranchMapping, pickBranchMappingCategory } from "@/lib/courseCategory";
import {
  isMtp1CourseCode,
  isMtp2CourseCode,
  MTP_COMPONENT_CREDITS,
  MTP_TOTAL_CREDITS,
} from "@/lib/mtpConfig";
import {
  addCredits,
  formatCourseCode,
  formatCredits,
  maxCredits,
  minCredits,
  subtractCredits,
  sumCredits,
} from "@/lib/utils";

export interface CreditBreakdown {
  core: number;
  de: number; // Discipline Electives
  pe: number; // Program Electives
  freeElective: number;
  mtp: number;
  istp: number;
  total: number;
}

export interface ProgramProgress {
  programId: string;
  programName: string;
  programType: ProgramType;
  required: CreditBreakdown;
  completed: CreditBreakdown;
  inProgress: CreditBreakdown;
  remaining: CreditBreakdown;
  percentage: number;
  /** Per-category required credits — used by ProgressChart for dynamic HSS cap */
  creditsRequiredByCategory?: {
    IC?: number; IC_BASKET?: number; DC?: number; DE?: number;
    FE?: number; HSS?: number; IKS?: number; MTP?: number; ISTP?: number; PE?: number;
  };
}

type CreditClassificationState = {
  icBasketUsed: { ic1: boolean; ic2: boolean };
  hssCreditsAccumulated: number;
  /** Canonical codes already counted — used to skip duplicate/equivalent enrollments. */
  seenCanonicalCodes?: Set<string>;
};

/**
 * Same course offered under two codes (renumbered / theory-lab renames).
 * Both map to a single canonical code so only one enrollment of the pair counts.
 * e.g. EE-205 is the same course as EE-202 (Electromagnetics & Wave Propagation).
 */
const COURSE_EQUIVALENTS: Record<string, string> = {
  EE205: "EE202",
};

export interface MTPEligibility {
  eligible: boolean;
  reason?: string;
  creditsCompleted: number;
  creditsRequired?: number;
  semesterNumber: number;
  minSemesterRequired?: number;
}

interface BranchMapping {
  courseCategory: string;
  branch: string;
  batch?: string | null;
  splitCategory?: string | null;
  splitAmount?: number | null;
}

// `pickBranchMapping` / `pickBranchMappingCategory` now live in lib/courseCategory.ts
// (the single source of truth) and are imported above.

// Branches for which Design Practicum (IC202P) is NOT a compulsory Institute Core
// from Batch-24 onwards: Civil (CE), Engineering Physics (EP), Bioengineering (BE),
// and Chemical (CH / BSCS / BS). For these students IC202P is a Free Elective.
const DP_EXEMPT_BRANCHES = new Set(["CE", "EP", "BE", "CH", "BSCS", "BS"]);

function isDpExemptBranchBatch(branch?: string, batchYear?: number | null): boolean {
  if (!batchYear || batchYear < 2024) return false;
  const normalized = normalizeBranchCode(branch);
  return DP_EXEMPT_BRANCHES.has(normalized);
}

export class CreditCalculator {
  async calculateProgramProgress(
    userId: string,
    programId: string,
    options?: { minorCodes?: string[]; minorCountedCourseCodes?: string[] }
  ): Promise<ProgramProgress> {
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new Error("Program not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { doingMTP: true, doingMTP2: true, doingISTP: true, branch: true, batch: true, enrollmentId: true },
    });

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        // No programId filter — transcripts are per-user and may have stale/null programIds
      },
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
    });

    // Check if user has completed ISTP / MTP components (pass grade only)
    const normalizeCourseCode = (code: string) =>
      (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    const isPassingCompleted = (e: (typeof enrollments)[number]) =>
      e.status === EnrollmentStatus.COMPLETED && (!e.grade || e.grade !== "F");

    const mtp1Completed = enrollments.some(
      (e) => isPassingCompleted(e) && isMtp1CourseCode(e.course.code)
    );
    const mtp2Completed = enrollments.some(
      (e) => isPassingCompleted(e) && isMtp2CourseCode(e.course.code)
    );
    const istpCompleted = enrollments.some(
      (e) => isPassingCompleted(e) && normalizeCourseCode(e.course.code) === "DP301P"
    );

    // Derive individual project requirements from the combined field.
    // BTech: MTP=8, ISTP=4. BSCS: MTP=8, Research/Communication=6.
    const isBSProgram = program.code === "BSCS";
    const mtpCreditsFull = MTP_TOTAL_CREDITS;
    const istpCreditsFull = isBSProgram ? 0 : 4;
    const researchCredits = isBSProgram
      ? Math.max(0, program.mtpIstpCredits - MTP_TOTAL_CREDITS)
      : 0;

    // Infer batch year for batch-specific credit adjustments
    const inferredBatch = (() => {
      if (typeof user?.batch === "number" && user.batch > 2000) return user.batch;
      const enrollmentId = String(user?.enrollmentId || "").toUpperCase();
      const match = /B(\d{2})/i.exec(enrollmentId);
      if (match) return 2000 + Number.parseInt(match[1], 10);
      return null;
    })();

    // Batch-specific DC/DE adjustments (e.g. B25: EE-261→EE-265 adds 2cr to DC)
    const adjusted = getBatchAdjustedCredits(
      user?.branch ?? program.code,
      inferredBatch,
      { dcCredits: program.dcCredits, deCredits: program.deCredits },
    );
    const effectiveDcCredits = adjusted.dcCredits;

    // Adjust credit requirements based on user preferences (skip logic per IIT Mandi rules)
    let deCredits = adjusted.deCredits;
    let feCredits = program.feCredits;
    let mtpCredits = mtpCreditsFull;
    let istpCredits = istpCreditsFull;

    // GE Open Specialisation (plain "GE") merges the DE pool into Free Electives:
    // DC 36 + DE 0 + FE 52. Named GE tracks (GE-ROBO/MECH/COMM/FIN) keep the
    // program's DE 30 / FE 22 (they share the single "GE" program record).
    if (user?.branch === "GE") {
      const mergedFe = adjusted.deCredits + program.feCredits;
      deCredits = 0;
      feCredits = mergedFe;
    }

    {
      const isBatch22 = inferredBatch === 2022;

      const doingMTP1Pref = user?.doingMTP ?? true;
      const doingMTP2Pref = user?.doingMTP2 ?? true;
      const doingISTPPref = user?.doingISTP ?? true;

      // If ISTP is skipped (and not already completed), add 4 credits to FE
      if (!isBSProgram && !doingISTPPref && !istpCompleted) {
        if (isBatch22) {
          deCredits += 3;
          feCredits += 1;
        } else {
          feCredits += istpCreditsFull;
        }
        istpCredits = 0;
      }

      // MTP-1 and MTP-2 preferences are independent.
      if (!doingMTP1Pref && !mtp1Completed) {
        deCredits += MTP_COMPONENT_CREDITS;
        mtpCredits = Math.max(0, subtractCredits(mtpCredits, MTP_COMPONENT_CREDITS));
      }

      if (!doingMTP2Pref && !mtp2Completed) {
        deCredits += MTP_COMPONENT_CREDITS;
        mtpCredits = Math.max(0, subtractCredits(mtpCredits, MTP_COMPONENT_CREDITS));
      }
    }

    const required: CreditBreakdown = {
      core: program.icCredits + effectiveDcCredits,
      de: deCredits,
      pe: researchCredits, // reuse pe field for BS Research credits
      freeElective: feCredits,
      mtp: mtpCredits,
      istp: istpCredits,
      total: program.totalCreditsRequired,
    };

    const minorEligibleCourseCodes = buildNonMgmtMinorCountedCourseCodeSet(options?.minorCodes ?? []);
    const minorDeToFeCourseCodes = (() => {
      const selected = options?.minorCountedCourseCodes;
      if (selected === undefined) return minorEligibleCourseCodes;

      const selectedSet = new Set<string>();
      for (const raw of selected) {
        const formatted = formatCourseCode(String(raw ?? ""));
        if (formatted) selectedSet.add(formatted);
      }

      const out = new Set<string>();
      selectedSet.forEach((code) => {
        if (minorEligibleCourseCodes.has(code)) out.add(code);
      });
      return out;
    })();

    const classificationState: CreditClassificationState = {
      icBasketUsed: { ic1: false, ic2: false },
      hssCreditsAccumulated: 0,
      seenCanonicalCodes: new Set<string>(),
    };

    const completed = this.calculateCreditsByType(
      enrollments.filter((e) =>
        e.status === EnrollmentStatus.COMPLETED &&
        (!e.grade || e.grade !== "F") // Exclude failed courses
      ),
      user?.branch || undefined,
      minorDeToFeCourseCodes,
      user?.batch ?? null,
      classificationState,
      program.icCredits
    );

    const inProgress = this.calculateCreditsByType(
      enrollments.filter((e) => e.status === EnrollmentStatus.IN_PROGRESS),
      user?.branch || undefined,
      minorDeToFeCourseCodes,
      user?.batch ?? null,
      classificationState,
      program.icCredits
    );

    // DE overflow → FE: excess DE credits beyond requirement count as Free Electives
    const completedDeOverflow = Math.max(0, subtractCredits(completed.de, deCredits));
    completed.de = subtractCredits(completed.de, completedDeOverflow);
    completed.freeElective = addCredits(completed.freeElective, completedDeOverflow);

    const deStillNeeded = Math.max(0, subtractCredits(deCredits, completed.de));
    const inProgressDeOverflow = Math.max(0, subtractCredits(inProgress.de, deStillNeeded));
    inProgress.de = subtractCredits(inProgress.de, inProgressDeOverflow);
    inProgress.freeElective = addCredits(inProgress.freeElective, inProgressDeOverflow);

    const remaining: CreditBreakdown = {
      core: Math.max(0, subtractCredits(required.core, completed.core)),
      de: Math.max(0, subtractCredits(required.de, completed.de)),
      pe: Math.max(0, subtractCredits(required.pe, completed.pe)),
      freeElective: Math.max(0, subtractCredits(required.freeElective, completed.freeElective)),
      mtp: Math.max(0, subtractCredits(required.mtp, completed.mtp)),
      istp: Math.max(0, subtractCredits(required.istp, completed.istp)),
      total: Math.max(0, subtractCredits(required.total, completed.total)),
    };

    const percentage =
      required.total > 0 ? (completed.total / required.total) * 100 : 0;

    const hssReq = (program.icCredits ?? 60) <= 52 ? 12 : 15;
    return {
      programId,
      programName: program.name,
      programType: program.type,
      required,
      completed,
      inProgress,
      remaining,
      percentage: Math.min(100, Math.round(percentage * 10) / 10),
      creditsRequiredByCategory: {
        IC: Math.max(0, (program.icCredits ?? 60) - 6 - hssReq),
        IC_BASKET: 6,
        DC: effectiveDcCredits,
        DE: deCredits,
        FE: feCredits,
        HSS: hssReq,
        IKS: 0,
        MTP: mtpCredits,
        ISTP: istpCredits,
        PE: researchCredits,
      },
    };
  }

  async calculateMinorProgress(
    userId: string,
    majorProgramId: string,
    minorProgramId: string
  ): Promise<ProgramProgress & { overlappingCredits: number }> {
    const minorProgress = await this.calculateProgramProgress(
      userId,
      minorProgramId
    );

    // Calculate overlapping courses between major and minor
    const majorEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        programId: majorProgramId,
        status: EnrollmentStatus.COMPLETED,
      },
      select: { courseId: true, course: { select: { credits: true } } },
    });

    const minorEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        programId: minorProgramId,
        status: EnrollmentStatus.COMPLETED,
      },
      select: { courseId: true },
    });

    const majorCourseIds = new Set(majorEnrollments.map((e: { courseId: string }) => e.courseId));
    const overlappingCourses = minorEnrollments.filter((e: { courseId: string }) =>
      majorCourseIds.has(e.courseId)
    );

    const overlappingCredits = sumCredits(
      majorEnrollments
        .filter((e: { courseId: string; course: { credits: number } }) => overlappingCourses.some((o: { courseId: string }) => o.courseId === e.courseId))
        .map((e: { course: { credits: number } }) => e.course.credits)
    );

    return {
      ...minorProgress,
      overlappingCredits,
    };
  }

  async checkMTPEligibility(
    userId: string,
    programId: string
  ): Promise<MTPEligibility> {
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new Error("Program not found");
    }

    if (!program.minSemesterForMtp) {
      return {
        eligible: false,
        reason: "MTP is not required for this program",
        creditsCompleted: 0,
        semesterNumber: 0,
      };
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        programId,
        status: EnrollmentStatus.COMPLETED,
      },
      include: {
        course: true,
      },
    });

    const creditsCompleted = sumCredits(enrollments
      .filter((e: { grade?: string | null }) => !e.grade || e.grade !== "F")
      .map((e: { course: { credits: number } }) => e.course.credits));

    // Get current semester
    const allEnrollments = await prisma.courseEnrollment.findMany({
      where: { userId },
      orderBy: { semester: "desc" },
      take: 1,
    });

    const currentSemester = allEnrollments[0]?.semester || 0;

    // Check credit requirement
    if (
      program.minCreditsForMtp &&
      creditsCompleted < program.minCreditsForMtp
    ) {
      return {
        eligible: false,
        reason: `Need ${formatCredits(subtractCredits(program.minCreditsForMtp, creditsCompleted))} more credits`,
        creditsCompleted,
        creditsRequired: program.minCreditsForMtp,
        semesterNumber: currentSemester,
      };
    }

    // Check semester requirement
    if (
      program.minSemesterForMtp &&
      currentSemester < program.minSemesterForMtp
    ) {
      return {
        eligible: false,
        reason: `Can only register in semester ${program.minSemesterForMtp} or later`,
        creditsCompleted,
        semesterNumber: currentSemester,
        minSemesterRequired: program.minSemesterForMtp,
      };
    }

    return {
      eligible: true,
      creditsCompleted,
      semesterNumber: currentSemester,
    };
  }

  async checkISTPEligibility(
    userId: string,
    programId: string
  ): Promise<MTPEligibility> {
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new Error("Program not found");
    }

    // BSCS has MTP but no ISTP.
    if (program.code === "BSCS" || !program.minSemesterForMtp) {
      return {
        eligible: false,
        reason: "ISTP is not allowed for this program",
        creditsCompleted: 0,
        semesterNumber: 0,
      };
    }

    // ISTP usually has similar requirements to MTP
    return this.checkMTPEligibility(userId, programId);
  }

  private calculateCreditsByType(
    enrollments: Array<{
      course: {
        credits: number;
        code: string;
        branchMappings?: BranchMapping[];
      };
      courseType: CourseType;
      grade?: string | null;
      semester?: number;
      isInternship?: boolean;
    }>,
    branch?: string,
    minorDeToFeCourseCodes?: Set<string>,
    batchYear?: number | null,
    classificationState?: CreditClassificationState,
    programIcCredits?: number
  ): CreditBreakdown {
    const breakdown: CreditBreakdown = {
      core: 0,
      de: 0,
      pe: 0,
      freeElective: 0,
      mtp: 0,
      istp: 0,
      total: 0,
    };

    const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
    const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

    const IC_BASKET_COMPULSIONS = {
      BIO: { ic1: "IC136", ic2: "IC240" },
      CE:  { ic1: "IC230", ic2: "IC240" },
      CS:  { ic2: "IC253" },
      CSE: { ic2: "IC253" },
      DSE: { ic2: "IC253" },
      DSAI: { ic2: "IC253" }, // shares DSE's IC-basket compulsion
      EP:  { ic1: "IC230", ic2: "IC121" },
      ME:  { ic2: "IC240" },
      CH:  { ic1: "IC131", ic2: "IC121" },
      MNC: { ic1: "IC136", ic2: "IC253" },
      MS:  { ic1: "IC131", ic2: "IC241" },
      MSE: { ic1: "IC131", ic2: "IC241" },
      GE:  { ic1: "IC230", ic2: "IC240" },
      EE:  {},
      VLSI: {},
    } as Record<string, { ic1?: string; ic2?: string }>;

    // Sort enrollments by semester for IC basket first-course logic
    const sortedEnrollments = [...enrollments].sort(
      (a, b) => (a.semester || 0) - (b.semester || 0)
    );
    const state = classificationState ?? {
      icBasketUsed: { ic1: false, ic2: false },
      hssCreditsAccumulated: 0,
      seenCanonicalCodes: new Set<string>(),
    };
    const icBasketUsed = state.icBasketUsed;
    const seenCanonicalCodes = (state.seenCanonicalCodes ??= new Set<string>());

    // HSS+IKS combined basket: BTech = 15 core, BSCS = 12 core; above 20 → don't count, 16-20 (BTech) → FE
    let hssCreditsAccumulated = state.hssCreditsAccumulated;
    const HSS_CORE_CAP = (programIcCredits ?? 60) <= 52 ? 12 : 15; // BSCS: 12, BTech: 15
    const HSS_FE_CAP = 20;
    const addBreakdownCredits = (key: keyof CreditBreakdown, credits: number) => {
      breakdown[key] = addCredits(breakdown[key], credits);
    };
    const subtractBreakdownCredits = (key: keyof CreditBreakdown, credits: number) => {
      breakdown[key] = subtractCredits(breakdown[key], credits);
    };
    const addHssCredits = (credits: number) => {
      const prev = hssCreditsAccumulated;
      hssCreditsAccumulated = addCredits(hssCreditsAccumulated, credits);
      state.hssCreditsAccumulated = hssCreditsAccumulated;
      const corePortion = subtractCredits(
        minCredits(HSS_CORE_CAP, hssCreditsAccumulated),
        minCredits(HSS_CORE_CAP, prev)
      );
      const fePortion = Math.max(
        0,
        subtractCredits(
          minCredits(HSS_FE_CAP, hssCreditsAccumulated),
          maxCredits(HSS_CORE_CAP, prev)
        )
      );
      const ignored = subtractCredits(credits, corePortion, fePortion);
      addBreakdownCredits("core", corePortion);
      addBreakdownCredits("freeElective", fePortion);
      subtractBreakdownCredits("total", ignored); // undo the total increment for credits that don't count
    };

    const shouldOverrideDeToFe = (courseCode: string): boolean => {
      if (!minorDeToFeCourseCodes || minorDeToFeCourseCodes.size === 0) return false;
      const formatted = formatCourseCode(courseCode);
      if (!formatted) return false;
      return minorDeToFeCourseCodes.has(formatted);
    };

    const addDeCredits = (credits: number, courseCode: string) => {
      if (shouldOverrideDeToFe(courseCode)) {
        addBreakdownCredits("freeElective", credits);
      } else {
        addBreakdownCredits("de", credits);
      }
    };

    sortedEnrollments.forEach((enrollment) => {
      const credits = enrollment.course.credits;

      // Skip duplicate/equivalent enrollments: same course counted once only.
      // (e.g. EE-202 and EE-205 are the same Electromagnetics course.)
      const rawCode = enrollment.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const canonicalCode = COURSE_EQUIVALENTS[rawCode] ?? rawCode;
      if (seenCanonicalCodes.has(canonicalCode)) {
        return; // already counted an enrollment of this course — don't double-count
      }
      seenCanonicalCodes.add(canonicalCode);

      addBreakdownCredits("total", credits);

      // Internship courses (XX-399P / XX-396P) are always P/F FE for all branches
      if (enrollment.isInternship || /39[69]P$/i.test(enrollment.course.code)) {
        addBreakdownCredits("freeElective", credits);
        return;
      }

      const code = enrollment.course.code.toUpperCase();
      const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
      const isICB1 = ICB1_CODES.has(normalizedCode);
      const isICB2 = ICB2_CODES.has(normalizedCode);
      const isIkCourse = /^IK\d/.test(normalizedCode);

      // IC202P (Design Practicum) is NOT compulsory for CE/EP/BE(bio)/CH(chemical/BSCS)
      // from Batch-24 onwards — for those students it's a Free Elective, not Institute Core.
      // Checked BEFORE branchMappings so a stale IC mapping can't override it.
      if (normalizedCode === "IC202P" && isDpExemptBranchBatch(branch, batchYear)) {
        addBreakdownCredits("freeElective", credits);
        return;
      }

      // IC Basket compulsion logic - check BEFORE branchMappings
      if ((isICB1 || isICB2) && branch) {
        const basketBranch = normalizeBranchForIcBasket(branch);
        const branchCompulsion = IC_BASKET_COMPULSIONS[basketBranch] || {};
        
        if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
          addBreakdownCredits("core", credits);
          return;
        }
        
        if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
          addBreakdownCredits("core", credits);
          return;
        }
        
        // No compulsion - first course counts as core (IC_BASKET)
        if (isICB1 && !branchCompulsion.ic1 && !icBasketUsed.ic1) {
          icBasketUsed.ic1 = true;
          addBreakdownCredits("core", credits);
          return;
        }
        
        if (isICB2 && !branchCompulsion.ic2 && !icBasketUsed.ic2) {
          icBasketUsed.ic2 = true;
          addBreakdownCredits("core", credits);
          return;
        }
        
        // Non-compulsory IC basket course → check branch mapping before defaulting to FE
        // (e.g. IC-240 is ICB2 but mapped as DC for MSE)
        const basketFallbackCategory = pickBranchMappingCategory(enrollment.course.branchMappings, branch, batchYear);
        if (basketFallbackCategory === "DC") {
          addBreakdownCredits("core", credits);
        } else if (basketFallbackCategory === "DE") {
          addDeCredits(credits, enrollment.course.code);
        } else {
          addBreakdownCredits("freeElective", credits);
        }
        return;
      }

      // HS-xxx courses always go to HSS (cap logic), never let branch mapping override
      if (normalizedCode.startsWith("HS")) {
        addHssCredits(credits);
        return;
      }

      const matchedMapping = pickBranchMapping(enrollment.course.branchMappings, branch, batchYear);
      const mappedCategory = matchedMapping?.courseCategory;

      if (mappedCategory) {
        // IK-xxx courses (and IKS-mapped courses) → HSS+IKS combined basket.
        if (mappedCategory === "IKS") {
          addHssCredits(credits);
          return;
        }

        // Split credit handling: e.g. IN2406 counts 3cr as DC and 1cr as FE
        const splitCat = matchedMapping?.splitCategory;
        const splitAmt = matchedMapping?.splitAmount;
        if (splitCat && splitAmt != null && splitAmt > 0) {
          const mainCredits = subtractCredits(credits, splitAmt);
          const applyCategory = (cat: string, amt: number) => {
            switch (cat) {
              case "IC": case "IC_BASKET": case "DC": case "IKS":
                addBreakdownCredits("core", amt); break;
              case "HSS": addHssCredits(amt); break;
              case "DE": addDeCredits(amt, enrollment.course.code); break;
              case "FE": addBreakdownCredits("freeElective", amt); break;
              case "MTP": addBreakdownCredits("mtp", amt); break;
              case "ISTP": addBreakdownCredits("istp", amt); break;
              default: addBreakdownCredits("freeElective", amt);
            }
          };
          applyCategory(mappedCategory, mainCredits);
          applyCategory(splitCat, splitAmt);
          return;
        }

        switch (mappedCategory) {
          case "IC":
          case "IC_BASKET":
          case "DC":
            addBreakdownCredits("core", credits);
            return;
          case "IKS":
          case "HSS":
            // IKS and HSS are now one combined basket (BTech=15, BSCS=12 core; cap 20)
            addHssCredits(credits);
            return;
          case "DE":
            addDeCredits(credits, enrollment.course.code);
            return;
          case "FE":
            addBreakdownCredits("freeElective", credits);
            return;
          case "MTP":
            addBreakdownCredits("mtp", credits);
            return;
          case "ISTP":
            addBreakdownCredits("istp", credits);
            return;
          case "INTERNSHIP":
            addBreakdownCredits("freeElective", credits);
            return;
          case "BACKLOG":
            break;
          case "NA":
            addBreakdownCredits("freeElective", credits);
            return;
        }
      }

      if (isICB1 || isICB2) {
        addBreakdownCredits("core", credits);
        return;
      }

      // Apply prefix-based categorization (same as other components)
      if (normalizedCode === "IK593") {
        addBreakdownCredits("freeElective", credits);
        return;
      }
      if (normalizedCode === "IC181" || normalizedCode === "IC182") {
        addHssCredits(credits); // IKS merged into HSS+IKS basket
        return;
      }
      if (isIkCourse) {
        addHssCredits(credits); // IK-xxx → HSS+IKS basket
        return;
      }
      if (normalizedCode.startsWith("IC")) {
        addBreakdownCredits("core", credits);
        return;
      }
      if (normalizedCode.startsWith("HS")) {
        addHssCredits(credits);
        return;
      }

      const specialDpCategory = getSpecialDpCategory(normalizedCode);
      if (specialDpCategory === "FE") {
        addBreakdownCredits("freeElective", credits);
        return;
      }
      if (specialDpCategory === "ISTP") {
        addBreakdownCredits("istp", credits);
        return;
      }
      if (specialDpCategory === "MTP") {
        addBreakdownCredits("mtp", credits);
        return;
      }

      // Branch-specific course patterns
      if (branch === "CSE" && (normalizedCode.startsWith("DS") || normalizedCode.startsWith("CS"))) {
        addDeCredits(credits, enrollment.course.code);
        return;
      }
      if (isDataScienceBranch(branch) && (normalizedCode.startsWith("DS") || normalizedCode.startsWith("CS"))) {
        addDeCredits(credits, enrollment.course.code);
        return;
      }
      // Civil: any CE-xxx course not already matched as DC counts as a Discipline Elective.
      if (branch === "CE" && normalizedCode.startsWith("CE")) {
        addDeCredits(credits, enrollment.course.code);
        return;
      }

      // If the course has branchMappings defined but none matched this student's
      // branch, the course is NOT part of their curriculum → Free Elective.
      const hasMappings = enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0;
      if (hasMappings) {
        addBreakdownCredits("freeElective", credits);
        return;
      }

      // No branchMappings at all — fall back to courseType.
      switch (enrollment.courseType) {
        case CourseType.CORE:
          addBreakdownCredits("core", credits);
          break;
        case CourseType.DE:
          addDeCredits(credits, enrollment.course.code);
          break;
        case CourseType.PE:
          addBreakdownCredits("pe", credits);
          break;
        case CourseType.FREE_ELECTIVE:
          addBreakdownCredits("freeElective", credits);
          break;
        case CourseType.MTP:
          addBreakdownCredits("mtp", credits);
          break;
        case CourseType.ISTP:
          addBreakdownCredits("istp", credits);
          break;
        default:
          addBreakdownCredits("freeElective", credits);
      }
    });

    return breakdown;
  }

  async getAvailableDECourses(
    userId: string,
    programId: string
  ): Promise<Array<{ id: string; code: string; name: string; credits: number }>> {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        courses: {
          where: {
            courseType: CourseType.DE,
          },
          include: {
            course: {
              include: {
                prerequisites: {
                  include: {
                    prerequisite: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!program) {
      return [];
    }

    // Get completed courses
    const completedCourses = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        status: EnrollmentStatus.COMPLETED,
      },
      select: { courseId: true },
    });

    const completedCourseIds = new Set(completedCourses.map((c: { courseId: string }) => c.courseId));

    // Filter courses where prerequisites are met
    const availableCourses = program.courses
      .filter((pc: any) => {
        // Check if already completed
        if (completedCourseIds.has(pc.course.id)) {
          return false;
        }

        // Check prerequisites
        const allPrereqsMet = pc.course.prerequisites.every((prereq: { prerequisiteId: string }) =>
          completedCourseIds.has(prereq.prerequisiteId)
        );

        return allPrereqsMet && pc.course.isActive;
      })
      .map((pc: any) => ({
        id: pc.course.id,
        code: pc.course.code,
        name: pc.course.name,
        credits: pc.course.credits,
      }));

    return availableCourses;
  }
}

export const creditCalculator = new CreditCalculator();
