import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseCategoryType } from "@prisma/client";

function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeBranchCode(branch: string): string {
  const b = branch.trim().toUpperCase();
  if (!b) return b;

  // UI aliases used in `defaultCurriculum.ts` / import UI
  if (b === "GERAI") return "GE-ROBO";
  if (b === "GECE") return "GE-COMM";
  if (b === "GEMECH") return "GE-MECH";

  return b;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getBranchCandidates(branch: string): string[] {
  const b = normalizeBranchCode(branch);
  const candidates: string[] = [b];

  if (b === "CSE") candidates.push("CS");
  if (b === "CS") candidates.push("CSE");

  if (b === "DSE") candidates.push("DS");
  if (b === "DS") candidates.push("DSE");

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

  if (b === "GE-MECH" || b === "GE-COMM" || b === "GE-ROBO") candidates.push("GE");

  candidates.push("COMMON");
  return unique(candidates);
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

  // Students should only fetch their own branch (or a GE specialization under GE).
  if (session.user.role !== "ADMIN") {
    const userBranch = normalizeBranchCode(session.user.branch || "");
    if (userBranch && requestedBranch !== userBranch) {
      const allowed = new Set(getBranchCandidates(userBranch));
      const isGeSubBranch = userBranch === "GE" && requestedBranch.startsWith("GE-");
      if (!allowed.has(requestedBranch) && !isGeSubBranch) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const candidates = getBranchCandidates(requestedBranch);
  const candidateOrder = new Map<string, number>(candidates.map((b, idx) => [b, idx]));

  const mappings = await prisma.courseBranchMapping.findMany({
    where: { branch: { in: candidates } },
    select: {
      branch: true,
      courseCategory: true,
      course: { select: { code: true } },
    },
  });

  const pickedIndexByCode = new Map<string, number>();
  const categoriesByCode: Record<string, string> = {};

  for (const m of mappings) {
    const code = normalizeCourseCode(m.course.code);
    const idx = candidateOrder.get(m.branch) ?? Number.POSITIVE_INFINITY;
    const existingIdx = pickedIndexByCode.get(code);
    if (existingIdx !== undefined && existingIdx <= idx) continue;

    pickedIndexByCode.set(code, idx);
    categoriesByCode[code] = toUiCategory(m.courseCategory);
  }

  return NextResponse.json({
    branch: requestedBranch,
    candidates,
    categoriesByCode,
  });
}

