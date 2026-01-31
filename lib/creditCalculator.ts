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

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId,
        programId,
      },
      include: {
        course: true,
      },
    });

    const required: CreditBreakdown = {
      core: program.coreCredits,
      de: program.deCredits,
      pe: program.peCredits,
      freeElective: program.freeElectiveCredits,
      mtp: program.mtpCredits,
      istp: program.istpCredits,
      total: program.totalCreditsRequired,
    };

    const completed = this.calculateCreditsByType(
      enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED)
    );

    const inProgress = this.calculateCreditsByType(
      enrollments.filter((e) => e.status === EnrollmentStatus.IN_PROGRESS)
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

    if (!program.mtpRequired) {
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

    const creditsCompleted = enrollments.reduce(
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

    if (!program.istpAllowed) {
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
      course: { credits: number };
      courseType: CourseType;
    }>
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

    enrollments.forEach((enrollment) => {
      const credits = enrollment.course.credits;
      breakdown.total += credits;

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
