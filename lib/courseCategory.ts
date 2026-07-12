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

export interface BranchMapping {
  courseCategory: string;
  branch: string;
  batch?: string | null;
  splitCategory?: string | null;
  splitAmount?: number | null;
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
  const isBatch24Or25 = batchYear === 2024 || batchYear === 2025;
  const isIkCourse = /^IK\d/.test(nc);

  // --- Step 1: institute hard prefix rules (override the table by design) ---
  if (nc === "IK593") return "FE";              // Kulhad Economy — Free Elective for everyone
  if (nc === "IC181") return "HSS";             // IKS → HSS+IKS basket
  if (nc === "IC182") return isBatch24Or25 ? "HSS" : "IC";
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
