import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { courseIdentityKey } from "@/lib/courseIdentity";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";
import { getSpecialDpCourseType } from "@/lib/specialCourseCategories";
import { getMtpComponent, isMtp1CourseCode, isMtp2CourseCode } from "@/lib/mtpConfig";
import { EnrollmentStatus } from "@prisma/client";
import {
  PASS_FAIL_LIMITS,
  isOnsiteSemesterInternshipCourse,
  isSemesterInternshipCourse,
  validateOnsiteInternshipExclusivity,
  validateOnsiteInternshipPassFailBudget,
} from "@/lib/course-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log("🔐 Session:", session?.user?.email);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { enrollments } = body;
    
    console.log(`📋 Received ${enrollments?.length || 0} enrollments from ${session.user.email}`);

    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      return NextResponse.json(
        { error: "Invalid enrollments data" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        batch: true,
        enrollmentId: true,
        branch: true,
        doingMTP: true,
        doingMTP2: true,
        doingISTP: true,
        programs: {
          where: { isPrimary: true },
          select: { programId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get primary program ID for enrollments
    let primaryProgramId = user.programs[0]?.programId || null;

    // If no primary program, try to auto-enroll based on branch
    if (!primaryProgramId && user.branch) {
      console.log(`Auto-enrolling user in ${user.branch} program...`);

      const program = await prisma.program.findUnique({
        where: { code: getProgramLookupBranchCode(user.branch, user.batch) },
      });

      if (program) {
        const userProgram = await prisma.userProgram.create({
          data: {
            userId: user.id,
            programId: program.id,
            programType: "MAJOR",
            isPrimary: true,
            startSemester: 1,
            status: "ACTIVE",
          },
        });
        primaryProgramId = userProgram.programId;
        console.log(`✅ Auto-enrolled in ${user.branch} program`);
      }
    }

    if (!primaryProgramId) {
      return NextResponse.json(
        { error: "No program found. Please enroll in a program first." },
        { status: 400 }
      );
    }

    // currentSemester from payload tells us which sems are "past" (→ COMPLETED)
    const currentSemester: number = body.currentSemester ?? 99;

    // Map curriculum category codes to CourseType enum values
    const categoryToCourseType: Record<
      string,
      "CORE" | "DE" | "PE" | "FREE_ELECTIVE" | "MTP" | "ISTP"
    > = {
      IC: "CORE",
      ICB: "CORE",
      DC: "CORE",
      HSS: "CORE",
      IKS: "CORE",
      DE: "DE",
      FE: "FREE_ELECTIVE",
      MTP: "MTP",
      ISTP: "ISTP",
      INTERNSHIP: "FREE_ELECTIVE",
    };

    const results: Array<{ courseCode: string; action: string; id: string }> = [];
    const errors: Array<{ courseCode: string; error: string }> = [];

    const normalizeCourseCode = (code: string) =>
      code.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");

    const toHyphenatedCode = (code: string) => {
      const normalized = normalizeCourseCode(code);
      const match = normalized.match(/^([A-Z]+)(\d{3}[A-Z]?)$/);
      if (match) return `${match[1]}-${match[2]}`;
      return normalized;
    };

    const buildCodeCandidates = (code: string) => {
      const normalized = normalizeCourseCode(code);
      const hyphenated = toHyphenatedCode(code);
      const mtpComponent = getMtpComponent(code);
      const genericMtpCode = mtpComponent === 1 ? "DP-498P" : mtpComponent === 2 ? "DP-499P" : "";
      const genericMtpSpacedCode = mtpComponent === 1 ? "DP 498P" : mtpComponent === 2 ? "DP 499P" : "";
      // Also try original case-insensitive
      const original = code.trim();
      return Array.from(new Set([normalized, hyphenated, original, genericMtpCode, genericMtpSpacedCode].filter(Boolean)));
    };

    const inferBatchYear = (
      batch: number | null | undefined,
      enrollmentId: string | null | undefined
    ) => {
      if (enrollmentId) {
        const match = enrollmentId.match(/B(\d{2})/i);
        if (match) return 2000 + parseInt(match[1], 10);
      }
      if (batch && batch > 2000) return batch;
      return new Date().getFullYear() - 3;
    };

    let doingMTP1Pref = user.doingMTP ?? true;
    let doingMTP2Pref = user.doingMTP2 ?? true;
    let doingISTPPref = user.doingISTP ?? true;

    const maybeEnableProjectPrefsForCourse = async (normalizedCode: string) => {
      const updates: { doingMTP?: boolean; doingMTP2?: boolean; doingISTP?: boolean } = {};

      if (normalizedCode === "DP301P" && !doingISTPPref) {
        updates.doingISTP = true;
        doingISTPPref = true;
      }

      if (isMtp1CourseCode(normalizedCode) && !doingMTP1Pref) {
        updates.doingMTP = true;
        doingMTP1Pref = true;
      }

      if (isMtp2CourseCode(normalizedCode) && !doingMTP2Pref) {
        updates.doingMTP2 = true;
        doingMTP2Pref = true;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    };

    const existingActiveEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId: user.id,
        status: { notIn: [EnrollmentStatus.DROPPED, EnrollmentStatus.FAILED] },
      },
      select: {
        id: true,
        semester: true,
        year: true,
        term: true,
        status: true,
        isPassFail: true,
        passFailCredits: true,
        course: {
          select: {
            code: true,
          },
        },
      },
    });

    const existingByIdentity = new Map<string, (typeof existingActiveEnrollments)>();
    for (const e of existingActiveEnrollments) {
      const key = courseIdentityKey(e.course.code);
      if (!key) continue;
      const list = existingByIdentity.get(key) ?? [];
      list.push(e);
      existingByIdentity.set(key, list);
    }

    let passFailCreditsUsed = existingActiveEnrollments
      .filter((enrollment) => enrollment.isPassFail)
      .reduce((sum, enrollment) => sum + Number(enrollment.passFailCredits || 0), 0);
    const passFailCreditsBySemester = new Map<number, number>();
    existingActiveEnrollments
      .filter((enrollment) => enrollment.isPassFail)
      .forEach((enrollment) => {
        passFailCreditsBySemester.set(
          enrollment.semester,
          (passFailCreditsBySemester.get(enrollment.semester) ?? 0) +
            Number(enrollment.passFailCredits || 0)
        );
      });
    const passFailEligibleCategories = new Set(["FE", "HSS", "IKS", "DE"]);

    for (const enrollment of enrollments) {
      try {
        const { courseCode, semester, grade } = enrollment as {
          courseCode: string;
          semester: number;
          grade?: string;
          courseType?: string;
        };

        const rawType = (enrollment as any).courseType as string;
        const registrationType = String((enrollment as any).registrationType ?? "REGULAR");
        if (!["REGULAR", "PASS_FAIL", "AUDIT"].includes(registrationType)) {
          errors.push({ courseCode, error: "Invalid registration type." });
          continue;
        }
        const requestedAudit = registrationType === "AUDIT";
        const requestedPassFail = registrationType === "PASS_FAIL";
        let courseType = categoryToCourseType[rawType] ?? "CORE";

        const codeCandidates = buildCodeCandidates(courseCode);
        const course = await prisma.course.findFirst({
          where: { code: { in: codeCandidates, mode: 'insensitive' } },
        });

        if (!course) {
          console.error(`❌ Course not found: ${courseCode} (tried: ${codeCandidates.join(', ')})`);
          errors.push({ 
            courseCode, 
            error: `Course not found. Tried: ${codeCandidates.join(', ')}` 
          });
          continue;
        }

        const identityKey = courseIdentityKey(course.code);
        if (!identityKey) {
          errors.push({ courseCode, error: "Invalid course code." });
          continue;
        }

        const existingSameIdentity = existingByIdentity.get(identityKey) ?? [];
        const existingInSameSemester = existingSameIdentity.find((e) => e.semester === semester);

        if (existingSameIdentity.length > 0 && !existingInSameSemester) {
          const other = existingSameIdentity[0];
          errors.push({
            courseCode,
            error: `Already enrolled in this course in Semester ${other.semester} (${other.term} ${other.year}). Remove it before importing again in a different semester.`,
          });
          continue;
        }

        // Determine correct academic year from batch + semester number.
        // Fall (odd) opens the academic year, Spring (even) is the next calendar year:
        //   Sem 1 = FALL batchYear, Sem 2 = SPRING batchYear+1, Sem 3 = FALL batchYear+1,
        //   Sem 4 = SPRING batchYear+2, ... → year = batchYear + floor(semester / 2).
        const batchYear = inferBatchYear(user.batch, user.enrollmentId);
        const semYear = batchYear + Math.floor(semester / 2);
        const term = semester % 2 === 1 ? "FALL" : "SPRING";

        // Past semesters are COMPLETED; current sem depends on whether grade given
        const isPastSemester = semester < currentSemester;
        const normalizedCode = normalizeCourseCode(course.code);
        const is399PCourse = isOnsiteSemesterInternshipCourse(course.code);
        const isInternshipCourse = isSemesterInternshipCourse(course.code);
        const isPassFail = isInternshipCourse || requestedPassFail;
        const isAudit = requestedAudit && !isInternshipCourse;
        const status = isAudit
          ? EnrollmentStatus.AUDIT
          : grade
            ? EnrollmentStatus.COMPLETED
            : isPastSemester
              ? EnrollmentStatus.COMPLETED
              : EnrollmentStatus.IN_PROGRESS;
        if (requestedPassFail && !isInternshipCourse && !passFailEligibleCategories.has(rawType)) {
          errors.push({
            courseCode,
            error: "P/F is available only for Free Electives, HSS+IKS, or Discipline Electives.",
          });
          continue;
        }
        if (isPassFail) courseType = "FREE_ELECTIVE";
        const specialDpCourseType = getSpecialDpCourseType(normalizedCode);
        if (specialDpCourseType && !isInternshipCourse) courseType = specialDpCourseType;
        await maybeEnableProjectPrefsForCourse(normalizedCode);

        const previousPassFailCredits = existingInSameSemester?.isPassFail
          ? Number(existingInSameSemester.passFailCredits || 0)
          : 0;
        const nextPassFailCredits = isPassFail ? Number(course.credits || 0) : 0;
        const currentSemesterPassFail = passFailCreditsBySemester.get(semester) ?? 0;
        const nextTotalPassFail = passFailCreditsUsed - previousPassFailCredits + nextPassFailCredits;
        const nextSemesterPassFail = currentSemesterPassFail - previousPassFailCredits + nextPassFailCredits;

        const exclusivity = await validateOnsiteInternshipExclusivity(
          user.id,
          semester,
          course.code,
          existingInSameSemester?.id
        );
        if (!exclusivity.allowed) {
          errors.push({ courseCode, error: exclusivity.reason || "399P enrollment conflict." });
          continue;
        }

        if (is399PCourse) {
          const pfBudget = await validateOnsiteInternshipPassFailBudget(
            user.id,
            Number(course.credits || 0),
            existingInSameSemester?.id
          );
          if (!pfBudget.allowed) {
            errors.push({ courseCode, error: pfBudget.reason || "399P must use the complete P/F allowance." });
            continue;
          }
        } else {
          if (nextTotalPassFail > PASS_FAIL_LIMITS.TOTAL_CREDITS) {
            errors.push({
              courseCode,
              error: `Cannot exceed ${PASS_FAIL_LIMITS.TOTAL_CREDITS} total P/F credits.`,
            });
            continue;
          }
          if (nextSemesterPassFail > PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS) {
            errors.push({
              courseCode,
              error: `Cannot exceed ${PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS} P/F credits in Semester ${semester}.`,
            });
            continue;
          }
        }

        if (existingInSameSemester) {
          const updated = await prisma.courseEnrollment.update({
            where: { id: existingInSameSemester.id },
            data: {
              courseType,
              grade: isAudit ? null : grade || null,
              status,
              isPassFail,
              passFailCredits: nextPassFailCredits,
              isInternship: isInternshipCourse,
              year: semYear,
              term,
              programId: primaryProgramId,
            },
          });
          results.push({ courseCode, action: "updated", id: updated.id });
        } else {
          const created = await prisma.courseEnrollment.create({
            data: {
              userId: user.id,
              courseId: course.id,
              semester,
              year: semYear,
              term,
              courseType: courseType || "CORE",
              grade: isAudit ? null : grade || null,
              status,
              isPassFail,
              passFailCredits: nextPassFailCredits,
              isInternship: isInternshipCourse,
              programId: primaryProgramId,
            },
          });
          results.push({ courseCode, action: "created", id: created.id });

          const nextList = existingByIdentity.get(identityKey) ?? [];
          nextList.push({
            id: created.id,
            semester,
            year: semYear,
            term,
            status,
            isPassFail,
            passFailCredits: nextPassFailCredits,
            course: { code: course.code },
          });
          existingByIdentity.set(identityKey, nextList);
        }

        passFailCreditsUsed = is399PCourse
          ? PASS_FAIL_LIMITS.TOTAL_CREDITS
          : nextTotalPassFail;
        passFailCreditsBySemester.set(
          semester,
          is399PCourse ? PASS_FAIL_LIMITS.TOTAL_CREDITS : nextSemesterPassFail
        );
      } catch (error) {
        console.error(`Error processing ${(enrollment as any).courseCode}:`, error);
        errors.push({
          courseCode: String((enrollment as any).courseCode),
          error: String(error),
        });
      }
    }

    const summary = {
      total: enrollments.length,
      successful: results.length,
      failed: errors.length,
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { totalPassFailCredits: passFailCreditsUsed },
    });

    console.log(`✅ Import complete: ${summary.successful} success, ${summary.failed} failed`);

    if (summary.successful === 0) {
      console.error("❌ No courses imported, errors:", errors);
      return NextResponse.json(
        {
          success: false,
          error: "No courses were imported.",
          results,
          errors,
          summary,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary,
    });
  } catch (error) {
    console.error("Bulk enrollment error:", error);
    return NextResponse.json(
      { error: "Failed to create enrollments" },
      { status: 500 }
    );
  }
}

