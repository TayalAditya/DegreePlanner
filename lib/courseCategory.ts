/**
 * Single source of truth for resolving a course's category.
 *
 * The `CourseBranchMapping` table is authoritative. A course's category is
 * resolved in this fixed order (see `resolveBaseCategory`):
 *
 *   1. Institute hard prefix rules (HS/IK/IC181/IC182/IK593) — these intentionally
 *      override the table (institute-wide rules that no branch mapping should change).
 *   2. The mapping table (branch + batch aware) via `pickBranchMapping`.  ← source of truth
 *   3. If no table row applies: an applicable prefix/branch fallback
 *      (CS/DS/CE → DE, IC → IC) and then `courseType`.
 *   4. Otherwise: FE.
 *
 * IMPORTANT — what this module deliberately does NOT do:
 *   - IC-basket consumption ("first ICB course counts as IC_BASKET") is order-dependent
 *     and stateful, so it stays at each call site. For ICB1/ICB2 codes this returns the
 *     sentinel "IC_BASKET_CANDIDATE" (unless a branch mapping forces DC/DE) so callers can
 *     run their own basket bookkeeping.
 *   - HSS credit-cap accumulation stays at call sites. This just returns "HSS"; callers
 *     apply the cap and may spill overflow to FE.
 *   - The minor-DE override stays at call sites (each surface has its own closure). Apply
 *     it to a returned "DE".
 */
import { getBranchCandidates, isDataScienceBranch, normalizeBranchCode } from "@/lib/branchInfo";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import { ICB1_CODES, ICB2_CODES } from "@/lib/icBasketConfig";
import { addCredits } from "@/lib/utils";

export interface BranchMapping {
  courseCategory: string;
  branch: string;
  batch?: string | null;
  splitCategory?: string | null;
  splitAmount?: number | null;
}

/**
 * HSS+IKS core requirement: the credits that satisfy the degree's HSS+IKS
 * basket. BTech = 15, BSCS = 12 (identified by its lower IC requirement).
 */
export const getHssIksCoreCap = (programIcCredits?: number | null) =>
  (programIcCredits ?? 60) <= 52 ? 12 : 15;

/**
 * HSS+IKS degree cap: combined HSS+IKS credits beyond this do not count toward
 * the degree total at all (they show as "Not in Degree").
 *
 * B23 received a BOA relaxation raising the cap from 20 → 30; every other batch
 * stays at 20. Every surface that splits HSS+IKS credits MUST read the cap from
 * here — a hardcoded 20 silently under-counts a B23 student's degree total.
 */
export const HSS_IKS_DEGREE_CAP_DEFAULT = 20;
export const HSS_IKS_DEGREE_CAP_B23 = 30;

/**
 * `User.batch` is a 4-digit year in most rows but a 2-digit one ("23") in some
 * older records, so normalize before comparing. Getting this wrong would hand a
 * B23 student the 20-credit cap instead of 30.
 */
export const normalizeBatchYear = (batch?: number | string | null): number | null => {
  const raw = Number(batch);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw < 100 ? 2000 + Math.trunc(raw) : Math.trunc(raw);
};

export const getHssIksDegreeCap = (batchYear?: number | string | null) =>
  normalizeBatchYear(batchYear) === 2023 ? HSS_IKS_DEGREE_CAP_B23 : HSS_IKS_DEGREE_CAP_DEFAULT;

/**
 * Courses that take their place in the HSS+IKS basket but pay out as DE, for one
 * specific branch + batch.
 *
 * IK-502 (Introduction to Bio-signals) is IK-coded, so by default it lands in the
 * shared HSS+IKS basket like any other IKS course. For B23 DSE it is a DE
 * instead: the course is still checked against the HSS+IKS degree cap, but the
 * credits that fit are credited to DE rather than to HSS core / FE, and anything
 * beyond the cap does not count toward the degree at all.
 *
 * Two properties of this rule that are easy to get wrong:
 *   - It CONSUMES basket room. Taking IK-502 leaves less HSS+IKS space for other
 *     HS/IK courses even though its own credits land in DE.
 *   - A course straddling the cap splits pro-rata — the in-cap part becomes DE,
 *     the remainder is excluded. It is not all-or-nothing.
 *
 * Every other branch and batch keeps the ordinary HSS+IKS treatment.
 */
const HSS_IKS_AS_DE_RULES: ReadonlyArray<{
  code: string;
  batchYear: number;
  branches: ReadonlySet<string>;
}> = [
  {
    code: "IK502",
    batchYear: 2023,
    // DSE only. DS and DSAI are accepted because this codebase aliases the whole
    // data-science family (see getBranchCandidates / isDataScienceBranch) and a
    // B23 row may carry any of the three spellings. DSAI only became a
    // standalone curriculum in B25, so this does not sweep in a separate B23
    // DSAI cohort — there isn't one.
    branches: new Set(["DSE", "DS", "DSAI"]),
  },
];

/**
 * Does this course consume HSS+IKS room but count as DE for this student?
 * See HSS_IKS_AS_DE_RULES. Callers apply the cap themselves and then pass the
 * result through `routeHssIksSplit`.
 */
export function hssIksCountsAsDe(
  code?: string | null,
  branch?: string | null,
  batchYear?: number | string | null,
): boolean {
  const normalizedCode = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalizedCode) return false;
  const normalizedBranch = normalizeBranchCode(branch) || String(branch ?? "").trim().toUpperCase();
  const year = normalizeBatchYear(batchYear);
  return HSS_IKS_AS_DE_RULES.some(
    (rule) =>
      rule.code === normalizedCode &&
      rule.batchYear === year &&
      rule.branches.has(normalizedBranch),
  );
}

/**
 * Send an HSS+IKS cap split to its final baskets.
 *
 * The cap splitters answer "how much of this course fits" — a core portion, an
 * FE portion, and the excluded remainder. For a DE-paying course everything that
 * fit becomes DE instead. The consumed amount (`hss + fe + de`) is identical
 * either way, which is exactly what makes the basket bookkeeping unchanged.
 */
export function routeHssIksSplit(
  split: { hss: number; fe: number; notInDegree: number },
  countsAsDe: boolean,
): { hss: number; fe: number; de: number; notInDegree: number } {
  if (!countsAsDe) return { hss: split.hss, fe: split.fe, de: 0, notInDegree: split.notInDegree };
  return { hss: 0, fe: 0, de: addCredits(split.hss, split.fe), notInDegree: split.notInDegree };
}

/**
 * Pick the best mapping for a given branch + batch.
 * Within the same branch priority, a batch-specific mapping beats a generic one (batch="").
 * Moved verbatim from the former private copy in creditCalculator.ts (the canonical scorer).
 */
export function pickBranchMapping(
  mappings: BranchMapping[] | undefined,
  branch?: string,
  batchYear?: number | null
): BranchMapping | undefined {
  if (!mappings || mappings.length === 0) return undefined;

  const normalizedBranch = normalizeBranchCode(branch);
  const candidates = getBranchCandidates(normalizedBranch);
  const candidateOrder = new Map<string, number>(candidates.map((br, idx) => [br, idx]));
  const batchStr = batchYear ? String(batchYear) : "";

  let best: BranchMapping | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const m of mappings) {
    const mappingBranch = normalizeBranchCode(m.branch);
    const mappingBatch = m.batch ?? "";

    // Skip mappings that don't apply to this batch
    if (mappingBatch !== "" && mappingBatch !== batchStr) continue;

    let branchIdx: number;

    const directIdx = candidateOrder.get(mappingBranch);
    if (directIdx !== undefined) {
      branchIdx = directIdx;
    } else if (normalizedBranch === "GE" && mappingBranch.startsWith("GE") && candidateOrder.has("GE")) {
      branchIdx = (candidateOrder.get("GE") ?? Number.POSITIVE_INFINITY) + 0.5;
    } else {
      continue;
    }

    // Lower score = better: branch priority * 2, minus 1 bonus for batch-specific match
    const batchBonus = batchStr && mappingBatch === batchStr ? 0 : 1;
    const score = branchIdx * 2 + batchBonus;

    if (score < bestScore) {
      best = m;
      bestScore = score;
    }
  }

  return best;
}

export function pickBranchMappingCategory(
  mappings: BranchMapping[] | undefined,
  branch?: string,
  batchYear?: number | null
): string | undefined {
  return pickBranchMapping(mappings, branch, batchYear)?.courseCategory;
}

/**
 * Base categories returned by `resolveBaseCategory`.
 * "IC_BASKET_CANDIDATE" is a sentinel: an ICB1/ICB2 course with no forcing branch mapping —
 * the caller must run its own IC-basket consumption logic to decide IC_BASKET vs FE.
 */
export type BaseCategory =
  | "IC" | "IC_BASKET" | "IC_BASKET_CANDIDATE" | "DC" | "DE"
  | "HSS" | "FE" | "MTP" | "ISTP" | "PE";

export interface ResolvableCourse {
  code: string;
  courseType?: string | null;
  branchMappings?: BranchMapping[] | null;
}

function normalize(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Resolve a course's base category. Pure and stateless. Table-first (see file header).
 *
 * @param course        code + optional courseType + branchMappings
 * @param branch        student branch (raw or normalized; normalized internally)
 * @param batchYear     e.g. 2024 — enables batch-specific mappings and IC182 IKS rule
 */
export function resolveBaseCategory(
  course: ResolvableCourse,
  branch?: string | null,
  batchYear?: number | null
): BaseCategory {
  const rawCode = course.code || "";
  const code = rawCode.toUpperCase();
  const nc = normalize(rawCode);
  // IC182 joined the IKS/HSS basket with B24 and remains there for later
  // intakes, including B26.
  const usesIc182AsIks = batchYear != null && batchYear >= 2024;
  const isIkCourse = /^IK\d/.test(nc);

  // --- Step 1: institute hard prefix rules (override the table by design) ---
  if (nc === "IK593") return "FE";              // Kulhad Economy — Free Elective for everyone
  if (nc === "IC181") return "HSS";             // IKS → HSS+IKS basket
  if (nc === "IC182") return usesIc182AsIks ? "HSS" : "IC";
  if (code.startsWith("HS") || isIkCourse) return "HSS";

  const isICB1 = ICB1_CODES.has(nc);
  const isICB2 = ICB2_CODES.has(nc);

  // --- Step 2: mapping table (source of truth) ---
  const mapping = pickBranchMapping(course.branchMappings ?? undefined, branch ?? undefined, batchYear);
  if (mapping) {
    switch (mapping.courseCategory) {
      case "NA":
      case "BACKLOG":
      case "INTERNSHIP":
        return "FE";
      case "IKS":
        return "HSS";                            // IKS-mapped → HSS+IKS basket
      case "IC": case "IC_BASKET": case "DC":
      case "DE": case "FE": case "HSS":
      case "MTP": case "ISTP": case "PE":
        return mapping.courseCategory as BaseCategory;
      default:
        return "FE";
    }
  }

  // ICB course with no forcing mapping → let the caller run basket-consumption logic.
  if (isICB1 || isICB2) return "IC_BASKET_CANDIDATE";

  // Course HAS mappings but none matched this student's branch → not in their curriculum → FE.
  if (course.branchMappings && course.branchMappings.length > 0) return "FE";

  // --- Step 3: no table row at all — applicable prefix / courseType fallbacks ---
  if (nc.startsWith("IC")) return "IC";

  const special = getSpecialDpCategory(nc);
  if (special === "FE") return "FE";
  if (special === "MTP") return "MTP";
  if (special === "ISTP") return "ISTP";

  // Branch DE-fallback (CS/DS for CSE/DS branches, CE for Civil) — ONLY reached when the
  // table has no row for this course, so it can never outrank a mapping.
  const normBranch = normalizeBranchCode(branch);
  const isCsDs = nc.startsWith("CS") || nc.startsWith("DS");
  if (isCsDs && (normBranch === "CSE" || isDataScienceBranch(normBranch))) return "DE";
  if (normBranch === "CE" && nc.startsWith("CE")) return "DE";

  // courseType fallback (authoritative ordering from the credit calculator).
  switch (course.courseType) {
    case "CORE": return "DC";
    case "DE": return "DE";
    case "PE": return "PE";
    case "MTP": return "MTP";
    case "ISTP": return "ISTP";
    case "FREE_ELECTIVE": return "FE";
    default: return "FE";
  }
}
