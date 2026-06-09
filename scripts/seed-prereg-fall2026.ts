import { PrismaClient, CourseCategoryType } from "@prisma/client";
import XLSX from "xlsx";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;
const ALL_ACTIVE_SEMS = [3, 5, 7];

// IC courses with non-default semesters (everything else IC defaults to sem 1)
const IC_SEM_OVERRIDES: Record<string, number> = {
  "IC-202P": 3,
  "IC-222P": 3,
  "IC-252":  2, // sem 2 — not offered in Fall pre-reg
  "IC-240":  2,
  "IC-241":  2,
  "IC-253":  2,
  "IC-121":  2,
};

// Eligible sems = odd active sems >= compulsorySem
// Even-sem courses (sem 2, 4 etc.) get empty → isActive=false effectively
// e.g. compulsorySem=5 → [5,7]; compulsorySem=7 → [7]; null/1 → [3,5,7]; 2/4 → []
function computeEligibleSems(compulsorySem: number | null): number[] {
  const min = compulsorySem ?? 1;
  if (min % 2 === 0) return []; // even-sem course → hide from Fall pre-reg
  const filtered = ALL_ACTIVE_SEMS.filter((s) => s >= min);
  return filtered.length > 0 ? filtered : ALL_ACTIVE_SEMS;
}

const C = {
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

function parseBranches(raw: string): string[] {
  return raw.split(",").map((s) => s.trim().replace(/\s+S\d+$/i, "").trim()).filter(Boolean);
}

function extractDcSemester(dcRaw: string): number | null {
  const matches = [...dcRaw.matchAll(/S(\d+)/gi)];
  if (!matches.length) return null;
  const freq = new Map<number, number>();
  for (const m of matches) freq.set(parseInt(m[1]), (freq.get(parseInt(m[1])) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeSlot(raw: string): string | null {
  const s = raw.trim();
  if (!s || /not required|^ns$/i.test(s)) return null;
  if (/free slot/i.test(s)) return "Free Slot";
  return s;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const wb = XLSX.readFile("C:/Users/AdityaTayal/Downloads/final-compiled-course-list-recommended.xlsx");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Compiled"], { header: 1, defval: "" }) as string[][];
  const dataRows = rows.slice(1);
  console.log(`Parsed ${dataRows.length} rows from sheet`);

  // ── Step 1: pre-load existing data ────────────────────────────────────────
  const [existingCourses, existingOfferings, existingMappings] = await Promise.all([
    prisma.course.findMany({ select: { id: true, code: true } }),
    prisma.courseOffering.findMany({
      where: { offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
      select: { id: true, courseCode: true },
    }),
    prisma.courseBranchMapping.findMany({ select: { id: true, courseId: true, branch: true, batch: true } }),
  ]);

  const courseByCode  = new Map(existingCourses.map((c) => [c.code.toUpperCase(), c.id]));
  const offeringById  = new Map(existingOfferings.map((o) => [o.courseCode.toUpperCase(), o.id]));
  const mappingKey    = (courseId: string, branch: string) => `${courseId}|${branch}|`;
  const existingMapSet = new Set(existingMappings.map((m) => mappingKey(m.courseId, m.branch)));
  console.log(`Loaded: ${existingCourses.length} courses, ${existingOfferings.length} existing offerings, ${existingMappings.length} existing mappings`);

  // ── Step 2: parse all rows ─────────────────────────────────────────────────
  type ParsedRow = {
    code: string; name: string; ltpc: string | null; credits: number;
    instructor: string | null; instructorEmail: string | null;
    school: string | null; slot: string | null;
    branchCatMap: Map<string, CourseCategoryType>;
    allBranches: string[];
    compulsorySem: number | null;
  };

  const parsed: ParsedRow[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const rawCode = String(row[C.CODE] ?? "").trim();
    if (!rawCode || rawCode.includes(" ") || rawCode.includes("|")) { skipped++; continue; }
    const verdict = String((row as any)[2] ?? "").toLowerCase();
    if (verdict.includes("exclude")) { skipped++; continue; }

    const code = rawCode.toUpperCase();
    const name = String(row[C.NAME] ?? "").trim() || code;
    const ltpc = String(row[C.LTPC] ?? "").trim() || null;
    const creditsRaw = parseFloat(String(row[C.CREDITS] ?? ""));
    const credits = isNaN(creditsRaw)
      ? (ltpc ? (parseFloat(ltpc.split("-").pop()!) || 3) : 3)
      : creditsRaw;

    const branchCatMap = new Map<string, CourseCategoryType>();
    for (const [colIdx, cat] of CAT_COLS) {
      for (const b of parseBranches(String(row[colIdx] ?? ""))) {
        if (b) branchCatMap.set(b, cat);
      }
    }
    if (!branchCatMap.size) { skipped++; continue; }

    // Curriculum overrides: Excel sometimes puts CSE in FE for DS/CS courses,
    // but curriculum convention is CSE can take DS-xxx/CS-xxx as DE.
    if (code.startsWith("DS-") && branchCatMap.get("CSE") === CourseCategoryType.FE) {
      branchCatMap.set("CSE", CourseCategoryType.DE);
    }

    parsed.push({
      code,
      name,
      ltpc,
      credits,
      instructor: String(row[C.PROF] ?? "").trim() || null,
      instructorEmail: String(row[C.EMAIL] ?? "").trim() || null,
      school: String(row[C.SCHOOL] ?? "").trim() || null,
      slot: normalizeSlot(String(row[C.SLOT] ?? "")),
      branchCatMap,
      allBranches: [...branchCatMap.keys()],
      compulsorySem: (() => {
        // Explicit override first (IC-202P, IC-222P → sem 3)
        if (IC_SEM_OVERRIDES[code]) return IC_SEM_OVERRIDES[code];
        // Try to extract from DC/IC/ICB columns
        const parsed =
          extractDcSemester(String(row[C.DC]  ?? "")) ??
          extractDcSemester(String(row[C.IC]  ?? "")) ??
          extractDcSemester(String(row[C.ICB] ?? "")) ??
          null;
        // IC courses with no semester annotation → default to sem 1
        const hasIcEntry = String(row[C.IC] ?? "").trim() || String(row[C.ICB] ?? "").trim();
        if (!parsed && hasIcEntry) return 1;
        return parsed;
      })(),
    });
  }
  console.log(`Valid rows: ${parsed.length}, skipped: ${skipped}`);

  // ── Step 3: create missing courses ────────────────────────────────────────
  const newCourses = parsed.filter((p) => !courseByCode.has(p.code));
  if (newCourses.length) {
    await prisma.course.createMany({
      data: newCourses.map((p) => ({
        id: randomUUID(),
        code: p.code,
        name: p.name,
        credits: p.credits,
        department: p.school ?? "Unknown",
        level: 300,
        offeredInFall: true,
        offeredInSpring: false,
        isActive: true,
      })),
      skipDuplicates: true,
    });
    // Reload new IDs
    const fresh = await prisma.course.findMany({
      where: { code: { in: newCourses.map((p) => p.code) } },
      select: { id: true, code: true },
    });
    for (const c of fresh) courseByCode.set(c.code.toUpperCase(), c.id);
    console.log(`Created ${newCourses.length} new courses`);
  }

  // ── Step 4: bulk upsert CourseBranchMapping ────────────────────────────────
  // Collect all mappings to upsert
  const allMappings: { courseId: string; branch: string; category: CourseCategoryType }[] = [];
  for (const p of parsed) {
    const courseId = courseByCode.get(p.code);
    if (!courseId) continue;
    for (const [branch, category] of p.branchCatMap) {
      allMappings.push({ courseId, branch, category });
    }
  }

  // Split into new vs update
  const newMappings  = allMappings.filter((m) => !existingMapSet.has(mappingKey(m.courseId, m.branch)));
  const updMappings  = allMappings.filter((m) =>  existingMapSet.has(mappingKey(m.courseId, m.branch)));

  // Upsert all mappings via raw SQL ON CONFLICT (fastest approach)
  for (const batch of chunk(allMappings, 500)) {
    const now = new Date().toISOString();
    const values = batch
      .map((m) => `('${randomUUID()}','${m.courseId}','${m.branch}','','${m.category}',false,'${now}','${now}')`)
      .join(",");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CourseBranchMapping" (id,"courseId",branch,batch,"courseCategory","isRequired","createdAt","updatedAt")
      VALUES ${values}
      ON CONFLICT ("courseId",branch,batch) DO UPDATE SET "courseCategory"=EXCLUDED."courseCategory","updatedAt"=EXCLUDED."updatedAt"
    `);
  }
  console.log(`Upserted ${allMappings.length} branch mappings`);

  // ── Step 5: bulk upsert CourseOffering ────────────────────────────────────
  const toCreate: typeof parsed = [];
  const toUpdate: typeof parsed = [];

  for (const p of parsed) {
    if (offeringById.has(p.code)) toUpdate.push(p);
    else toCreate.push(p);
  }

  // Create new offerings
  if (toCreate.length) {
    await prisma.courseOffering.createMany({
      data: toCreate.map((p) => ({
        id: randomUUID(),
        courseCode: p.code,
        courseId: courseByCode.get(p.code) ?? null,
        courseName: p.name,
        instructor: p.instructor,
        instructorEmail: p.instructorEmail,
        school: p.school,
        slots: p.slot,
        ltpc: p.ltpc,
        credits: p.credits,
        branches: p.allBranches,
        eligibleSems: computeEligibleSems(p.compulsorySem),
        compulsorySem: p.compulsorySem,
        offeringSemester: OFFERING_SEMESTER,
        offeringYear: OFFERING_YEAR,
        isActive: true,
        categoryOverride: null,
        curriculumLink: null,
      })),
      skipDuplicates: true,
    });
    console.log(`Created ${toCreate.length} new offerings`);
  }

  // Update existing offerings via raw SQL
  for (const batch of chunk(toUpdate, 200)) {
    const now = new Date().toISOString();
    for (const p of batch) {
      const cid = courseByCode.get(p.code);
      const branches = JSON.stringify(p.allBranches).replace(/'/g, "''");
      const eligSems = `ARRAY[${computeEligibleSems(p.compulsorySem).join(",")}]::int[]`;
      await prisma.$executeRawUnsafe(`
        UPDATE "CourseOffering" SET
          "courseId"=${cid ? `'${cid}'` : "NULL"},
          "courseName"='${p.name.replace(/'/g,"''")}',
          "instructor"=${p.instructor ? `'${p.instructor.replace(/'/g,"''")}'` : "NULL"},
          "instructorEmail"=${p.instructorEmail ? `'${p.instructorEmail}'` : "NULL"},
          "school"=${p.school ? `'${p.school}'` : "NULL"},
          "slots"=${p.slot ? `'${p.slot}'` : "NULL"},
          "ltpc"=${p.ltpc ? `'${p.ltpc}'` : "NULL"},
          "credits"=${p.credits},
          "branches"=ARRAY[${p.allBranches.map(b=>`'${b}'`).join(",")}]::text[],
          "eligibleSems"=${eligSems},
          "compulsorySem"=${p.compulsorySem ?? "NULL"},
          "isActive"=true,
          "updatedAt"='${now}'
        WHERE "courseCode"='${p.code}' AND "offeringSemester"=${OFFERING_SEMESTER} AND "offeringYear"=${OFFERING_YEAR}
      `);
    }
  }
  console.log(`Updated ${toUpdate.length} existing offerings`);

  console.log("\n✓ Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
