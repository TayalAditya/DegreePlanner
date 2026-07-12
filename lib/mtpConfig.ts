export const MTP_COMPONENT_CREDITS = 4;
export const MTP_TOTAL_CREDITS = MTP_COMPONENT_CREDITS * 2;

export type MtpComponent = 1 | 2;

const MTP_PREFIX_BY_BRANCH: Record<string, string> = {
  CSE: "CS",
  DSE: "DS",
  DSAI: "DS",
  EE: "EE",
  MEVLSI: "VL",
  VLSI: "VL",
  VL: "VL",
  MNC: "MC",
  ME: "ME",
  EP: "EP",
  GE: "GE",
  "GE-ROBO": "GE",
  "GE-MECH": "GE",
  "GE-COMM": "GE",
  "GE-FIN": "GE",
  MSE: "MS",
  MS: "MS",
  CE: "CE",
  BE: "BE",
  BIO: "BE",
  BSCS: "BS",
  CH: "BS",
};

const MTP_PREFIXES = new Set(["DP", ...Object.values(MTP_PREFIX_BY_BRANCH)]);

export function normalizeMtpCourseCode(code: unknown): string {
  return String(code ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/(_\d{1,2})?_NEW$/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function getMtpPrefix(branch?: string | null): string {
  const normalizedBranch = String(branch ?? "").trim().toUpperCase();
  if (normalizedBranch.startsWith("GE-")) return "GE";
  return MTP_PREFIX_BY_BRANCH[normalizedBranch] || "DP";
}

export function getMtpCourseCode(branch: string | null | undefined, component: MtpComponent): string {
  const suffix = component === 1 ? "498P" : "499P";
  return `${getMtpPrefix(branch)}-${suffix}`;
}

export function getMtpComponent(code: unknown): MtpComponent | null {
  const normalized = normalizeMtpCourseCode(code);

  if (normalized === "MTP1") return 1;
  if (normalized === "MTP2") return 2;

  // BSCS research project codes
  if (normalized === "DP551P") return 1;
  if (normalized === "DP552P") return 2;

  const match = normalized.match(/^([A-Z]+)(498P|499P)$/);
  if (!match || !MTP_PREFIXES.has(match[1])) return null;
  return match[2] === "498P" ? 1 : 2;
}

export function isMtpCourseCode(code: unknown): boolean {
  return getMtpComponent(code) !== null;
}

export function isMtp1CourseCode(code: unknown): boolean {
  return getMtpComponent(code) === 1;
}

export function isMtp2CourseCode(code: unknown): boolean {
  return getMtpComponent(code) === 2;
}
