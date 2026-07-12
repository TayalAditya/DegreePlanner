import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { pickBranchMapping, type BranchMapping } from "@/lib/courseCategory";
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

  // Group mappings by course code, then pick the best one via the shared canonical
  // scorer (lib/courseCategory.ts) so branch/batch precedence matches everywhere.
  const mappingsByCode = new Map<string, BranchMapping[]>();
  for (const m of mappings) {
    const code = normalizeCourseCode(m.course.code);
    const list = mappingsByCode.get(code);
    if (list) list.push(m);
    else mappingsByCode.set(code, [m]);
  }

  const batchYear = userBatch ? Number(userBatch) : null;
  const categoriesByCode: Record<string, string> = {};

  for (const [code, list] of mappingsByCode) {
    const best = pickBranchMapping(list, requestedBranch, batchYear);
    if (!best) continue;
    const uiCategory = toUiCategory(best.courseCategory as CourseCategoryType);
    categoriesByCode[code] = uiCategory === "IKS" && /^IK\d/.test(code) ? "FE" : uiCategory;
  }

  return NextResponse.json({
    branch: requestedBranch,
    batch: userBatch,
    candidates,
    categoriesByCode,
  });
}
