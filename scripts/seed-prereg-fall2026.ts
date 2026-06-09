import { PrismaClient, CourseCategoryType } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;
const ELIGIBLE_SEMS = [3, 5, 7]; // B25→sem3, B24→sem5, B23→sem7

// Column indices
const C = {
  ISSUES: 0, ACTION: 1, VERDICT: 2,
  CODE: 3, NAME: 4, LTPC: 5, CREDITS: 6,
  PROF: 7, EMAIL: 8, SCHOOL: 9, SLOT: 10,
  DC: 11, DE: 12, HSS: 13, IC: 14, ICB: 15, IKS: 16, MTP: 17, FE: 18,
};

const CAT_COLS: [number, CourseCategoryType][] = [
  [C.DC,  CourseCategoryType.DC],
  [C.DE,  CourseCategoryType.DE],
  [C.HSS, CourseCategoryType.HSS],
  [C.IC,  CourseCategoryType.IC],
  [C.ICB, CourseCategoryType.IC_BASKET],
  [C.IKS, CourseCategoryType.IKS],
  [C.MTP, CourseCategoryType.MTP],
  [C.FE,  CourseCategoryType.FE],
];

// Parse "CSE S5, DSE S5, BE" → ["CSE", "DSE", "BE"]
function parseBranches(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\s+S\d+$/i, "").trim())
    .filter(Boolean);
}

// Extract the most common semester from a DC column string like "CSE S5, DSE S5" → 5
// Returns null if no semester found (means compulsory for any semester)
function extractDcSemester(dcRaw: string): number | null {
  if (!dcRaw.trim()) return null;
  const matches = [...dcRaw.matchAll(/S(\d+)/gi)];
  if (matches.length === 0) return null;
  const sems = matches.map((m) => parseInt(m[1], 10));
  // Return the most common one (usually all the same, e.g. all S5)
  const freq = new Map<number, number>();
  for (const s of sems) freq.set(s, (freq.get(s) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Normalize slot — skip non-slot values
function normalizeSlot(raw: string): string | null {
  const s = raw.trim();
  if (!s || /not required|NS|^ns$/i.test(s)) return null;
  if (/free slot/i.test(s)) return "Free Slot";
  return s;
}

async function main() {
  const wb = XLSX.readFile(
    "C:/Users/AdityaTayal/Downloads/final-compiled-course-list-recommended.xlsx"
  );
  const ws = wb.Sheets["Compiled"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
  const dataRows = rows.slice(1); // skip header

  console.log(`Processing ${dataRows.length} rows…\n`);

  // Load existing courses for fast lookup
  const existingCourses = await prisma.course.findMany({ select: { id: true, code: true } });
  const courseByCode = new Map(existingCourses.map((c) => [c.code.toUpperCase(), c.id]));

  let created = 0, updated = 0, skipped = 0, newCourses = 0, mappingsSet = 0;

  for (const row of dataRows) {
    const rawCode = String(row[C.CODE] ?? "").trim();

    // Skip blank / group rows (contains space = "IK XXX" etc.)
    if (!rawCode || rawCode.includes(" ") || rawCode.includes("|")) { skipped++; continue; }

    const verdict = String(row[C.VERDICT] ?? "").trim().toLowerCase();
    if (verdict.includes("exclude")) { skipped++; continue; }

    const code = rawCode.toUpperCase();
    const name = String(row[C.NAME] ?? "").trim() || code;
    const ltpc = String(row[C.LTPC] ?? "").trim() || null;
    const creditsRaw = parseFloat(String(row[C.CREDITS] ?? ""));
    const credits = isNaN(creditsRaw) ? (ltpc ? parseFloat(ltpc.split("-").pop()!) || 3 : 3) : creditsRaw;
    const instructor = String(row[C.PROF] ?? "").trim() || null;
    const instructorEmail = String(row[C.EMAIL] ?? "").trim() || null;
    const school = String(row[C.SCHOOL] ?? "").trim() || null;
    const slot = normalizeSlot(String(row[C.SLOT] ?? ""));

    // Build branch → category map
    const branchCatMap = new Map<string, CourseCategoryType>();
    const allBranches = new Set<string>();

    for (const [colIdx, cat] of CAT_COLS) {
      const branches = parseBranches(String(row[colIdx] ?? ""));
      for (const b of branches) {
        if (b) {
          branchCatMap.set(b, cat);
          allBranches.add(b);
        }
      }
    }

    if (allBranches.size === 0) { skipped++; continue; }

    // Find or create Course
    let courseId = courseByCode.get(code);
    if (!courseId) {
      const newCourse = await prisma.course.create({
        data: {
          code,
          name,
          credits,
          department: school ?? "Unknown",
          level: 300,
          offeredInFall: true,
          offeredInSpring: false,
          isActive: true,
        },
      });
      courseId = newCourse.id;
      courseByCode.set(code, courseId);
      newCourses++;
      console.log(`  + Created course: ${code} — ${name}`);
    }

    // Upsert CourseBranchMapping for each branch
    for (const [branch, category] of branchCatMap) {
      await prisma.courseBranchMapping.upsert({
        where: { courseId_branch_batch: { courseId, branch, batch: "" } },
        update: { courseCategory: category },
        create: { courseId, branch, batch: "", courseCategory: category, isRequired: false },
      });
      mappingsSet++;
    }

    // Upsert CourseOffering
    // Extract compulsory semester from DC column (e.g. "CSE S5" → 5)
    const compulsorySem = extractDcSemester(String(row[C.DC] ?? ""));

    const offeringData = {
      courseId,
      courseName: name,
      instructor,
      instructorEmail,
      school,
      compulsorySem,
      slots: slot,
      ltpc,
      credits,
      branches: [...allBranches],
      eligibleSems: ELIGIBLE_SEMS,
      offeringSemester: OFFERING_SEMESTER,
      offeringYear: OFFERING_YEAR,
      isActive: true,
      categoryOverride: null,
      curriculumLink: null,
    };

    const existing = await prisma.courseOffering.findUnique({
      where: { courseCode_offeringSemester_offeringYear: { courseCode: code, offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR } },
    });

    if (existing) {
      await prisma.courseOffering.update({ where: { id: existing.id }, data: offeringData });
      updated++;
    } else {
      await prisma.courseOffering.create({ data: { courseCode: code, ...offeringData } });
      created++;
    }
  }

  console.log(`\n✓ Done`);
  console.log(`  Offerings created : ${created}`);
  console.log(`  Offerings updated : ${updated}`);
  console.log(`  Rows skipped      : ${skipped}`);
  console.log(`  New courses       : ${newCourses}`);
  console.log(`  Branch mappings   : ${mappingsSet}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
