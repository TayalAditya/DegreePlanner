import { CourseType, EnrollmentStatus, ProgramType } from "@prisma/client";
import prisma from "@/lib/prisma";

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
}

export interface MTPEligibility {
  eligible: boolean;
  reason?: string;
  creditsCompleted: number;
  creditsRequired?: number;
  semesterNumber: number;
  minSemesterRequired?: number;
}

export class CreditCalculator {
  async calculateProgramProgress(
    userId: string,
    programId: string
  ): Promise<ProgramProgress> {
    const program = await prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new Error("Program not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { doingMTP: true, doingISTP: true, branch: true },
    });

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        programId,
      },
      include: {
        course: {
          include: {
            branchMappings: {
              select: {
                courseCategory: true,
                branch: true,
              },
            },
          },
        },
      },
    });

    // Check if user has completed MTP-1 (but not MTP-2) — for partial MTP skip logic
    const mtp1Completed = enrollments.some(
      (e) => e.status === EnrollmentStatus.COMPLETED &&
      e.course.code.endsWith("498P") // MTP-1 course code pattern
    );
    const mtp2Completed = enrollments.some(
      (e) => e.status === EnrollmentStatus.COMPLETED &&
      e.course.code.endsWith("499P") // MTP-2 course code pattern
    );

    // Derive individual MTP/ISTP credits from the combined field (BSCS has Research=14, BTech has 12)
    // For BTech: MTP=8, ISTP=4. For BSCS: no MTP/ISTP (mtpIstpCredits=14 is Research)
    const isBSProgram = program.code === "BSCS";
    const mtpCreditsFull = isBSProgram ? 0 : 8;
    const istpCreditsFull = isBSProgram ? 0 : 4;
    const researchCredits = isBSProgram ? program.mtpIstpCredits : 0;

    // Adjust credit requirements based on user preferences (skip logic per IIT Mandi rules)
    let deCredits = program.deCredits;
    let feCredits = program.feCredits;
    let mtpCredits = mtpCreditsFull;
    let istpCredits = istpCreditsFull;

    if (!isBSProgram) {
      // If ISTP is skipped, add 4 credits to FE
      if (!user?.doingISTP) {
        feCredits += istpCredits; // +4 credits to FE
        istpCredits = 0;
      }

      // If MTP is skipped completely, add 8 credits to DE
      if (!user?.doingMTP && !mtp1Completed) {
        deCredits += mtpCredits; // +8 credits to DE
        mtpCredits = 0;
      }
      // If MTP-1 done but MTP-2 will be skipped, add 5 credits to DE
      else if (mtp1Completed && !mtp2Completed && !user?.doingMTP) {
        deCredits += 5; // +5 credits for skipping MTP-2
        mtpCredits = 3; // Only MTP-1 (3 credits) required
      }
    }

    const required: CreditBreakdown = {
      core: program.icCredits + program.dcCredits, // IC + DC = "core" in IIT Mandi terms
      de: deCredits,
      pe: researchCredits, // reuse pe field for BS Research credits
      freeElective: feCredits,
      mtp: mtpCredits,
      istp: istpCredits,
      total: program.totalCreditsRequired,
    };

    const completed = this.calculateCreditsByType(
      enrollments.filter((e) => 
        e.status === EnrollmentStatus.COMPLETED && 
        (!e.grade || e.grade !== "F") // Exclude failed courses
      ),
      user?.branch || undefined
    );

    const inProgress = this.calculateCreditsByType(
      enrollments.filter((e) => e.status === EnrollmentStatus.IN_PROGRESS),
      user?.branch || undefined
    );

    const remaining: CreditBreakdown = {
      core: Math.max(0, required.core - completed.core),
      de: Math.max(0, required.de - completed.de),
      pe: Math.max(0, required.pe - completed.pe),
      freeElective: Math.max(0, required.freeElective - completed.freeElective),
      mtp: Math.max(0, required.mtp - completed.mtp),
      istp: Math.max(0, required.istp - completed.istp),
      total: Math.max(0, required.total - completed.total),
    };

    const percentage =
      required.total > 0 ? (completed.total / required.total) * 100 : 0;

    return {
      programId,
      programName: program.name,
      programType: program.type,
      required,
      completed,
      inProgress,
      remaining,
      percentage: Math.min(100, Math.round(percentage * 10) / 10),
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

    const overlappingCredits = majorEnrollments
      .filter((e: { courseId: string; course: { credits: number } }) => overlappingCourses.some((o: { courseId: string }) => o.courseId === e.courseId))
      .reduce((sum: number, e: { course: { credits: number } }) => sum + e.course.credits, 0);

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

    // BSCS has no MTP (it uses Research credits instead); minSemesterForMtp=0 means no MTP
    if (program.code === "BSCS" || !program.minSemesterForMtp) {
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

    const creditsCompleted = enrollments
      .filter((e: { grade?: string | null }) => !e.grade || e.grade !== "F")
      .reduce(
        (sum: number, e: { course: { credits: number } }) => sum + e.course.credits,
        0
      );

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
        reason: `Need ${program.minCreditsForMtp - creditsCompleted} more credits`,
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

    // BSCS has no ISTP; minSemesterForMtp=0 means no MTP/ISTP
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
        branchMappings?: Array<{ courseCategory: string; branch: string }>;
      };
      courseType: CourseType;
      grade?: string | null;
      semester?: number;
    }>,
    branch?: string
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

    const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
      BIO: { ic1: "IC136", ic2: "IC240" },
      CE: { ic1: "IC230", ic2: "IC240" },
      CS: { ic2: "IC253" },
      CSE: { ic2: "IC253" },
      DSE: { ic2: "IC253" },
      EP: { ic1: "IC230", ic2: "IC121" },
      ME: { ic2: "IC240" },
      CH: { ic1: "IC131", ic2: "IC121" },
      MNC: { ic1: "IC136", ic2: "IC253" },
      MS: { ic1: "IC131", ic2: "IC240" },
      GE: { ic1: "IC230", ic2: "IC240" },
      EE: {},
      VLSI: {},
    };

    // Sort enrollments by semester for IC basket first-course logic
    const sortedEnrollments = [...enrollments].sort(
      (a, b) => (a.semester || 0) - (b.semester || 0)
    );
    const icBasketUsed = { ic1: false, ic2: false };

    // HSS cap: first 12 credits → core, next 8 (13–20) → FE, above 20 → don't count
    let hssCreditsAccumulated = 0;
    const HSS_CORE_CAP = 12;
    const HSS_FE_CAP = 20;
    const addHssCredits = (credits: number) => {
      const prev = hssCreditsAccumulated;
      hssCreditsAccumulated += credits;
      const corePortion = Math.min(HSS_CORE_CAP, hssCreditsAccumulated) - Math.min(HSS_CORE_CAP, prev);
      const fePortion = Math.max(0, Math.min(HSS_FE_CAP, hssCreditsAccumulated) - Math.max(HSS_CORE_CAP, prev));
      const ignored = credits - corePortion - fePortion;
      breakdown.core += corePortion;
      breakdown.freeElective += fePortion;
      breakdown.total -= ignored; // undo the total increment for credits that don't count
    };

    sortedEnrollments.forEach((enrollment) => {
      const credits = enrollment.course.credits;
      breakdown.total += credits;

      const code = enrollment.course.code.toUpperCase();
      const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
      const isICB1 = ICB1_CODES.has(normalizedCode);
      const isICB2 = ICB2_CODES.has(normalizedCode);

      // IC Basket compulsion logic - check BEFORE branchMappings
      if ((isICB1 || isICB2) && branch) {
        const branchCompulsion = IC_BASKET_COMPULSIONS[branch] || {};
        
        if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
          breakdown.core += credits;
          return;
        }
        
        if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
          breakdown.core += credits;
          return;
        }
        
        // No compulsion - first course counts as core (IC_BASKET)
        if (isICB1 && !branchCompulsion.ic1 && !icBasketUsed.ic1) {
          icBasketUsed.ic1 = true;
          breakdown.core += credits;
          return;
        }
        
        if (isICB2 && !branchCompulsion.ic2 && !icBasketUsed.ic2) {
          icBasketUsed.ic2 = true;
          breakdown.core += credits;
          return;
        }
        
        // Non-compulsory IC basket course → FE
        breakdown.freeElective += credits;
        return;
      }

      const mappingBranch = branch === "CSE" ? "CS" : branch;
      const mappedCategory = enrollment.course.branchMappings
        ? ((mappingBranch
          ? enrollment.course.branchMappings.find(
              (m) => m.branch === mappingBranch || m.branch === "COMMON"
            )?.courseCategory
          : undefined) || (branch && branch.startsWith("GE")
            ? enrollment.course.branchMappings.find((m) => m.branch.startsWith("GE"))?.courseCategory
            : undefined) || (enrollment.course.branchMappings.length === 1
              ? enrollment.course.branchMappings[0]?.courseCategory
              : undefined))
        : undefined;

      if (mappedCategory) {
        switch (mappedCategory) {
          case "IC":
          case "IC_BASKET":
          case "DC":
          case "IKS":
            breakdown.core += credits;
            return;
          case "HSS":
            addHssCredits(credits);
            return;
          case "DE":
            breakdown.de += credits;
            return;
          case "FE":
            breakdown.freeElective += credits;
            return;
          case "MTP":
            breakdown.mtp += credits;
            return;
          case "ISTP":
            breakdown.istp += credits;
            return;
          case "INTERNSHIP":
          case "BACKLOG":
            break;
          case "NA":
            breakdown.freeElective += credits;
            return;
        }
      }

      if (isICB1 || isICB2) {
        breakdown.core += credits;
        return;
      }

      // Apply prefix-based categorization (same as other components)
      if (normalizedCode === "IC181") {
        breakdown.core += credits; // IKS
        return;
      }
      if (normalizedCode.startsWith("IC")) {
        breakdown.core += credits;
        return;
      }
      if (normalizedCode.startsWith("HS")) {
        addHssCredits(credits);
        return;
      }
      if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) {
        breakdown.core += credits;
        return;
      }

      // Special DP codes (ISTP/MTP don't contain "ISTP"/"MTP" in the code)
      if (normalizedCode === "DP301P") {
        breakdown.istp += credits;
        return;
      }
      if (normalizedCode === "DP498P" || normalizedCode === "DP499P") {
        breakdown.mtp += credits;
        return;
      }
      if (normalizedCode.includes("MTP")) {
        breakdown.mtp += credits;
        return;
      }
      if (normalizedCode.includes("ISTP")) {
        breakdown.istp += credits;
        return;
      }

      // Branch-specific course patterns
      if (branch === "CSE" && normalizedCode.startsWith("DS")) {
        breakdown.de += credits;
        return;
      }
      if (branch === "DSE" && (normalizedCode.startsWith("DS") || normalizedCode.startsWith("CS"))) {
        breakdown.de += credits;
        return;
      }

      // Fall back to courseType
      switch (enrollment.courseType) {
        case CourseType.CORE:
          breakdown.core += credits;
          break;
        case CourseType.DE:
          breakdown.de += credits;
          break;
        case CourseType.PE:
          breakdown.pe += credits;
          break;
        case CourseType.FREE_ELECTIVE:
          breakdown.freeElective += credits;
          break;
        case CourseType.MTP:
          breakdown.mtp += credits;
          break;
        case CourseType.ISTP:
          breakdown.istp += credits;
          break;
        default:
          breakdown.core += credits; // Default to core (DC)
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
