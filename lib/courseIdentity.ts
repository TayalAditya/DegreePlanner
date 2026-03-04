export function courseIdentityKey(code: unknown): string {
  const text = String(code ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase();

  if (!text) return "";

  const cleaned = text
    // "CS201(P)" -> "CS201P"
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/gi, "$1P")
    // Samarth suffix noise: "CS-302_New", "HS-342_1_New" -> base code
    .replace(/(_\d{1,2})?_NEW$/gi, "");

  // Standard course codes: "IC-102P", "IC 102P", "IC102P"
  // Also allow a simple section suffix: "BE-203_1" -> "BE203"
  const standard = cleaned.match(
    /^([A-Z]{2,4})\s*[- ]?\s*(\d{3})\s*([A-Z])?(?:\s*_\s*(\d{1,2}))?$/
  );
  if (standard) {
    const [, prefix, digits, maybeSuffix] = standard;
    return `${prefix}${digits}${maybeSuffix ?? ""}`;
  }

  // Fallback: keep special-topic suffixes like "AR-593_2025_01" distinct.
  return cleaned.replace(/[^A-Z0-9]/g, "");
}

