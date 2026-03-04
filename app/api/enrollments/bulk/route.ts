import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { courseIdentityKey } from "@/lib/courseIdentity";
import { EnrollmentStatus } from "@prisma/client";

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
        where: { code: user.branch },
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
      // Also try original case-insensitive
      const original = code.trim();
      return Array.from(new Set([normalized, hyphenated, original]));
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
    let doingMTP2Pref = user.doingMTP2 ?? doingMTP1Pref;
    let doingISTPPref = user.doingISTP ?? true;

    const maybeEnableProjectPrefsForCourse = async (normalizedCode: string) => {
      const updates: { doingMTP?: boolean; doingMTP2?: boolean; doingISTP?: boolean } = {};

      if (normalizedCode === "DP301P" && !doingISTPPref) {
        updates.doingISTP = true;
        doingISTPPref = true;
      }

      if (normalizedCode === "DP498P" && !doingMTP1Pref) {
        updates.doingMTP = true;
        doingMTP1Pref = true;
      }

      if (normalizedCode === "DP499P" && (!doingMTP1Pref || !doingMTP2Pref)) {
        updates.doingMTP = true;
        updates.doingMTP2 = true;
        doingMTP1Pref = true;
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

    for (const enrollment of enrollments) {
      try {
        const { courseCode, semester, grade } = enrollment as {
          courseCode: string;
          semester: number;
          grade?: string;
          courseType?: string;
        };

        const rawType = (enrollment as any).courseType as string;
        const courseType = categoryToCourseType[rawType] ?? "CORE";

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

        // Determine correct academic year from batch + semester number
        // Sem 1 = FALL batchYear, Sem 2 = SPRING batchYear+1, Sem 3 = FALL batchYear+1 ...
        const batchYear = inferBatchYear(user.batch, user.enrollmentId);
        const semYear = batchYear + Math.floor((semester - 1) / 2);
        const term = semester % 2 === 1 ? "FALL" : "SPRING";

        // Past semesters are COMPLETED; current sem depends on whether grade given
        const isPastSemester = semester < currentSemester;
        const status =
          grade ? "COMPLETED" : isPastSemester ? "COMPLETED" : "IN_PROGRESS";

        const normalizedCode = normalizeCourseCode(course.code);
        await maybeEnableProjectPrefsForCourse(normalizedCode);

        if (existingInSameSemester) {
          const updated = await prisma.courseEnrollment.update({
            where: { id: existingInSameSemester.id },
            data: {
              courseType,
              grade,
              status,
              year: semYear,
              term,
              programId: primaryProgramId,
            },
          });
          results.push({ courseCode, action: "updated", id: updated.id });
        } else {
          // Semester-long onsite internship constraint (e.g., DP-399P):
          // If any *399P course is enrolled in semester 6/7, no other courses are allowed in that semester.
          if (semester === 6 || semester === 7) {
            const is399PCourse = normalizedCode.endsWith("399P");
            const semesterEnrollments = await prisma.courseEnrollment.findMany({
              where: {
                userId: user.id,
                semester,
                status: { not: "DROPPED" },
              },
              select: {
                id: true,
                course: { select: { code: true } },
              },
            });

            const semesterHas399P = semesterEnrollments.some((e) =>
              normalizeCourseCode(e.course.code).endsWith("399P")
            );

            if (is399PCourse && semesterEnrollments.length > 0) {
              errors.push({
                courseCode,
                error:
                  "Cannot enroll in a 399P course with other courses in semester 6/7. Remove other courses from that semester first.",
              });
              continue;
            }

            if (!is399PCourse && semesterHas399P) {
              errors.push({
                courseCode,
                error:
                  "Cannot enroll in any other course in semester 6/7 while a 399P course is enrolled.",
              });
              continue;
            }
          }

          const created = await prisma.courseEnrollment.create({
            data: {
              userId: user.id,
              courseId: course.id,
              semester,
              year: semYear,
              term,
              courseType: courseType || "CORE",
              grade,
              status,
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
            course: { code: course.code },
          });
          existingByIdentity.set(identityKey, nextList);
        }
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

