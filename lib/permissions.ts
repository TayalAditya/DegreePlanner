export const DOCS_ADMIN_ENROLLMENT_ID = (process.env.DOCS_ADMIN_ENROLLMENT_ID || "B23243").toUpperCase();

export function isDocumentsAdmin(user: { role?: string | null; enrollmentId?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.role !== "ADMIN") return false;
  return (user.enrollmentId || "").toUpperCase() === DOCS_ADMIN_ENROLLMENT_ID;
}

