import fs from "fs";
import path from "path";
import { PrismaClient, CourseCategoryType } from "@prisma/client";
import * as XLSX from "xlsx";

const pdfParse = require("pdf-parse") as (data: Buffer) => Promise<{ text: string }>;

type CourseIndexEntry = {
  id: string;
  code: string;
  name: string;
  credits: number;
};

type ExistingMapping = {
  courseId: string;
  branch: string;
  courseCategory: CourseCategoryType;
};

type ManualCourseDefinition = {
  courseKey: string; // identity key, e.g. "MA251"
  code: string; // canonical stored code, e.g. "MA-251"
  name: string;
  credits: number;
  department: string;
  level: number;
};

const PROTECTED_CATEGORIES = new Set<CourseCategoryType>([
  CourseCategoryType.DC,
  CourseCategoryType.IC,
  CourseCategoryType.IC_BASKET,
]);

const EXCLUDED_COURSE_KEYS = new Set<string>([
  // Requested: skip Biofluid Dynamics (ME-527) from BioE DE list.
  "ME527",
]);

const DSE_BRANCH_ALIASES = ["DSE", "DS"] as const;
const BIOE_BRANCH_ALIASES = ["BE", "BIO"] as const;

function courseIdentityKey(code: string): string {
  const text = String(code ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase();

  const standard = text.match(
    /^([A-Z]{2,4})\s*[- ]?\s*(\d{3})\s*([A-Z])?(?:\s*_\s*(\d{1,2}))?$/
  );
  if (standard) {
    const [, prefix, digits, maybeSuffix] = standard;
    return `${prefix}${digits}${maybeSuffix ?? ""}`;
  }

  return text.replace(/[^A-Z0-9]/g, "");
}

function scoreCodeRepresentation(code: string): number {
  const c = String(code ?? "").trim();
  const upper = c.toUpperCase();
  const hasUnderscore = c.includes("_");
  const hasSpace = /\s/.test(c);
  const hyphenated = /^[A-Z]{2,4}-\d{3}[A-Z]?$/.test(upper);
  if (hasUnderscore || hasSpace) return 0;
  if (hyphenated) return 2;
  return 1;
}

function hyphenateCourseKey(key: string): string | null {
  const match = key.match(/^([A-Z]{2,4})(\d{3})([A-Z])?$/);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  return `${prefix}-${digits}${suffix ?? ""}`;
}

function buildCourseIndex(courses: CourseIndexEntry[]) {
  const bestByKey = new Map<string, CourseIndexEntry>();

  for (const course of courses) {
    const key = courseIdentityKey(course.code);
    const existing = bestByKey.get(key);
    if (!existing || scoreCodeRepresentation(course.code) > scoreCodeRepresentation(existing.code)) {
      bestByKey.set(key, course);
    }
  }

  return bestByKey;
}

function extractCourseCodesFromCell(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text === "---") return [];
  if (/^NOTE\s*:/i.test(text)) return [];

  const matches = text.matchAll(/([A-Z]{2,4})\s*[- ]?\s*(\d{3})([A-Z])?/gi);
  const codes: string[] = [];
  for (const match of matches) {
    const prefix = match[1].toUpperCase();
    const digits = match[2];
    const suffix = (match[3] || "").toUpperCase();
    const raw = `${prefix}${digits}${suffix}`;
    if (raw.includes("XXX")) continue;
    codes.push(raw);
  }
  return Array.from(new Set(codes));
}

async function readDseDeCodesFromXlsx(filePath: string): Promise<string[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];

  const codes = new Set<string>();
  for (const row of rows.slice(1)) {
    const cells = row.slice(2);
    for (const cell of cells) {
      for (const code of extractCourseCodesFromCell(cell)) {
        codes.add(code);
      }
    }
  }

  return Array.from(codes);
}

async function readPdfText(filePath: string): Promise<string> {
  const data = await pdfParse(fs.readFileSync(filePath));
  return data.text || "";
}

function extractSection(text: string, startMarker: RegExp, endMarker: RegExp): string {
  const startMatch = text.match(startMarker);
  if (!startMatch?.index && startMatch?.index !== 0) return "";
  const startIndex = startMatch.index;
  const tail = text.slice(startIndex);
  const endMatch = tail.match(endMarker);
  const endIndex = endMatch?.index ?? tail.length;
  return tail.slice(0, endIndex);
}

function extractCourseCodesFromTextBlock(text: string): string[] {
  const codes = new Set<string>();
  const matches = text.matchAll(/([A-Z]{2,4})\s*[- ]?\s*(\d{3})([A-Z])?/g);
  for (const match of matches) {
    const prefix = match[1].toUpperCase();
    const digits = match[2];
    const suffix = (match[3] || "").toUpperCase();
    const raw = `${prefix}${digits}${suffix}`;
    if (raw.includes("XXX")) continue;
    codes.add(raw);
  }
  return Array.from(codes);
}

function parseMncCodesFromCompiledPdf(
  text: string,
  courseIndex: Map<string, CourseIndexEntry>,
  startPhrase: string,
  endPhrase: string
): string[] {
  const start = text.toLowerCase().indexOf(startPhrase.toLowerCase());
  if (start < 0) return [];
  const end = text.toLowerCase().indexOf(endPhrase.toLowerCase(), start);
  const section = text.slice(start, end > 0 ? end : undefined);

  const found = new Set<string>();
  const matches = section.matchAll(/([A-Z]{2,4})\s*[- ]?\s*(\d{3})(P)?/g);

  for (const match of matches) {
    const prefix = match[1].toUpperCase();
    const digits = match[2];
    const maybeP = match[3] ? "P" : "";

    const baseKey = `${prefix}${digits}`;
    const pKey = `${prefix}${digits}P`;

    // Validate against existing course codes to avoid false positives like "CS669P" from "CS669Pattern...".
    const pickedKey =
      maybeP && courseIndex.has(pKey) ? pKey :
      courseIndex.has(baseKey) ? baseKey :
      courseIndex.has(pKey) ? pKey :
      null;

    if (!pickedKey) continue;
    found.add(pickedKey);
  }

  return Array.from(found);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const createMissingCourses = args.has("--create-missing-courses");

  const prisma = new PrismaClient();

  try {
    const docsDir = path.join(process.cwd(), "docs");
    const dseXlsxPath = path.join(docsDir, "DSE DE.xlsx");
    const bioePdfPath = path.join(docsDir, "BioE DE.pdf");
    const compiledPdfPath = path.join(docsDir, "Compiled UG curriculum.pdf");

    const courses = await prisma.course.findMany({
      select: { id: true, code: true, name: true, credits: true },
    });
    const courseIndex = buildCourseIndex(courses);

    const existingMappings = await prisma.courseBranchMapping.findMany({
      where: { branch: { in: ["DSE", "DS", "BE", "BIO", "MNC", "ME", "MSE", "GE-ROBO", "GE-COMM"] } },
      select: { courseId: true, branch: true, courseCategory: true },
    });
    const existingByKey = new Map<string, ExistingMapping>();
    for (const m of existingMappings) {
      existingByKey.set(`${m.courseId}:${m.branch}`, m);
    }

    const desired: Array<{
      branch: string;
      courseKey: string; // identity key (e.g. CS208, CE352P)
      category: CourseCategoryType;
      source: string;
    }> = [];

    // MNC curriculum extras (from user-provided basket definitions)
    const manualCourses: ManualCourseDefinition[] = [
      // Discipline Elective Basket I: Foundation Module
      { courseKey: "MA251", code: "MA-251", name: "Abstract Algebra", credits: 3, department: "Mathematics", level: 200 },
      { courseKey: "MA252", code: "MA-252", name: "Functional analysis", credits: 3, department: "Mathematics", level: 200 },
      { courseKey: "MA253", code: "MA-253", name: "Measure Theory", credits: 3, department: "Mathematics", level: 200 },
      { courseKey: "MA254", code: "MA-254", name: "Topology", credits: 3, department: "Mathematics", level: 200 },
      { courseKey: "MA255", code: "MA-255", name: "Number Theory", credits: 3, department: "Mathematics", level: 200 },

      // Discipline Elective Basket II: Advance Modelling Module
      { courseKey: "MA351", code: "MA-351", name: "Climate Modelling", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA352", code: "MA-352", name: "Computational Financial Modelling & Lab", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA353", code: "MA-353", name: "Modelling of infectious disease", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA354", code: "MA-354", name: "Mathematical Image Processing", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA355", code: "MA-355", name: "Mathematical Control Theory", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA356", code: "MA-356", name: "Modelling and Simulation", credits: 3, department: "Mathematics", level: 300 },
      { courseKey: "MA357", code: "MA-357", name: "Modelling Population Dynamics", credits: 3, department: "Mathematics", level: 300 },
    ];
    const manualByKey = new Map(manualCourses.map((c) => [c.courseKey, c]));

    // DSE discipline electives (from XLSX)
    if (fs.existsSync(dseXlsxPath)) {
      const rawCodes = await readDseDeCodesFromXlsx(dseXlsxPath);
      for (const raw of rawCodes) {
        const courseKey = courseIdentityKey(raw);
        if (EXCLUDED_COURSE_KEYS.has(courseKey)) continue;

        for (const branch of DSE_BRANCH_ALIASES) {
          desired.push({
            branch,
            courseKey,
            category: CourseCategoryType.DE,
            source: "docs/DSE DE.xlsx",
          });
        }
      }
    } else {
      console.warn(`⚠️  Missing: ${dseXlsxPath}`);
    }

    // BioE: core (DC) + DE list (from PDF)
    if (fs.existsSync(bioePdfPath)) {
      const pdfText = await readPdfText(bioePdfPath);
      const coreBlock = extractSection(pdfText, /Table 5:/i, /Table 6:/i);
      const electiveBlock = extractSection(pdfText, /Table 6:/i, /\n\s*$/);

      const bioeCore = extractCourseCodesFromTextBlock(coreBlock).filter((c) =>
        c.toUpperCase().startsWith("BE")
      );
      const bioeDe = extractCourseCodesFromTextBlock(electiveBlock);

      const coreKeys = new Set(bioeCore.map((c) => courseIdentityKey(c)));

      for (const code of bioeCore) {
        const courseKey = courseIdentityKey(code);
        if (EXCLUDED_COURSE_KEYS.has(courseKey)) continue;

        for (const branch of BIOE_BRANCH_ALIASES) {
          desired.push({
            branch,
            courseKey,
            category: CourseCategoryType.DC,
            source: "docs/BioE DE.pdf (Table 5)",
          });
        }
      }

      for (const code of bioeDe) {
        const courseKey = courseIdentityKey(code);
        if (EXCLUDED_COURSE_KEYS.has(courseKey)) continue;

        for (const branch of BIOE_BRANCH_ALIASES) {
          desired.push({
            branch,
            courseKey,
            category: CourseCategoryType.DE,
            source: "docs/BioE DE.pdf (Table 6)",
          });
        }
      }

      // Rule from PDF: any non-core BE/BY course of level 3+ counts as DE for Bioengineering.
      for (const course of courses) {
        const key = courseIdentityKey(course.code);
        if (EXCLUDED_COURSE_KEYS.has(key)) continue;

        const match = key.match(/^([A-Z]{2,3})(\d{3})/);
        if (!match) continue;
        const prefix = match[1];
        const num = Number(match[2]);
        if (Number.isNaN(num) || num < 300) continue;
        if (prefix !== "BE" && prefix !== "BY") continue;
        if (prefix === "BE" && coreKeys.has(key)) continue;

        for (const branch of BIOE_BRANCH_ALIASES) {
          desired.push({
            branch,
            courseKey: key,
            category: CourseCategoryType.DE,
            source: "docs/BioE DE.pdf (BEXXX/BYXXX rule)",
          });
        }
      }
    } else {
      console.warn(`⚠️  Missing: ${bioePdfPath}`);
    }

    // MNC: course mappings from compiled curriculum PDF (DE list) + (partial) core list.
    if (fs.existsSync(compiledPdfPath)) {
      const compiledText = await readPdfText(compiledPdfPath);

      const mncDeKeys = parseMncCodesFromCompiledPdf(
        compiledText,
        courseIndex,
        "Maths and Computing - Discipline Electives",
        "Bachelor of Technology - Mechanical Engineering"
      );
      for (const k of mncDeKeys) {
        desired.push({
          branch: "MNC",
          courseKey: k,
          category: CourseCategoryType.DE,
          source: "docs/Compiled UG curriculum.pdf (MNC DE list)",
        });
      }

      const mncCoreKeys = parseMncCodesFromCompiledPdf(
        compiledText,
        courseIndex,
        "Maths and Computing Core Courses",
        "Table 87"
      );
      for (const k of mncCoreKeys) {
        desired.push({
          branch: "MNC",
          courseKey: k,
          category: CourseCategoryType.DC,
          source: "docs/Compiled UG curriculum.pdf (MNC core list)",
        });
      }
    } else {
      console.warn(`⚠️  Missing: ${compiledPdfPath}`);
    }

    // Always include the basket course mappings for MNC (create the Course rows if requested).
    for (const course of manualCourses) {
      if (EXCLUDED_COURSE_KEYS.has(course.courseKey)) continue;
      desired.push({
        branch: "MNC",
        courseKey: course.courseKey,
        category: CourseCategoryType.DE,
        source: "MNC DE baskets (manual list)",
      });
    }

    // IC basket edge cases: some IC-basket-coded courses are actually DC for specific branches.
    // (Ref: lib/defaultCurriculum.ts)
    const icBasketOverrides: Array<{
      branch: string;
      courseKey: string;
      category: CourseCategoryType;
      source: string;
    }> = [
      { branch: "MSE", courseKey: "IC240", category: CourseCategoryType.DC, source: "defaultCurriculum: MSE treats IC-240 as DC" },
      { branch: "ME", courseKey: "IC241", category: CourseCategoryType.DC, source: "defaultCurriculum: ME treats IC-241 as DC" },
      { branch: "GE-ROBO", courseKey: "IC241", category: CourseCategoryType.DC, source: "defaultCurriculum: GE-ROBO treats IC-241 as DC" },
      { branch: "GE-ROBO", courseKey: "IC253", category: CourseCategoryType.DC, source: "defaultCurriculum: GE-ROBO treats IC-253 as DC" },
    ];
    for (const entry of icBasketOverrides) desired.push(entry);

    // MNC: default rule — treat all MA-XXX* courses as DE unless explicitly mapped as DC/DE elsewhere.
    for (const courseKey of courseIndex.keys()) {
      if (!/^MA\d{3}[A-Z]?$/.test(courseKey)) continue;
      desired.push({
        branch: "MNC",
        courseKey,
        category: CourseCategoryType.DE,
        source: "MNC rule: MA-XXX* => DE (fallback)",
      });
    }

    // De-dupe desired mappings: last one wins (DC should generally override DE)
    const desiredByBranchAndKey = new Map<string, (typeof desired)[number]>();
    const precedence: Record<CourseCategoryType, number> = {
      IC: 100,
      IC_BASKET: 90,
      DC: 80,
      HSS: 70,
      IKS: 60,
      DE: 50,
      FE: 40,
      MTP: 30,
      ISTP: 20,
      INTERNSHIP: 10,
      BACKLOG: 5,
      NA: 0,
    };

    for (const d of desired) {
      const mapKey = `${d.branch}:${d.courseKey}`;
      const existing = desiredByBranchAndKey.get(mapKey);
      if (!existing || precedence[d.category] > precedence[existing.category]) {
        desiredByBranchAndKey.set(mapKey, d);
      }
    }

    let created = 0;
    let updated = 0;
    let skippedProtected = 0;
    let skippedSame = 0;
    const missing: Array<{ branch: string; courseKey: string; category: CourseCategoryType; source: string }> = [];

    const entries = Array.from(desiredByBranchAndKey.values());
    entries.sort((a, b) => a.branch.localeCompare(b.branch) || a.courseKey.localeCompare(b.courseKey));

    for (const entry of entries) {
      let course = courseIndex.get(entry.courseKey);

      if (!course && createMissingCourses) {
        const def = manualByKey.get(entry.courseKey);
        if (def) {
          const canonical = hyphenateCourseKey(def.courseKey) || def.code;
          if (!dryRun) {
            const createdCourse = await prisma.course.create({
              data: {
                code: canonical,
                name: def.name,
                credits: def.credits,
                department: def.department,
                level: def.level,
                offeredInFall: true,
                offeredInSpring: true,
                offeredInSummer: false,
                isActive: true,
              },
            });
            course = {
              id: createdCourse.id,
              code: createdCourse.code,
              name: createdCourse.name,
              credits: createdCourse.credits,
            };
            courseIndex.set(entry.courseKey, course);
          } else {
            course = {
              id: "(dry-run)",
              code: canonical,
              name: def.name,
              credits: def.credits,
            };
          }
        }
      }

      if (!course || course.id === "(dry-run)") {
        missing.push(entry);
        continue;
      }

      const key = `${course.id}:${entry.branch}`;
      const existing = existingByKey.get(key);

      if (existing) {
        if (existing.courseCategory === entry.category) {
          skippedSame++;
          continue;
        }

        if (PROTECTED_CATEGORIES.has(existing.courseCategory) && !PROTECTED_CATEGORIES.has(entry.category)) {
          skippedProtected++;
          continue;
        }

        if (!dryRun) {
          await prisma.courseBranchMapping.updateMany({
            where: { courseId: course.id, branch: entry.branch },
            data: { courseCategory: entry.category },
          });
        }

        existingByKey.set(key, {
          courseId: course.id,
          branch: entry.branch,
          courseCategory: entry.category,
        });
        updated++;
      } else {
        if (!dryRun) {
          await prisma.courseBranchMapping.create({
            data: {
              courseId: course.id,
              branch: entry.branch,
              courseCategory: entry.category,
            },
          });
        }

        existingByKey.set(key, {
          courseId: course.id,
          branch: entry.branch,
          courseCategory: entry.category,
        });
        created++;
      }
    }

    const header = dryRun ? "DRY RUN" : "APPLIED";
    console.log(`\n✅ ${header}: CourseBranchMapping updates\n`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (same): ${skippedSame}`);
    console.log(`Skipped (protected existing IC/DC): ${skippedProtected}`);
    console.log(`Missing courses in DB: ${missing.length}`);
    if (!dryRun && createMissingCourses) {
      console.log("Created missing courses: enabled");
    }

    if (missing.length > 0) {
      console.log("\nMissing (no matching Course row found):");
      for (const m of missing.slice(0, 80)) {
        console.log(`- [${m.branch}] ${m.courseKey} -> ${m.category} (${m.source})`);
      }
      if (missing.length > 80) console.log(`...and ${missing.length - 80} more`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exitCode = 1;
});
