import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';

type SheetObservation = {
  sheet: string;
  row: number;
  rawCode: string;
  rawName: string;
  credits: number;
  sheetPriority: number;
};

type CanonicalCourse = {
  identityKey: string;
  codeExample: string;
  nameExample: string;
  credits: number;
  sources: SheetObservation[];
  conflicts: Array<{ credits: number; count: number; sheets: string[] }>;
};

const prisma = new PrismaClient();

function courseIdentityKey(code: string): string | null {
  const text = String(code ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toUpperCase();

  // Standard course codes: "IC-102P", "IC 102P", "IC102P"
  // Also allow section suffixes from Excel dumps: "BE-203_1", "AR-593_2025_01" -> "BE203", "AR593"
  const standard = text.match(/^([A-Z]{2,4})\s*[- ]?\s*(\d{3})\s*([A-Z])?(?:\s*_\s*\d+)*$/);
  if (standard) {
    const [, prefix, digits, maybeSuffix] = standard;
    return `${prefix}${digits}${maybeSuffix ?? ''}`;
  }

  return null;
}

function identityKeyToDbCode(identityKey: string): string | null {
  const match = identityKey.match(/^([A-Z]{2,4})(\d{3}[A-Z]?)$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function inferDepartmentFromCode(code: string): string {
  const prefixMatch = code.match(/^([A-Z]{2,4})/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  const departmentMap: Record<string, string> = {
    IC: 'Institute Core',
    CS: 'Computer Science',
    EE: 'Electrical Engineering',
    ME: 'Mechanical Engineering',
    CE: 'Civil Engineering',
    BE: 'Bioengineering',
    EP: 'Engineering Physics',
    MA: 'Mathematics',
    MT: 'Materials Science',
    DS: 'Data Science',
    CY: 'Chemical Sciences',
    PH: 'Physics',
    VL: 'Microelectronics and VLSI',
    AR: 'General Engineering',
    HS: 'Humanities & Social Sciences',
    IK: 'Indian Knowledge System',
    BY: 'Bioengineering',
  };

  return departmentMap[prefix] || 'General';
}

function inferLevelFromCode(code: string): number {
  const numMatch = code.match(/\d{3}/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 100;
  if (num >= 500) return 500;
  if (num >= 400) return 400;
  if (num >= 300) return 300;
  if (num >= 200) return 200;
  return 100;
}

function getSheetPriority(sheetName: string): number {
  // Prefer latest academic year if conflicts occur.
  // Order: 2025-26 > 2024-25 > 2023-24 > unknown
  const match = sheetName.match(/(20\d{2})-(\d{2})/);
  if (!match) return 0;
  const startYear = parseInt(match[1], 10);
  const endYear = 2000 + parseInt(match[2], 10);
  // Map to a comparable number (e.g., 2025-2026 => 202526)
  return startYear * 1000 + endYear;
}

function parseCreditsCell(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const str = String(value).trim();
  if (!str) return null;

  // Common format: "3-0-2-4" or "3 - 0 - 2 - 4"
  const match = str.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/,
  );
  if (match) {
    const total = Number.parseFloat(match[4]);
    return Number.isFinite(total) ? total : null;
  }

  // Sometimes the sheet uses plain totals like "4"
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    const total = Number.parseFloat(str);
    return Number.isFinite(total) ? total : null;
  }

  return null;
}

function isIntegerLike(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

function findHeaderRow(rows: any[][]): { headerRowIndex: number; headers: string[] } | null {
  const scanLimit = Math.min(rows.length, 30);
  let best: { idx: number; score: number; headers: string[] } | null = null;

  for (let i = 0; i < scanLimit; i++) {
    const raw = rows[i] || [];
    const headers = raw.map((c) => String(c ?? '').trim());
    const lowered = headers.map((h) => h.toLowerCase());

    const hasCode =
      lowered.some((h) => h.includes('course code')) ||
      lowered.some((h) => h.includes('course no')) ||
      lowered.some((h) => h === 'code') ||
      lowered.some((h) => h.includes('course code'));

    const hasName =
      lowered.some((h) => h.includes('course name')) ||
      lowered.some((h) => h.includes('course title')) ||
      lowered.some((h) => h === 'title') ||
      lowered.some((h) => h.includes('title'));

    const hasCredit =
      lowered.some((h) => h.includes('l-t-p-c')) ||
      lowered.some((h) => h === 'credit') ||
      lowered.some((h) => h.includes('credit'));

    const score = (hasCode ? 2 : 0) + (hasName ? 1 : 0) + (hasCredit ? 2 : 0);
    if (score < 4) continue; // Need at least code + credits

    if (!best || score > best.score) {
      best = { idx: i, score, headers };
    }
  }

  return best ? { headerRowIndex: best.idx, headers: best.headers } : null;
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  const lowered = headers.map((h) => h.toLowerCase());
  for (const pattern of patterns) {
    const idx = lowered.findIndex((h) => pattern.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildCanonicalCourses(observations: SheetObservation[]): CanonicalCourse[] {
  const byKey = new Map<string, SheetObservation[]>();
  for (const obs of observations) {
    const key = courseIdentityKey(obs.rawCode);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(obs);
    byKey.set(key, list);
  }

  const canonical: CanonicalCourse[] = [];

  for (const [key, obsList] of byKey.entries()) {
    const creditCounts = new Map<number, { count: number; sheets: Set<string>; topPriority: number }>();
    for (const obs of obsList) {
      const existing = creditCounts.get(obs.credits) ?? {
        count: 0,
        sheets: new Set<string>(),
        topPriority: 0,
      };
      existing.count += 1;
      existing.sheets.add(obs.sheet);
      existing.topPriority = Math.max(existing.topPriority, obs.sheetPriority);
      creditCounts.set(obs.credits, existing);
    }

    const creditOptions = Array.from(creditCounts.entries()).map(([credits, info]) => ({
      credits,
      count: info.count,
      topPriority: info.topPriority,
      sheets: Array.from(info.sheets.values()),
    }));

    creditOptions.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.topPriority !== a.topPriority) return b.topPriority - a.topPriority;
      return b.credits - a.credits;
    });

    const chosen = creditOptions[0];

    const bestNameSource =
      obsList
        .filter((o) => o.rawName && o.rawName.trim().length > 0)
        .sort((a, b) => b.sheetPriority - a.sheetPriority)[0] ?? obsList[0];

    canonical.push({
      identityKey: key,
      codeExample: bestNameSource?.rawCode ?? key,
      nameExample: bestNameSource?.rawName ?? '',
      credits: chosen.credits,
      sources: obsList,
      conflicts: creditOptions
        .filter((o) => o.credits !== chosen.credits)
        .map((o) => ({ credits: o.credits, count: o.count, sheets: o.sheets })),
    });
  }

  return canonical;
}

function cleanCourseDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const trimmed = description.trim();
  if (!trimmed) return null;

  // Remove metadata-like descriptions that leak instructor/slot details.
  const looksLikeMetadata =
    /^instructors?:/i.test(trimmed) ||
    /^extracted from excel/i.test(trimmed) ||
    /timetable\s*slot/i.test(trimmed) ||
    /labslot/i.test(trimmed);

  if (looksLikeMetadata) return null;

  // If description contains an "Instructors:" segment, strip it.
  const stripped = trimmed
    .replace(/instructors?:\s*[^|]+(\|\s*)?/gi, '')
    .replace(/timetable\s*slot\s*[:=]\s*[^|]+(\|\s*)?/gi, '')
    .replace(/labslot\s*[:=]\s*[^|]+(\|\s*)?/gi, '')
    .replace(/\|\s*category\s*:\s*[^|]+/gi, '')
    .replace(/\s+\|\s+/g, ' | ')
    .trim();

  return stripped.length > 0 ? stripped : null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const createMissing = args.has('--create-missing');
  const dryRun = !apply || args.has('--dry-run');

  const excelPath = path.join(process.cwd(), 'docs', 'Course List semester wise.xlsx');
  const workbook = XLSX.readFile(excelPath);

  const observations: SheetObservation[] = [];
  const parseIssues: Array<{ sheet: string; row: number; reason: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' }) as any[][];
    if (!rows || rows.length === 0) continue;

    const headerInfo = findHeaderRow(rows);
    if (!headerInfo) {
      parseIssues.push({ sheet: sheetName, row: 1, reason: 'Could not detect header row' });
      continue;
    }

    const { headerRowIndex, headers } = headerInfo;
    const codeIdx = findColumnIndex(headers, [/course\s*(code|no)/i, /^code$/i]);
    const nameIdx = findColumnIndex(headers, [/course\s*(name|title)/i, /^title$/i]);
    const creditsIdx = findColumnIndex(headers, [/l-t-p-c/i, /^credit$/i, /credits?/i]);

    if (codeIdx === -1 || creditsIdx === -1) {
      parseIssues.push({
        sheet: sheetName,
        row: headerRowIndex + 1,
        reason: `Missing required columns (codeIdx=${codeIdx}, creditsIdx=${creditsIdx})`,
      });
      continue;
    }

    const priority = getSheetPriority(sheetName);

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawCode = String(row[codeIdx] ?? '').trim();
      if (!rawCode) continue;

      const rawName = nameIdx !== -1 ? String(row[nameIdx] ?? '').trim() : '';
      const creditsRaw = row[creditsIdx];
      const credits = parseCreditsCell(creditsRaw);

      if (credits === null) {
        parseIssues.push({ sheet: sheetName, row: r + 1, reason: `Unparseable credits: "${String(creditsRaw)}"` });
        continue;
      }

      if (!Number.isFinite(credits) || credits <= 0) continue;
      if (!isIntegerLike(credits)) {
        parseIssues.push({ sheet: sheetName, row: r + 1, reason: `Non-integer credits: ${credits}` });
        continue;
      }

      observations.push({
        sheet: sheetName,
        row: r + 1,
        rawCode,
        rawName,
        credits: Math.round(credits),
        sheetPriority: priority,
      });
    }
  }

  const canonicalCourses = buildCanonicalCourses(observations);

  console.log('\n📚 Excel course credits extracted');
  console.log(`- Sheets scanned: ${workbook.SheetNames.length}`);
  console.log(`- Observations: ${observations.length}`);
  console.log(`- Unique codes: ${canonicalCourses.length}`);
  console.log(`- Parse issues: ${parseIssues.length}`);

  const conflicts = canonicalCourses.filter((c) => c.conflicts.length > 0);
  console.log(`- Credit conflicts: ${conflicts.length}\n`);

  if (conflicts.length > 0) {
    console.log('⚠️  Sample conflicts (showing up to 10):');
    conflicts.slice(0, 10).forEach((c) => {
      const details = [
        `${c.credits} (chosen)`,
        ...c.conflicts.map((x) => `${x.credits} (${x.count}x in ${x.sheets.join(', ')})`),
      ].join(' | ');
      console.log(`- ${c.codeExample} → ${details}`);
    });
    console.log('');
  }

  // Load DB courses once for fast matching
  const dbCourses = await prisma.course.findMany({
    select: { id: true, code: true, name: true, credits: true, description: true },
  });

  const dbByKey = new Map<
    string,
    Array<{ id: string; code: string; name: string; credits: number; description: string | null }>
  >();
  for (const c of dbCourses) {
    const key = courseIdentityKey(c.code);
    if (!key) continue;
    const list = dbByKey.get(key) ?? [];
    list.push({ id: c.id, code: c.code, name: c.name, credits: c.credits, description: c.description });
    dbByKey.set(key, list);
  }

  let missingInDb = 0;
  let createdMissing = 0;
  let creditMatches = 0;
  let creditMismatches = 0;
  let descriptionsCleaned = 0;

  const updates: Array<{
    id: string;
    code: string;
    fromCredits: number;
    toCredits: number;
    cleanDescriptionTo: string | null;
    cleanDescriptionFrom: string | null;
  }> = [];

  for (const excelCourse of canonicalCourses) {
    const matches = dbByKey.get(excelCourse.identityKey);
    if (!matches || matches.length === 0) {
      missingInDb++;

      const dbCode = identityKeyToDbCode(excelCourse.identityKey);
      if (!dbCode) continue;

      if (!dryRun && createMissing) {
        const department = inferDepartmentFromCode(dbCode);
        const level = inferLevelFromCode(dbCode);
        const safeName = excelCourse.nameExample?.trim() || dbCode;

        const created = await prisma.course.upsert({
          where: { code: dbCode },
          update: {
            credits: excelCourse.credits,
            name: safeName,
            department,
            level,
            description: null,
          },
          create: {
            code: dbCode,
            name: safeName,
            credits: excelCourse.credits,
            department,
            level,
            description: null,
            isActive: true,
            offeredInFall: true,
            offeredInSpring: true,
            offeredInSummer: false,
            isPassFailEligible: false,
            isBranchSpecific: false,
            requiredBranches: [],
          },
        });

        const list = dbByKey.get(excelCourse.identityKey) ?? [];
        list.push({
          id: created.id,
          code: created.code,
          name: created.name,
          credits: created.credits,
          description: created.description,
        });
        dbByKey.set(excelCourse.identityKey, list);

        createdMissing++;
      }

      continue;
    }

    for (const dbCourse of matches) {
      const creditsSame = dbCourse.credits === excelCourse.credits;
      const cleaned = cleanCourseDescription(dbCourse.description);
      const descriptionChanged = (dbCourse.description ?? null) !== cleaned;

      if (creditsSame) creditMatches++;
      else creditMismatches++;

      if (!creditsSame || descriptionChanged) {
        if (descriptionChanged) descriptionsCleaned++;
        updates.push({
          id: dbCourse.id,
          code: dbCourse.code,
          fromCredits: dbCourse.credits,
          toCredits: excelCourse.credits,
          cleanDescriptionFrom: dbCourse.description ?? null,
          cleanDescriptionTo: cleaned,
        });
      }
    }
  }

  console.log('🗄️  Database comparison');
  console.log(`- DB courses loaded: ${dbCourses.length}`);
  console.log(`- Excel codes missing in DB: ${missingInDb}`);
  console.log(`- Credit matches: ${creditMatches}`);
  console.log(`- Credit mismatches: ${creditMismatches}`);
  console.log(`- Descriptions cleaned: ${descriptionsCleaned}`);
  console.log(`- Updates to apply: ${updates.length}`);
  console.log(`- Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'APPLY (DB will be updated)'}\n`);

  if (updates.length > 0) {
    console.log('🔍 Sample updates (up to 15):');
    updates.slice(0, 15).forEach((u) => {
      const creditPart = u.fromCredits === u.toCredits ? '' : `credits ${u.fromCredits} → ${u.toCredits}`;
      const descPart = u.cleanDescriptionFrom !== u.cleanDescriptionTo ? 'description cleaned' : '';
      const parts = [creditPart, descPart].filter(Boolean).join(', ');
      console.log(`- ${u.code}: ${parts}`);
    });
    console.log('');
  }

  if (!dryRun) {
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await prisma.$transaction(
        chunk.map((u) =>
          prisma.course.update({
            where: { id: u.id },
            data: {
              credits: u.toCredits,
              description: u.cleanDescriptionTo,
            },
          }),
        ),
      );
    }

    console.log(`✅ Applied ${updates.length} updates to the database.`);
  } else {
    console.log('ℹ️  Dry run complete. Re-run with `--apply` to update the DB.');
  }
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
