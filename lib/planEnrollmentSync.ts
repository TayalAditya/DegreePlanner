/**
 * Materialize a saved `PreRegistrationPlan` into `CourseEnrollment` rows.
 *
 * WHY THIS EXISTS
 * ---------------
 * A saved pre-registration plan lived only in `PreRegistrationPlan.selectedIds`
 * (a bare `String[]` of mixed CourseOffering/Course ids). Every other surface —
 * dashboard, progress, courses, credit caps — reads `CourseEnrollment`. So a
 * student who had planned their upcoming semester saw those courses on the
 * registration page but nowhere else, and their credit totals silently excluded
 * them. Materializing the plan into IN_PROGRESS enrollments is what makes all
 * those pages agree.
 *
 * SCOPE OF THE WRITE — deliberately narrow
 * ----------------------------------------
 * The plan is authoritative for exactly one term, so the sync only ever touches
 * rows in that one `(semester, year, term)` triple, and only ever rows whose
 * status is IN_PROGRESS or AUDIT. It will never touch COMPLETED, DROPPED or
 * FAILED rows, never a graded row, and never another semester — so a student's
 * academic history cannot be rewritten by editing a plan.
 *
 * The `year`/`term` come from `contextFromSemester(semester, batchYear)`, NOT
 * from `plan.offeringYear`: the plan stores a raw calendar year while enrollments
 * use the academic-year convention, and mixing them duplicates rows against the
 * `[userId, courseId, semester, year, term]` unique key.
 *
 * Course identity is compared with `courseIdentityKey`, which collapses MTP
 * aliases (DP-498P / CS-498P / MTP1 all key to "MTP1") and Samarth code noise.
 * Without that, a plan naming CS-498P alongside an existing DP-498P enrollment
 * would double-count MTP credits.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { CourseType, EnrollmentStatus, Term } from "@prisma/client";
import { inferBatchYear } from "@/lib/academicCalendar";
import { contextFromSemester } from "@/lib/timetable";
import { courseIdentityKey } from "@/lib/courseIdentity";
import { pickBranchMapping } from "@/lib/courseCategory";
import { getSpecialDpCourseType } from "@/lib/specialCourseCategories";
import { isMtp1CourseCode, isMtp2CourseCode } from "@/lib/mtpConfig";
import { isSemesterInternshipCourse, isOnsiteSemesterInternshipCourse } from "@/lib/course-validation";

/** Any Prisma client or interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Registration types stored in `PreRegistrationPlan.registrationTypes`. */
type RegistrationType = "REGULAR" | "PASS_FAIL" | "AUDIT";

/** Statuses this sync is allowed to create or remove. Anything else is history. */
const MANAGED_STATUSES = [EnrollmentStatus.IN_PROGRESS, EnrollmentStatus.AUDIT] as const;

export type PlanSyncChange = {
  action: "created" | "updated" | "deleted" | "skipped";
  courseCode: string;
  credits: number;
  detail?: string;
};

export type PlanSyncResult = {
  userId: string;
  semester: number;
  year: number;
  term: Term;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  changes: PlanSyncChange[];
  /** Set when the plan could not be synced at all (no batch, no plan, ...). */
  reason?: string;
};

const emptyResult = (
  userId: string,
  semester: number,
  year: number,
  term: Term,
  reason?: string
): PlanSyncResult => ({
  userId,
  semester,
  year,
  term,
  created: 0,
  updated: 0,
  deleted: 0,
  skipped: 0,
  changes: [],
  reason,
});

/**
 * Map a pre-registration `resolvedCategory` to the coarse `CourseType` column.
 *
 * `courseType` is only a *fallback* for the credit engines — they prefer
 * `CourseBranchMapping` and code-prefix rules (see lib/courseCategory.ts). It
 * still matters when a course has no mapping rows, and there `CORE` is read as
 * DC, so HSS/IKS must not be stored as CORE for courses that carry no mapping.
 */
function courseTypeForCategory(category: string | null | undefined): CourseType {
  switch ((category ?? "").toUpperCase()) {
    case "IC":
    case "IC_BASKET":
    case "DC":
      return CourseType.CORE;
    case "DE":
      return CourseType.DE;
    case "MTP":
      return CourseType.MTP;
    case "ISTP":
      return CourseType.ISTP;
    // HSS / IKS / FE / NA / unknown → FREE_ELECTIVE. The HSS+IKS basket split
    // (core → FE → not-in-degree) is recomputed downstream from the course code,
    // so storing CORE here would misreport unmapped HSS courses as DC.
    default:
      return CourseType.FREE_ELECTIVE;
  }
}

/** Course code with separators/case stripped, for exact same-course comparison. */
const normalizeCode = (code: unknown) =>
  String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** One plan entry resolved to a real course, with everything the write needs. */
type ResolvedSelection = {
  planId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  identityKey: string;
  normalizedCode: string;
  registrationType: RegistrationType;
  category: string | null;
};

/**
 * Resolve `selectedIds` (mixed CourseOffering ids and Course ids) into concrete
 * courses. Offerings are tried first and are NOT filtered by offering
 * semester/year — a plan saved before an offering re-upload must still resolve —
 * but inactive (withdrawn) offerings are dropped, matching the timetable route.
 */
async function resolveSelections(
  db: Db,
  selectedIds: string[],
  registrationTypes: Record<string, string>,
  branch: string | null,
  batchYear: number | null
): Promise<{ resolved: ResolvedSelection[]; unresolved: string[] }> {
  if (selectedIds.length === 0) return { resolved: [], unresolved: [] };

  const [offerings, directCourses] = await Promise.all([
    db.courseOffering.findMany({
      where: { id: { in: selectedIds }, isActive: true },
      select: {
        id: true,
        courseId: true,
        courseCode: true,
        courseName: true,
        credits: true,
        categoryOverride: true,
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
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
    }),
    db.course.findMany({
      where: { id: { in: selectedIds } },
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
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
    }),
  ]);

  const regType = (id: string): RegistrationType => {
    const raw = String(registrationTypes[id] ?? "REGULAR").toUpperCase();
    return raw === "PASS_FAIL" || raw === "AUDIT" ? raw : "REGULAR";
  };

  const resolved: ResolvedSelection[] = [];
  const unresolved: string[] = [];
  const offeringById = new Map(offerings.map((o) => [o.id, o]));
  const courseById = new Map(directCourses.map((c) => [c.id, c]));

  for (const id of selectedIds) {
    const offering = offeringById.get(id);
    if (offering) {
      // An offering with no linked Course cannot become an enrollment:
      // CourseEnrollment.courseId is a required FK.
      if (!offering.courseId || !offering.course) {
        unresolved.push(`${id} (offering ${offering.courseCode} has no linked Course)`);
        continue;
      }
      const mapped = pickBranchMapping(offering.course.branchMappings, branch ?? undefined, batchYear)
        ?.courseCategory;
      resolved.push({
        planId: id,
        courseId: offering.courseId,
        courseCode: offering.courseCode,
        courseName: offering.courseName,
        credits: offering.credits,
        identityKey: courseIdentityKey(offering.courseCode),
        normalizedCode: normalizeCode(offering.courseCode),
        registrationType: regType(id),
        category: mapped ?? offering.categoryOverride ?? null,
      });
      continue;
    }

    const course = courseById.get(id);
    if (course) {
      const mapped = pickBranchMapping(course.branchMappings, branch ?? undefined, batchYear)
        ?.courseCategory;
      resolved.push({
        planId: id,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        identityKey: courseIdentityKey(course.code),
        normalizedCode: normalizeCode(course.code),
        registrationType: regType(id),
        category: mapped ?? null,
      });
      continue;
    }

    unresolved.push(id);
  }

  return { resolved, unresolved };
}

/** Derive the enrollment column values for one resolved selection. */
function enrollmentFieldsFor(selection: ResolvedSelection) {
  const { courseCode, credits, category, registrationType } = selection;

  let courseType = courseTypeForCategory(category);

  // Special project/practicum codes override any category guess, exactly as the
  // manual enrollment route does.
  if (isMtp1CourseCode(courseCode) || isMtp2CourseCode(courseCode)) courseType = CourseType.MTP;
  const specialDp = getSpecialDpCourseType(courseCode);
  if (specialDp) courseType = specialDp as CourseType;

  // Semester internships (xx-396P / xx-399P) are always P/F Free Electives.
  const isInternship = isSemesterInternshipCourse(courseCode);
  if (isInternship) courseType = CourseType.FREE_ELECTIVE;

  const isAudit = registrationType === "AUDIT";
  const isPassFail = isInternship || (!isAudit && registrationType === "PASS_FAIL");

  // A P/F course counts toward Free Electives rather than its own basket, so it
  // must not stay CORE/DE — mirrors the enrollments POST route.
  if (isPassFail && courseType !== CourseType.MTP && courseType !== CourseType.ISTP) {
    courseType = CourseType.FREE_ELECTIVE;
  }

  return {
    courseType,
    status: isAudit ? EnrollmentStatus.AUDIT : EnrollmentStatus.IN_PROGRESS,
    isPassFail,
    // passFailCredits is an Int column; offering credits are Float.
    passFailCredits: isPassFail ? Math.round(credits) : 0,
    isInternship,
    internshipType: isInternship
      ? isOnsiteSemesterInternshipCourse(courseCode)
        ? ("ONSITE" as const)
        : ("REMOTE" as const)
      : null,
  };
}

export type SyncOptions = {
  /** When false, compute the diff but write nothing. Defaults to true. */
  apply?: boolean;
  /**
   * The plan's `selectedIds` *before* this save. Only courses that were in that
   * previous plan and are no longer selected become deletions.
   *
   * This is what makes "the plan is authoritative for its term" safe. Students
   * also add courses by hand on the Courses page, and imports create rows too;
   * those never appeared in a plan, so they are not the plan's to remove. An
   * audit of the first backfill found 36 such rows — including three students'
   * DP-498P MTP registrations — that a blind "delete anything unplanned" pass
   * would have destroyed.
   *
   * Omit it (as the backfill does) and the sync is purely additive.
   */
  previousSelectedIds?: string[];
  /**
   * Whether to correct the fields (status / courseType / P/F) of enrollment rows
   * that already exist in the term.
   *
   * True for live saves: the student just pressed Save with those registration
   * types, so the plan is the freshest statement of intent.
   *
   * False for the first backfill: those rows predate the sync entirely and may
   * hold deliberate choices made on the Courses page — two students had P/F set
   * there that a blind pass would have silently reverted to Regular, changing
   * their P/F budget. Missing rows are still created either way.
   */
  manageExistingRows?: boolean;
  /**
   * Escape hatch for deliberate admin repair: allow deleting ANY managed
   * IN_PROGRESS/AUDIT row in the term that the plan does not list, regardless of
   * whether the plan ever managed it. Destructive — off by default.
   */
  removeAllUnplanned?: boolean;
};

/**
 * Sync one student's plan for one (semester, year) into CourseEnrollment rows.
 * Idempotent: running it twice makes no further changes.
 */
export async function syncPlanToEnrollments(
  db: Db,
  userId: string,
  offeringSemester: number,
  offeringYear: number,
  options: SyncOptions = {}
): Promise<PlanSyncResult> {
  const {
    apply = true,
    previousSelectedIds,
    manageExistingRows = true,
    removeAllUnplanned = false,
  } = options;

  const [user, plan] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, branch: true, batch: true, enrollmentId: true },
    }),
    db.preRegistrationPlan.findUnique({
      where: {
        userId_offeringSemester_offeringYear: {
          userId,
          offeringSemester,
          offeringYear,
        },
      },
      select: { selectedIds: true, registrationTypes: true },
    }),
  ]);

  const batchYear = inferBatchYear(user?.batch, user?.enrollmentId);
  if (!user) return emptyResult(userId, offeringSemester, offeringYear, Term.FALL, "user not found");
  if (batchYear == null) {
    // Without a batch year the academic (year, term) is unknowable, and guessing
    // would write rows under the wrong key.
    return emptyResult(userId, offeringSemester, offeringYear, Term.FALL, "batch year unknown");
  }

  const context = contextFromSemester(offeringSemester, batchYear);
  const { year, term } = context;

  if (!plan) return emptyResult(userId, offeringSemester, year, term, "no saved plan");

  const { resolved, unresolved } = await resolveSelections(
    db,
    plan.selectedIds,
    (plan.registrationTypes as Record<string, string> | null) ?? {},
    user.branch,
    batchYear
  );

  const result = emptyResult(userId, offeringSemester, year, term);
  for (const id of unresolved) {
    result.skipped += 1;
    result.changes.push({
      action: "skipped",
      courseCode: id,
      credits: 0,
      detail: "plan entry no longer resolves to an active offering or course",
    });
  }

  // Everything the student has already finished (any term) fulfils its identity
  // key, so a stale plan entry for a completed course must not be re-created.
  const priorEnrollments = await db.courseEnrollment.findMany({
    where: { userId },
    select: {
      id: true,
      courseId: true,
      semester: true,
      year: true,
      term: true,
      status: true,
      courseType: true,
      isPassFail: true,
      passFailCredits: true,
      isInternship: true,
      internshipType: true,
      grade: true,
      course: { select: { code: true, credits: true } },
    },
  });

  const inThisTerm = priorEnrollments.filter(
    (e) => e.semester === offeringSemester && e.year === year && e.term === term
  );
  const settledIdentityKeys = new Set(
    priorEnrollments
      .filter(
        (e) =>
          e.status === EnrollmentStatus.COMPLETED ||
          // A row outside this term that is still running belongs to another
          // term's registration; leave it alone and don't duplicate it here.
          (e.status === EnrollmentStatus.IN_PROGRESS &&
            !(e.semester === offeringSemester && e.year === year && e.term === term))
      )
      .map((e) => courseIdentityKey(e.course.code))
  );

  // Index this term's rows by identity key so MTP aliases collapse together.
  const existingByIdentity = new Map<string, (typeof inThisTerm)[number]>();
  for (const e of inThisTerm) existingByIdentity.set(courseIdentityKey(e.course.code), e);

  const plannedIdentityKeys = new Set<string>();
  // Existing rows that a still-selected course matched. A claimed row represents
  // a course the student wants, so it must never also be considered for deletion
  // (this is what stops an alias swap, e.g. CS-498P → DP-498P, from updating a row
  // and then deleting the very same row).
  const claimedRowIds = new Set<string>();

  for (const selection of resolved) {
    if (plannedIdentityKeys.has(selection.identityKey)) {
      result.skipped += 1;
      result.changes.push({
        action: "skipped",
        courseCode: selection.courseCode,
        credits: selection.credits,
        detail: "duplicate of another selected course in the same plan",
      });
      continue;
    }
    if (settledIdentityKeys.has(selection.identityKey)) {
      result.skipped += 1;
      result.changes.push({
        action: "skipped",
        courseCode: selection.courseCode,
        credits: selection.credits,
        detail: "already completed or in progress in another term",
      });
      continue;
    }
    plannedIdentityKeys.add(selection.identityKey);

    const fields = enrollmentFieldsFor(selection);
    const existing = existingByIdentity.get(selection.identityKey);

    if (!existing) {
      if (apply) {
        await db.courseEnrollment.create({
          data: {
            userId,
            courseId: selection.courseId,
            semester: offeringSemester,
            year,
            term,
            ...fields,
          },
        });
      }
      result.created += 1;
      result.changes.push({
        action: "created",
        courseCode: selection.courseCode,
        credits: selection.credits,
        detail: `${fields.status} · ${fields.courseType}${fields.isPassFail ? " · P/F" : ""}`,
      });
      continue;
    }

    // Never rewrite a graded or otherwise settled row.
    claimedRowIds.add(existing.id);
    if (!MANAGED_STATUSES.includes(existing.status as (typeof MANAGED_STATUSES)[number])) {
      result.skipped += 1;
      result.changes.push({
        action: "skipped",
        courseCode: selection.courseCode,
        credits: selection.credits,
        detail: `existing row is ${existing.status} — left untouched`,
      });
      continue;
    }

    const needsUpdate =
      manageExistingRows &&
      (existing.status !== fields.status ||
        existing.courseType !== fields.courseType ||
        existing.isPassFail !== fields.isPassFail ||
        existing.passFailCredits !== fields.passFailCredits ||
        existing.isInternship !== fields.isInternship ||
        (existing.internshipType ?? null) !== fields.internshipType);

    if (needsUpdate) {
      if (apply) {
        await db.courseEnrollment.update({ where: { id: existing.id }, data: fields });
      }
      result.updated += 1;
      result.changes.push({
        action: "updated",
        courseCode: selection.courseCode,
        credits: selection.credits,
        detail: `${existing.status}/${existing.courseType} → ${fields.status}/${fields.courseType}`,
      });
    }
  }

  // Deletions: a course the student has removed from their plan.
  //
  // Only rows this sync is responsible for are eligible. "Responsible for" means
  // the course was in the plan's PREVIOUS selection and is not in the new one —
  // not merely "present in the term but absent from the plan", which would sweep
  // away hand-added and imported enrollments the plan never owned.
  //
  // Matching here is by EXACT course code, not by identity key. Identity keys
  // deliberately collapse MTP aliases so CS-498P and DP-498P are recognised as
  // one requirement — correct for "don't create a duplicate", but wrong for
  // "delete this": dropping CS-498P from a plan must not delete a separately
  // added DP-498P row.
  const deletableCodes = new Set<string>();
  if (removeAllUnplanned) {
    for (const existing of inThisTerm) deletableCodes.add(normalizeCode(existing.course.code));
  } else if (previousSelectedIds && previousSelectedIds.length > 0) {
    const dropped = previousSelectedIds.filter((id) => !plan.selectedIds.includes(id));
    if (dropped.length > 0) {
      const { resolved: droppedSelections } = await resolveSelections(db, dropped, {}, user.branch, batchYear);
      for (const selection of droppedSelections) deletableCodes.add(selection.normalizedCode);
    }
  }
  // A course still selected in the new plan is never a deletion, whatever its code.
  const plannedCodes = new Set(
    resolved.filter((s) => plannedIdentityKeys.has(s.identityKey)).map((s) => s.normalizedCode)
  );

  for (const existing of inThisTerm) {
    const code = normalizeCode(existing.course.code);
    if (claimedRowIds.has(existing.id)) continue;
    if (plannedCodes.has(code)) continue;
    if (!deletableCodes.has(code)) continue;
    if (!MANAGED_STATUSES.includes(existing.status as (typeof MANAGED_STATUSES)[number])) continue;
    // A grade means real recorded work — never remove it.
    if (existing.grade) continue;

    if (apply) {
      await db.courseEnrollment.delete({ where: { id: existing.id } });
    }
    result.deleted += 1;
    result.changes.push({
      action: "deleted",
      courseCode: existing.course.code,
      credits: existing.course.credits,
      detail: "removed from the saved plan",
    });
  }

  return result;
}
