/**
 * Add GE-592 "Special Topics in Innovation and Intellectual Property Rights"
 * (1cr, 1-0-0-1, odd semester) to BOTH:
 *   1. Course catalog (Course table)
 *   2. Course mapping list (CourseBranchMapping) — FE for every branch,
 *      mirroring the GE-501 template (16 branches, category FE).
 *
 * Also backfills the missing branch mappings for IK-591_E26 (added earlier as
 * catalog-only): IKS for every branch, mirroring IK-101.
 *
 * Run:  npx tsx scripts/add-ge592-sanskrit-grammar.ts          (dry run)
 *       npx tsx scripts/add-ge592-sanskrit-grammar.ts --apply  (write)
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Full branch list used by GE-501 (FE) and IK-101 (IKS).
const ALL_BRANCHES = [
  "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE", "EP", "MSE", "MNC",
  "MEVLSI", "GE", "GE-MECH", "GE-COMM", "GE-ROBO", "BSCS",
];

async function ensureCourse(opts: {
  code: string; name: string; credits: number; department: string;
  level: number; ltpc: string | null; oddSem: boolean;
}) {
  const existing = await prisma.course.findFirst({ where: { code: opts.code }, select: { id: true } });
  if (existing) {
    console.log(`CATALOG  SKIP  ${opts.code} already exists`);
    return existing.id;
  }
  console.log(`CATALOG  ADD   ${opts.code.padEnd(12)} ${opts.name} [${opts.credits}cr, ${opts.ltpc}, ${opts.oddSem ? "odd/fall" : "even/spring"}]`);
  if (!APPLY) return "DRY_RUN_ID";
  const c = await prisma.course.create({
    data: {
      code: opts.code, name: opts.name, credits: opts.credits,
      department: opts.department, level: opts.level, ltpc: opts.ltpc,
      offeredInFall: opts.oddSem, offeredInSpring: !opts.oddSem,
      isActive: true,
    },
    select: { id: true },
  });
  return c.id;
}

async function ensureMappings(courseId: string, code: string, category: CourseCategoryType) {
  if (!APPLY || courseId === "DRY_RUN_ID") {
    console.log(`MAPPING  would ensure ${ALL_BRANCHES.length} × ${category} for ${code} (${ALL_BRANCHES.join(", ")})`);
    return;
  }
  let added = 0, skipped = 0;
  for (const branch of ALL_BRANCHES) {
    const res = await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId, branch, batch: "" } },
      update: {}, // don't clobber an existing category
      create: { courseId, branch, batch: "", courseCategory: category, semester: null },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) added++; else skipped++;
  }
  console.log(`MAPPING  ${code}: +${added} added, ${skipped} already present (${category})`);
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  // 1. GE-592 — catalog + FE mappings
  const geId = await ensureCourse({
    code: "GE-592", name: "Special Topics in Innovation and Intellectual Property Rights", credits: 1,
    department: "GE", level: 500, ltpc: "1-0-0-1", oddSem: true,
  });
  await ensureMappings(geId, "GE-592", CourseCategoryType.FE);

  console.log("");

  // 2. Backfill IK-591_E26 missing mappings (IKS for every branch)
  const ikId = await ensureCourse({
    code: "IK-591_E26", name: "Sanskrit Grammar", credits: 1,
    department: "IK", level: 500, ltpc: "1-0-0-1", oddSem: false,
  });
  await ensureMappings(ikId, "IK-591_E26", CourseCategoryType.IKS);

  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply to write."}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
