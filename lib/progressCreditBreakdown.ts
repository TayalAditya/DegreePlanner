import { getBranchCandidates, isDataScienceBranch } from "@/lib/branchInfo";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import { pickBranchMapping, getHssIksDegreeCap, hssIksCountsAsDe, routeHssIksSplit, type BranchMapping } from "@/lib/courseCategory";
import { addCredits, minCredits, subtractCredits } from "@/lib/utils";
import { getEnrollmentCredits } from "@/lib/enrollmentCredits";
import { getMtpComponent } from "@/lib/mtpConfig";
import { yifComponentForCourse, YIF_VACATION_INTERNSHIP_CREDITS } from "@/lib/yif";

type CategoryKey = "IC" | "IC_BASKET" | "DC" | "DE" | "FE" | "HSS" | "IKS" | "MTP" | "ISTP" | "YIF" | "NOT_IN_DEGREE";

export type CategoryCreditBreakdown = Record<CategoryKey, number>;

export type CountedCreditBreakdown = {
  ic: number;
  icBasket: number;
  hssIks: number;
  institutionalCore: number;
  dc: number;
  core: number;
  de: number;
  freeElective: number;
  mtp: number;
  istp: number;
  yif: number;
  notInDegree: number;
  total: number;
};

type EnrollmentLike = {
  semester?: number | null;
  status?: string | null;
  grade?: string | null;
  courseType?: string | null;
  isPassFail?: boolean | null;
  isInternship?: boolean | null;
  course?: {
    code?: string | null;
    credits?: number | null;
    branchMappings?: Array<{
      branch?: string | null;
      batch?: string | null;
      courseCategory?: string | null;
      splitCategory?: string | null;
      splitAmount?: number | null;
    }>;
  } | null;
};

type Options = {
  enrollments: EnrollmentLike[];
  userBranch?: string | null;
  userBatch?: number | null;
  /** Program IC requirement determines the HSS+IKS core cap: BTech=15, BSCS=12. */
  programIcCredits?: number | null;
  requiredDE?: number;
  doingYIF?: boolean;
  includeCurrentSemesterCredits?: boolean;
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

// HSS+IKS combined credits beyond this cap do not count toward the degree total.
// Cap is batch-specific: B23 gets a 30-credit BOA relaxation; all others stay at 20.
// Passed as a parameter so the pure function stays testable.

// Split one course's credits across the HSS+IKS buckets:
//   0–coreCap → core(HSS) ; coreCap–feCap → FE ; >feCap → Not in Degree (drained)
function splitHssIksCredits(before: number, credits: number, coreCap: number, feCap: number) {
  const afterCore = minCredits(coreCap, addCredits(before, credits));
  const hss = subtractCredits(afterCore, minCredits(coreCap, before));
  const afterFe = minCredits(feCap, addCredits(before, credits));
  const fe = subtractCredits(afterFe, minCredits(feCap, addCredits(before, hss)));
  const notInDegree = subtractCredits(credits, addCredits(hss, fe));
  return { hss, fe, notInDegree };
}

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
  YIF: 0,
  NOT_IN_DEGREE: 0,
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

const countedFromCategories = (
  categoryCredits: CategoryCreditBreakdown,
  yifVacationOverlapCredits = 0,
): CountedCreditBreakdown => {
  const institutionalCore = addCredits(
    categoryCredits.IC,
    categoryCredits.IC_BASKET,
    categoryCredits.HSS,
    categoryCredits.IKS
  );
  const core = addCredits(institutionalCore, categoryCredits.DC);
  // NOT_IN_DEGREE credits are excluded from the degree total.
  const totalBeforeYifOverlap = Object.entries(categoryCredits)
    .filter(([key]) => key !== "NOT_IN_DEGREE")
    .reduce((sum, [, value]) => addCredits(sum, value), 0);
  const total = Math.max(
    0,
    subtractCredits(
      totalBeforeYifOverlap,
      minCredits(yifVacationOverlapCredits, categoryCredits.YIF),
    ),
  );

  return {
    ic: categoryCredits.IC,
    icBasket: categoryCredits.IC_BASKET,
    hssIks: addCredits(categoryCredits.HSS, categoryCredits.IKS),
    institutionalCore,
    dc: categoryCredits.DC,
    core,
    de: categoryCredits.DE,
    freeElective: categoryCredits.FE,
    mtp: categoryCredits.MTP,
    istp: categoryCredits.ISTP,
    yif: categoryCredits.YIF,
    notInDegree: categoryCredits.NOT_IN_DEGREE,
    total,
  };
};

export function computeEnrollmentCreditBreakdown({
  enrollments,
  userBranch,
  userBatch,
  programIcCredits,
  requiredDE = 0,
  doingYIF = false,
  includeCurrentSemesterCredits = false,
}: Options) {
  const categoryCredits = emptyCategoryCredits();
  const icBasketUsed = { ic1: false, ic2: false };
  const hssUsed = { credits: 0 };
  let yifSp1Used = false;
  let yifVacationOverlapCredits = 0;
  const hssCoreCap = (programIcCredits ?? 60) <= 52 ? 12 : 15;
  // B23 BOA relaxation: HSS+IKS degree cap raised from 20 → 30.
  const hssFeCap = getHssIksDegreeCap(userBatch);

  const shouldCount = (enrollment: EnrollmentLike) => {
    if (enrollment.status === "COMPLETED") return !enrollment.grade || enrollment.grade !== "F";
    return includeCurrentSemesterCredits && enrollment.status === "IN_PROGRESS";
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
    // MTP is a dedicated requirement. Check it before P/F treatment and
    // branch mapping so a stale or broad mapping cannot turn it into FE/DE.
    if (enrollment.courseType === "MTP" || getMtpComponent(normalizedCode) !== null) return "MTP";
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const isIkCourse = /^IK\d/.test(normalizedCode);
    const rawBranch = String(userBranch || "").trim().toUpperCase();
    const checkBranch = normalizeBranchForIcBasket(rawBranch);
    const mapping = pickMapping(enrollment, rawBranch, checkBranch);
    const isHssIksCourse =
      normalizedCode.startsWith("HS") ||
      isIkCourse ||
      normalizedCode === "IC181" ||
      (normalizedCode === "IC182" && userBatch != null && userBatch >= 2024) ||
      mapping?.courseCategory === "HSS" ||
      mapping?.courseCategory === "IKS";

    // P/F uses the separate P/F allowance. A P/F HSS/IKS course still takes
    // room in the combined HSS+IKS basket, so it counts toward the degree only
    // through that basket's 20-credit cap.
    if (enrollment.isPassFail) return isHssIksCourse ? "HSS" : "FE";
    if (enrollment.isInternship || /39[69]P$/i.test(courseCode)) return "FE";

    const usesIc182AsIks = userBatch != null && userBatch >= 2024;
    // IKS courses share the HSS+IKS basket. The credit splitter below moves
    // only any excess beyond the basket cap into FE.
    if (normalizedCode === "IK593") return "HSS";
    if (normalizedCode === "IC181") return "HSS";
    if (normalizedCode === "IC182") return usesIc182AsIks ? "IKS" : "IC";

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
      if (mapping?.courseCategory === "DE") return "DE";
      return "FE";
    }

    if (normalizedCode.startsWith("HS")) {
      return "HSS";
    }

    // IK-502 for B23 DSE consumes HSS+IKS room and the split below re-routes the
    // in-cap portion to DE. Must precede the mapping lookup, which maps IK-502 to
    // a plain DE for DSE and would skip the cap entirely. Placed after the P/F
    // return above so a P/F IK-502 keeps the ordinary HSS+IKS treatment.
    if (hssIksCountsAsDe(courseCode, userBranch, userBatch)) {
      return "HSS";
    }

    if (mapping?.courseCategory === "NA") return "FE";
    if (mapping?.courseCategory === "IKS" && isIkCourse) return "HSS";
    if (mapping?.courseCategory && mapping.courseCategory in categoryCredits) {
      return mapping.courseCategory as CategoryKey;
    }
    if ((enrollment.course?.branchMappings || []).length > 0) return "FE";

    if (isIkCourse) return "HSS";
    if (normalizedCode.startsWith("IC")) return "IC";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

    if (enrollment.courseType === "DE") return "DE";
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    if (enrollment.courseType === "CORE") return "DC";

    const upperCode = String(courseCode || "").toUpperCase();
    if (userBranch === "CSE" && (upperCode.startsWith("DS") || upperCode.startsWith("CS"))) {
      return "DE";
    }
    if (isDataScienceBranch(userBranch) && (upperCode.startsWith("DS") || upperCode.startsWith("CS"))) {
      return "DE";
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
    const credits = Number(enrollment.course?.credits || 0);

    if (doingYIF) {
      const yifComponent = yifComponentForCourse(enrollment.course?.code, userBatch, credits);
      if (yifComponent) {
        if (yifComponent !== "sp1" || !yifSp1Used) {
          categoryCredits.YIF = addCredits(categoryCredits.YIF, credits);
          if (yifComponent === "sp1") yifSp1Used = true;
        }
        if (yifComponent !== "vacation") return;

        // The compulsory vacation internship remains in its normal basket as
        // well as satisfying the YIF vacation component. Count it only once
        // in the degree total below.
        yifVacationOverlapCredits = minCredits(
          YIF_VACATION_INTERNSHIP_CREDITS,
          addCredits(yifVacationOverlapCredits, credits),
        );
        if ((programIcCredits ?? 60) <= 52) {
          categoryCredits.FE = addCredits(categoryCredits.FE, credits);
        } else {
          categoryCredits.IC = addCredits(categoryCredits.IC, credits);
        }
        return;
      }
    }

    const category = getCourseCategory(enrollment);

    // A branch mapping can allocate one course across two baskets. For example,
    // CSE's IN-2406 contributes 3 DC + 1 FE rather than four credits to one
    // category. Apply the same allocation used by the full progress calculator.
    const rawBranch = String(userBranch || "").trim().toUpperCase();
    const checkBranch = normalizeBranchForIcBasket(rawBranch);
    const mapping = pickMapping(enrollment, rawBranch, checkBranch);
    const splitAmount = Number(mapping?.splitAmount ?? 0);
    const splitCategory = mapping?.splitCategory as CategoryKey | undefined;
    const canSplit =
      splitAmount > 0 &&
      splitAmount < credits &&
      splitCategory &&
      splitCategory in categoryCredits &&
      category !== "MTP" &&
      category !== "HSS" &&
      category !== "IKS";

    if (canSplit) {
      categoryCredits[category] = addCredits(categoryCredits[category], subtractCredits(credits, splitAmount));
      categoryCredits[splitCategory] = addCredits(categoryCredits[splitCategory], splitAmount);
      return;
    }

    if (category === "HSS" || category === "IKS") {
      const before = hssUsed.credits;
      // A DE-paying course still consumes basket room, so `hssUsed` advances by
      // everything that fit (hss + fe + de) regardless of where it landed.
      const { hss, fe, de, notInDegree } = routeHssIksSplit(
        splitHssIksCredits(before, credits, hssCoreCap, hssFeCap),
        hssIksCountsAsDe(enrollment.course?.code, userBranch, userBatch)
      );
      hssUsed.credits = addCredits(before, hss, fe, de);
      if (hss > 0) categoryCredits.HSS = addCredits(categoryCredits.HSS, hss);
      if (fe > 0) categoryCredits.FE = addCredits(categoryCredits.FE, fe);
      if (de > 0) categoryCredits.DE = addCredits(categoryCredits.DE, de);
      if (notInDegree > 0) categoryCredits.NOT_IN_DEGREE = addCredits(categoryCredits.NOT_IN_DEGREE, notInDegree);
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
    counted: countedFromCategories(categoryCredits, yifVacationOverlapCredits),
  };
}
