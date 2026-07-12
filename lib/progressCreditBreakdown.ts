import { getBranchCandidates, isDataScienceBranch } from "@/lib/branchInfo";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import { pickBranchMapping, type BranchMapping } from "@/lib/courseCategory";
import { addCredits, formatCourseCode, minCredits, subtractCredits } from "@/lib/utils";

type CategoryKey = "IC" | "IC_BASKET" | "DC" | "DE" | "FE" | "HSS" | "IKS" | "MTP" | "ISTP";

export type CategoryCreditBreakdown = Record<CategoryKey, number>;

export type CountedCreditBreakdown = {
  institutionalCore: number;
  dc: number;
  core: number;
  de: number;
  freeElective: number;
  mtp: number;
  istp: number;
  total: number;
};

type EnrollmentLike = {
  semester?: number | null;
  status?: string | null;
  grade?: string | null;
  courseType?: string | null;
  isInternship?: boolean | null;
  course?: {
    code?: string | null;
    credits?: number | null;
    branchMappings?: Array<{
      branch?: string | null;
      batch?: string | null;
      courseCategory?: string | null;
    }>;
  } | null;
};

type Options = {
  enrollments: EnrollmentLike[];
  userBranch?: string | null;
  userBatch?: number | null;
  requiredDE?: number;
  includeCurrentSemesterCredits?: boolean;
  nonMgmtMinorCourseCodes?: Set<string>;
};

const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
  BIO: { ic1: "IC136", ic2: "IC240" },
  CE: { ic1: "IC230", ic2: "IC240" },
  CS: { ic2: "IC253" },
  CSE: { ic2: "IC253" },
  DSE: { ic2: "IC253" },
  DSAI: { ic2: "IC253" },
  EP: { ic1: "IC230", ic2: "IC121" },
  ME: { ic2: "IC240" },
  CH: { ic1: "IC131", ic2: "IC121" },
  MNC: { ic1: "IC136", ic2: "IC253" },
  MS: { ic1: "IC131", ic2: "IC241" },
  MSE: { ic1: "IC131", ic2: "IC241" },
  GE: { ic1: "IC230", ic2: "IC240" },
  EE: {},
  VLSI: {},
};

const HSS_CORE_CAP = 12;

const emptyCategoryCredits = (): CategoryCreditBreakdown => ({
  IC: 0,
  IC_BASKET: 0,
  DC: 0,
  DE: 0,
  FE: 0,
  HSS: 0,
  IKS: 0,
  MTP: 0,
  ISTP: 0,
});

const normalizeCourseCode = (code: unknown) =>
  String(code ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/g, "$1P")
    .replace(/(_\d{1,2})?_NEW$/g, "")
    .replace(/[^A-Z0-9]/g, "");

const normalizeBranchForIcBasket = (branch?: string | null) => {
  const upper = String(branch || "").toUpperCase();
  if (upper === "DSAI" || upper === "DS") return "DSE";
  if (upper === "BE") return "BIO";
  if (upper === "MEVLSI" || upper === "VL") return "VLSI";
  return upper;
};

const countedFromCategories = (categoryCredits: CategoryCreditBreakdown): CountedCreditBreakdown => {
  const institutionalCore = addCredits(
    categoryCredits.IC,
    categoryCredits.IC_BASKET,
    categoryCredits.HSS,
    categoryCredits.IKS
  );
  const core = addCredits(institutionalCore, categoryCredits.DC);
  const total = Object.values(categoryCredits).reduce((sum, value) => addCredits(sum, value), 0);

  return {
    institutionalCore,
    dc: categoryCredits.DC,
    core,
    de: categoryCredits.DE,
    freeElective: categoryCredits.FE,
    mtp: categoryCredits.MTP,
    istp: categoryCredits.ISTP,
    total,
  };
};

export function computeEnrollmentCreditBreakdown({
  enrollments,
  userBranch,
  userBatch,
  requiredDE = 0,
  includeCurrentSemesterCredits = false,
  nonMgmtMinorCourseCodes,
}: Options) {
  const categoryCredits = emptyCategoryCredits();
  const icBasketUsed = { ic1: false, ic2: false };
  const hssUsed = { credits: 0 };

  const shouldCount = (enrollment: EnrollmentLike) => {
    if (enrollment.status === "COMPLETED") return !enrollment.grade || enrollment.grade !== "F";
    return includeCurrentSemesterCredits && enrollment.status === "IN_PROGRESS";
  };

  const applyMinorDeOverride = (enrollment: EnrollmentLike, category: CategoryKey): CategoryKey => {
    if (category !== "DE") return category;
    const courseCode = formatCourseCode(enrollment.course?.code ?? "");
    if (!courseCode || !nonMgmtMinorCourseCodes?.has(courseCode)) return category;
    return "FE";
  };

  const batchStr = userBatch ? String(userBatch) : "";

  // Thin adapter over the shared, canonical scorer (lib/courseCategory.ts) so the
  // batch/branch precedence stays identical everywhere. `checkBranch` is unused now
  // (the shared scorer normalizes internally) but kept in the signature for call sites.
  const pickMapping = (enrollment: EnrollmentLike, rawBranch: string, _checkBranch: string) => {
    const mappings = enrollment.course?.branchMappings || [];
    if (mappings.length === 0) return null;
    return (
      pickBranchMapping(mappings as BranchMapping[], rawBranch, userBatch ?? null) ?? null
    );
  };

  const getCourseCategory = (enrollment: EnrollmentLike): CategoryKey => {
    const courseCode = enrollment.course?.code ?? "";
    const normalizedCode = normalizeCourseCode(courseCode);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const isIkCourse = /^IK\d/.test(normalizedCode);
    const rawBranch = String(userBranch || "").trim().toUpperCase();
    const checkBranch = normalizeBranchForIcBasket(rawBranch);

    if (enrollment.isInternship || /39[69]P$/i.test(courseCode)) return "FE";

    const isBatch24Or25 = userBatch === 2024 || userBatch === 2025;
    if (normalizedCode === "IK593") return "FE";
    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode === "IC182") return isBatch24Or25 ? "IKS" : "IC";

    if ((isICB1 || isICB2) && rawBranch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[checkBranch] || {};

      if (isICB1 && branchCompulsion.ic1 && normalizedCode === normalizeCourseCode(branchCompulsion.ic1)) {
        return "IC_BASKET";
      }

      if (isICB2 && branchCompulsion.ic2 && normalizedCode === normalizeCourseCode(branchCompulsion.ic2)) {
        return "IC_BASKET";
      }

      if (isICB1 && !branchCompulsion.ic1 && !icBasketUsed.ic1) {
        icBasketUsed.ic1 = true;
        return "IC_BASKET";
      }

      if (isICB2 && !branchCompulsion.ic2 && !icBasketUsed.ic2) {
        icBasketUsed.ic2 = true;
        return "IC_BASKET";
      }

      const mapping = pickMapping(enrollment, rawBranch, checkBranch);
      if (mapping?.courseCategory === "DC") return "DC";
      return "FE";
    }

    if (normalizedCode.startsWith("HS")) {
      const before = hssUsed.credits;
      if (before < HSS_CORE_CAP) {
        hssUsed.credits = minCredits(HSS_CORE_CAP, addCredits(before, enrollment.course?.credits || 0));
        return "HSS";
      }
      return "FE";
    }

    const mapping = pickMapping(enrollment, rawBranch, checkBranch);
    if (mapping?.courseCategory === "NA") return "FE";
    if (mapping?.courseCategory === "IKS" && isIkCourse) return "FE";
    if (mapping?.courseCategory && mapping.courseCategory in categoryCredits) {
      return applyMinorDeOverride(enrollment, mapping.courseCategory as CategoryKey);
    }
    if ((enrollment.course?.branchMappings || []).length > 0) return "FE";

    if (isIkCourse) return "FE";
    if (normalizedCode.startsWith("IC")) return "IC";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

    if (enrollment.courseType === "DE") return applyMinorDeOverride(enrollment, "DE");
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    if (enrollment.courseType === "CORE") return "DC";

    const upperCode = String(courseCode || "").toUpperCase();
    if (userBranch === "CSE" && (upperCode.startsWith("DS") || upperCode.startsWith("CS"))) {
      return applyMinorDeOverride(enrollment, "DE");
    }
    if (isDataScienceBranch(userBranch) && (upperCode.startsWith("DS") || upperCode.startsWith("CS"))) {
      return applyMinorDeOverride(enrollment, "DE");
    }

    return "FE";
  };

  const sortedEnrollments = [...enrollments]
    .filter(shouldCount)
    .sort(
      (a, b) =>
        (a.semester || 0) - (b.semester || 0) ||
        normalizeCourseCode(a.course?.code).localeCompare(normalizeCourseCode(b.course?.code))
    );

  sortedEnrollments.forEach((enrollment) => {
    const hssBefore = hssUsed.credits;
    const category = getCourseCategory(enrollment);
    const credits = Number(enrollment.course?.credits || 0);

    if (category === "HSS") {
      const actualHss = subtractCredits(hssUsed.credits, hssBefore);
      categoryCredits.HSS = addCredits(categoryCredits.HSS, actualHss);
      const feOverflow = subtractCredits(credits, actualHss);
      if (feOverflow > 0) categoryCredits.FE = addCredits(categoryCredits.FE, feOverflow);
      return;
    }

    categoryCredits[category] = addCredits(categoryCredits[category], credits);
  });

  if (requiredDE > 0 && categoryCredits.DE > requiredDE) {
    const overflow = subtractCredits(categoryCredits.DE, requiredDE);
    categoryCredits.DE = subtractCredits(categoryCredits.DE, overflow);
    categoryCredits.FE = addCredits(categoryCredits.FE, overflow);
  }

  return {
    categoryCredits,
    counted: countedFromCategories(categoryCredits),
  };
}
