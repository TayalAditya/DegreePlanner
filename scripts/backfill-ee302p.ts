/**
 * Backfill EE-302P (Control Systems Lab, 1cr DC) for students who have EE-302
 * but are missing the lab. EE-302 was historically a single 4cr curriculum entry;
 * the catalog splits it into EE-302 (3cr theory) + EE-302P (1cr lab), so students
 * who imported only EE-302 came up 1 DC credit short.
 *
 * Scope: EE (b23) + MEVLSI (b24) — matches where curriculum now lists EE-302P as DC.
 * Skips anyone who already has an EE-302P enrollment.
 * Mirrors the matching EE-302 enrollment's semester + status + grade.
 *
 * Run:  npx tsx scripts/backfill-ee302p.ts          (dry run)
 *       npx tsx scripts/backfill-ee302p.ts --apply  (write)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Only backfill students on these branch/batch combos (EE B23, MEVLSI B24).
function inScope(email: string | null, branch: string | null): boolean {
  const batch = (email || "").match(/b(\d{2})/i)?.[1];
  if (branch === "EE" && batch === "23") return true;
  if (branch === "MEVLSI" && batch === "24") return true;
  return false;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const lab = await prisma.course.findFirst({ where: { code: "EE-302P" }, select: { id: true, credits: true } });
  if (!lab) { console.log("ERROR: EE-302P not in catalog — aborting."); return; }

  const ee302 = await prisma.courseEnrollment.findMany({
    where: { course: { code: "EE-302" } },
    select: {
      id: true, userId: true, semester: true, year: true, term: true,
      courseType: true, programId: true, status: true, grade: true,
      user: { select: { name: true, email: true, branch: true } },
    },
  });

  const has302p = new Set(
    (await prisma.courseEnrollment.findMany({
      where: { course: { code: "EE-302P" } },
      select: { userId: true },
    })).map((e) => e.userId)
  );

  let added = 0, skippedHas = 0, skippedScope = 0;
  for (const e of ee302) {
    if (has302p.has(e.userId)) { skippedHas++; continue; }
    if (!inScope(e.user.email, e.user.branch)) {
      console.log(`SKIP(scope) ${(e.user.name || "?").padEnd(20)} ${e.user.email} branch=${e.user.branch}`);
      skippedScope++;
      continue;
    }
    console.log(`ADD  EE-302P -> ${(e.user.name || "?").padEnd(20)} ${e.user.email}  sem${e.semester} ${e.status}${e.grade ? " " + e.grade : ""}`);
    if (APPLY) {
      await prisma.courseEnrollment.create({
        data: {
          userId: e.userId,
          courseId: lab.id,
          semester: e.semester,
          year: e.year,
          term: e.term,
          courseType: e.courseType,
          programId: e.programId,
          status: e.status,
          grade: e.grade,
        },
      });
      added++;
    }
  }

  console.log("\n── Summary ─────────────────────────");
  console.log(`to add:            ${APPLY ? added : ee302.filter((e) => !has302p.has(e.userId) && inScope(e.user.email, e.user.branch)).length}`);
  console.log(`skipped (has 302P):${skippedHas}`);
  console.log(`skipped (scope):   ${skippedScope}`);
  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply to write."}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
