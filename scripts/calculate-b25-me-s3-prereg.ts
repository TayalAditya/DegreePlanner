// calculate-b25-me-s3-prereg.ts
// Calculate total compulsory pre-reg credits for B25 ME in semester 3 (Fall 2026)
// after moving IC-241 to semester 4.
import { PrismaClient } from "@prisma/client";
import { getBranchCandidates, normalizeBranchCode } from "../lib/branchInfo";

const prisma = new PrismaClient();

const OFFERING_SEMESTER = 3;
const OFFERING_YEAR = 2026;
const BRANCH = "ME";
const BATCH = 2025;

function pickCategory(
  branchMappings: Array<{ courseCategory: string; branch: string; batch: string }> | undefined,
  branch: string,
  batch: number
): string | undefined {
  if (!branchMappings || branchMappings.length === 0) return undefined;
  const candidates = getBranchCandidates(branch);
  const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
  const batchStr = String(batch);

  let best: { courseCategory: string } | undefined;
  let bestScore = Infinity;

  for (const m of branchMappings) {
    const idx = order.get(normalizeBranchCode(m.branch));
    if (idx === undefined) continue;
    const batchPenalty = m.batch && m.batch !== "" ? (m.batch === batchStr ? 0 : 1000) : 0.5;
    const score = idx + batchPenalty;
    if (score < bestScore) { best = m; bestScore = score; }
  }
  return best?.courseCategory;
}

function pickSemester(
  branchMappings: Array<{ semester: number | null; branch: string; batch: string }> | undefined,
  branch: string,
  batch: number
): number | null {
  if (!branchMappings || branchMappings.length === 0) return null;
  const candidates = getBranchCandidates(branch);
  const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
  const batchStr = String(batch);

  let best: { semester: number | null } | undefined;
  let bestScore = Infinity;

  for (const m of branchMappings) {
    const idx = order.get(normalizeBranchCode(m.branch));
    if (idx === undefined) continue;
    const batchPenalty = m.batch && m.batch !== "" ? (m.batch === batchStr ? 0 : 1000) : 0.5;
    const score = idx + batchPenalty;
    if (score < bestScore) { best = m; bestScore = score; }
  }
  return best?.semester ?? null;
}

async function main() {
  const normalizedBranch = normalizeBranchCode(BRANCH);
  const branchCandidates = getBranchCandidates(normalizedBranch);

  const offerings = await prisma.courseOffering.findMany({
    where: { offeringYear: OFFERING_YEAR, isActive: true },
    include: {
      course: {
        select: {
          id: true,
          branchMappings: {
            select: { courseCategory: true, branch: true, batch: true, semester: true }
          },
        },
      },
    },
    orderBy: { courseCode: "asc" },
  });

  const skippedNoSlot: string[] = [];

  console.log(`\n=== B25 ME Semester 3 Pre-Registration Credits (Fall 2026) ===\n`);
  console.log(`Branch: ${BRANCH}, Batch: ${BATCH}, Offering Semester: ${OFFERING_SEMESTER}\n`);

  const compulsoryCourses: Array<{
    code: string;
    name: string;
    credits: number;
    category: string;
    semester: number | null;
  }> = [];

  for (const o of offerings) {
    // API hides offerings with no slot AND no instructor
    if (!o.slots && !o.instructor) {
      // only note it if it would otherwise have been eligible+compulsory
      skippedNoSlot.push(o.courseCode);
      continue;
    }
    // Filter by branch eligibility
    const eligible =
      o.branches.includes("ALL") ||
      o.branches.some((b) => branchCandidates.includes(normalizeBranchCode(b)));
    if (!eligible) continue;

    // Filter by eligible semester
    if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(OFFERING_SEMESTER)) continue;

    // Resolve category
    const mappingCategory = o.course
      ? pickCategory(o.course.branchMappings, normalizedBranch, BATCH)
      : undefined;
    const baseCat = mappingCategory ?? o.categoryOverride ?? "FE";

    // Check if compulsory category
    const isCompulsoryCategory = ["IC", "IC_BASKET", "DC", "IKS"].includes(baseCat);
    if (!isCompulsoryCategory) continue;

    // Get branch-specific semester
    const branchMappingSem = o.course
      ? pickSemester(o.course.branchMappings, normalizedBranch, BATCH)
      : null;
    const effectiveCompulsorySem = branchMappingSem ?? o.compulsorySem;

    // Check if compulsory for this semester
    const semesterMatches = effectiveCompulsorySem == null || effectiveCompulsorySem === OFFERING_SEMESTER;

    // For this calculation, assume no backlogs (student hasn't completed anything yet)
    const isBacklog = false;

    if (!semesterMatches && !isBacklog) continue;

    compulsoryCourses.push({
      code: o.courseCode,
      name: o.courseName,
      credits: o.credits,
      category: baseCat,
      semester: effectiveCompulsorySem,
    });
  }

  // Sort by category, then by code
  compulsoryCourses.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.code.localeCompare(b.code);
  });

  // Print results
  let totalCredits = 0;
  const byCategory: Record<string, number> = {};

  console.log("Compulsory Courses:\n");
  console.log("Code".padEnd(12) + "Name".padEnd(40) + "Cat".padEnd(12) + "Sem".padEnd(6) + "Cr");
  console.log("-".repeat(76));

  for (const c of compulsoryCourses) {
    console.log(
      c.code.padEnd(12) +
      c.name.substring(0, 38).padEnd(40) +
      c.category.padEnd(12) +
      String(c.semester ?? "–").padEnd(6) +
      c.credits
    );
    totalCredits += c.credits;
    byCategory[c.category] = (byCategory[c.category] ?? 0) + c.credits;
  }

  console.log("-".repeat(76));
  console.log(`\nTotal (all compulsory shown): ${totalCredits} credits`);

  // IC-181 & IC-182 are the IKS basket — only ONE (3 cr) is actually required.
  const hasBothIks =
    compulsoryCourses.some((c) => c.code.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "IC181") &&
    compulsoryCourses.some((c) => c.code.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "IC182");
  const realisticTotal = hasBothIks ? totalCredits - 3 : totalCredits;

  console.log("\nBreakdown by Category:");
  for (const [cat, cr] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat.padEnd(12)}: ${cr} credits`);
  }

  if (hasBothIks) {
    console.log(
      `\nNote: IC-181 & IC-182 are the IKS basket — only ONE (3 cr) is required, not both.`
    );
    console.log(`Realistic compulsory total (one IKS): ${realisticTotal} credits`);
  }

  if (skippedNoSlot.length) {
    console.log(`\n(Offerings hidden by no-slot/no-instructor filter: ${skippedNoSlot.length})`);
  }

  console.log(`\nCredit Limit for B25 Semester 3: 25 credits`);
  console.log(`Remaining capacity for electives: ${25 - totalCredits} credits`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
