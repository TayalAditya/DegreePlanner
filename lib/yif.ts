/**
 * Young Innovators' Fellowship (YIF) rules.
 *
 * Keep this independent from the course-category enum: YIF is an opted-in
 * degree-path replacement, not a permanent category of every student's
 * transcript.
 */

export const YIF_STARTUP_PRACTICUMS = [
  { code: "SP-501", normalizedCode: "SP501", name: "Startup Practicum 1", credits: 4 },
  { code: "SP-502", normalizedCode: "SP502", name: "Startup Practicum 2", credits: 6 },
  { code: "SP-503", normalizedCode: "SP503", name: "Startup Practicum 3", credits: 10 },
] as const;

export const YIF_VACATION_INTERNSHIP_CREDITS = 2;
export const YIF_STARTUP_PRACTICUM_CREDITS = YIF_STARTUP_PRACTICUMS.reduce(
  (total, component) => total + component.credits,
  0,
);
export const YIF_TOTAL_CREDITS = YIF_VACATION_INTERNSHIP_CREDITS + YIF_STARTUP_PRACTICUM_CREDITS;
export const YIF_FREE_ELECTIVE_REDUCTION = 8;

export const ENTREPRENEURSHIP_SPECIALIZATION_COURSES = ["HS-510", "GE-523"] as const;

export function normalizeYifCourseCode(code: unknown): string {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function getYifStartupPracticum(code: unknown) {
  const normalized = normalizeYifCourseCode(code);
  return YIF_STARTUP_PRACTICUMS.find((component) => component.normalizedCode === normalized) ?? null;
}

export function isYifStartupPracticum(code: unknown): boolean {
  return getYifStartupPracticum(code) !== null;
}

/** B23's existing ISTP is explicitly accepted in place of SP-501. */
export function isB23YifSp501Equivalent(code: unknown, batch?: number | null): boolean {
  return batch === 2023 && normalizeYifCourseCode(code) === "DP301P";
}

/**
 * The compulsory vacation internship is stored with a branch prefix (CS-010,
 * EE-010, IC-010, etc.). It becomes the 2-credit YIF component only while
 * the student has opted into YIF.
 */
export function isYifVacationInternship(code: unknown, credits?: number | null): boolean {
  const normalized = normalizeYifCourseCode(code);
  return /[A-Z]+010$/.test(normalized) && (credits == null || Number(credits) === 2);
}

export function yifComponentForCourse(
  code: unknown,
  batch?: number | null,
  credits?: number | null,
): "vacation" | "sp1" | "sp2" | "sp3" | null {
  if (isB23YifSp501Equivalent(code, batch)) return "sp1";
  const practicum = getYifStartupPracticum(code);
  if (practicum) {
    return practicum.normalizedCode === "SP501"
      ? "sp1"
      : practicum.normalizedCode === "SP502"
        ? "sp2"
        : "sp3";
  }
  return isYifVacationInternship(code, credits) ? "vacation" : null;
}

export type YifEnrollmentLike = {
  status?: string | null;
  grade?: string | null;
  course?: { code?: string | null } | null;
};

function isPassingCompletion(enrollment: YifEnrollmentLike) {
  return enrollment.status === "COMPLETED" && enrollment.grade !== "F";
}

/**
 * SP-501 -> SP-502 -> SP-503 is sequential. For B23, DP-301P can fulfil the
 * SP-501 prerequisite instead. Only passed courses unlock the next component.
 */
export function getYifPrerequisiteError({
  courseCode,
  batch,
  enrollments,
}: {
  courseCode: unknown;
  batch?: number | null;
  enrollments: YifEnrollmentLike[];
}): string | null {
  const practicum = getYifStartupPracticum(courseCode);
  if (!practicum || practicum.normalizedCode === "SP501") return null;

  const completed = new Set(
    enrollments
      .filter(isPassingCompletion)
      .map((enrollment) => normalizeYifCourseCode(enrollment.course?.code)),
  );
  const hasSp1 = completed.has("SP501") || (batch === 2023 && completed.has("DP301P"));
  const hasSp2 = completed.has("SP502");

  if (practicum.normalizedCode === "SP502" && !hasSp1) {
    return batch === 2023
      ? "Startup Practicum 2 requires Startup Practicum 1 or the B23 DP-301P equivalent to be completed first."
      : "Startup Practicum 2 requires Startup Practicum 1 to be completed first.";
  }

  if (practicum.normalizedCode === "SP503" && (!hasSp1 || !hasSp2)) {
    return batch === 2023
      ? "Startup Practicum 3 requires Startup Practicum 2 and Startup Practicum 1 (or the B23 DP-301P equivalent) to be completed first."
      : "Startup Practicum 3 requires Startup Practicum 1 and Startup Practicum 2 to be completed first.";
  }

  return null;
}

export function getEntrepreneurshipSpecializationStatus({
  batch,
  enrollments,
}: {
  batch?: number | null;
  enrollments: YifEnrollmentLike[];
}) {
  const completed = new Set(
    enrollments
      .filter(isPassingCompletion)
      .map((enrollment) => normalizeYifCourseCode(enrollment.course?.code)),
  );
  const missing = [
    !(completed.has("SP501") || (batch === 2023 && completed.has("DP301P"))) ? "SP-501" : null,
    !completed.has("SP502") ? "SP-502" : null,
    !completed.has("SP503") ? "SP-503" : null,
    !completed.has("HS510") ? "HS-510" : null,
    !completed.has("GE523") ? "GE-523" : null,
  ].filter((code): code is string => Boolean(code));

  return { eligible: missing.length === 0, missing };
}
