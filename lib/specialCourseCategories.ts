import { getMtpComponent } from "@/lib/mtpConfig";

export type SpecialDpCategory = "FE" | "ISTP" | "MTP";
export type SpecialDpCourseType = "FREE_ELECTIVE" | "ISTP" | "MTP";

const DESIGN_PRACTICUM_TWO_CODES = new Set(["DP302P"]);
const ISTP_CODES = new Set(["DP301P"]);

export function normalizeSpecialCourseCode(code: unknown): string {
  return String(code ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/g, "$1P")
    .replace(/(_\d{1,2})?_NEW$/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function getSpecialDpCategory(code: unknown): SpecialDpCategory | null {
  const normalizedCode = normalizeSpecialCourseCode(code);

  if (DESIGN_PRACTICUM_TWO_CODES.has(normalizedCode)) return "FE";
  if (ISTP_CODES.has(normalizedCode)) return "ISTP";
  if (getMtpComponent(normalizedCode)) return "MTP";
  if (normalizedCode.includes("MTP")) return "MTP";
  if (normalizedCode.includes("ISTP")) return "ISTP";

  return null;
}

export function getSpecialDpCourseType(code: unknown): SpecialDpCourseType | null {
  const category = getSpecialDpCategory(code);

  switch (category) {
    case "FE":
      return "FREE_ELECTIVE";
    case "ISTP":
      return "ISTP";
    case "MTP":
      return "MTP";
    default:
      return null;
  }
}
