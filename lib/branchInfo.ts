const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function normalizeBranchCode(branch?: string | null): string {
  const b = String(branch || "").trim().toUpperCase();
  if (!b) return "";

  if (b === "GERAI") return "GE-ROBO";
  if (b === "GECE") return "GE-COMM";
  if (b === "GEMECH") return "GE-MECH";

  return b;
}

export function getCurriculumBranchCode(branch?: string | null): string {
  const normalized = normalizeBranchCode(branch);
  if (normalized === "DSAI") return "DSE";
  return normalized;
}

export function getProgramLookupBranchCode(branch?: string | null): string {
  const normalized = normalizeBranchCode(branch);
  if (normalized === "DSAI") return "DSE";
  return normalized;
}

export function getBranchCandidates(branch?: string | null): string[] {
  const b = normalizeBranchCode(branch);
  if (!b) return ["COMMON"];

  const candidates: string[] = [b];

  if (b === "CSE") candidates.push("CS");
  if (b === "CS") candidates.push("CSE");

  if (b === "DSE" || b === "DSAI") candidates.push("DS", "DSE", "DSAI");
  if (b === "DS") candidates.push("DSE", "DSAI");

  if (b === "MSE") candidates.push("MS");
  if (b === "MS") candidates.push("MSE");

  if (b === "MEVLSI") candidates.push("VL", "VLSI");
  if (b === "VL") candidates.push("MEVLSI", "VLSI");
  if (b === "VLSI") candidates.push("VL", "MEVLSI");

  if (b === "BSCS") candidates.push("BS", "CH");
  if (b === "BS") candidates.push("BSCS", "CH");
  if (b === "CH") candidates.push("BSCS", "BS");

  if (b === "BE") candidates.push("BIO");
  if (b === "BIO") candidates.push("BE");

  if (b === "GE-MECH" || b === "GE-COMM" || b === "GE-ROBO" || b.startsWith("GE-")) {
    candidates.push("GE");
  }

  candidates.push("COMMON");
  return unique(candidates);
}

export function normalizeBranchForIcBasket(branch?: string | null): string {
  const upper = getCurriculumBranchCode(branch);
  if (upper === "BE") return "BIO";
  if (upper === "BSCS" || upper === "BS") return "CH";
  if (upper === "MEVLSI" || upper === "VL") return "VLSI";
  return upper;
}

export function isDataScienceBranch(branch?: string | null): boolean {
  const normalized = normalizeBranchCode(branch);
  return normalized === "DS" || normalized === "DSE" || normalized === "DSAI";
}

export function getDepartmentForBranch(branch?: string | null): string | null {
  switch (normalizeBranchCode(branch)) {
    case "CSE":
    case "DSE":
    case "DSAI":
    case "EE":
    case "MEVLSI":
      return "School of Computing & Electrical Engineering";
    case "MNC":
      return "School of Mathematics & Statistical Science";
    case "ME":
    case "MSE":
    case "GE":
      return "School of Mechanical and Materials Engineering";
    case "CE":
      return "School of Environmental and Natural Sciences";
    case "EP":
      return "School of Physical Sciences";
    case "BE":
      return "School of Bioengineering";
    case "BSCS":
    case "CH":
      return "School of Chemical Sciences";
    default:
      return null;
  }
}

export function inferBranchFromProgram(program?: string | null): string | null {
  const normalized = String(program || "").trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("computer science") || /\bcse\b/.test(normalized)) return "CSE";
  if (normalized.includes("data science and artificial intelligence") || /\bdsai\b/.test(normalized)) return "DSAI";
  if (normalized.includes("data science") || /\bdse\b/.test(normalized)) return "DSE";
  if (normalized.includes("electrical") || /\bee\b/.test(normalized)) return "EE";
  if (normalized.includes("microelectronics") || normalized.includes("vlsi") || /\bmevlsi\b/.test(normalized)) return "MEVLSI";
  if (normalized.includes("mathematics and computing") || /\bmnc\b/.test(normalized)) return "MNC";
  if (normalized.includes("materials science") || /\bmse\b/.test(normalized)) return "MSE";
  if (normalized.includes("mechanical")) return "ME";
  if (normalized.includes("civil")) return "CE";
  if (normalized.includes("engineering physics") || /\bep\b/.test(normalized)) return "EP";
  if (normalized.includes("general engineering")) return "GE";
  if (normalized.includes("bio engineering") || normalized.includes("bioengineering")) return "BE";
  if (normalized.includes("chemical sciences") || /\bbscs\b/.test(normalized)) return "BSCS";
  return null;
}

export function getDisplayBranchCode(branch?: string | null, batch?: number | null): string {
  const normalized = normalizeBranchCode(branch);
  if (!normalized) return "";
  if (normalized === "DSE" && batch === 2025) return "DSAI";
  return normalized;
}
