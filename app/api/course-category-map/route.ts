import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { CourseCategoryType } from "@prisma/client";

function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toUiCategory(category: CourseCategoryType): string {
  switch (category) {
    case "IC_BASKET":
      return "ICB";
    case "NA":
    case "BACKLOG":
    case "INTERNSHIP":
      return "FE";
    default:
      return category;
  }
}

// GET /api/course-category-map?branch=...
// Returns a map: normalizedCode -> UI course category (IC, ICB, DC, DE, HSS, IKS, FE, MTP, ISTP)
// Batch-specific mappings take priority over generic (batch="") mappings.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedBranchRaw = searchParams.get("branch") || session.user.branch || "";
  const requestedBranch = normalizeBranchCode(requestedBranchRaw);

  if (!requestedBranch) {
    return NextResponse.json({ error: "branch is required" }, { status: 400 });
  }

  // Resolve user batch: prefer query param (for impersonation), fall back to session
  const batchParam = searchParams.get("batch");
  const userBatch = batchParam !== null
    ? batchParam
    : session.user.batch ? String(session.user.batch) : "";

  const candidates = getBranchCandidates(requestedBranch);
  const candidateOrder = new Map<string, number>(candidates.map((b, idx) => [b, idx]));

  // Fetch mappings for this branch's candidates, for generic batch "" AND the user's specific batch
  const batchFilter = userBatch
    ? { in: ["", userBatch] }
    : { equals: "" };

  const mappings = await prisma.courseBranchMapping.findMany({
    where: {
      branch: { in: candidates },
      batch: batchFilter,
    },
    select: {
      branch: true,
      batch: true,
      courseCategory: true,
      course: { select: { code: true } },
    },
  });

  // For each course code, pick the best mapping:
  //   lower candidateOrder index = better branch match
  //   within same branch priority, batch-specific beats generic (score += 0 vs 1)
  const pickedScoreByCode = new Map<string, number>();
  const categoriesByCode: Record<string, string> = {};

  for (const m of mappings) {
    const code = normalizeCourseCode(m.course.code);
    const branchIdx = candidateOrder.get(m.branch) ?? Number.POSITIVE_INFINITY;
    const batchBonus = userBatch && m.batch === userBatch ? 0 : 1;
    const score = branchIdx * 2 + batchBonus;

    const existingScore = pickedScoreByCode.get(code);
    if (existingScore !== undefined && existingScore <= score) continue;

    pickedScoreByCode.set(code, score);

    const uiCategory = toUiCategory(m.courseCategory);
    categoriesByCode[code] = uiCategory === "IKS" && /^IK\d/.test(code) ? "FE" : uiCategory;
  }

  return NextResponse.json({
    branch: requestedBranch,
    batch: userBatch,
    candidates,
    categoriesByCode,
  });
}
