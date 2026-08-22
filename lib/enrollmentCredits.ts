import { getCurriculumBranchCode } from "@/lib/branchInfo";

type CreditBearingEnrollment = {
  creditOverride?: number | null;
  course?: { code?: string | null; credits?: number | null } | null;
};

const normalizeCode = (code: unknown) =>
  String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Some historical curricula assigned a different credit value to the same
 * catalogue code. Store that value on the enrollment so it never changes the
 * credit value seen by students in another programme.
 */
export function getEnrollmentCredits(
  enrollment: CreditBearingEnrollment,
  branch?: string | null,
): number {
  // `Number(null)` is 0. Most existing enrollments intentionally have a
  // null override, so only an explicitly stored numeric override can replace
  // the catalogue credit value.
  const override = enrollment.creditOverride;
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return override;
  }

  // Keep historical programme-specific credits correct even for an enrollment
  // created before the explicit override column existed.
  const curriculumOverride = getEnrollmentCreditOverride(enrollment.course?.code ?? "", branch);
  if (curriculumOverride !== null) return curriculumOverride;

  return Number(enrollment.course?.credits ?? 0);
}

/**
 * EE-211 is a 4-credit MEVLSI DC course (B23 onward), while the shared EE
 * catalogue row remains 3 credits. New imports and direct additions therefore
 * preserve the programme-specific value on the enrollment itself.
 */
export function getEnrollmentCreditOverride(
  courseCode: string,
  branch?: string | null,
): number | null {
  if (
    normalizeCode(courseCode) === "EE211" &&
    getCurriculumBranchCode(branch ?? "") === "MEVLSI"
  ) {
    return 4;
  }
  return null;
}
