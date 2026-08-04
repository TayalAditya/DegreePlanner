import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClassType, DayOfWeek, EnrollmentStatus } from "@prisma/client";
import { getCurrentTimetableContext } from "@/lib/timetable";
import { isApproveableSlot } from "@/lib/timetableSlots";
import officialTimetableData from "@/lib/timetable-autofill-data.json";
import {
  buildOfficialCourseMeetings,
  parseOfficialCorrectionNotes,
  withOfficialCorrectionMarker,
  type OfficialTimetableData,
} from "@/lib/officialTimetable";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    const normalizedCode = (code: string) => code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const [currentEnrollments, completedEnrollments, savedPlan, profile, equivalencies, adminOfferings] = await Promise.all([
      prisma.courseEnrollment.findMany({
        where: {
          userId: session.user.id,
          semester: context.semester,
          year: context.year,
          term: context.term,
          status: EnrollmentStatus.IN_PROGRESS,
        },
        include: { course: { select: { id: true, code: true, name: true, credits: true, ltpc: true } } },
        orderBy: [{ course: { code: "asc" } }],
      }),
      prisma.courseEnrollment.findMany({
        where: { userId: session.user.id, status: EnrollmentStatus.COMPLETED },
        include: { course: { select: { id: true, code: true, name: true, credits: true, ltpc: true } } },
        orderBy: [{ updatedAt: "desc" }],
        distinct: ["courseId"],
      }),
      prisma.preRegistrationPlan.findUnique({
        where: {
          userId_offeringSemester_offeringYear: {
            userId: session.user.id,
            offeringSemester: context.semester,
            offeringYear: context.year,
          },
        },
        select: { selectedIds: true, registrationTypes: true },
      }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { branch: true, batch: true } }),
      prisma.courseEquivalent.findMany({
        select: {
          courseId: true,
          equivalentId: true,
          course: { select: { code: true } },
          equivalent: { select: { code: true } },
        },
      }),
      isAdmin
        ? prisma.courseOffering.findMany({
            where: {
              isActive: true,
              offeringSemester: context.semester,
              offeringYear: context.year,
              courseId: { not: null },
            },
            select: {
              courseCode: true,
              slots: true,
              course: { select: { id: true, code: true, name: true, credits: true, ltpc: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const selectedIds = savedPlan?.selectedIds ?? [];
    const [selectedOfferings, selectedDirectCourses] = selectedIds.length > 0
      ? await Promise.all([
          // The plan is already scoped to the current term. Preserve its exact
          // selections even when a migrated offering still carries its
          // curriculum semester (for example, Sem 7) as metadata. An inactive
          // offering, however, has been withdrawn and must not remain visible
          // merely because an older saved plan still contains its ID.
          prisma.courseOffering.findMany({
            where: {
              id: { in: selectedIds },
              isActive: true,
            },
            select: {
              id: true, courseId: true, courseCode: true, courseName: true, credits: true, ltpc: true, slots: true, offeringSemester: true, offeringYear: true,
              course: { select: { id: true, code: true, name: true, credits: true, ltpc: true } },
            },
          }),
          prisma.course.findMany({
            where: { id: { in: selectedIds } },
            select: { id: true, code: true, name: true, credits: true, ltpc: true },
          }),
        ])
      : [[], []];

    // A completed course fulfils every code in its equivalence component.
    // Saved plans predate completion/import corrections, so filter those stale
    // aliases here as well as on the pre-registration screen. Build the full
    // undirected component rather than relying on row direction or one hop.
    const equivalentIdsByCourseId = new Map<string, Set<string>>();
    const courseCodeById = new Map<string, string>();
    const linkEquivalentIds = (left: string, right: string) => {
      if (!equivalentIdsByCourseId.has(left)) equivalentIdsByCourseId.set(left, new Set());
      equivalentIdsByCourseId.get(left)!.add(right);
    };
    for (const equivalency of equivalencies) {
      linkEquivalentIds(equivalency.courseId, equivalency.equivalentId);
      linkEquivalentIds(equivalency.equivalentId, equivalency.courseId);
      courseCodeById.set(equivalency.courseId, equivalency.course.code);
      courseCodeById.set(equivalency.equivalentId, equivalency.equivalent.code);
    }

    const fulfilledCourseIds = new Set(completedEnrollments.map((enrollment) => enrollment.courseId));
    const equivalenceQueue = Array.from(fulfilledCourseIds);
    for (let index = 0; index < equivalenceQueue.length; index++) {
      for (const equivalentId of equivalentIdsByCourseId.get(equivalenceQueue[index]) ?? []) {
        if (fulfilledCourseIds.has(equivalentId)) continue;
        fulfilledCourseIds.add(equivalentId);
        equivalenceQueue.push(equivalentId);
      }
    }
    const fulfilledCourseCodes = new Set(
      completedEnrollments.map((enrollment) => normalizedCode(enrollment.course.code)),
    );
    for (const courseId of fulfilledCourseIds) {
      const code = courseCodeById.get(courseId);
      if (code) fulfilledCourseCodes.add(normalizedCode(code));
    }
    const isFulfilledCourse = (courseId: string | null, code: string) =>
      Boolean(courseId && fulfilledCourseIds.has(courseId)) || fulfilledCourseCodes.has(normalizedCode(code));

    const plannedOfferings = selectedOfferings.filter(
      (offering) => !isFulfilledCourse(offering.courseId, offering.courseCode),
    );
    const directPlannedCourses = selectedDirectCourses.filter(
      (course) => !isFulfilledCourse(course.id, course.code),
    );

    const registrationTypes = { ...((savedPlan?.registrationTypes as Record<string, string> | null) ?? {}) };
    const normalizedBranch = String(profile?.branch ?? "").trim().toUpperCase();
    const rawBatch = Number(profile?.batch);
    const batchYear = rawBatch > 0 && rawBatch < 100 ? 2000 + rawBatch : rawBatch;
    const isB25MevlsiSem3 =
      context.semester === 3 &&
      context.year === 2026 &&
      batchYear === 2025 &&
      ["MEVLSI", "VL", "VLSI"].includes(normalizedBranch);
    // Plans saved before the B25 MEVLSI recode can still point at EE-311.
    // Render VL-201 in its place without mutating the student's saved plan;
    // the pre-registration save endpoint already persists this canonical form.
    let timetableOfferings = plannedOfferings;
    if (isB25MevlsiSem3) {
      const staleEe311 = plannedOfferings.find((offering) => normalizedCode(offering.courseCode) === "EE311");
      if (staleEe311) {
        const canonicalVl201 =
          plannedOfferings.find((offering) => normalizedCode(offering.courseCode) === "VL201") ??
          await prisma.courseOffering.findFirst({
            where: {
              courseCode: "VL-201",
              offeringSemester: staleEe311.offeringSemester,
              offeringYear: staleEe311.offeringYear,
            },
            select: {
              id: true, courseId: true, courseCode: true, courseName: true, credits: true, ltpc: true, slots: true, offeringSemester: true, offeringYear: true,
              course: { select: { id: true, code: true, name: true, credits: true, ltpc: true } },
            },
          });
        if (canonicalVl201) {
          timetableOfferings = [
            ...plannedOfferings.filter((offering) => normalizedCode(offering.courseCode) !== "EE311"),
            ...(plannedOfferings.some((offering) => offering.id === canonicalVl201.id) ? [] : [canonicalVl201]),
          ];
          if (registrationTypes[staleEe311.id] && !registrationTypes[canonicalVl201.id]) {
            registrationTypes[canonicalVl201.id] = registrationTypes[staleEe311.id];
          }
          delete registrationTypes[staleEe311.id];
        }
      }
    }

    type DisplayCourse = { id: string; code: string; name: string; credits: number; ltpc: string | null };
    const scheduleCodeByCourseId = new Map<string, string>();
    const offeringSlotByCourseId = new Map<string, string | null>();
    const reportableCourseIds = new Set<string>();
    const displayCourseIdByOfferingId = new Map<string, string>();
    const courseMap = new Map<string, DisplayCourse>(
      currentEnrollments.map((enrollment) => [enrollment.course.id, enrollment.course]),
    );
    for (const enrollment of currentEnrollments) reportableCourseIds.add(enrollment.course.id);

    for (const offering of timetableOfferings) {
      const displayCourse: DisplayCourse = offering.course ?? {
        id: `offering:${offering.id}`,
        code: offering.courseCode,
        name: offering.courseName,
        credits: offering.credits,
        ltpc: offering.ltpc,
      };
      courseMap.set(displayCourse.id, displayCourse);
      displayCourseIdByOfferingId.set(offering.id, displayCourse.id);
      scheduleCodeByCourseId.set(displayCourse.id, offering.courseCode);
      offeringSlotByCourseId.set(displayCourse.id, offering.slots);
      if (offering.courseId) reportableCourseIds.add(displayCourse.id);
    }
    for (const course of directPlannedCourses) {
      courseMap.set(course.id, course);
      reportableCourseIds.add(course.id);
    }
    // Admins manage the shared timetable, not just their personal registration.
    // Give them every active course in the current timetable catalogue.
    for (const offering of adminOfferings) {
      if (!offering.course) continue;
      courseMap.set(offering.course.id, offering.course);
      scheduleCodeByCourseId.set(offering.course.id, offering.courseCode);
      offeringSlotByCourseId.set(offering.course.id, offering.slots);
      reportableCourseIds.add(offering.course.id);
    }
    const courses = Array.from(courseMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    const completedCourses = completedEnrollments.map((enrollment) => enrollment.course).sort((a, b) => a.code.localeCompare(b.code));
    const courseIds = courses.map((course) => course.id);

    const visibilityClauses: Array<Record<string, unknown>> = [
      { classType: ClassType.TA_DUTY, createdById: session.user.id },
    ];
    if (courseIds.length > 0) visibilityClauses.push({ courseId: { in: courseIds } });

    const databaseEntries = await prisma.timetableEntry.findMany({
      where: {
        semester: context.semester,
        year: context.year,
        term: context.term,
        ...(isAdmin ? {} : { OR: visibilityClauses, isApproved: true }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, credits: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // An approved shared edit supersedes the workbook. Pending reports do not:
    // students keep seeing the published schedule until an admin approves one.
    const approvedCorrectionKeys = new Set<string>();
    const coursesWithApprovedOverrides = new Set<string>();
    for (const entry of databaseEntries) {
      if (!entry.courseId || entry.classType === ClassType.TA_DUTY || !entry.isApproved) continue;
      const correction = parseOfficialCorrectionNotes(entry.notes);
      if (correction) {
        approvedCorrectionKeys.add(
          `${entry.courseId}|${correction.replacesOfficial.dayOfWeek}|${correction.replacesOfficial.startTime}|${correction.replacesOfficial.endTime}`,
        );
      } else {
        coursesWithApprovedOverrides.add(entry.courseId);
      }
    }
    const officialData = officialTimetableData as unknown as OfficialTimetableData;
    const now = new Date();
    const officialEntries = courses.flatMap((course) => {
      if (coursesWithApprovedOverrides.has(course.id)) return [];
      return buildOfficialCourseMeetings(officialData, scheduleCodeByCourseId.get(course.id) ?? course.code, {
        credits: course.credits,
        ltpc: course.ltpc,
        branch: profile?.branch,
        fallbackSlot: offeringSlotByCourseId.get(course.id),
        fallbackKind: course.code.toUpperCase().startsWith("IC-") ? "IC" : "NON_IC",
      })
        .filter((meeting) => !approvedCorrectionKeys.has(
          `${course.id}|${meeting.dayOfWeek}|${meeting.startTime}|${meeting.endTime}`,
        ))
        .map((meeting) => ({
        id: `official:${course.id}:${meeting.dayOfWeek}:${meeting.startTime}:${meeting.endTime}:${meeting.classType}`,
        courseId: course.id,
        semester: context.semester,
        year: context.year,
        term: context.term,
        dayOfWeek: meeting.dayOfWeek,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        slot: meeting.slot,
        venue: meeting.venue ?? null,
        roomNumber: null,
        building: null,
        classType: meeting.classType as ClassType,
        instructor: null,
        notes: "Official Aug–Nov 2026 timetable",
        createdAt: now,
        updatedAt: now,
        createdById: null,
        updatedById: null,
        approvedAt: now,
        approvedById: null,
        isApproved: true,
        googleEventId: null,
        course,
        createdBy: null,
        isOfficial: true,
        canReportCorrection: reportableCourseIds.has(course.id),
      }));
    });

    const databaseEntriesForClient = databaseEntries.map((entry) => {
      const correction = parseOfficialCorrectionNotes(entry.notes);
      return {
        ...entry,
        ...(correction
          ? {
              notes: correction.userNotes || null,
              isOfficialCorrection: true,
              replacesOfficial: correction.replacesOfficial,
            }
          : {}),
      };
    });
    const entries = [...databaseEntriesForClient, ...officialEntries].sort(
      (a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
    );

    const offeringIds = new Set(timetableOfferings.map((offering) => offering.id));
    const plannedItems = [
      ...timetableOfferings.map((offering) => ({
        selectedId: offering.id,
        courseId: displayCourseIdByOfferingId.get(offering.id) ?? offering.courseId,
        code: offering.courseCode,
        credits: offering.credits,
      })),
      ...directPlannedCourses
        .filter((course) => !offeringIds.has(course.id))
        .map((course) => ({ selectedId: course.id, courseId: course.id, code: course.code, credits: course.credits })),
    ];
    const totalCredits = plannedItems.reduce(
      (sum, item) => sum + (registrationTypes[item.selectedId] === "AUDIT" ? 0 : item.credits),
      0,
    );
    const plannedCourseIds = new Set(plannedItems.map((item) => item.courseId).filter(Boolean) as string[]);
    const plannedEntries = entries.filter(
      (entry) => entry.courseId && plannedCourseIds.has(entry.courseId) && entry.isApproved,
    );
    const clashSet = new Set<string>();
    const clashes: Array<{ first: string; second: string }> = [];
    for (let i = 0; i < plannedEntries.length; i++) {
      for (let j = i + 1; j < plannedEntries.length; j++) {
        const first = plannedEntries[i];
        const second = plannedEntries[j];
        if (!first.courseId || !second.courseId || first.courseId === second.courseId) continue;
        if (first.dayOfWeek !== second.dayOfWeek || first.startTime >= second.endTime || second.startTime >= first.endTime) continue;
        const codes = [first.course?.code ?? "Unknown", second.course?.code ?? "Unknown"].sort();
        const key = codes.join("|");
        if (clashSet.has(key)) continue;
        clashSet.add(key);
        clashes.push({ first: codes[0], second: codes[1] });
      }
    }

    return NextResponse.json({
      context,
      isAdmin,
      courses,
      completedCourses,
      entries,
      planWarnings: {
        hasSavedPlan: Boolean(savedPlan),
        totalCredits,
        overThirtyCredits: totalCredits > 30,
        clashes,
      },
    });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch timetable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getCurrentTimetableContext(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    const body = await req.json();
    const {
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      slot,
      venue,
      roomNumber,
      building,
      classType,
      instructor,
      notes,
      requestApproval,
      replacesOfficial,
    } = body;

    // Validate required fields
    // courseId is optional for TA duties
    if (!dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Object.values(DayOfWeek).includes(dayOfWeek)) {
      return NextResponse.json({ error: "Invalid dayOfWeek" }, { status: 400 });
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
    }
    if (endTime <= startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const selectedClassType: ClassType =
      classType && Object.values(ClassType).includes(classType) ? classType : ClassType.LECTURE;

    if (!courseId && selectedClassType !== ClassType.TA_DUTY) {
      return NextResponse.json(
        { error: "courseId is required unless classType is TA_DUTY" },
        { status: 400 }
      );
    }

    // Check enrollment permissions when courseId is provided
    if (courseId) {
      const taDutyCourseCheck = selectedClassType === ClassType.TA_DUTY;

      const enrollment = await prisma.courseEnrollment.findFirst({
        where: taDutyCourseCheck
          ? { userId: session.user.id, courseId, status: EnrollmentStatus.COMPLETED }
          : {
              userId: session.user.id,
              courseId,
              semester: context.semester,
              year: context.year,
              term: context.term,
              status: EnrollmentStatus.IN_PROGRESS,
            },
        select: { id: true },
      });

      let isPlanned = false;
      if (!enrollment && !taDutyCourseCheck) {
        const plan = await prisma.preRegistrationPlan.findUnique({
          where: {
            userId_offeringSemester_offeringYear: {
              userId: session.user.id,
              offeringSemester: context.semester,
              offeringYear: context.year,
            },
          },
          select: { selectedIds: true },
        });
        if (plan) {
          isPlanned = plan.selectedIds.includes(courseId) || Boolean(await prisma.courseOffering.findFirst({
            where: { id: { in: plan.selectedIds }, courseId },
            select: { id: true },
          }));
        }
      }

      if (!isAdmin && !enrollment && !isPlanned) {
        return NextResponse.json(
          {
            error: taDutyCourseCheck
              ? "For TA duties, select a course you have completed"
              : "You can only report schedules for enrolled or pre-registered courses",
          },
          { status: 403 }
        );
      }

      const duplicate = await prisma.timetableEntry.findFirst({
        where: {
          courseId,
          semester: context.semester,
          year: context.year,
          term: context.term,
          dayOfWeek,
          startTime,
          endTime,
          classType: selectedClassType,
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json({ error: "This class is already scheduled" }, { status: 409 });
      }
    }

    // Admins always approved; TA duties are personal (no approval needed).
    // For regular entries: auto-approve only when the submitted slot+day+time
    // exactly matches the official timetable slot tables (A-H, L1-L5).
    // Free/unscheduled slots (FS, FS1, FS2, NS) and anything else → pending approval.
    const slotValue = typeof slot === "string" ? slot.trim() || undefined : undefined;
    const hasValidReplacement =
      replacesOfficial &&
      Object.values(DayOfWeek).includes(replacesOfficial.dayOfWeek) &&
      timeRegex.test(replacesOfficial.startTime) &&
      timeRegex.test(replacesOfficial.endTime);
    if (requestApproval && (!courseId || !hasValidReplacement)) {
      return NextResponse.json(
        { error: "A valid official class is required for a correction report" },
        { status: 400 },
      );
    }

    let officialMeetings: ReturnType<typeof buildOfficialCourseMeetings> = [];
    if (courseId && selectedClassType !== ClassType.TA_DUTY) {
      const [course, profile, plan] = await Promise.all([
        prisma.course.findUnique({
          where: { id: courseId },
          select: { code: true, credits: true, ltpc: true },
        }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { branch: true },
        }),
        prisma.preRegistrationPlan.findUnique({
          where: {
            userId_offeringSemester_offeringYear: {
              userId: session.user.id,
              offeringSemester: context.semester,
              offeringYear: context.year,
            },
          },
          select: { selectedIds: true },
        }),
      ]);
      const plannedOffering = plan
        ? await prisma.courseOffering.findFirst({
            where: {
              id: { in: plan.selectedIds },
              courseId,
            },
            select: { courseCode: true, credits: true, ltpc: true, slots: true },
          })
        : null;
      const scheduleCode = plannedOffering?.courseCode ?? course?.code;
      if (scheduleCode) {
        officialMeetings = buildOfficialCourseMeetings(
          officialTimetableData as unknown as OfficialTimetableData,
          scheduleCode,
          {
            credits: plannedOffering?.credits ?? course?.credits,
            ltpc: plannedOffering?.ltpc ?? course?.ltpc,
            branch: profile?.branch,
            fallbackSlot: plannedOffering?.slots,
            fallbackKind: scheduleCode.toUpperCase().startsWith("IC-") ? "IC" : "NON_IC",
          },
        );
      }
    }

    if (!isAdmin && !requestApproval && officialMeetings.length > 0) {
      return NextResponse.json(
        { error: "This course already has an approved timetable. Open a class to report a correction." },
        { status: 409 },
      );
    }
    if (
      requestApproval &&
      hasValidReplacement &&
      !officialMeetings.some(
        (meeting) =>
          meeting.dayOfWeek === replacesOfficial.dayOfWeek &&
          meeting.startTime === replacesOfficial.startTime &&
          meeting.endTime === replacesOfficial.endTime,
      )
    ) {
      return NextResponse.json(
        { error: "The class being corrected is no longer in the approved timetable. Refresh and try again." },
        { status: 409 },
      );
    }

    const autoApprove =
      isAdmin ||
      (!requestApproval && (
        selectedClassType === ClassType.TA_DUTY ||
        isApproveableSlot(slotValue, dayOfWeek, startTime)
      ));
    const storedNotes = requestApproval && hasValidReplacement
      ? withOfficialCorrectionMarker(
          typeof notes === "string" ? notes : null,
          replacesOfficial,
        )
      : notes;

    const entry = await prisma.timetableEntry.create({
      data: {
        courseId,
        semester: context.semester,
        year: context.year,
        term: context.term,
        dayOfWeek,
        startTime,
        endTime,
        slot: slotValue,
        venue,
        roomNumber,
        building,
        classType: selectedClassType,
        instructor,
        notes: storedNotes,
        createdById: session.user.id,
        updatedById: session.user.id,
        isApproved: autoApprove,
        ...(autoApprove && { approvedById: session.user.id, approvedAt: new Date() }),
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
          },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Timetable creation error:", error);
    return NextResponse.json(
      { error: "Failed to create timetable entry" },
      { status: 500 }
    );
  }
}
