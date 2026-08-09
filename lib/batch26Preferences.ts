/**
 * B26's UG26 preference form contains two separately allocated English
 * sections. They share the HS-108 catalogue course, but the section decides
 * the published classroom, so retain that suffix in the preference record.
 */
export function normalizeBatch26PreferenceCode(value: string): string {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/\u00A0/g, " ")
    .trim();
  const englishSection = raw.match(/^HS\s*-?\s*108\s*[_-]\s*([12])$/);
  if (englishSection) return `HS-108_${englishSection[1]}`;
  // Other preference-form suffixes only distinguish lecture/lab groups of a
  // compulsory core course. They are not separate course choices.
  return raw.replace(/_\d{1,2}$/, "").replace(/[^A-Z0-9]/g, "");
}

export function resolveBatch26TimetableCourseCode(
  courseCode: string,
  batch: number | null | undefined,
  preferenceCodes: string[] | null | undefined,
): string {
  const numericBatch = Number(batch);
  const batchYear = numericBatch > 0 && numericBatch < 100 ? 2000 + numericBatch : numericBatch;
  if (batchYear !== 2026 || normalizeBatch26PreferenceCode(courseCode) !== "HS108") {
    return courseCode;
  }

  const selectedEnglishSection = (preferenceCodes ?? [])
    .map(normalizeBatch26PreferenceCode)
    .find((code) => /^HS-108_[12]$/.test(code));
  return selectedEnglishSection ?? courseCode;
}
