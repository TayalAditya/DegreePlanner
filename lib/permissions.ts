export const DOCS_ADMIN_ENROLLMENT_ID = (process.env.DOCS_ADMIN_ENROLLMENT_ID || "B23243").toUpperCase();

// Emails granted academic-secretary rights (branch/batch login exemption + impersonation preview).
export const ACAD_SEC_EMAILS = new Set<string>([
  "academic_secretary@students.iitmandi.ac.in",
  "sae@iitmandi.ac.in",
]);

export function isAcadSec(email?: string | null): boolean {
  if (!email) return false;
  return ACAD_SEC_EMAILS.has(email.toLowerCase());
}

export function isDocumentsAdmin(user: { role?: string | null; enrollmentId?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.role !== "ADMIN") return false;
  return (user.enrollmentId || "").toUpperCase() === DOCS_ADMIN_ENROLLMENT_ID;
}

